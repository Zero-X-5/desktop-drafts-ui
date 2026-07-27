import { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut } from 'electron';
import path from 'node:path';
import { readNotes, saveNote, createNote, watchNotes } from './drafts-store.js';

let win;
let tray;

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createTray() {
  tray = new Tray(path.join(app.getAppPath(), 'assets/icon.png'));
  tray.setToolTip('拾笺');

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开拾笺', click: showWindow },
    { label: '新建草稿', click: () => win?.webContents.send('create-note-request') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]));

  tray.on('double-click', showWindow);
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;

  win = new BrowserWindow({
    width: 680,
    height: 460,
    x: width - 696,
    y: 16,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('src/shijian-desktop.html');

  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  watchNotes((change) => {
    win?.webContents.send('notes-changed', change);
  });
}

ipcMain.handle('set-topmost', (_, value) => {
  win?.setAlwaysOnTop(Boolean(value));
});

ipcMain.handle('load-notes', () => readNotes());
ipcMain.handle('save-note', (_, note) => saveNote(note));
ipcMain.handle('create-note', () => createNote());

app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (win?.isVisible()) win.hide();
    else showWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {});
