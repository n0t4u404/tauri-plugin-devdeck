use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder};

use crate::WINDOW_LABEL;

fn window_url() -> Url {
    let url = if cfg!(any(windows, target_os = "android")) {
        "http://devdeck.localhost/index.html"
    } else {
        "devdeck://localhost/index.html"
    };
    url.parse().expect("valid devdeck url")
}

pub fn open<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.unminimize();
        return window.set_focus().map_err(|e| e.to_string());
    }

    let title = format!("{} — devdeck", app.package_info().name);
    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::CustomProtocol(window_url()))
        .title(title)
        .inner_size(820.0, 760.0)
        .min_inner_size(560.0, 420.0)
        .build()
        .map_err(|e| e.to_string())?;
    crate::monitor::start(app.clone());
    Ok(())
}