[README in Korean](README.ko.md) · [Architecture](docs/rebuild/architecture.md) · [Progress Log](docs/rebuild/progress.md) · [Legacy Technical README](extension/README.md)

# YouTube AI Translator

> A Chrome extension that translates YouTube captions with context in mind.

![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-3%20Flash%20Preview-8E75FF?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?style=flat-square&logo=javascript&logoColor=black)

**YouTube AI Translator** reads YouTube captions, sends them to Google **Gemini 3 Flash Preview**, and renders translated results in real time through both a side panel and an on-video overlay.  
Instead of translating each line in isolation, it aims to preserve the flow of the surrounding conversation so subtitles read more naturally.

> [!NOTE]
> The TypeScript/Vite rebuild is now the default runtime path. The execution plan, target architecture, and session-by-session progress log live in [docs/rebuild/plan.md](docs/rebuild/plan.md), [docs/rebuild/architecture.md](docs/rebuild/architecture.md), and [docs/rebuild/progress.md](docs/rebuild/progress.md). The legacy `extension/` tree remains in the repository temporarily for regression reference during Phase 6 cleanup.

## Highlights

- **🧠 Context-aware translation**: Carries recent translation context forward for more consistent tone and terminology.
- **⚡ Real-time rendering**: Progress and translated output appear immediately in both the panel and the overlay.
- **🔐 Local API key flow**: Save or clear your Gemini API key directly from the rebuilt popup.
- **⏯️ Resume mode**: Reuses completed chunks after refreshes or interruptions.
- **🗂️ Local cache**: Stores up to 100 translation entries and removes old ones after 30 days.
- **📊 Usage tracking**: Shows token usage and estimated cost for today and the last 30 days in the popup.

## Quick Start

### 1. Install the extension

This project is currently loaded through Chrome Developer Mode rather than the Chrome Web Store.

1. Download or clone this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Open `chrome://extensions` in Chrome.
5. Enable `Developer mode`.
6. Click `Load unpacked` and select the `dist` folder from this repository.

### 2. Add your Gemini API key

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Open the extension menu from the Chrome toolbar and click `YouTube AI Translator`.
3. Paste the key into the popup and save it.

> The API key is stored locally in browser storage in obfuscated form.  
> Requests go directly from the browser to the Google Gemini API without a relay server.

### 3. Start translating

1. Open a YouTube video that has captions.
2. Click `Open Transcript` near the video actions to open the transcript panel.
3. Click `Translate` inside the transcript panel.
4. Use `Refine`, `Export JSON`, or `Import JSON` from the rebuilt translation surface when you need post-processing or manual bundle reuse.

## How It Works

### Reading translated captions

- Translation progress appears in the panel while work is in progress.
- Completed text shows up in both the translation panel and the on-video overlay.
- You can drag the overlay to reposition it and use the mouse wheel to resize the text.
- Double-clicking the overlay resets its position.

### Popup settings

- **Gemini API key**: save, reveal, or clear the key used for browser-to-Gemini requests
- **Thinking Level**: `Minimal`, `Low`, `Medium`, `High`
- **Language settings**: auto-detect source language and choose a target language
- **Resume Mode**: continue interrupted translations
- **Token usage**: review daily and 30-day usage with estimated cost
- **Cache management**: remove individual entries or clear all cached data

### Rebuilt parity notes

- The default rebuilt runtime now covers translation, resume, refine, JSON export/import, popup settings, API key management, usage tracking, and cache management.
- The main remaining Phase 6 work is legacy cleanup and manual browser verification across retained YouTube DOM variants.

## Limitations

- It only works on videos with available YouTube caption data.
- `403`, `429`, and `503` errors can occur depending on Gemini API quota and service status.
- Installation currently assumes Chrome Developer Mode.

## Repository Guide

This repository keeps documentation in two layers:

- This file: installation and usage for end users
- [docs/rebuild/architecture.md](docs/rebuild/architecture.md): current runtime architecture and boundaries
- [docs/rebuild/progress.md](docs/rebuild/progress.md): rebuild status and recent implementation slices
- [extension/README.md](extension/README.md): legacy implementation reference kept during cleanup
- [extension/README.ko.md](extension/README.ko.md): Korean legacy technical reference

## Development and Tests

```bash
npm run dev
npm run build
npm run rebuild:check
npm test
npm run test:coverage
```

The root `package.json` now builds the default extension artifact into `dist/`, while Node's built-in test runner still covers both the retained legacy modules and the rebuilt TypeScript runtime during the cleanup phase.

## FAQ

**Q. Can it translate videos without captions?**  
A. No. It requires caption data provided by YouTube.

**Q. How much does it cost?**  
A. Cost depends on your Google Gemini API usage. The popup shows estimated usage totals for today and the last 30 days.

**Q. The translation stopped midway.**  
A. This is usually caused by network issues, API congestion, or quota limits. If the button switches to a retry state, try again.

## Contact

`imxtraa7@gmail.com`
