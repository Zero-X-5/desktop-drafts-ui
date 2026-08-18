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

for mode in ("crystal", "thin-acrylic", "acrylic", "blur"):
    assert f'data-mode="{mode}"' in index
assert "Crystal Glass Test" in index
assert "data-tauri-drag-region" in index
assert "material-card" in index
assert "glass-sheen-a" in index and "glass-sheen-b" in index

assert "window.__TAURI__?.window" in js
assert "getCurrentWindow()" in js
assert "appWindow.setEffects" in js
assert "appWindow.clearEffects" in js
assert "Array.isArray(spec.color)" in js
assert "effects.color = spec.color" in js
assert "glass-test-config.json" in js

assert config["initialMode"] == "crystal"
assert config["shortcuts"] == {
    "1": "crystal",
    "2": "thin-acrylic",
    "3": "acrylic",
    "4": "blur",
}
assert config["modes"]["crystal"]["effect"] is None
assert config["modes"]["crystal"]["color"] is None
assert config["modes"]["thin-acrylic"]["effect"] == "acrylic"
assert config["modes"]["thin-acrylic"]["color"] == [92, 170, 226, 12]
assert config["modes"]["acrylic"]["effect"] == "acrylic"
assert config["modes"]["acrylic"]["color"] == [92, 170, 226, 78]
assert config["modes"]["blur"]["effect"] == "blur"
assert config["modes"]["blur"]["color"] == [92, 170, 226, 78]

assert "background: transparent" in css
assert "grid-template-columns: repeat(4, minmax(0, 1fr))" in css
assert "border-radius: 28px" in css
assert "rgba(80, 154, 207, .030)" in css
assert "rgba(235, 248, 255, .045)" in css
assert css.count("backdrop-filter: none") >= 4
assert "blur(14px)" not in css
assert "window_region" not in lib
assert "SetWindowRgn" not in lib
assert "tauri_plugin" not in lib
assert "WGC" not in js and "D3D11" not in js

print("Tauri four-mode glass effects static validation: PASS")
print("Crystal clear-glass visual contract: PASS")
