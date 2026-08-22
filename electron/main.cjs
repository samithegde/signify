const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } = require("electron");
const path = require("path");

// In dev the overlay points at the Vite server; packaged builds read OVERLAY_URL.
const APP_URL = process.env.OVERLAY_URL || "http://localhost:8080/";
const APP_ICON = path.join(__dirname, "..", "assets", "signifyicon.png");

let win = null;
let dashboard = null;
let clickThrough = false;
const DASHBOARD_URL = `${APP_URL}${APP_URL.includes("?") ? "&" : "?"}dashboard=1`;
const overlaySettings = {
  mode: "sign-to-words",
  opacity: 68,
  voiceOn: true,
};

function broadcastSettings() {
  [win, dashboard].forEach((target) => {
    if (target && !target.isDestroyed()) {
      target.webContents.send("overlay:settings-changed", overlaySettings);
    }
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 520,
    height: 300,
    x: Math.round(width / 2 - 260),
    y: height - 340,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 360,
    minHeight: 180,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: APP_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(APP_URL);

  // Auto-approve screen sharing so getDisplayMedia() needs no picker.
  win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      callback({ video: sources[0], audio: "loopback" });
    });
  });
}

function createDashboard() {
  dashboard = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 760,
    minHeight: 580,
    title: "Sign Overlay Dashboard",
    backgroundColor: "#101820",
    icon: APP_ICON,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  dashboard.loadURL(DASHBOARD_URL);
  dashboard.once("ready-to-show", () => dashboard.show());
  dashboard.on("closed", () => {
    dashboard = null;
  });
}

ipcMain.handle("overlay:toggle-click-through", () => {
  clickThrough = !clickThrough;
  win?.setIgnoreMouseEvents(clickThrough, { forward: true });
  return clickThrough;
});

ipcMain.handle("overlay:set-click-through", (_event, enabled) => {
  clickThrough = Boolean(enabled);
  win?.setIgnoreMouseEvents(clickThrough, { forward: true });
  return clickThrough;
});

ipcMain.handle("overlay:set-visible", (_event, visible) => {
  if (visible) win?.show();
  else win?.hide();
  return Boolean(visible);
});

ipcMain.handle("overlay:get-settings", () => overlaySettings);

ipcMain.handle("overlay:update-settings", (_event, patch) => {
  if (patch && typeof patch === "object") {
    if (patch.mode === "sign-to-words" || patch.mode === "words-to-sign") {
      overlaySettings.mode = patch.mode;
    }
    if (typeof patch.opacity === "number") {
      overlaySettings.opacity = Math.min(90, Math.max(42, Math.round(patch.opacity)));
    }
    if (typeof patch.voiceOn === "boolean") {
      overlaySettings.voiceOn = patch.voiceOn;
    }
  }

  broadcastSettings();
  return overlaySettings;
});

ipcMain.handle("overlay:get-launch-on-startup", () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle("overlay:set-launch-on-startup", (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return app.getLoginItemSettings().openAtLogin;
});

// Manual window dragging: follow the OS cursor while the user holds the header.
let dragTimer = null;

function stopDrag() {
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
}

ipcMain.handle("overlay:drag-start", () => {
  if (!win) return;
  stopDrag();
  const start = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const offsetX = start.x - winX;
  const offsetY = start.y - winY;

  dragTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return stopDrag();
    const point = screen.getCursorScreenPoint();
    win.setPosition(Math.round(point.x - offsetX), Math.round(point.y - offsetY));
  }, 8);
});

ipcMain.handle("overlay:drag-end", () => stopDrag());

// Manual resizing from the corner grip.
let resizeTimer = null;

function stopResize() {
  if (resizeTimer) clearInterval(resizeTimer);
  resizeTimer = null;
}

ipcMain.handle("overlay:resize-start", () => {
  if (!win) return;
  stopResize();
  const [x, y] = win.getPosition();

  resizeTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return stopResize();
    const point = screen.getCursorScreenPoint();
    win.setBounds({
      x,
      y,
      width: Math.max(360, Math.round(point.x - x)),
      height: Math.max(180, Math.round(point.y - y)),
    });
  }, 16);
});

ipcMain.handle("overlay:resize-end", () => stopResize());

ipcMain.handle("overlay:quit", () => app.quit());


app.whenReady().then(() => {
  app.setAppUserModelId("com.signify.dialogue-overlay");
  createWindow();
  createDashboard();
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
  globalShortcut.register("CommandOrControl+Shift+D", () => {
    if (!dashboard) return createDashboard();
    dashboard.isVisible() ? dashboard.hide() : dashboard.show();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => globalShortcut.unregisterAll());
