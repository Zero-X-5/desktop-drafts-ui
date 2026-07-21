import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import type { PreviewSide } from "../types";

const DOCK_WIDTH = 286;
const PREVIEW_WIDTH = 500;
const WINDOW_GAP = 6;
const EXPANDED_HEIGHT = 640;
const COLLAPSED_HEIGHT = 64;
const POSITION_KEY = "shijian-native-position-v1";
const isTauri = "__TAURI_INTERNALS__" in window;
let previewSide: PreviewSide | null = null;
let dockPosition: PhysicalPosition | null = null;

function readSavedPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null") as { x?: number; y?: number } | null;
    return typeof saved?.x === "number" && typeof saved?.y === "number" ? new PhysicalPosition(saved.x, saved.y) : null;
  } catch {
    return null;
  }
}

async function setSize(width: number, height: number) {
  if (isTauri) await getCurrentWindow().setSize(new LogicalSize(width, height));
}

async function getLayout() {
  const appWindow = getCurrentWindow();
  const [position, monitor, scaleFactor] = await Promise.all([appWindow.innerPosition(), currentMonitor(), appWindow.scaleFactor()]);
  const dockWidth = Math.round(DOCK_WIDTH * scaleFactor);
  const previewWidth = Math.round(PREVIEW_WIDTH * scaleFactor);
  const gap = Math.round(WINDOW_GAP * scaleFactor);
  const monitorLeft = monitor?.position.x ?? 0;
  const monitorRight = monitor ? monitor.position.x + monitor.size.width : position.x + dockWidth + previewWidth + gap;
  const leftAvailable = position.x - monitorLeft;
  const rightAvailable = monitorRight - (position.x + dockWidth);
  return { appWindow, position, scaleFactor, dockWidth, previewWidth, gap, leftAvailable, rightAvailable };
}

export const desktopApi = {
  isNative: isTauri,

  async initialize() {
    document.documentElement.dataset.runtime = isTauri ? "tauri" : "browser";
    if (!isTauri) return;
    const appWindow = getCurrentWindow();
    const savedPosition = readSavedPosition();
    if (savedPosition) await appWindow.setPosition(savedPosition);
    await appWindow.onMoved(({ payload }) => {
      if (!previewSide) {
        dockPosition = new PhysicalPosition(payload.x, payload.y);
        localStorage.setItem(POSITION_KEY, JSON.stringify(payload));
      }
    });
    await appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await appWindow.hide();
    });
  },

  async startDragging() {
    if (isTauri) await getCurrentWindow().startDragging();
  },

  async setAlwaysOnTop(enabled: boolean) {
    if (isTauri) await getCurrentWindow().setAlwaysOnTop(enabled);
  },

  async hideToTray() {
    if (isTauri) await getCurrentWindow().hide();
  },

  async setCollapsed(collapsed: boolean) {
    await this.hidePreview();
    await setSize(DOCK_WIDTH, collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT);
  },

  async showPreview(): Promise<PreviewSide> {
    if (!isTauri) return "left";
    const layout = await getLayout();
    if (!dockPosition) dockPosition = new PhysicalPosition(layout.position.x, layout.position.y);
    previewSide = layout.leftAvailable >= layout.previewWidth + layout.gap ? "left" : "right";
    const windowX = previewSide === "left" ? dockPosition.x - layout.previewWidth - layout.gap : dockPosition.x;
    await layout.appWindow.setPosition(new PhysicalPosition(windowX, dockPosition.y));
    await setSize(DOCK_WIDTH + PREVIEW_WIDTH + WINDOW_GAP, EXPANDED_HEIGHT);
    return previewSide;
  },

  async hidePreview() {
    if (!isTauri) return;
    const layout = await getLayout();
    const currentPosition = await layout.appWindow.innerPosition();
    const dockX = previewSide === "left" ? currentPosition.x + layout.previewWidth + layout.gap : currentPosition.x;
    dockPosition = new PhysicalPosition(dockX, currentPosition.y);
    previewSide = null;
    await layout.appWindow.setPosition(dockPosition);
    await setSize(DOCK_WIDTH, EXPANDED_HEIGHT);
  },

  async getAutostart() {
    return isTauri ? isAutostartEnabled() : localStorage.getItem("shijian-browser-autostart") === "true";
  },

  async setAutostart(enabled: boolean) {
    if (isTauri) {
      if (enabled) await enableAutostart();
      else await disableAutostart();
      return;
    }
    localStorage.setItem("shijian-browser-autostart", String(enabled));
  },

  async onTrayNewDraft(handler: () => void): Promise<UnlistenFn> {
    if (!isTauri) return () => undefined;
    return listen("tray-new-draft", handler);
  },
};
