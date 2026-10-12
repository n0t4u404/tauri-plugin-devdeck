mod monitor;
mod protocol;
mod window;

use serde_json::Value;
use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    AppHandle, Manager, Runtime
};

pub const WINDOW_LABEL: &str = "devdeck";

#[derive(Clone, Copy)]
pub(crate) struct WindowSize {
    pub size: (f64, f64),
    pub min_size: (f64, f64)
}

pub struct Builder {
    window: WindowSize
}

impl Default for Builder {
    fn default() -> Self {
        Self {
            window: WindowSize {
                size: (1120.0, 820.0),
                min_size: (640.0, 480.0)
            }
        }
    }
}

impl Builder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn size(mut self, width: f64, height: f64) -> Self {
        self.window.size = (width, height);
        self
    }

    pub fn min_size(mut self, width: f64, height: f64) -> Self {
        self.window.min_size = (width, height);
        self
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let window = self.window;
        PluginBuilder::new("devdeck")
            .invoke_handler(tauri::generate_handler![open, report])
            .register_uri_scheme_protocol("devdeck", |context, request| protocol::respond(context.app_handle(), &request))
            .setup(move |app, _api| {
                app.manage(window);
                Ok(())
            })
            .build()
    }
}

#[tauri::command]
async fn open<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    window::open(&app)
}

#[tauri::command]
fn report(report: Value) {
    monitor::set_page_report(report);
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new().build()
}