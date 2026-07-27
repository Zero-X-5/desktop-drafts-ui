const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shijian', {
  setTopmost(value) {
    ipcRenderer.invoke('set-topmost', value);
  },
  loadNotes() {
    return ipcRenderer.invoke('load-notes');
  },
  saveNote(note) {
    return ipcRenderer.invoke('save-note', note);
  },
  createNote() {
    return ipcRenderer.invoke('create-note');
  }
});
