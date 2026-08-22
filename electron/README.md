# Sign Overlay (Electron shell)

The Electron shell is a transparent, always-on-top, frameless window that loads the
React overlay and auto-approves screen capture, so local hand-sign recognition can
read signing from anything on your screen (video call, recording, streaming player).

## Run locally

```bash
npm install --save-dev electron @electron/packager
npm run dev            # terminal 1: the React app on http://localhost:8080
npx electron .         # terminal 2: the overlay window
```

Point the shell at a deployed build instead:

```bash
OVERLAY_URL="https://your-app.example.com/" npx electron .
```

## Package

```bash
npx @electron/packager . "SignOverlay" --platform=linux --arch=x64 \
  --out=electron-release --overwrite --ignore='node_modules' \
  --ignore='^/src' --ignore='^/electron-release'
```

Use `--platform=darwin` or `--platform=win32` for macOS / Windows builds.

## Shortcuts

- `Ctrl/Cmd + Shift + O` — hide/show the overlay
- Ghost button in the overlay — make the window click-through
