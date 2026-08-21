const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  isElectron: true,
  toggleClickThrough: () => ipcRenderer.invoke("overlay:toggle-click-through"),
  quit: () => ipcRenderer.invoke("overlay:quit"),
});
