[README in Korean](README.ko.md) · [Migration Plan](docs/rebuild/plan.md) · [Architecture Snapshot](docs/rebuild/architecture.md) · [Migration Log](docs/rebuild/progress.md) · [Legacy Runtime Reference](extension/README.md)

# YouTube AI Translator

> Chrome extension for context-aware YouTube caption translation with Gemini.

![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Node%20Built--in-5FA04E?style=flat-square&logo=node.js&logoColor=white)

`src/` is now the main extension runtime. `npm run build` produces the loadable `dist/` artifact, and the retained `extension/` tree is kept only as a minimal legacy reference for regression comparison.

## What It Does

- Reads YouTube transcript segments and translates them with surrounding context in mind.
- Injects transcript-aware controls directly into the YouTube watch page.
- Shows translated output in both the transcript surface and the on-video overlay.
- Supports resume mode, refine, JSON export/import, cache management, and usage tracking.
- Stores the Gemini API key locally in the popup instead of relying on a relay server.

## Quick Start

### 1. Install the extension

1. Clone or download this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Open `chrome://extensions` in Chrome.
5. Enable `Developer mode`.
6. Click `Load unpacked` and select this repository's `dist/` folder.

### 2. Add your Gemini API key

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Open the extension popup from the Chrome toolbar.
3. Paste the key and save it.

The key is stored in `chrome.storage.local` in obfuscated form, and requests go directly from the browser to the Gemini API.

### 3. Translate a video

1. Open a YouTube video with captions.
2. Click `Open Transcript` near the watch-page actions.
3. Click `Translate` inside the transcript panel.
4. Use `Refine`, `Export`, or `Import` when you need post-processing or bundle reuse.

## Main Features

- Context-aware translation across caption chunks
- Resume mode for interrupted work
- Local translation cache with popup management
- Token usage and estimated cost summaries
- On-video overlay with drag, resize, and reset interactions
- JSON bundle export/import for translated subtitles

## Repository Map

- `src/`: main TypeScript/Vite runtime
- `dist/`: built Chrome extension artifact
- `docs/rebuild/`: migration plan, architecture snapshot, progress history, and transcript regression checklist
- `extension/`: archived legacy runtime reference for regression comparison

## Development

```bash
npm install
npm run dev
npm run build
npm run check
npm test
npm run test:coverage
```

`npm run check` runs the full local quality gate: typecheck, tests, and production build.

## Current Status

- The TypeScript/Vite runtime under `src/` is the default implementation.
- The extension should be loaded from `dist/`, not from `extension/`.
- The retained `extension/` tree exists only as a legacy behavior reference.
- Manual browser verification still matters when changing YouTube DOM handling or overlay behavior.

## Limitations

- It only works on videos with available YouTube captions.
- Gemini quota, overload, or service errors can still surface as `403`, `429`, or `503` failures.
- Installation currently assumes Chrome Developer Mode.

## Contact

`imxtraa7@gmail.com`
