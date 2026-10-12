mod monitor;
mod protocol;
mod window;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime
};

pub const WINDOW_LABEL: &str = "devdeck";

#[tauri::command]
async fn open<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    window::open(&app)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("devdeck")
        .invoke_handler(tauri::generate_handler![open])
        .register_uri_scheme_protocol("devdeck", |_context, request| protocol::respond(&request))
        .build()
}