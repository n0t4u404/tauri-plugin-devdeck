use std::collections::{HashMap, HashSet, VecDeque};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tauri::{AppHandle, Manager, Runtime};

use crate::WINDOW_LABEL;

const SAMPLE_INTERVAL: Duration = Duration::from_secs(1);
const RECORD_INTERVAL: Duration = Duration::from_millis(250);
const MAX_RECORD_SAMPLES: usize = 4 * 60 * 10;
const HISTORY: usize = 300;
const RECORDINGS_DIR: &str = "devdeck-recordings";
const LOG_FILE: &str = "devdeck.jsonl";
const MAX_LOG_BYTES: u64 = 4 * 1024 * 1024;

static SAMPLES: Mutex<VecDeque<Value>> = Mutex::new(VecDeque::new());
static IS_SAMPLING: AtomicBool = AtomicBool::new(false);
static PAGE_REPORT: Mutex<Option<Value>> = Mutex::new(None);
static RECORDING: Mutex<Option<Recording>> = Mutex::new(None);

struct Recording {
    started: u64,
    samples: Vec<Value>
}

pub fn set_page_report(report: Value) {
    *PAGE_REPORT.lock().unwrap() = Some(report);
}

pub fn samples_json() -> Vec<u8> {
    let samples = SAMPLES.lock().unwrap();
    serde_json::to_vec(&*samples).unwrap_or_else(|_| b"[]".to_vec())
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |time| time.as_millis() as u64)
}

pub fn recording_json() -> Vec<u8> {
    let recording = RECORDING.lock().unwrap();
    let status = match &*recording {
        Some(recording) => json!({ "isRecording": true, "started": recording.started, "samples": recording.samples.len() }),
        None => json!({ "isRecording": false })
    };
    status.to_string().into_bytes()
}

pub fn start_recording() {
    let mut recording = RECORDING.lock().unwrap();
    if recording.is_none() {
        *recording = Some(Recording { started: now(), samples: Vec::new() });
    }
}

pub fn stop_recording<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    let recording = RECORDING.lock().unwrap().take().ok_or("not recording")?;
    let stopped = now();
    let samples = recording.samples.len();
    let file = json!({
        "format": "devdeck-recording",
        "version": 1,
        "app": app.package_info().name,
        "started": recording.started,
        "stopped": stopped,
        "intervalMs": RECORD_INTERVAL.as_millis() as u64,
        "samples": recording.samples
    });

    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?.join(RECORDINGS_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.devdeck.json", file_stamp(recording.started)));
    std::fs::write(&path, file.to_string()).map_err(|e| e.to_string())?;

    Ok(json!({
        "path": path.to_string_lossy(),
        "duration": stopped - recording.started,
        "samples": samples
    }))
}

pub fn reveal(path: &str) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("file not found".to_string());
    }

    #[cfg(windows)]
    let result = std::process::Command::new("explorer").arg(format!("/select,{}", path.display())).spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg("-R").arg(&path).spawn();
    #[cfg(not(any(windows, target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(path.parent().unwrap_or(&path)).spawn();

    result.map(|_| ()).map_err(|e| e.to_string())
}

pub fn start<R: Runtime>(app: AppHandle<R>) {
    if IS_SAMPLING.swap(true, Ordering::SeqCst) {
        return;
    }
    SAMPLES.lock().unwrap().clear();

    tauri::async_runtime::spawn(async move {
        let mut system = System::new();
        let own = Pid::from_u32(std::process::id());
        let log = app.path().app_log_dir().ok().map(|dir| dir.join(LOG_FILE));
        if let Some(path) = &log {
            let _ = std::fs::remove_file(path);
        }

        let mut last_live = 0;
        loop {
            let is_recording = RECORDING.lock().unwrap().is_some();
            tokio::time::sleep(if is_recording { RECORD_INTERVAL } else { SAMPLE_INTERVAL }).await;
            if app.get_webview_window(WINDOW_LABEL).is_none() {
                IS_SAMPLING.store(false, Ordering::SeqCst);
                RECORDING.lock().unwrap().take();
                break;
            }

            system.refresh_processes_specifics(
                ProcessesToUpdate::All,
                true,
                ProcessRefreshKind::nothing().with_memory().with_cpu().with_cmd(UpdateKind::OnlyIfNotSet)
            );
            let processes: Vec<Value> = family(&system, own).into_iter().map(|process| json!({
                "pid": process.pid().as_u32(),
                "kind": kind_of(process, own),
                "memory": process.memory(),
                "cpu": process.cpu_usage()
            })).collect();

            let time = now();
            let sample = json!({
                "time": time,
                "processes": processes,
                "rust": {
                    "tasks": tokio::runtime::Handle::current().metrics().num_alive_tasks()
                },
                "page": PAGE_REPORT.lock().unwrap().clone().unwrap_or(Value::Null)
            });

            if let Some(recording) = RECORDING.lock().unwrap().as_mut() {
                if recording.samples.len() < MAX_RECORD_SAMPLES {
                    recording.samples.push(sample.clone());
                }
            }
            let live_every = (SAMPLE_INTERVAL - RECORD_INTERVAL / 2).as_millis() as u64;
            if time - last_live < live_every {
                continue;
            }
            last_live = time;

            if let Some(path) = &log {
                append_log(path, &sample);
            }
            let mut samples = SAMPLES.lock().unwrap();
            samples.push_back(sample);
            while samples.len() > HISTORY {
                samples.pop_front();
            }
        }
    });
}

fn file_stamp(millis: u64) -> String {
    let seconds = millis / 1000;
    let days = (seconds / 86_400) as i64;
    let (hour, minute, second) = (seconds / 3600 % 24, seconds / 60 % 60, seconds % 60);

    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era = (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 { month_index + 3 } else { month_index - 9 };
    let year = year_of_era + era * 400 + i64::from(month <= 2);

    format!("recording-{year:04}-{month:02}-{day:02}-{hour:02}{minute:02}{second:02}")
}

fn family(system: &System, root: Pid) -> Vec<&Process> {
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, process) in system.processes() {
        if let Some(parent) = process.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }

    let mut seen = HashSet::new();
    let mut queue = vec![root];
    let mut result = Vec::new();
    while let Some(pid) = queue.pop() {
        if !seen.insert(pid) {
            continue;
        }
        if let Some(process) = system.process(pid) {
            result.push(process);
        }
        queue.extend(children.get(&pid).into_iter().flatten().copied());
    }
    result
}

fn kind_of(process: &Process, own: Pid) -> String {
    if process.pid() == own {
        return "app".to_string();
    }

    let args: Vec<String> = process.cmd().iter().map(|arg| arg.to_string_lossy().into_owned()).collect();
    let value_of = |key: &str| args.iter().find_map(|arg| arg.strip_prefix(key).map(str::to_string));
    let name = process.name().to_string_lossy().to_lowercase();
    if !name.contains("webview") {
        return name.trim_end_matches(".exe").to_string();
    }

    match value_of("--type=").as_deref() {
        None => "webview:browser".to_string(),
        Some("renderer") => "webview:renderer".to_string(),
        Some("gpu-process") => "webview:gpu".to_string(),
        Some("utility") => match value_of("--utility-sub-type=") {
            Some(sub) if sub.contains("network") => "webview:network".to_string(),
            Some(sub) if sub.contains("storage") => "webview:storage".to_string(),
            Some(sub) if sub.contains("audio") => "webview:audio".to_string(),
            _ => "webview:utility".to_string()
        },
        Some(other) => format!("webview:{other}")
    }
}

fn append_log(path: &Path, sample: &Value) {
    if std::fs::metadata(path).is_ok_and(|metadata| metadata.len() > MAX_LOG_BYTES) {
        let _ = std::fs::remove_file(path);
    }
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{sample}");
    }
}