const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  isElectron: true,
  toggleClickThrough: () => ipcRenderer.invoke("overlay:toggle-click-through"),
  setClickThrough: (enabled) => ipcRenderer.invoke("overlay:set-click-through", enabled),
  quit: () => ipcRenderer.invoke("overlay:quit"),
  dragStart: () => ipcRenderer.invoke("overlay:drag-start"),
  dragEnd: () => ipcRenderer.invoke("overlay:drag-end"),
  resizeStart: () => ipcRenderer.invoke("overlay:resize-start"),
  resizeEnd: () => ipcRenderer.invoke("overlay:resize-end"),
});
