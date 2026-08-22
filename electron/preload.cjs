const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  isElectron: true,
  toggleClickThrough: () => ipcRenderer.invoke("overlay:toggle-click-through"),
  setClickThrough: (enabled) => ipcRenderer.invoke("overlay:set-click-through", enabled),
  setOverlayVisible: (visible) => ipcRenderer.invoke("overlay:set-visible", visible),
  getSettings: () => ipcRenderer.invoke("overlay:get-settings"),
  updateSettings: (patch) => ipcRenderer.invoke("overlay:update-settings", patch),
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("overlay:settings-changed", listener);
    return () => ipcRenderer.removeListener("overlay:settings-changed", listener);
  },
  getLaunchOnStartup: () => ipcRenderer.invoke("overlay:get-launch-on-startup"),
  setLaunchOnStartup: (enabled) => ipcRenderer.invoke("overlay:set-launch-on-startup", enabled),
  quit: () => ipcRenderer.invoke("overlay:quit"),
  dragStart: () => ipcRenderer.invoke("overlay:drag-start"),
  dragEnd: () => ipcRenderer.invoke("overlay:drag-end"),
  resizeStart: () => ipcRenderer.invoke("overlay:resize-start"),
  resizeEnd: () => ipcRenderer.invoke("overlay:resize-end"),
});
