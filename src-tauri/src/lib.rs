use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

struct ApiPort(Mutex<u16>);
// Store child handle and PID together so both cleanup paths can kill the full tree.
struct SidecarChild(Mutex<Option<(CommandChild, u32)>>);

impl Drop for SidecarChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some((child, pid)) = guard.take() {
                let _ = child.kill();
                kill_process_tree(pid);
            }
        }
    }
}

// Kill the process and all its children (/T) forcefully (/F) by PID.
// This ensures mitmdump.exe and any other subprocesses spawned by the
// sidecar are also terminated when the app exits.
fn kill_process_tree(pid: u32) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output();
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

                let pid = child.pid();
                *app.state::<SidecarChild>().0.lock().unwrap() = Some((child, pid));

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
                if let Some((child, pid)) = window
                    .app_handle()
                    .state::<SidecarChild>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                    kill_process_tree(pid);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_api_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
