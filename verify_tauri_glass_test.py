import json
from pathlib import Path

root = Path(__file__).resolve().parent
index = (root / "src" / "index.html").read_text(encoding="utf-8")
js = (root / "src" / "main.js").read_text(encoding="utf-8")
css = (root / "src" / "styles.css").read_text(encoding="utf-8")
config = json.loads((root / "src" / "glass-test-config.json").read_text(encoding="utf-8"))
tauri = json.loads((root / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
plate = json.loads((root / "src-tauri" / "native-plate.json").read_text(encoding="utf-8"))
cap = json.loads((root / "src-tauri" / "capabilities" / "default.json").read_text(encoding="utf-8"))
lib = (root / "src-tauri" / "src" / "lib.rs").read_text(encoding="utf-8")
cargo = (root / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")

window = tauri["app"]["windows"][0]
assert window["label"] == "main"
assert window["width"] == 620 and window["height"] == 430
assert window["transparent"] is True
assert window["decorations"] is False
assert window["resizable"] is False
assert window["noRedirectionBitmap"] is True
assert window["backgroundColor"] == "#00000000"
assert tauri["app"]["withGlobalTauri"] is True

assert "core:window:allow-set-effects" in cap["permissions"]
assert "core:window:allow-start-dragging" in cap["permissions"]
assert "core:window:allow-close" in cap["permissions"]

modes = (
    "pure",
    "edge",
    "tint",
    "frost",
    "acrylic-0",
    "acrylic-12",
    "acrylic-78",
    "blur-0",
    "native-acrylic",
    "native-blur",
)
for mode in modes:
    assert f'data-mode="{mode}"' in index

assert "Glass Transparency Lab" in index
assert "local native plate" in index
assert "Native Acrylic Plate" in index
assert "Native Blur Plate" in index
assert "data-tauri-drag-region" in index
assert "cssProfile" in index
assert "tintAlpha" in index

assert "window.__TAURI__?.window" in js
assert "window.__TAURI__?.core" in js
assert "getCurrentWindow()" in js
assert "tauriCore.invoke('set_native_plate'" in js
assert "await setNativePlate(null)" in js
assert "await setNativePlate(spec.nativePlate)" in js
assert "appWindow.setEffects" in js
assert "appWindow.clearEffects" in js
assert "dataset.profile" in js
assert "dataset.nativePlate" in js
assert "spec?.cssProfile" in js
assert "Array.isArray(spec.color)" in js
assert "effects.color = spec.color" in js

assert config["initialMode"] == "pure"
assert config["shortcuts"] == {
    "1": "pure",
    "2": "edge",
    "3": "tint",
    "4": "frost",
    "5": "acrylic-0",
    "6": "acrylic-12",
    "7": "acrylic-78",
    "8": "blur-0",
    "9": "native-acrylic",
    "0": "native-blur",
}

for mode in ("pure", "edge", "tint", "frost", "native-acrylic", "native-blur"):
    assert config["modes"][mode]["effect"] is None
    assert config["modes"][mode]["color"] is None

assert config["modes"]["pure"]["cssProfile"] == "pure"
assert config["modes"]["edge"]["cssProfile"] == "edge"
assert config["modes"]["tint"]["cssProfile"] == "tint"
assert config["modes"]["frost"]["cssProfile"] == "frost"

assert config["modes"]["acrylic-0"]["effect"] == "acrylic"
assert config["modes"]["acrylic-0"]["color"] == [92, 170, 226, 0]
assert config["modes"]["acrylic-12"]["color"] == [92, 170, 226, 12]
assert config["modes"]["acrylic-78"]["color"] == [92, 170, 226, 78]
assert config["modes"]["blur-0"]["effect"] == "blur"
assert config["modes"]["blur-0"]["color"] == [92, 170, 226, 0]
for mode in ("acrylic-0", "acrylic-12", "acrylic-78", "blur-0"):
    assert config["modes"][mode]["cssProfile"] == "edge"

assert config["modes"]["native-acrylic"]["cssProfile"] == "edge"
assert config["modes"]["native-acrylic"]["nativePlate"] == "acrylic"
assert config["modes"]["native-blur"]["cssProfile"] == "edge"
assert config["modes"]["native-blur"]["nativePlate"] == "blur"

assert plate == {
    "x": 120,
    "y": 0,
    "width": 500,
    "height": 430,
    "acrylicColor": [92, 170, 226, 0],
    "blurColor": [92, 170, 226, 0],
}

assert 'features = ["tray-icon", "unstable"]' in cargo
assert 'include_str!("../native-plate.json")' in lib
assert 'WindowBuilder::new(app, "native-plate")' in lib
assert ".parent_raw(main.hwnd()?)" in lib
assert ".position(config.x, config.y)" in lib
assert ".inner_size(config.width, config.height)" in lib
assert ".always_on_bottom(true)" in lib
assert "plate.set_ignore_cursor_events(true)" in lib
assert '"acrylic" => Effect::Acrylic' in lib
assert '"blur" => Effect::Blur' in lib
assert "set_native_plate" in lib
assert "generate_handler![set_native_plate]" in lib

assert "background: transparent" in css
assert "grid-template-columns: repeat(5, minmax(0, 1fr))" in css
assert 'data-profile="edge"' in css
assert 'data-profile="tint"' in css
assert 'data-profile="frost"' in css
assert "backdrop-filter: blur(4px)" in css
assert "window_region" not in lib
assert "SetWindowRgn" not in lib
assert "WGC" not in js and "D3D11" not in js

print("Tauri ten-mode glass transparency ladder: PASS")
print("Whole-window Acrylic alpha 0 / 12 / 78 isolation: PASS")
print("Native Acrylic / Blur child-HWND plate contract: PASS")
