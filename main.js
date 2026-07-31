const path = require('node:path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

const DIRECTORY_WIDTH = 248;
const PREVIEW_WIDTH = 472;
const COLLAPSED_HEIGHT = 36;
const WINDOW_MARGIN = 16;

let mainWindow = null;
let moveNotificationTimer = null;

function windowFromEvent(event) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) throw new Error('Desktop window is unavailable.');
  return window;
}

function finiteInteger(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`);
  return Math.round(value);
}

function safeLayout(input) {
  const width = finiteInteger(input?.width, 'width');
  const height = finiteInteger(input?.height, 'height');
  const directoryLeft = finiteInteger(input?.directoryLeft, 'directoryLeft');
  const side = input?.side === 'left' ? 'left' : 'right';

  if (width < DIRECTORY_WIDTH || width > DIRECTORY_WIDTH + PREVIEW_WIDTH) {
    throw new RangeError('width is outside the supported preview range.');
  }
  if (height < COLLAPSED_HEIGHT || height > 480) {
    throw new RangeError('height is outside the supported window range.');
  }

  const previewOffset = Math.max(0, width - DIRECTORY_WIDTH);
  const x = side === 'left' ? directoryLeft - previewOffset : directoryLeft;
  return { x, width, height };
}

function currentWindowContext(window) {
  const bounds = window.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;

  return {
    position: { x: bounds.x, y: bounds.y },
    monitor: {
      position: { x: workArea.x, y: workArea.y },
      size: { width: workArea.width, height: workArea.height },
      scaleFactor: display.scaleFactor,
    },
  };
}

function registerWindowIpc() {
  ipcMain.handle('window:get-context', event => currentWindowContext(windowFromEvent(event)));

  ipcMain.handle('window:apply-layout', (event, input) => {
    const window = windowFromEvent(event);
    const current = window.getBounds();
    const layout = safeLayout(input);
    window.setBounds({ x: layout.x, y: current.y, width: layout.width, height: layout.height }, false);
    return currentWindowContext(window);
  });

  ipcMain.handle('window:set-always-on-top', (event, value) => {
    const window = windowFromEvent(event);
    window.setAlwaysOnTop(Boolean(value), 'floating');
    return window.isAlwaysOnTop();
  });

  ipcMain.handle('window:minimize', event => {
    windowFromEvent(event).minimize();
  });
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const x = workArea.x + workArea.width - DIRECTORY_WIDTH - WINDOW_MARGIN;
  const y = workArea.y + WINDOW_MARGIN;

  mainWindow = new BrowserWindow({
    x,
    y,
    width: DIRECTORY_WIDTH,
    height: COLLAPSED_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  });

  if (process.platform === 'win32') {
    try {
      mainWindow.setBackgroundMaterial('acrylic');
    } catch (error) {
      console.warn('Windows Acrylic is unavailable; using transparent CSS fallback.', error);
    }
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.setZoomFactor(1);

  mainWindow.on('move', () => {
    clearTimeout(moveNotificationTimer);
    moveNotificationTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window:moved');
      }
    }, 80);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  registerWindowIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
