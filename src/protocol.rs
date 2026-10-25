use serde_json::Value;
use tauri::{
    http::{Method, Request, Response, StatusCode},
    AppHandle, Runtime
};

const HTML: &str = "text/html; charset=utf-8";
const FILES: &[(&str, &str, &[u8])] = &[("/index.html", HTML, include_bytes!("ui-dist/index.html"))];

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

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let hex = bytes.get(index + 1..index + 3).and_then(|pair| std::str::from_utf8(pair).ok());
        match (bytes[index], hex.and_then(|pair| u8::from_str_radix(pair, 16).ok())) {
            (b'%', Some(byte)) => {
                decoded.push(byte);
                index += 3;
            }
            (byte, _) => {
                decoded.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

pub fn respond<R: Runtime>(app: &AppHandle<R>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let is_post = request.method() == Method::POST;
    let (status, content_type, body): Reply = match (is_post, request.uri().path()) {
        (false, "/samples") => (StatusCode::OK, "application/json", crate::monitor::samples_json()),
        (false, "/recording") => (StatusCode::OK, "application/json", crate::monitor::recording_json()),
        (true, "/recording/start") => {
            crate::monitor::start_recording(app);
            (StatusCode::OK, "application/json", crate::monitor::recording_json())
        }
        (true, "/recording/stop") => json(crate::monitor::stop_recording(app)),
        (true, "/recording/reveal") => {
            let name = String::from_utf8_lossy(request.body()).into_owned();
            json(crate::monitor::reveal(app, &name).map(|_| Value::Null))
        }
        (false, "/recordings") => json(crate::monitor::recordings_list(app)),
        (false, path) if path.starts_with("/recordings/") => {
            let name = percent_decode(&path["/recordings/".len()..]);
            match crate::monitor::read_recording(app, &name) {
                Ok(body) => (StatusCode::OK, "application/json", body),
                Err(error) => (StatusCode::NOT_FOUND, "text/plain", error.into_bytes())
            }
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