# Signify by Samit Hegde
<img width="1640" height="664" alt="signifywordmark" src="https://github.com/user-attachments/assets/472b7902-ee2d-410d-ae5d-4baade72122b" />

A desktop accessibility tool that uses Google Gemini Vision to interpret ASL fingerspelling and short sign-language phrases from screen content. Results appear as live captions and can optionally be spoken aloud.

## Features

- Transparent, always-on-top overlay
- Separate taskbar dashboard
- Google Gemini Vision sign interpretation
- ASL letter and phrase recognition
- Text-to-sign fingerspelling display
- Computer-audio transcription
- Optional spoken output
- Click-through overlay mode
- Adjustable overlay opacity
- Global keyboard shortcuts
- Quick phrase dictionary

## How It Works

The Electron shell creates two windows:

### Overlay Window

- Transparent
- Always on top
- Hidden from the taskbar
- Captures selected screen content
- Sends short frame bursts to Google Gemini
- Displays recognized captions

### Dashboard Window

- Appears in the taskbar
- Configures overlay settings
- Controls translation mode
- Adjusts opacity
- Enables spoken output
- Shows or hides the overlay
- Controls launch-on-startup behavior

Google Gemini receives consecutive screen frames and returns the interpreted text with a confidence score. Low-confidence results are ignored.

The project also retains the previous MediaPipe landmark implementation for experimentation, but Gemini is the active recognition system.

## Requirements

- Node.js 18 or newer
- npm
- Electron-compatible desktop environment
- Google Gemini API key
- Screen-sharing support

## Installation

```bash
git clone https://github.com/your-username/sign-dialogue-overlay.git
cd sign-dialogue-overlay
npm install
```

## Create a .env file in the project root:
```.env
AI_API_KEY=your_gemini_api_key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
SIGN_INTERPRETATION_MODEL=gemini-2.5-flash
AUDIO_TRANSCRIPTION_MODEL=gemini-2.5-flash
```

Running the Application
Start the Vite development server:
```bash
npm run dev -- --port 8080
```

In a second terminal, start Electron:
```bash
npx electron .
```

The dashboard opens as a normal taskbar window, while the overlay appears separately on top of other applications.

Keyboard Shortcuts:
`Ctrl/Cmd + Shift + O	| Show or hide the overlay`
`Ctrl/Cmd + Shift + D	| Show or hide the dashboard`

Clicking the overlay X button hides the overlay without quitting the application.
