import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import type { PreviewSide } from "../types";

const DOCK_WIDTH = 286;
const EXPANDED_HEIGHT = 640;
const COLLAPSED_HEIGHT = 64;
const PREVIEW_WIDTH = 500;
const PREVIEW_GAP = 6;
const POSITION_KEY = "shijian-native-position-v1";

const isTauri = "__TAURI_INTERNALS__" in window;
let previewSide: PreviewSide | null = null;
let repositioningPreview = false;
let initialized = false;

function readSavedPosition(): PhysicalPosition | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null") as { x?: number; y?: number } | null;
    return typeof saved?.x === "number" && typeof saved?.y === "number"
      ? new PhysicalPosition(saved.x, saved.y)
      : null;
  } catch {
    return null;
  }
}

async function setWindowSize(width: number, height: number) {
  if (!isTauri) return;
  await getCurrentWindow().setSize(new LogicalSize(width, height));
}

async function repositionPreview() {
  if (!isTauri || !previewSide || repositioningPreview) return;
  repositioningPreview = true;
  try {
  const mainWindow = getCurrentWindow();
  const previewWindow = await WebviewWindow.getByLabel("preview");
  const [position, monitor, scaleFactor] = await Promise.all([
    mainWindow.innerPosition(),
    currentMonitor(),
    mainWindow.scaleFactor(),
  ]);
  if (!monitor || !previewWindow) return;

  const previewPhysicalWidth = Math.round(PREVIEW_WIDTH * scaleFactor);
  const dockPhysicalWidth = Math.round(DOCK_WIDTH * scaleFactor);
  const monitorRight = monitor.position.x + monitor.size.width;
  const leftAvailable = position.x - monitor.position.x;
  const rightAvailable = monitorRight - (position.x + dockPhysicalWidth);
  const currentSideAvailable = previewSide === "left" ? leftAvailable : rightAvailable;
  if (currentSideAvailable < previewPhysicalWidth) {
    previewSide = leftAvailable >= previewPhysicalWidth ? "left" : "right";
  }
  await previewWindow.setPosition(new PhysicalPosition(
    previewSide === "left" ? position.x - previewPhysicalWidth - Math.round(PREVIEW_GAP * scaleFactor) : position.x + dockPhysicalWidth + Math.round(PREVIEW_GAP * scaleFactor),
    position.y,
  ));
  await previewWindow.emit("preview-side-changed", previewSide);
  } finally {
    repositioningPreview = false;
  }
}

export const desktopApi = {
  isNative: isTauri,

  async initialize() {
    document.documentElement.dataset.runtime = isTauri ? "tauri" : "browser";
    if (!isTauri || initialized) return;
    initialized = true;

    const appWindow = getCurrentWindow();
    const savedPosition = readSavedPosition();
    if (savedPosition) await appWindow.setPosition(savedPosition);

    await appWindow.onMoved(({ payload }) => {
      if (previewSide === null) {
        localStorage.setItem(POSITION_KEY, JSON.stringify(payload));
      } else {
        void repositionPreview();
      }
    });

    await appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await appWindow.hide();
    });
  },

  async initializePreviewWindow() {
    if (!isTauri) return;
    const previewWindow = getCurrentWindow();
    await previewWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await previewWindow.hide();
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
    await setWindowSize(DOCK_WIDTH, collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT);
  },

  async showPreview(draftId?: string): Promise<PreviewSide> {
    if (!isTauri) return "left";

    const mainWindow = getCurrentWindow();
    const previewWindow = await WebviewWindow.getByLabel("preview");
    const [position, monitor, scaleFactor] = await Promise.all([
      mainWindow.innerPosition(),
      currentMonitor(),
      mainWindow.scaleFactor(),
    ]);
    if (!previewWindow) throw new Error("预览窗口不可用");
    const previewPhysicalWidth = Math.round(PREVIEW_WIDTH * scaleFactor);
    const dockPhysicalWidth = Math.round(DOCK_WIDTH * scaleFactor);
    const monitorLeft = monitor?.position.x ?? 0;
    const monitorRight = monitor ? monitor.position.x + monitor.size.width : position.x + dockPhysicalWidth + previewPhysicalWidth;
    const availableLeft = position.x - monitorLeft;
    const availableRight = monitorRight - (position.x + dockPhysicalWidth);
    if (!previewSide || (previewSide === "left" && availableLeft < previewPhysicalWidth) || (previewSide === "right" && availableRight < previewPhysicalWidth)) {
      previewSide = availableLeft >= previewPhysicalWidth ? "left" : "right";
    }
    await previewWindow.setPosition(new PhysicalPosition(
      previewSide === "left" ? position.x - previewPhysicalWidth - Math.round(PREVIEW_GAP * scaleFactor) : position.x + dockPhysicalWidth + Math.round(PREVIEW_GAP * scaleFactor),
      position.y,
    ));
    if (draftId) await previewWindow.emit("preview-draft", draftId);
    await previewWindow.show();
    await previewWindow.emit("preview-side-changed", previewSide);
    return previewSide;
  },

  async hidePreview() {
    if (!isTauri) {
      previewSide = null;
      return;
    }

    const previewWindow = await WebviewWindow.getByLabel("preview");
    await previewWindow?.hide();
    previewSide = null;
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

  async onPreviewSideChange(handler: (side: PreviewSide) => void): Promise<UnlistenFn> {
    if (!isTauri) return () => undefined;
    return listen<PreviewSide>("preview-side-changed", (event) => handler(event.payload));
  },

  async onPreviewDraft(handler: (draftId: string) => void): Promise<UnlistenFn> {
    if (!isTauri) return () => undefined;
    return listen<string>("preview-draft", (event) => handler(event.payload));
  },

  async notifyPreviewDeleted(draftId: string) {
    if (!isTauri) return;
    const mainWindow = await WebviewWindow.getByLabel("main");
    await mainWindow?.emit("preview-draft-deleted", draftId);
  },

  async onPreviewDraftDeleted(handler: (draftId: string) => void): Promise<UnlistenFn> {
    if (!isTauri) return () => undefined;
    return listen<string>("preview-draft-deleted", (event) => handler(event.payload));
  },
};
