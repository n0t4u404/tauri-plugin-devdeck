mod monitor;
mod protocol;
mod window;

use serde_json::Value;
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime
};

pub const WINDOW_LABEL: &str = "devdeck";

#[tauri::command]
async fn open<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    window::open(&app)
}

#[tauri::command]
fn report(report: Value) {
    monitor::set_page_report(report);
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("devdeck")
        .invoke_handler(tauri::generate_handler![open, report])
        .register_uri_scheme_protocol("devdeck", |_context, request| protocol::respond(&request))
        .build()
}