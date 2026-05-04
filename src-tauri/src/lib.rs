use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

struct ApiPort(Mutex<u16>);
struct SidecarChild(Mutex<Option<CommandChild>>);

impl Drop for SidecarChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}

#[tauri::command]
fn get_api_port(state: tauri::State<'_, ApiPort>) -> u16 {
    *state.0.lock().unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ApiPort(Mutex::new(7842)))
        .manage(SidecarChild(Mutex::new(None)))
        .setup(|app| {
            // Only spawn sidecar in production builds.
            // In dev, run `python -m api.main` manually.
            #[cfg(not(debug_assertions))]
            {
                use tauri_plugin_shell::ShellExt;
                use tauri_plugin_shell::process::CommandEvent;

                let shell = app.shell();
                let sidecar = shell.sidecar("hub-czn-api")
                    .expect("hub-czn-api sidecar not found in binaries/");

                let (mut rx, child) = sidecar.spawn()
                    .expect("Failed to spawn hub-czn-api sidecar");

                // Keep the child handle alive in app state so it is killed on exit.
                *app.state::<SidecarChild>().0.lock().unwrap() = Some(child);

                let handle = app.handle().clone();

                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        if let CommandEvent::Stdout(bytes) = event {
                            let line = String::from_utf8_lossy(&bytes);
                            if let Some(port_str) = line.trim().strip_prefix("PORT:") {
                                if let Ok(port) = port_str.parse::<u16>() {
                                    *handle.state::<ApiPort>().0.lock().unwrap() = port;
                                }
                            }
                        }
                    }
                });
            }
            #[cfg(debug_assertions)]
            let _ = app;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(child) = window
                    .app_handle()
                    .state::<SidecarChild>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_api_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
