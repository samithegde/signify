const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
} = require("electron");
const path = require("path");

// In dev the overlay points at the Vite server; packaged builds read OVERLAY_URL.
const APP_URL = process.env.OVERLAY_URL || "http://localhost:8080/";
const APP_ICON = path.join(__dirname, "..", "assets", "signifyicon.png");

let win = null;
let dashboard = null;
let tray = null;
let clickThrough = false;
let isQuitting = false;
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

function getOverlayVisible() {
  return Boolean(win && !win.isDestroyed() && win.isVisible());
}

function broadcastOverlayVisibility() {
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.webContents.send(
      "overlay:visibility-changed",
      getOverlayVisible(),
    );
  }
}

function requestQuit() {
  isQuitting = true;
  app.quit();
}

function showOverlay() {
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  updateTrayMenu();
  broadcastOverlayVisibility();
  return getOverlayVisible();
}

function hideOverlay() {
  if (win && !win.isDestroyed()) win.hide();
  updateTrayMenu();
  broadcastOverlayVisibility();
  return getOverlayVisible();
}

function showDashboard() {
  if (!dashboard || dashboard.isDestroyed()) createDashboard();
  if (dashboard.isMinimized()) dashboard.restore();
  dashboard.show();
  dashboard.focus();
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: win?.isVisible() ? "Hide Overlay" : "Show Overlay",
        click: () => {
          if (!win || win.isDestroyed()) return showOverlay();
          win.isVisible() ? hideOverlay() : showOverlay();
        },
      },
      {
        label: dashboard?.isVisible() ? "Hide Dashboard" : "Open Dashboard",
        click: () => {
          if (!dashboard || dashboard.isDestroyed()) return showDashboard();
          dashboard.isVisible() ? dashboard.hide() : showDashboard();
          updateTrayMenu();
        },
      },
      { type: "separator" },
      { label: "Quit Signify", click: requestQuit },
    ]),
  );
}

function createTray() {
  if (tray) return;

  tray = new Tray(APP_ICON);
  tray.setToolTip("Signify");
  tray.on("click", showOverlay);
  tray.on("double-click", showDashboard);
  updateTrayMenu();
}

function installAltF4Quit(window) {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.alt && input.key === "F4") {
      event.preventDefault();
      requestQuit();
    }
  });
}

function hideToTrayOnClose(window) {
  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
    updateTrayMenu();
    if (window === win) broadcastOverlayVisibility();
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
  installAltF4Quit(win);
  hideToTrayOnClose(win);
  win.on("show", () => {
    updateTrayMenu();
    broadcastOverlayVisibility();
  });
  win.on("hide", () => {
    updateTrayMenu();
    broadcastOverlayVisibility();
  });

  // Auto-approve screen sharing so getDisplayMedia() needs no picker.
  win.webContents.session.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
        callback({ video: sources[0], audio: "loopback" });
      });
    },
  );
}

function createDashboard() {
  dashboard = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 760,
    minHeight: 580,
    title: "Signify Dashboard",
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
  installAltF4Quit(dashboard);
  hideToTrayOnClose(dashboard);
  dashboard.on("show", updateTrayMenu);
  dashboard.on("hide", updateTrayMenu);
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
  return visible ? showOverlay() : hideOverlay();
});

ipcMain.handle("overlay:get-visible", () => getOverlayVisible());

ipcMain.handle("overlay:open-dashboard", () => {
  showDashboard();
});

ipcMain.handle("overlay:get-settings", () => overlaySettings);

ipcMain.handle("overlay:update-settings", (_event, patch) => {
  if (patch && typeof patch === "object") {
    if (patch.mode === "sign-to-words" || patch.mode === "words-to-sign") {
      overlaySettings.mode = patch.mode;
    }
    if (typeof patch.opacity === "number") {
      overlaySettings.opacity = Math.min(
        90,
        Math.max(42, Math.round(patch.opacity)),
      );
    }
    if (typeof patch.voiceOn === "boolean") {
      overlaySettings.voiceOn = patch.voiceOn;
    }
  }

  broadcastSettings();
  return overlaySettings;
});

ipcMain.handle(
  "overlay:get-launch-on-startup",
  () => app.getLoginItemSettings().openAtLogin,
);

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
    win.setPosition(
      Math.round(point.x - offsetX),
      Math.round(point.y - offsetY),
    );
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

ipcMain.handle("overlay:quit", () => requestQuit());

app.whenReady().then(() => {
  app.setAppUserModelId("com.signify.dialogue-overlay");
  createTray();
  createWindow();
  createDashboard();
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    if (!win || win.isDestroyed()) return showOverlay();
    win.isVisible() ? hideOverlay() : showOverlay();
  });
  globalShortcut.register("CommandOrControl+Shift+D", () => {
    if (!dashboard || dashboard.isDestroyed()) return showDashboard();
    dashboard.isVisible() ? dashboard.hide() : showDashboard();
    updateTrayMenu();
  });
});

app.on("window-all-closed", () => {
  if (isQuitting) app.quit();
});
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("will-quit", () => globalShortcut.unregisterAll());
