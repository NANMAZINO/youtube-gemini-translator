# Rebuild Plan

## Current Status

- **Phase 1:** Done
- **Phase 2:** Done
- **Phase 3:** Done
- **Phase 4:** Done
- **Phase 5:** Done
- **Phase 6:** Done
- **Post-cutover cleanup:** Done

## Fixed Decisions

- Migration style: incremental transition
- Source of truth for the rebuild: `src/`
- Existing `extension/` tree remains an archived regression reference for behavior comparison
- Default local workflow uses `npm run dev`, `npm run build`, and `npm run check`
- Runtime boundary: browser-only Chrome MV3 extension
- Primary optimization target: stability and maintainability
- Provider scope: Gemini-optimized, not user-selectable multi-model
- Compatibility target: preserve settings and import/export JSON; regenerate caches on schema mismatch
- Minimum quality gate for each runtime PR: `npm run check`

## Baseline Features To Preserve

- YouTube transcript panel discovery and open/close coordination
- Context-aware translation using Gemini
- Subtitle refinement flow
- Resume mode with partial progress reuse
- Local cache management
- Token usage aggregation and estimated cost display
- Popup-based settings management
- Panel overlay and in-page translation rendering
- JSON export/import for translated captions

## Known Structural Debt To Remove

- Untyped runtime message contracts between popup, content script, and background
- Business rules mixed with DOM traversal and rendering concerns
- No modern TypeScript build pipeline or typed manifest generation

## Phase Checklist

### Phase 1. Baseline and Docs

- [x] Create `docs/rebuild/plan.md`
- [x] Create `docs/rebuild/architecture.md`
- [x] Create `docs/rebuild/progress.md`
- [x] Add rebuild notice to root README
- [x] Add rebuild notice to technical README
- [x] Capture old/new YouTube transcript DOM fixtures
- [x] Freeze regression checklist for transcript DOM changes

### Phase 2. Tooling and Type System

- [x] Add TypeScript + Vite + CRX toolchain
- [x] Create `src/background`, `src/content`, `src/popup`, `src/domain`, `src/adapters`, `src/shared`
- [x] Introduce typed manifest scaffold
- [x] Define typed runtime command/event contracts
- [x] Define shared core models (`Settings`, `TranscriptSegment`, `CacheRecord`, `UsageSummary`, `ExportBundle`)
- [x] Add CI-ready `npm run check` gate to workflow/automation

### Phase 3. Pure Domain Rebuild

- [x] Port transcript normalization
- [x] Port chunking and fingerprint logic
- [x] Port resume checkpoint logic
- [x] Port retry/error classification into typed domain modules
- [x] Introduce storage schema version rules
- [x] Consolidate Gemini request building into the rebuild adapter

### Phase 4. Background and Popup Rebuild

- [x] Move task orchestration to new background service worker
- [x] Rebuild popup against typed background API for settings/usage/cache compatibility views
- [x] Route settings/cache/usage through the new command layer only
- [x] Fail malformed Gemini payloads loudly instead of accepting empty translation/refine success
- [x] Keep cache persistence best-effort so storage errors do not mask successful task results
- [x] Add typed resume orchestration and parity checks for partial-cache continuation
- [x] Extend popup/content surfaces to consume typed task events end-to-end

### Phase 5. Content, YouTube Adapter, and UI Rebuild

- [x] Move YouTube-specific DOM logic into adapter modules
- [x] Rebuild panel/overlay state machine
- [x] Centralize labels/icons/status text registry
- [x] Support transcript panel mutations driven only by attribute changes

### Phase 6. Default Runtime Cutover

- [x] Switch manifest to new implementation
- [x] Refresh README and technical docs for the new architecture
- [x] Mark cutover complete in progress log

## Post-cutover Cleanup Backlog

- [x] Remove `extension/lib/*` and other obsolete duplicate entrypoints
- [x] Capture old/new YouTube transcript DOM fixtures
- [x] Freeze regression checklist for transcript DOM changes

## Regression Checklist Targets

- Transcript panel opens when already mounted but hidden
- Transcript panel opens when YouTube changes attributes without child node insertion
- Old and new segment renderers are both parsed
- Resume mode survives refresh/navigation interruption
- Popup settings remain compatible with existing stored values
- Existing JSON export files still import successfully
