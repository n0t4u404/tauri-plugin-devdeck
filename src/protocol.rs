use serde_json::Value;
use tauri::{
    http::{Method, Request, Response, StatusCode},
    AppHandle, Runtime
};

const HTML: &str = "text/html; charset=utf-8";
const CSS: &str = "text/css; charset=utf-8";
const JS: &str = "text/javascript; charset=utf-8";

const FILES: &[(&str, &str, &[u8])] = &[
    ("/index.html", HTML, include_bytes!("ui/index.html")),
    ("/style.css", CSS, include_bytes!("ui/style.css")),
    ("/fonts/inter-latin.woff2", "font/woff2", include_bytes!("ui/fonts/inter-latin.woff2")),
    ("/js/main.js", JS, include_bytes!("ui/js/main.js")),
    ("/js/format.js", JS, include_bytes!("ui/js/format.js")),
    ("/js/chart.js", JS, include_bytes!("ui/js/chart.js")),
    ("/js/panel.js", JS, include_bytes!("ui/js/panel.js")),
    ("/js/stat.js", JS, include_bytes!("ui/js/stat.js")),
    ("/js/monitor.js", JS, include_bytes!("ui/js/monitor.js")),
    ("/js/recording.js", JS, include_bytes!("ui/js/recording.js"))
];

fn file(path: &str) -> Option<(&'static str, &'static [u8])> {
    let path = if path == "/" { "/index.html" } else { path };
    FILES.iter().find(|(name, ..)| *name == path).map(|(_, content_type, body)| (*content_type, *body))
}

type Reply = (StatusCode, &'static str, Vec<u8>);

fn json(result: Result<Value, String>) -> Reply {
    match result {
        Ok(value) => (StatusCode::OK, "application/json", value.to_string().into_bytes()),
        Err(error) => (StatusCode::BAD_REQUEST, "text/plain", error.into_bytes())
    }
}

pub fn respond<R: Runtime>(app: &AppHandle<R>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let is_post = request.method() == Method::POST;
    let (status, content_type, body): Reply = match (is_post, request.uri().path()) {
        (false, "/samples") => (StatusCode::OK, "application/json", crate::monitor::samples_json()),
        (false, "/recording") => (StatusCode::OK, "application/json", crate::monitor::recording_json()),
        (true, "/recording/start") => {
            crate::monitor::start_recording();
            (StatusCode::OK, "application/json", crate::monitor::recording_json())
        }
        (true, "/recording/stop") => json(crate::monitor::stop_recording(app)),
        (true, "/recording/reveal") => {
            let path = String::from_utf8_lossy(request.body()).into_owned();
            json(crate::monitor::reveal(&path).map(|_| Value::Null))
        }
        (false, path) => match file(path) {
            Some((content_type, body)) => (StatusCode::OK, content_type, body.to_vec()),
            None => (StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec())
        },
        _ => (StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec())
    };

    Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Cache-Control", "no-store")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}