import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';

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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
