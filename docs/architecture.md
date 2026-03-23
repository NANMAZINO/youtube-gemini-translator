# Current Runtime Architecture

## Target Runtime Boundaries

- **Background service worker**
  - typed command router
  - translation/refine task orchestration
  - retry/cancel/keep-alive coordination
  - settings/cache/usage access layer
- **Content script**
  - YouTube DOM capability detection
  - transcript extraction adapter
  - panel and overlay rendering
  - projection of background task state into the page
- **Popup**
  - typed command client for settings, usage, and cache management
  - direct local API key management to keep secrets off the generic runtime bus
- **Domain**
  - pure logic only
  - chunking, fingerprinting, resume, usage aggregation, error mapping
- **Adapters**
  - Chrome storage/runtime access
  - Gemini request/response translation
  - YouTube DOM strategies

## Directory Model

```text
extension/
├── adapters/
│   └── storage/
├── background/
├── content/
├── domain/
├── popup/
└── shared/
    └── contracts/
```

The Vite build packages the default extension artifact into `dist/`, and `npm run dev` / `npm run build` target the `extension/` runtime source tree by default.

The current default runtime already routes settings, cache, usage, and typed translation start/resume/cancel plus refine task orchestration through `extension/background`. The popup reads and writes the API key through the shared storage adapter instead of the generic runtime bus, presents a user-facing management shell rather than diagnostic copy, tolerates partial section load failures, keeps async popup actions explicitly disabled while they are running, and intentionally favors a low-density layout that surfaces only the controls and metrics needed for the primary setup/cache tasks. The content script consumes typed runtime events into a typed panel and overlay surface, exposes YouTube-integrated open/translate/cancel controls through the main content path, and centralizes transcript button/panel detection, transcript opening, transcript extraction, and video context lookup in `extension/adapters/youtube` so YouTube-specific DOM rules no longer live directly in the content entrypoint. The in-video subtitle overlay intentionally follows the established subtitle visual baseline while keeping the maintained implementation in one place.

Within the current Phase 4 slice, malformed Gemini JSON now fails the task instead of being accepted as an empty success, and cache writes are treated as best-effort side effects rather than task-fatal steps.

## Typed Runtime Contract

### Commands

- `settings.get`
- `settings.save`
- `translation.start`
- `translation.cancel`
- `translation.resume`
- `refine.start`
- `cache.list`
- `cache.get`
- `cache.import`
- `cache.delete`
- `cache.clear`
- `usage.get`

### Page Messages

- `cache.delete`
- `cache.clear`

### Events

- `translation.progress`
- `translation.retrying`
- `translation.completed`
- `translation.failed`
- `translation.cancelled`
- `refine.completed`
- `refine.failed`

## Storage Compatibility Rules

- Existing settings keys remain valid:
  - `targetLang`
  - `sourceLang`
  - `thinkingLevel`
  - `resumeMode`
- Existing usage key remains valid:
  - `tokenHistory`
- Existing API key storage remains valid:
  - `apiKey`
- Existing cache key conventions remain the compatibility baseline:
  - index key `idx_translations`
  - data prefix `dat_`
- Runtime cache metadata exposes the stored cache key explicitly as `cacheKey` to avoid conflating it with the raw YouTube video id.
- Schema version markers now use runtime-facing keys and migrate earlier compatibility keys forward on read or write so stored data stays compatible across the 3.0.0 runtime layout.
- Runtime cache writes should preserve a human-readable title when one is available from the request or active tab, and they should never downgrade a successful translation/refine result into a failed task purely because storage rejected the write.

## Data Flow

### Settings / Usage / Cache

1. Popup sends a typed command to background.
2. Background validates the command and calls storage adapters.
3. Background returns a typed success or failure payload.
4. Popup renders state without duplicating storage rules, while API key reads and writes stay local to the popup through the shared storage adapter.

### Translation / Refine

1. Content discovers transcript capabilities on the YouTube page.
2. Content requests translation or refinement from background.
3. Background owns task lifecycle, retries, and cancellation.
4. Background emits typed progress events.
5. Content renders state transitions into the panel and overlay.

At the current checkpoint, steps 3 and 4 exist in the default typed runtime for `translation.start`, `translation.resume`, `translation.cancel`, `refine.start`, and typed imported-bundle cache writes, while step 5 exists as a typed content-side surface driven by the runtime event stream, adapter-backed YouTube transcript capability scans, cached-translation rehydration, and in-page action controls plus refine/export/import header actions. The remaining operational work is browser-side regression verification rather than the basic command/event contract, transcript discovery path, or content-side state model itself.

## DOM Strategy Requirements

- Transcript panel detection cannot rely on a single selector.
- Open/close detection must tolerate:
  - child node insertion
  - attribute-only visibility changes
  - old renderer structures
  - new renderer/view-model structures
- Native transcript hide/restore must preserve original rendering semantics rather than forcing a generic display value.
- Custom panel actions must mount outside transcript body containers that may be hidden as part of the translation surface handoff path.
- Overlay event subscriptions must be torn down when the overlay is hidden so stale playback listeners cannot resurrect dismissed subtitle text.

## UI Baseline Requirements

- Popup and content surfaces should default to the lowest information density that still supports the primary task without hiding essential controls.
- Additional helper copy, summary cards, or dashboard-style telemetry should not be added unless they unlock a concrete production action.
- The popup usage summary is expected to remain compact and scannable inside the extension-width shell, including a stable 2x2 stats layout.
- The in-video subtitle overlay should keep the established visual style as the design baseline unless an intentional product decision replaces it.
