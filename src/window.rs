use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder};

use crate::{WindowSize, WINDOW_LABEL};

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
    let WindowSize { size, min_size } = *app.state::<WindowSize>();
    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::CustomProtocol(window_url()))
        .title(title)
        .inner_size(size.0, size.1)
        .min_inner_size(min_size.0, min_size.1)
        .build()
        .map_err(|e| e.to_string())?;
    crate::monitor::start(app.clone());
    Ok(())
}