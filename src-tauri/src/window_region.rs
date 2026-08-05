use tauri::{LogicalSize, WebviewWindow};

pub const CANVAS_WIDTH: f64 = 720.0;
pub const CANVAS_HEIGHT: f64 = 480.0;
const DIRECTORY_WIDTH: f64 = 248.0;
const PREVIEW_WIDTH: f64 = 472.0;
const COLLAPSED_HEIGHT: f64 = 36.0;
const CORNER_RADIUS: f64 = 14.0;

pub fn ensure_fixed_canvas(window: &WebviewWindow) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(CANVAS_WIDTH, CANVAS_HEIGHT))
        .map_err(|error| error.to_string())
}

pub fn apply(window: &WebviewWindow, state: &str, side: &str) -> Result<(), String> {
    platform::apply(window, state, side)
}

fn region_geometry(state: &str, side: &str) -> Result<(f64, f64, f64, f64), String> {
    let directory_x = if side.eq_ignore_ascii_case("left") {
        PREVIEW_WIDTH
    } else {
        0.0
    };

    match state {
        "collapsed" => Ok((directory_x, 0.0, DIRECTORY_WIDTH, COLLAPSED_HEIGHT)),
        "expanded" => Ok((directory_x, 0.0, DIRECTORY_WIDTH, CANVAS_HEIGHT)),
        "preview" => Ok((0.0, 0.0, CANVAS_WIDTH, CANVAS_HEIGHT)),
        other => Err(format!("unknown window region state: {other}")),
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{region_geometry, CORNER_RADIUS};
    use std::ffi::c_void;
    use tauri::WebviewWindow;

    type Hwnd = *mut c_void;
    type Hrgn = *mut c_void;
    type Hgdiobj = *mut c_void;

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateRoundRectRgn(
            left: i32,
            top: i32,
            right: i32,
            bottom: i32,
            ellipse_width: i32,
            ellipse_height: i32,
        ) -> Hrgn;
        fn DeleteObject(object: Hgdiobj) -> i32;
    }

    #[link(name = "user32")]
    extern "system" {
        fn SetWindowRgn(window: Hwnd, region: Hrgn, redraw: i32) -> i32;
    }

    fn physical(value: f64, scale_factor: f64) -> i32 {
        (value * scale_factor).round() as i32
    }

    pub fn apply(window: &WebviewWindow, state: &str, side: &str) -> Result<(), String> {
        let (x, y, width, height) = region_geometry(state, side)?;
        let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;

        let left = physical(x, scale_factor);
        let top = physical(y, scale_factor);
        let right = physical(x + width, scale_factor);
        let bottom = physical(y + height, scale_factor);
        let diameter = physical(CORNER_RADIUS * 2.0, scale_factor).max(2);

        let region = unsafe {
            CreateRoundRectRgn(left, top, right, bottom, diameter, diameter)
        };
        if region.is_null() {
            return Err("CreateRoundRectRgn returned a null region".to_string());
        }

        let result = unsafe { SetWindowRgn(hwnd.0 as Hwnd, region, 1) };
        if result == 0 {
            unsafe {
                DeleteObject(region as Hgdiobj);
            }
            return Err("SetWindowRgn failed".to_string());
        }

        // On success Windows owns the region handle and releases it when replaced.
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::region_geometry;
    use tauri::WebviewWindow;

    pub fn apply(_window: &WebviewWindow, state: &str, side: &str) -> Result<(), String> {
        let _ = region_geometry(state, side)?;
        Ok(())
    }
}
