const COMMANDS: &[&str] = &["open"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}