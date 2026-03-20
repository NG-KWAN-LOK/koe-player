# CLAUDE.md

## Project Overview

Koe Player is a Chrome extension for generating TTS audio for language listening practice. No build process — pure vanilla JS.

## Architecture

- **popup/** — Extension popup: voice selection, encrypted API key storage
- **tab/** — Main app page: assignment management, audio playback/download
- **lib/crypto.js** — AES-256-GCM encryption (PBKDF2 key derivation)
- **background.js** — Service worker (hot reload polling in dev)

### Storage

- `chrome.storage.local` — Encrypted API key, voice settings
- `IndexedDB: KoePlayerDB` — Assignment data and audio cache (assignments store)

### TTS API

- Endpoint: `https://texttospeech.googleapis.com/v1/text:synthesize`
- Voice model: `{lang}-Chirp3-HD-{voiceName}`
- Audio format: LINEAR16 (WAV)
- Supported languages: ja-JP, yue-HK

## Key Conventions

- UI language is Traditional Chinese
- No package.json, no npm dependencies, no build step
- Develop by loading as an unpacked extension in Chrome

## Common Tasks

### Testing

Load the extension in Chrome and test manually. No automated tests.

### Development

1. After code changes, reload the extension at `chrome://extensions/`
2. `background.js` includes a hot reload mechanism that polls for file changes every second
