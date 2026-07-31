const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  getContext: () => ipcRenderer.invoke('window:get-context'),
  applyLayout: layout => ipcRenderer.invoke('window:apply-layout', layout),
  setAlwaysOnTop: value => ipcRenderer.invoke('window:set-always-on-top', Boolean(value)),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  onMoved: callback => {
    const listener = () => callback();
    ipcRenderer.on('window:moved', listener);
    return () => ipcRenderer.removeListener('window:moved', listener);
  },
});
