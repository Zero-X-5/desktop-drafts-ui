use serde::Deserialize;
use tauri::Manager;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativePlateConfig {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    acrylic_color: [u8; 4],
    blur_color: [u8; 4],
}

fn native_plate_config() -> Result<NativePlateConfig, serde_json::Error> {
    serde_json::from_str(include_str!("../native-plate.json"))
}

#[cfg(target_os = "windows")]
fn apply_native_plate_effect(
    plate: &tauri::window::Window,
    kind: &str,
    color: [u8; 4],
) -> Result<(), String> {
    use tauri::window::{Color, Effect, EffectsBuilder};

    let effect = match kind {
        "acrylic" => Effect::Acrylic,
        "blur" => Effect::Blur,
        other => return Err(format!("unsupported native plate effect: {other}")),
    };

    plate
        .set_effects(
            EffectsBuilder::new()
                .effect(effect)
                .color(Color(color[0], color[1], color[2], color[3]))
                .build(),
        )
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn setup_native_plate(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let main = app
        .get_webview_window("main")
        .ok_or("main window is unavailable")?;
    let config = native_plate_config()?;

    let plate = tauri::window::WindowBuilder::new(app, "native-plate")
        .parent_raw(main.hwnd()?)
        .position(config.x, config.y)
        .inner_size(config.width, config.height)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .focusable(false)
        .skip_taskbar(true)
        .always_on_bottom(true)
        .visible(false)
        .build()?;

    plate.set_ignore_cursor_events(true)?;
    plate.set_always_on_bottom(true)?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn setup_native_plate(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn set_native_plate(app: tauri::AppHandle, kind: Option<String>) -> Result<(), String> {
    let plate = app
        .get_window("native-plate")
        .ok_or_else(|| "native plate window is unavailable".to_string())?;

    let Some(kind) = kind else {
        plate.hide().map_err(|error| error.to_string())?;
        return Ok(());
    };

    let config = native_plate_config().map_err(|error| error.to_string())?;
    let color = match kind.as_str() {
        "acrylic" => config.acrylic_color,
        "blur" => config.blur_color,
        other => return Err(format!("unsupported native plate effect: {other}")),
    };

    apply_native_plate_effect(&plate, &kind, color)?;
    plate
        .set_always_on_bottom(true)
        .map_err(|error| error.to_string())?;
    plate.show().map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn set_native_plate(_app: tauri::AppHandle, kind: Option<String>) -> Result<(), String> {
    if kind.is_some() {
        Err("native backdrop plate is Windows-only".to_string())
    } else {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            setup_native_plate(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_native_plate])
        .run(tauri::generate_context!())
        .expect("error while running Tauri glass effects test");
}
