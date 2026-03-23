# YouTube AI Translator Technical Documentation

> Technical notes for the Gemini 3 Flash Preview based YouTube caption translation extension.  
> For end-user setup and usage, see the [English README](../README.md) or the [Korean README](../README.ko.md).

![Docs](https://img.shields.io/badge/Docs-Technical-0A7EA4?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Node%20Built--in-5FA04E?style=flat-square&logo=node.js&logoColor=white)

## Core Capabilities

- **🧠 Context injection**: Feeds recent translated context into the next request to improve tone and terminology consistency.
- **⚡ Streaming UI**: Renders completed chunks immediately so the panel and overlay update progressively.
- **🧩 Structured responses**: Uses Gemini JSON schema responses, with repair handling on the translation path and strict parsing on the refine path.
- **⏯️ Resume mode**: Saves partial progress and computes resume points with transcript fingerprinting, source checkpoints, and timestamp fallback logic.
- **🛑 Task preemption**: Tracks active work per tab and aborts in-flight jobs when tabs or video URLs change.
- **🔄 Service worker keep-alive**: Keeps the MV3 service worker alive during translation and refinement.
- **♻️ Abort-aware retry**: Retries overload-style failures with exponential backoff while still respecting abort signals.
- **🗂️ Local storage cache**: Stores up to 100 cached translations in `chrome.storage.local` with a 30-day TTL.
- **📊 Token usage history**: Tracks input and output token usage for daily and 30-day summaries in the popup.

## File Structure

```text
extension/
├── manifest.json                    # Manifest V3 metadata (v2.1.4)
├── README.md                        # Technical documentation in English
├── README.ko.md                     # Technical documentation in Korean
├── background/
│   └── service-worker.js            # Translation/refine orchestration, task preemption, keep-alive
├── content.js                       # ESM loader entry for content/app/main.js
├── content.css                      # Content script and injected UI styling
├── icons/
│   └── icon.svg                     # Extension icon asset
├── core/
│   ├── constants.js                 # Shared constants for API, selectors, cache, retry, and UI settings
│   ├── errors.js                    # API error classification
│   ├── errors.test.js               # Unit tests for error classification
│   ├── logger.js                    # Tagged logger utilities
│   ├── utils.js                     # Timestamp, token estimate, and fingerprint utilities
│   └── utils.test.js                # Unit tests for shared utilities
├── infrastructure/
│   ├── api/
│   │   ├── gemini-client.js         # Gemini translation and refine client
│   │   ├── retry.js                 # Abort-aware exponential backoff retry helper
│   │   └── retry.test.js            # Unit tests for retry logic
│   └── storage/
│       ├── cache.js                 # Cache storage with TTL, indexing, and partial-save support
│       ├── cache.test.js            # Unit tests for cache behavior
│       └── local-store.js           # API key obfuscation and token history storage
├── content/
│   ├── app/
│   │   ├── main.js                  # Main entry, observers, navigation handling, module wiring
│   │   └── panel-controller.js      # Panel open/toggle flow and cached render coordination
│   ├── dom/
│   │   ├── button-injector.js       # Injects transcript, translate, refine, and panel toggle buttons
│   │   ├── captions.js              # Caption extraction and normalization
│   │   └── transcript-opener.js     # Opens YouTube transcript panel
│   ├── flow/
│   │   ├── translation-flow.js      # High-level translation, resume, and refine orchestration
│   │   ├── translation-executor.js  # Translation session execution and progress streaming
│   │   ├── resume-resolver.js       # Resume start point resolution
│   │   └── resume-resolver.test.js  # Unit tests for resume logic
│   └── ui/
│       ├── ui.js                    # Shadow DOM panel UI, import/export, notifications
│       └── ui-overlay.js            # On-video overlay, drag, and font-size control
└── popup/
    ├── popup.html                   # Popup markup for settings, token usage, and cache
    ├── popup.js                     # Popup behavior and rendering
    ├── popup.css                    # Popup styling
    └── components/
        ├── token-usage.js           # Pure token aggregation and cost estimation logic
        └── token-usage.test.js      # Unit tests for token usage calculations
```

## Repository Docs

- `../README.md` - default English user guide
- `../README.ko.md` - Korean user guide
- `./README.md` - default English technical guide
- `./README.ko.md` - Korean technical guide

## Tech Stack

| Area | Technology |
| --- | --- |
| Platform | Chrome Extension **Manifest V3** |
| AI model | **Gemini 3 Flash Preview** via `generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview` |
| UI isolation | **Shadow DOM** |
| DOM observation | **MutationObserver** |
| Module style | Factory-style composition with dependency separation |
| Error handling | Shared retry utility plus explicit API error classification |
| Stability | **AbortController** plus service-worker keep-alive |
| Storage | `chrome.storage.local` |
| Language | Vanilla JavaScript with ES modules |

## Tests

This repository includes unit tests with Node's built-in test runner.

```bash
npm test
npm run test:coverage
```

| Test file | Covered module |
| --- | --- |
| `infrastructure/storage/cache.test.js` | `cache.js` cache lifecycle and partial-save behavior |
| `infrastructure/api/retry.test.js` | `retry.js` exponential backoff retry behavior |
| `core/errors.test.js` | `errors.js` API error classification |
| `content/flow/resume-resolver.test.js` | `resume-resolver.js` checkpoint and fallback resume logic |
| `core/utils.test.js` | `utils.js` shared utility helpers |
| `popup/components/token-usage.test.js` | `token-usage.js` token aggregation and cost estimation |

- Coverage targets are configured through the root `package.json` `test:coverage` script.
- Current thresholds are 80% minimum for lines, functions, and branches.
