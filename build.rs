const COMMANDS: &[&str] = &["open", "report"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}