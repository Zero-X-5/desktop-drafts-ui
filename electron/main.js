import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'node:path';
import { readNotes, saveNote, createNote, watchNotes } from './drafts-store.js';

let win;

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

  watchNotes((change)=>{
    win?.webContents.send('notes-changed', change);
  });
}

ipcMain.handle('set-topmost', (_, value) => {
  win?.setAlwaysOnTop(Boolean(value));
});

ipcMain.handle('load-notes', () => readNotes());
ipcMain.handle('save-note', (_, note) => saveNote(note));
ipcMain.handle('create-note', () => createNote());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});