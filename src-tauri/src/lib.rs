use std::sync::Mutex;
use tauri::{Emitter, Manager};

struct PendingFiles(Mutex<Vec<String>>);

#[tauri::command]
fn take_pending_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    state.0.lock().unwrap().drain(..).collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance is launched, forward its CLI args
            // to the already-running instance as an "open-files" event.
            let files: Vec<&str> = args
                .iter()
                .skip(1) // skip the binary path
                .filter(|a| !a.starts_with('-')) // skip flags
                .map(|s| s.as_str())
                .collect();
            if !files.is_empty() {
                let _ = app.emit("open-files", files);
            }
            // Focus the existing window
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .manage(PendingFiles(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![take_pending_files])
        .setup(|app| {
            // On first launch, collect file paths from CLI args
            let files: Vec<String> = std::env::args()
                .skip(1)
                .filter(|a| !a.starts_with('-'))
                .collect();
            if !files.is_empty() {
                app.state::<PendingFiles>().0.lock().unwrap().extend(files);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application");

    app.run(|handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = &event {
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|url| {
                    url.to_file_path()
                        .ok()
                        .map(|p| p.to_string_lossy().into_owned())
                })
                .collect();
            if !paths.is_empty() {
                // Store for retrieval by frontend (in case webview isn't ready)
                if let Some(state) = handle.try_state::<PendingFiles>() {
                    state.0.lock().unwrap().extend(paths.clone());
                }
                // Also emit for immediate delivery if webview is ready
                let _ = handle.emit("open-files", paths);
            }
        }
        let _ = (&handle, &event); // suppress unused warnings
    });
}
