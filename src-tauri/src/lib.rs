use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

// ── App state ────────────────────────────────────────────────────────────────

struct ApiPort(Mutex<u16>);

struct SidecarState {
    child: CommandChild,
    pid:   u32,
    /// Job Object handle (Windows only).
    /// Kept alive so that when this struct — or the entire process — is
    /// dropped/killed for ANY reason, the OS closes this handle and
    /// immediately terminates every process in the job (sidecar + mitmdump
    /// + any other children).  No cleanup code needs to run.
    #[cfg(target_os = "windows")]
    _job: Option<WinJob>,
}

struct SidecarChild(Mutex<Option<SidecarState>>);

impl Drop for SidecarChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(state) = guard.take() {
                // Belt-and-suspenders: explicit kill + taskkill tree before
                // the Job Object handle is released by dropping `state`.
                let _ = state.child.kill();
                kill_tree(state.pid);
                // `state` is dropped here → _job is dropped → OS kills job.
            }
        }
    }
}

fn kill_tree(pid: u32) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output();
    #[cfg(not(target_os = "windows"))]
    let _ = pid;
}

// ── Windows Job Object ────────────────────────────────────────────────────────
//
// Strategy: assign the sidecar to a Job Object with KILL_ON_JOB_CLOSE.
// When hub-czn.exe exits for ANY reason (graceful close, installer kill,
// crash, Task Manager), Windows automatically closes all process handles,
// including the Job Object handle.  That triggers the OS to kill every
// process in the job — sidecar, mitmdump, and any grandchildren — with no
// Rust cleanup code required.  This is fundamentally more reliable than
// taskkill, which only runs when our code runs.
//
// Raw extern declarations avoid adding a new crate dependency.

#[cfg(target_os = "windows")]
mod win {
    use std::ffi::c_void;

    pub const PROCESS_TERMINATE:  u32 = 0x0001;
    pub const PROCESS_SET_QUOTA:  u32 = 0x0100;
    pub const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x0000_2000;
    pub const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

    #[repr(C)]
    pub struct BasicLimitInfo {
        pub per_process_time: i64,
        pub per_job_time:     i64,
        pub limit_flags:      u32,
        pub min_ws:           usize,
        pub max_ws:           usize,
        pub active_proc:      u32,
        pub affinity:         usize,
        pub priority:         u32,
        pub scheduling:       u32,
    }

    #[repr(C)]
    pub struct IoCounters {
        pub read_ops:   u64, pub write_ops:  u64, pub other_ops:   u64,
        pub read_xfer:  u64, pub write_xfer: u64, pub other_xfer:  u64,
    }

    #[repr(C)]
    pub struct ExtLimitInfo {
        pub basic:          BasicLimitInfo,
        pub io:             IoCounters,
        pub proc_mem_limit: usize,
        pub job_mem_limit:  usize,
        pub peak_proc_mem:  usize,
        pub peak_job_mem:   usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn CreateJobObjectW(attrs: *mut c_void, name: *const u16) -> isize;
        pub fn OpenProcess(access: u32, inherit: i32, pid: u32) -> isize;
        pub fn AssignProcessToJobObject(job: isize, process: isize) -> i32;
        pub fn SetInformationJobObject(
            job: isize, class: i32, info: *mut c_void, len: u32,
        ) -> i32;
        pub fn CloseHandle(handle: isize) -> i32;
    }
}

#[cfg(target_os = "windows")]
struct WinJob(isize);

#[cfg(target_os = "windows")]
unsafe impl Send for WinJob {}
#[cfg(target_os = "windows")]
unsafe impl Sync for WinJob {}

#[cfg(target_os = "windows")]
impl Drop for WinJob {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe { win::CloseHandle(self.0); }
        }
    }
}

#[cfg(target_os = "windows")]
fn create_job_for(pid: u32) -> Option<WinJob> {
    unsafe {
        let job = win::CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
        if job == 0 { return None; }

        let mut info = std::mem::zeroed::<win::ExtLimitInfo>();
        info.basic.limit_flags = win::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        win::SetInformationJobObject(
            job,
            win::JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
            &mut info as *mut _ as *mut _,
            std::mem::size_of::<win::ExtLimitInfo>() as u32,
        );

        let proc_handle = win::OpenProcess(
            win::PROCESS_TERMINATE | win::PROCESS_SET_QUOTA,
            0,
            pid,
        );
        if proc_handle != 0 {
            win::AssignProcessToJobObject(job, proc_handle);
            win::CloseHandle(proc_handle);
        }

        Some(WinJob(job))
    }
}

// ── Tauri entry point ─────────────────────────────────────────────────────────

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

                *app.state::<SidecarChild>().0.lock().unwrap() = Some(SidecarState {
                    child,
                    pid,
                    #[cfg(target_os = "windows")]
                    _job: create_job_for(pid),
                });

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
                // Explicit cleanup on graceful close — belt-and-suspenders
                // alongside the Job Object (which handles forced kills).
                if let Some(state) = window
                    .app_handle()
                    .state::<SidecarChild>()
                    .0.lock().unwrap().take()
                {
                    let _ = state.child.kill();
                    kill_tree(state.pid);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_api_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
