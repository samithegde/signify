const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } = require("electron");

// The overlay renders the Lovable app. In dev it points at the Vite server;
// packaged builds read OVERLAY_URL (your published app URL).
const APP_URL = process.env.OVERLAY_URL || "http://localhost:8080/";

let win = null;
let clickThrough = false;

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
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: require("path").join(__dirname, "preload.cjs"),
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

ipcMain.handle("overlay:toggle-click-through", () => {
  clickThrough = !clickThrough;
  win?.setIgnoreMouseEvents(clickThrough, { forward: true });
  return clickThrough;
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

ipcMain.handle("overlay:quit", () => app.quit());


app.whenReady().then(() => {
  createWindow();
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => globalShortcut.unregisterAll());
