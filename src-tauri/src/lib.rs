use std::sync::Mutex;
use tauri::{Emitter, Manager};

struct PendingFiles(Mutex<Vec<String>>);

fn lock_pending(state: &PendingFiles) -> std::sync::MutexGuard<'_, Vec<String>> {
    // Recover from a poisoned mutex rather than panicking the whole app.
    // A panic here would take down the editor on any single-instance event.
    state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[tauri::command]
fn take_pending_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    lock_pending(state.inner()).drain(..).collect()
}

/// Extract file paths from a raw argv slice. Skip the binary path (index 0),
/// treat `--` as a sentinel that terminates flag parsing, and only treat tokens
/// that look like flags (`-x`, `--foo`) as flags. Preserves paths that happen
/// to start with `-` when they appear after `--`.
fn collect_cli_files<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut out: Vec<String> = Vec::new();
    let mut iter = args.into_iter();
    // Skip the binary path.
    let _ = iter.next();
    let mut past_sentinel = false;
    for raw in iter {
        let s = raw.as_ref();
        if past_sentinel {
            out.push(s.to_string());
            continue;
        }
        if s == "--" {
            past_sentinel = true;
            continue;
        }
        if s.starts_with("--") {
            // Long flag like `--foo` or `--foo=bar`; skip unless it exists on the filesystem.
            if std::path::Path::new(s).exists() {
                out.push(s.to_string());
                continue;
            }
            continue;
        }
        if s.starts_with('-') && s.len() > 1 && s.chars().nth(1).is_some_and(|c| c.is_ascii_alphabetic()) {
            // Short flag like `-v`; skip unless it exists on the filesystem.
            if std::path::Path::new(s).exists() {
                out.push(s.to_string());
                continue;
            }
            continue;
        }
        out.push(s.to_string());
    }
    out
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
            // When a second instance is launched, forward its CLI file args
            // to the already-running instance as an "open-files" event.
            let files = collect_cli_files(args.iter().map(|s| s.as_str()));
            if !files.is_empty() {
                // Queue for frontend drain as a safety net for the listener race.
                if let Some(state) = app.try_state::<PendingFiles>() {
                    lock_pending(state.inner()).extend(files.clone());
                }
                if let Err(err) = app.emit("open-files", &files) {
                    eprintln!("[litecode] single-instance emit(open-files) failed: {err}");
                }
            }
            // Focus the existing window.
            if let Some(w) = app.get_webview_window("main") {
                if let Err(err) = w.set_focus() {
                    eprintln!("[litecode] single-instance set_focus failed: {err}");
                }
            }
        }))
        .manage(PendingFiles(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![take_pending_files])
        .setup(|app| {
            // On first launch, collect file paths from CLI args.
            let argv: Vec<String> = std::env::args().collect();
            let files = collect_cli_files(argv.iter().map(|s| s.as_str()));
            if !files.is_empty() {
                lock_pending(app.state::<PendingFiles>().inner()).extend(files);
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
                // Queue for retrieval by the frontend (safety net if the webview
                // hasn't attached its "open-files" listener yet). The frontend
                // drains this after the listener is registered, so late-arriving
                // events are not lost.
                if let Some(state) = handle.try_state::<PendingFiles>() {
                    lock_pending(state.inner()).extend(paths.clone());
                }
                if let Err(err) = handle.emit("open-files", &paths) {
                    eprintln!("[litecode] emit(open-files) failed: {err}");
                }
            }
        }
        let _ = (&handle, &event); // suppress unused warnings on non-mac targets
    });
}

#[cfg(test)]
mod tests {
    use super::collect_cli_files;

    #[test]
    fn keeps_paths_after_sentinel_even_if_dash_prefixed() {
        let args = vec!["litecode", "--", "-weird.txt", "normal.txt"];
        assert_eq!(
            collect_cli_files(args),
            vec!["-weird.txt".to_string(), "normal.txt".to_string()]
        );
    }

    #[test]
    fn skips_short_and_long_flags_before_sentinel() {
        let args = vec!["litecode", "-v", "--foo=bar", "file.txt"];
        assert_eq!(collect_cli_files(args), vec!["file.txt".to_string()]);
    }

    #[test]
    fn accepts_single_dash_and_numeric_prefixed() {
        let args = vec!["litecode", "-", "-1.txt"];
        assert_eq!(
            collect_cli_files(args),
            vec!["-".to_string(), "-1.txt".to_string()]
        );
    }
}
