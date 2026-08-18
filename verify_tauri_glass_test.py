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
    "split-acrylic",
    "split-clear",
)
for mode in modes:
    assert f'data-mode="{mode}"' in index

assert "Glass Transparency Lab" in index
assert "data-tauri-drag-region" in index
assert "cssProfile" in index
assert "tintAlpha" in index
assert "Split Acrylic" in index
assert "Split Clear" in index

assert "window.__TAURI__?.window" in js
assert "getCurrentWindow()" in js
assert "appWindow.setEffects" in js
assert "appWindow.clearEffects" in js
assert "dataset.profile" in js
assert "spec?.cssProfile" in js
assert "Array.isArray(spec?.color)" in js
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
    "9": "split-acrylic",
    "0": "split-clear",
}

for mode in ("pure", "edge", "tint", "frost", "split-clear"):
    assert config["modes"][mode]["effect"] is None
    assert config["modes"][mode]["color"] is None

assert config["modes"]["pure"]["cssProfile"] == "pure"
assert config["modes"]["edge"]["cssProfile"] == "edge"
assert config["modes"]["tint"]["cssProfile"] == "tint"
assert config["modes"]["frost"]["cssProfile"] == "frost"
assert config["modes"]["split-clear"]["cssProfile"] == "split"

assert config["modes"]["acrylic-0"]["effect"] == "acrylic"
assert config["modes"]["acrylic-0"]["color"] == [92, 170, 226, 0]
assert config["modes"]["acrylic-12"]["color"] == [92, 170, 226, 12]
assert config["modes"]["acrylic-78"]["color"] == [92, 170, 226, 78]
assert config["modes"]["blur-0"]["effect"] == "blur"
assert config["modes"]["blur-0"]["color"] == [92, 170, 226, 0]
for mode in ("acrylic-0", "acrylic-12", "acrylic-78", "blur-0"):
    assert config["modes"][mode]["cssProfile"] == "edge"

assert config["modes"]["split-acrylic"]["effect"] == "acrylic"
assert config["modes"]["split-acrylic"]["color"] == [92, 170, 226, 0]
assert config["modes"]["split-acrylic"]["cssProfile"] == "split"

assert "background: transparent" in css
assert "grid-template-columns: repeat(5, minmax(0, 1fr))" in css
assert 'data-profile="edge"' in css
assert 'data-profile="tint"' in css
assert 'data-profile="frost"' in css
assert 'data-profile="split"' in css
assert "backdrop-filter: blur(4px)" in css
assert "backdrop-filter: blur(14px)" in css
assert "mask-image: linear-gradient" in css
assert "left: 22%" in css
assert "rgba(255, 248, 240, .19)" in css
assert "window_region" not in lib
assert "SetWindowRgn" not in lib
assert "tauri_plugin" not in lib
assert "WGC" not in js and "D3D11" not in js

print("Tauri ten-mode glass transparency ladder: PASS")
print("Pure / Edge / Tint / Frost CSS isolation: PASS")
print("Acrylic alpha 0 / 12 / 78 comparison contract: PASS")
print("Split Acrylic / Split Clear reference isolation: PASS")
