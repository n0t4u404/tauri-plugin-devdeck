use std::collections::{HashMap, HashSet, VecDeque};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tauri::{AppHandle, Manager, Runtime};

use crate::WINDOW_LABEL;

const SAMPLE_INTERVAL: Duration = Duration::from_secs(1);
const HISTORY: usize = 300;
const LOG_FILE: &str = "devdeck.jsonl";
const MAX_LOG_BYTES: u64 = 4 * 1024 * 1024;

static SAMPLES: Mutex<VecDeque<Value>> = Mutex::new(VecDeque::new());
static IS_SAMPLING: AtomicBool = AtomicBool::new(false);

pub fn samples_json() -> Vec<u8> {
    let samples = SAMPLES.lock().unwrap();
    serde_json::to_vec(&*samples).unwrap_or_else(|_| b"[]".to_vec())
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

        loop {
            tokio::time::sleep(SAMPLE_INTERVAL).await;
            if app.get_webview_window(WINDOW_LABEL).is_none() {
                IS_SAMPLING.store(false, Ordering::SeqCst);
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

            let time = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |time| time.as_millis() as u64);
            let sample = json!({
                "time": time,
                "processes": processes,
                "rust": {
                    "tasks": tokio::runtime::Handle::current().metrics().num_alive_tasks()
                }
            });

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