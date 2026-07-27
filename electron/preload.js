const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shijian', {
  setTopmost(value) {
    ipcRenderer.invoke('set-topmost', value);
  },
  loadNotes() {
    return ipcRenderer.invoke('load-notes');
  },\n  saveNote(note) {
    return ipcRenderer.invoke('save-note', note);
  },
  createNote() {
    return ipcRenderer.invoke('create-note');
  },
  toggleWindow() {
    return ipcRenderer.invoke('toggle-window');
  },
  onNotesChanged(callback) {
    ipcRenderer.on('notes-changed', (_, data) => callback(data));
  }
});
