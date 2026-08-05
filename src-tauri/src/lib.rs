mod window_region;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, ShortcutState};

const STORE_DIR_DEFAULT: &str = r"C:\文档\拾笺";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
struct Settings {
    always_on_top: bool,
    autostart: bool,
    hotkey: bool,
    auto_save: bool,
    transparent: bool,
    store_dir: String,
    pinned: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            always_on_top: false,
            autostart: false,
            hotkey: true,
            auto_save: true,
            transparent: false,
            store_dir: STORE_DIR_DEFAULT.to_string(),
            pinned: vec![],
        }
    }
}

#[derive(Serialize)]
struct DraftMeta {
    path: String,
    title: String,
    mtime: u64,
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

fn load_settings(app: &tauri::AppHandle) -> Settings {
    std::fs::read_to_string(settings_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_settings(app: &tauri::AppHandle, s: &Settings) {
    if let Some(dir) = settings_path(app).parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(s) {
        let _ = std::fs::write(settings_path(app), json);
    }
}

fn store_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = PathBuf::from(load_settings(app).store_dir);
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn safe_file_name(title: &str) -> String {
    let mut name = title
        .trim()
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    if name.is_empty() {
        name = "未命名草稿".to_string();
    }
    name
}

fn unique_path(dir: &Path, title: &str) -> PathBuf {
    let base = safe_file_name(title);
    let first = dir.join(format!("{base}.txt"));
    if !first.exists() {
        return first;
    }
    for i in 2..1000 {
        let p = dir.join(format!("{base}_{i}.txt"));
        if !p.exists() {
            return p;
        }
    }
    dir.join(format!(
        "{base}_{}.txt",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ))
}

fn file_mtime_ms(p: &Path) -> u64 {
    p.metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
fn get_store_dir(app: tauri::AppHandle) -> String {
    store_dir(&app).to_string_lossy().to_string()
}

#[tauri::command]
fn list_drafts(app: tauri::AppHandle) -> Result<Vec<DraftMeta>, String> {
    let dir = store_dir(&app);
    let mut out = vec![];
    let rd = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in rd.flatten() {
        let p = entry.path();
        if p.extension().map(|e| e == "txt").unwrap_or(false) {
            out.push(DraftMeta {
                path: p.to_string_lossy().to_string(),
                title: p
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                mtime: file_mtime_ms(&p),
            });
        }
    }
    out.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    Ok(out)
}

#[tauri::command]
fn read_draft(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_draft(
    app: tauri::AppHandle,
    path: Option<String>,
    title: String,
    content: String,
) -> Result<String, String> {
    let dir = store_dir(&app);
    match path {
        Some(p) => {
            let new_path = dir.join(format!("{}.txt", safe_file_name(&title)));
            if PathBuf::from(&p) != new_path {
                let _ = std::fs::rename(&p, &new_path);
            }
            std::fs::write(&new_path, content).map_err(|e| e.to_string())?;
            Ok(new_path.to_string_lossy().to_string())
        }
        None => {
            let new_path = unique_path(&dir, &title);
            std::fs::write(&new_path, content).map_err(|e| e.to_string())?;
            Ok(new_path.to_string_lossy().to_string())
        }
    }
}

#[tauri::command]
fn delete_to_recycle(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg("/select,")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Settings {
    load_settings(&app)
}

#[tauri::command]
fn set_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    save_settings(&app, &settings);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_always_on_top(settings.always_on_top);
    }
    Ok(())
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_hotkey(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let shortcut = app.global_shortcut();
    let hotkeys = ["ctrl+shift+space", "ctrl+shift+n"];
    for h in hotkeys {
        let registered = shortcut.is_registered(h);
        if enabled && !registered {
            shortcut.register(h).map_err(|e| e.to_string())?;
        } else if !enabled && registered {
            shortcut.unregister(h).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn set_window_region(
    window: tauri::WebviewWindow,
    state: String,
    side: String,
) -> Result<(), String> {
    window_region::apply(&window, &state, &side)
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn hotkey_toggle(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if !win.is_visible().unwrap_or(false) {
            let _ = win.show();
            let _ = win.set_focus();
        }
        let _ = app.emit("global-hotkey", "toggle");
    }
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
            let _ = app.emit("global-hotkey", "toggle");
        }
    }
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "toggle", "显示 / 隐藏", true, None::<&str>)?;
    let new = MenuItem::with_id(app, "new", "新建草稿", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &new, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_window(app),
            "new" => {
                show_window(app);
                let _ = app.emit("global-hotkey", "new");
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn spawn_watcher(app: tauri::AppHandle) {
    let dir = store_dir(&app);
    std::thread::spawn(move || {
        use notify::{RecommendedWatcher, RecursiveMode, Watcher};
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher: RecommendedWatcher = notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        })
        .unwrap();
        if watcher.watch(&dir, RecursiveMode::NonRecursive).is_err() {
            return;
        }
        for res in rx {
            if res.is_ok() {
                let _ = app.emit("drafts-changed", ());
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    match shortcut.key {
                        Code::Space => hotkey_toggle(app),
                        Code::KeyN => {
                            show_window(app);
                            let _ = app.emit("global-hotkey", "new");
                        }
                        _ => {}
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_store_dir,
            list_drafts,
            read_draft,
            write_draft,
            delete_to_recycle,
            open_folder,
            get_settings,
            set_settings,
            set_autostart,
            set_hotkey,
            set_window_region
        ])
        .setup(|app| {
            let settings = load_settings(app.handle());
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_always_on_top(settings.always_on_top);
                if let Err(error) = window_region::ensure_fixed_canvas(&win) {
                    eprintln!("failed to fix window canvas size: {error}");
                }
                if let Err(error) = window_region::apply(&win, "collapsed", "right") {
                    eprintln!("failed to apply initial window region: {error}");
                }
                let _ = win.show();
            }
            if settings.hotkey {
                let _ = set_hotkey(app.handle().clone(), true);
            }
            setup_tray(app.handle())?;
            spawn_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
