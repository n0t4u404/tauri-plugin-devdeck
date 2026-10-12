use tauri::http::{Request, Response, StatusCode};

const INDEX: &str = include_str!("ui/index.html");
const INTER: &[u8] = include_bytes!("ui/fonts/inter-latin.woff2");

pub fn respond(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let (status, content_type, body) = match request.uri().path() {
        "/" | "/index.html" => (StatusCode::OK, "text/html; charset=utf-8", INDEX.as_bytes().to_vec()),
        "/fonts/inter-latin.woff2" => (StatusCode::OK, "font/woff2", INTER.to_vec()),
        _ => (StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec())
    };
    Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Cache-Control", "no-store")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}