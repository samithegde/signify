# Signify by Samit Hegde
<img width="1640" height="664" alt="signifywordmark" src="https://github.com/user-attachments/assets/472b7902-ee2d-410d-ae5d-4baade72122b" />

A desktop accessibility and creative expression tool for Deaf, hard-of-hearing, mute, and non-speaking users. Signify uses Google Gemini Vision to interpret ASL fingerspelling and short sign-language phrases from screen content. Results appear as live captions and can optionally be spoken aloud.

Signify also supports an art-focused music workflow: listen mode captures computer audio, transcribes lyrics with Groq Whisper, and turns the text into ASL-style fingerspelling and sign cues.

## Features

- Transparent, always-on-top overlay
- Separate taskbar dashboard
- Google Gemini Vision sign interpretation
- ASL letter and phrase recognition
- Text-to-sign fingerspelling display
- Computer-audio transcription with Groq Whisper
- Music lyric-to-sign workflow through listen mode
- Optional spoken output
- Click-through overlay mode
- Adjustable overlay opacity
- Draggable and resizable overlay
- Global keyboard shortcuts
- Quick phrase dictionary
- MediaPipe and Python hand-keypoint prototype for efficient local recognition

## How It Works

The Electron shell creates two windows:

### Overlay Window

- Transparent
- Always on top
- Hidden from the taskbar
- Captures selected screen content
- Sends short frame bursts to Google Gemini
- Displays recognized captions
- Shows typed, transcribed, or lyric-based words as signs

### Dashboard Window

- Appears in the taskbar
- Configures overlay settings
- Controls translation mode
- Adjusts opacity
- Enables spoken output
- Shows or hides the overlay
- Controls launch-on-startup behavior

Google Gemini receives consecutive screen frames and returns interpreted text with a confidence score. Low-confidence results are ignored.

Groq Whisper powers listen mode by transcribing computer audio into text. Signify can then display that text as ASL-style fingerspelling and common phrase cues, which makes it useful for turning music lyrics into a visual sign-language experience.

The project also includes a MediaPipe landmark implementation in `scripts/sign_keypoints.py`. I added this because sending too many frames to Gemini can cause rate limiting and slow down real-time recognition. The Python script uses OpenCV, NumPy, and MediaPipe to read webcam frames, extract hand landmarks, normalize keypoints, and classify simple hand shapes locally as a more efficient recognition path.

## Requirements

- Node.js 18 or newer
- npm
- Electron-compatible desktop environment
- Google Gemini API key for sign interpretation
- Groq API key for listen-mode audio transcription
- Screen-sharing support
- Python dependencies for the optional MediaPipe keypoint prototype

## Installation

```bash
git clone https://github.com/your-username/sign-dialogue-overlay.git
cd sign-dialogue-overlay
npm install
```

Install Python dependencies for the optional keypoint prototype:

```bash
pip install -r requirements.txt
```

## Create a .env file in the project root:
```.env
AI_API_KEY=your_gemini_api_key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
SIGN_INTERPRETATION_MODEL=gemini-3.6-flash
GROQ_API_KEY=your_groq_api_key
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
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

Run the optional MediaPipe keypoint prototype:
```bash
npm run sign:keypoints
```

Keyboard Shortcuts:
`Ctrl/Cmd + Shift + O	| Show or hide the overlay`
`Ctrl/Cmd + Shift + D	| Show or hide the dashboard`

Clicking the overlay X button hides the overlay without quitting the application.
