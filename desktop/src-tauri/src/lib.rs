use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;

mod commands;

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let draft_state = commands::drafts::DraftState::load(app.handle())
                .map_err(std::io::Error::other)?;
            app.manage(draft_state);

            let show_item = MenuItem::with_id(app, "show", "显示拾笺", true, None::<&str>)?;
            let new_item = MenuItem::with_id(app, "new", "新建草稿", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出拾笺", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &new_item, &separator, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("missing app icon").clone())
                .tooltip("拾笺")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "new" => {
                        show_main_window(app);
                        let _ = app.emit("tray-new-draft", ());
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
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::drafts::get_draft_directory,
            commands::drafts::choose_draft_directory,
            commands::drafts::list_drafts,
            commands::drafts::read_draft,
            commands::drafts::create_draft,
            commands::drafts::rename_draft,
            commands::drafts::save_draft,
            commands::drafts::trash_draft,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Shijian");
}
