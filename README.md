# Koe Player

A Chrome extension for language listening practice, powered by Google Cloud Text-to-Speech API. Generates realistic audio for Japanese (ja-JP) and Cantonese (yue-HK) using Chirp 3 HD voice models.

## Features

- **Text-to-Speech** — Multiple male/female voices via Google Cloud Chirp 3 HD
- **Assignment Management** — Create, save, load, delete assignments with full export/import
- **Playback Control** — Line-by-line playback with speed adjustment (0.5x–2x)
- **Offline Caching** — Generated audio cached in IndexedDB to avoid redundant API calls
- **Encrypted Storage** — API key encrypted with AES-256-GCM, protected by a 4-digit PIN

## Installation

1. Get a [Google Cloud API Key](https://console.cloud.google.com/) with Text-to-Speech API enabled
2. Clone the repository:
   ```bash
   git clone https://github.com/NG-KWAN-LOK/koe-player.git
   ```
3. Open Chrome at `chrome://extensions/` and enable **Developer mode**
4. Click **Load unpacked** and select the project directory
5. Click the Koe Player icon in the toolbar, enter a PIN, paste your API key, select voices, and save

## Usage

1. Click the extension icon → **Open Dashboard**
2. Enter your PIN to unlock
3. Paste JSON content (see format below) or load a saved assignment
4. Use the play / download buttons on each line

### JSON Format

```json
{
  "lines": [
    { "id": "1", "lang": "ja-JP", "gender": "F", "text": "すみません、駅はどこですか。" },
    { "id": "2", "lang": "yue-HK", "gender": "M", "text": "唔該，請問車站喺邊度？" }
  ]
}
```

## Project Structure

```
koe-player/
├── manifest.json        # Chrome Extension Manifest V3
├── background.js        # Service worker (hot reload in dev)
├── popup/
│   ├── popup.html       # Settings popup UI
│   └── popup.js         # Voice selection & API key encryption
├── tab/
│   ├── index.html       # Main dashboard
│   ├── app.js           # Core application logic
│   ├── db.js            # IndexedDB wrapper
│   └── style.css        # Styles
├── lib/
│   └── crypto.js        # AES-GCM encryption utility
└── icons/
    └── icon128.png      # Extension icon
```

## Tech Stack

- Vanilla JavaScript (no frameworks, no build tools)
- Chrome Extensions API (Manifest V3)
- Google Cloud Text-to-Speech API (Chirp 3 HD)
- Web Crypto API (AES-256-GCM + PBKDF2)
- IndexedDB

## License

MIT
