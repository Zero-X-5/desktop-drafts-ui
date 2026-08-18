import json
from pathlib import Path

root = Path(__file__).resolve().parent
index = (root / "src" / "index.html").read_text(encoding="utf-8")
js = (root / "src" / "main.js").read_text(encoding="utf-8")
css = (root / "src" / "styles.css").read_text(encoding="utf-8")
config = json.loads((root / "src" / "glass-test-config.json").read_text(encoding="utf-8"))
tauri = json.loads((root / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
cap = json.loads((root / "src-tauri" / "capabilities" / "default.json").read_text(encoding="utf-8"))
lib = (root / "src-tauri" / "src" / "lib.rs").read_text(encoding="utf-8")

window = tauri["app"]["windows"][0]
assert window["label"] == "main"
assert window["width"] == 520 and window["height"] == 360
assert window["transparent"] is True
assert window["decorations"] is False
assert window["resizable"] is False
assert window["noRedirectionBitmap"] is True
assert window["backgroundColor"] == "#00000000"
assert tauri["app"]["withGlobalTauri"] is True

assert "core:window:allow-set-effects" in cap["permissions"]
assert "core:window:allow-start-dragging" in cap["permissions"]
assert "core:window:allow-close" in cap["permissions"]

assert 'data-mode="acrylic"' in index
assert 'data-mode="blur"' in index
assert 'data-mode="transparent"' in index
assert "data-tauri-drag-region" in index
assert "material-card" in index
assert "glass-sheen-a" in index and "glass-sheen-b" in index

assert "window.__TAURI__?.window" in js
assert "getCurrentWindow()" in js
assert "appWindow.setEffects" in js
assert "appWindow.clearEffects" in js
assert "glass-test-config.json" in js

assert config["initialMode"] == "acrylic"
assert config["effectColor"] == [92, 170, 226, 78]
assert config["modes"]["acrylic"]["effect"] == "acrylic"
assert config["modes"]["blur"]["effect"] == "blur"
assert config["modes"]["transparent"]["effect"] is None
assert config["shortcuts"] == {"1": "acrylic", "2": "blur", "3": "transparent"}

assert "background: transparent" in css
assert "--glass-blue" in css
assert "border-radius: 28px" in css
assert "backdrop-filter: blur(14px)" in css
assert "inset 0 1px 0 rgba(255, 255, 255, .94)" in css
assert "window_region" not in lib
assert "SetWindowRgn" not in lib
assert "tauri_plugin" not in lib
assert "WGC" not in js and "D3D11" not in js

print("Tauri glass effects test static validation: PASS")
print("Layered blue-white acrylic visual contract: PASS")
