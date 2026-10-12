use serde_json::Value;
use tauri::{
    http::{Method, Request, Response, StatusCode},
    AppHandle, Runtime
};

const INDEX: &str = include_str!("ui/index.html");
const INTER: &[u8] = include_bytes!("ui/fonts/inter-latin.woff2");

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
        (false, "/" | "/index.html") => (StatusCode::OK, "text/html; charset=utf-8", INDEX.as_bytes().to_vec()),
        (false, "/fonts/inter-latin.woff2") => (StatusCode::OK, "font/woff2", INTER.to_vec()),
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
        _ => (StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec())
    };

    Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Cache-Control", "no-store")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}