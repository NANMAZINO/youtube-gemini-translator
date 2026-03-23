# Rebuild Progress

## Status Board

| Area | Status | Notes |
| --- | --- | --- |
| Phase 1 baseline docs | Done | Rebuild documentation and README notices created |
| Phase 2 toolchain scaffold | Done | TypeScript, Vite, CRX, typed contracts, and `src/` skeleton added |
| Phase 3 pure domain port | Done | Transcript, resume, retry, Gemini request building, and cache compatibility logic now live in `src/` |
| Phase 4 background/popup rebuild | Done | Typed translation start/resume/cancel and refine orchestration now run in `src/background`, and `src/content` projects typed task events into a lightweight preview monitor |
| Phase 5 content/UI rebuild | Done | Typed YouTube adapters, preview controls, label registry, and panel/overlay surface now live under `src/` |
| Phase 6 cutover | Done | `src/` and `dist/` are now the default runtime and build path |
| Post-cutover cleanup | Done | DOM fixtures, regression checklist, CI gate, and release cutover follow-ups are all checked in |

## 2026-03-24

### Session Start

- **In Progress:** finish the remaining post-cutover release work by checking in transcript DOM fixtures, freezing the regression checklist, adding a CI `npm run check` gate, and cutting the first stable runtime release version

### Session End

- **Done:** added checked-in legacy and modern YouTube transcript HTML fixtures plus `jsdom`-backed tests for transcript capability detection, extraction, and attribute-only panel opening
- **Done:** published `docs/rebuild/transcript-regression-checklist.md` so manual release verification now has a fixed checklist beside the automated fixture coverage
- **Done:** added `.github/workflows/check.yml` so GitHub runs `npm run check` on pushes and pull requests
- **Done:** migrated active storage schema markers away from rebuild-prefixed keys while preserving fallback compatibility for existing stored data
- **Done:** bumped the typed runtime manifest version to `3.0.0` for the first post-cutover stable release line
- **Decision:** keep `docs/rebuild/` as the migration-history namespace and keep `extension/` as a minimal regression reference instead of deleting historical context entirely
- **Risk:** live browser verification is still the only way to confirm current YouTube production DOM behavior after future upstream markup changes, even with fixtures and CI in place
- **Validation:** `npm run check`, `npm run test:coverage`

### Session Start

- **In Progress:** trim the last clearly unused legacy duplicate entrypoints under `extension/` so the archived reference tree stops carrying parallel flat-module stacks

### Session End

- **Done:** removed the obsolete `extension/lib/*` layer plus the unused flat `extension/content/*.js` and `extension/background.js` duplicate entrypoints that were no longer referenced by the retained legacy manifest path
- **Done:** updated legacy coverage targets and the archived legacy README structure so tests and docs point at the still-retained reference modules instead of deleted duplicates
- **Decision:** keep `extension/content.js` and the nested `content/app|dom|flow|ui/*` plus `background/service-worker.js` structure as the minimal archived legacy runtime slice until DOM fixtures and regression checklists are captured
- **Next:** capture old/new YouTube transcript DOM fixtures and freeze the regression checklist so the remaining legacy reference can be trimmed with confidence
- **Validation:** `npm run check`, `npm run test:coverage`

### Session Start

- **In Progress:** present the typed runtime as the mainline extension path instead of a rebuild preview, then refresh the user-facing and legacy-facing README set to match

### Session End

- **Done:** promoted `npm run check` to the primary local quality gate while keeping `rebuild:check` as a compatibility alias
- **Done:** refreshed the English and Korean root READMEs so they describe `src/` as the main runtime, `dist/` as the load target, and `extension/` as an archived legacy reference
- **Done:** rewrote the legacy technical READMEs so they clearly frame `extension/` as reference-only instead of a competing primary runtime
- **Done:** removed the remaining user-facing `Rebuild` copy from runtime labels, status text, and console prefixes that still leaked cutover terminology into the default experience
- **Decision:** keep `docs/rebuild/` as the migration-history location even though the default runtime cutover is complete, so cleanup work can keep a stable audit trail
- **Next:** trim duplicated legacy slices under `extension/` in smaller cleanup passes and decide later whether internal `rebuild.*` protocol names are worth a dedicated rename
- **Validation:** `npm run check`

### Session Start

- **In Progress:** settle the rebuilt popup/content UI into a maintainable default that keeps only the essential controls and restores the preferred legacy-style in-video subtitle look

### Session End

- **Done:** iterated on the rebuilt popup visual system to keep the Google/Apple-inspired color and typography direction while stripping explanatory copy and decorative density back toward the pre-rebuild simplicity level
- **Done:** reduced the rebuilt transcript surface to the minimum production shell again so it keeps the core status, translate/refine/import/export actions, and clickable translated rows without extra summary cards or secondary telemetry
- **Done:** aligned the YouTube-integrated `Open Transcript` and panel action buttons with the rebuilt blue control palette so page-entry actions no longer keep the old amber styling
- **Done:** restored the in-video subtitle overlay styling to the legacy visual baseline while preserving rebuilt behavior for drag-to-move, wheel-to-resize, and double-click reset
- **Done:** fixed the popup stats cards to stay in a 2x2 grid at extension widths instead of collapsing to a single column under the narrow-width media rule
- **Decision:** the current UI baseline favors essential controls and low visual noise over extra helper copy or dashboard-like status density; future UI changes should preserve that restraint unless a missing production task truly requires more on-screen information
- **Risk:** the current popup still keeps four usage stats visible at once, so any further simplification pass should confirm whether usage and cache summary should be collapsed before adding new popup controls
- **Next:** use the current popup/content styling as the default design baseline during remaining Phase 6 cleanup and only add UI copy or panels when they unlock a concrete user task
- **Validation:** repeated `npm run build` checks during UI iteration, plus `npm run typecheck`, `npm test`, and `npm run build` after the content/popup styling checkpoints

### Session Start

- **In Progress:** review the default rebuilt popup and YouTube UI surface, then close the most visible UX gaps before continuing Phase 6 cleanup

### Session End

- **Done:** replaced popup rebuild-phase copy with user-facing product copy so the default extension shell no longer looks like an internal cutover screen
- **Done:** made popup refresh partial-failure tolerant, added explicit busy-state disabling for async actions, and improved API key plus cache-row accessibility affordances
- **Done:** reformatted popup cache items into user-facing status/date summaries, added truncation messaging, and covered the new popup presentation helpers with tests
- **Done:** moved rebuilt transcript panel actions outside the hideable transcript body fallback so translate/cancel controls stay visible across broader YouTube transcript DOM variants
- **Done:** tore down rebuild overlay sync when the overlay is hidden and surfaced hidden partial-cache state so import can replace an unseen saved draft without trapping the user
- **Risk:** live browser verification is still needed across old/new YouTube transcript DOM variants, especially for transcript hide/show behavior, overlay playback sync, and the updated panel action mount point
- **Risk:** overlay cue timing still uses per-chunk start timestamps only, so final-line hold behavior has not been revisited in this session
- **Next:** capture manual browser regression notes for the updated popup and transcript panel flows, then continue removing retained legacy entrypoints during Phase 6 cleanup
- **Validation:** `npm run typecheck`, `npm test`, `npm run build`

### Session Start

- **In Progress:** restore rebuilt content parity for cached translation rehydration plus refine and JSON export/import controls so the default surface can stand in for the remaining legacy panel behavior

### Session End

- **Done:** added rebuilt-side cache rehydration when the transcript panel opens so existing translation results can repopulate the default surface without falling back to the legacy panel controller
- **Done:** added typed `cache.import` support plus rebuilt content-side JSON parsing/export helpers so imported subtitle bundles can be validated, rendered, and cached through the rebuild runtime
- **Done:** exposed `Refine`, `Export JSON`, and `Import JSON` controls from the rebuilt surface and wired refine requests through the existing typed background command path
- **Done:** updated the English and Korean READMEs plus architecture notes so the default rebuilt UI documentation matches the newly restored parity surface
- **Risk:** the rebuilt content path still needs live browser verification for imported bundles, cached surface rehydration, and refine reruns across old/new YouTube transcript DOM variants
- **Next:** keep trimming retained legacy entrypoints and capture manual regression notes so Phase 6 can move from cutover hardening into cleanup completion
- **Validation:** `npm run typecheck`, `npm test`, `npm run build`

### Session Start

- **In Progress:** switch the default script, manifest, and documentation path from the rebuild preview flow to the rebuilt runtime so `src/` and `dist/` become the default extension path

### Session End

- **Done:** changed the default `npm run dev` and `npm run build` scripts to target the rebuilt Vite/CRX runtime directly while leaving `dev:rebuild` and `build:rebuild` as compatibility aliases
- **Done:** switched the typed manifest metadata away from scaffold naming so the rebuilt artifact now presents itself as the default `YouTube AI Translator` extension
- **Done:** restored popup-side API key save/clear support through the shared storage adapter and brought cache delete/clear actions back through the rebuilt popup so the default rebuilt UI covers the core setup and cache-management flow
- **Done:** added rebuilt popup-to-content cache invalidation messages so deleting cache from the popup clears stale in-page translation state for the active YouTube tab
- **Done:** updated the English and Korean root READMEs to build and load `dist/`, repositioned `extension/README*` as legacy technical references, and clarified which legacy controls are still being ported
- **Done:** updated rebuild architecture and plan docs so they reflect that the rebuilt runtime is now the default artifact path and popup command scope
- **Risk:** `extension/` still contains duplicate legacy entrypoints and support modules, so the repository has not reached the final cleanup checkpoint yet
- **Next:** remove obsolete `extension/lib/*` and other duplicate legacy entrypoints in small cleanup slices, then mark cutover complete once the retained regression references are trimmed to the intended minimum
- **Validation:** `npm run typecheck`, `npm test`, `npm run build`

### Session Start

- **In Progress:** replace the diagnostic monitor dependency with YouTube-integrated content controls so the typed content path can stand on its own ahead of cutover cleanup

### Session End

- **Done:** added typed in-page action controls that inject an `Open Transcript` button into the watch action row and translation/cancel controls into the transcript panel
- **Done:** wired those controls into the existing typed preview controller so transcript opening, translate/resume, and cancellation all keep using the rebuilt background command contract
- **Done:** removed the user-facing dependency on the bottom-right diagnostic monitor while keeping the typed panel and overlay surface driven by runtime task state
- **Done:** added rebuild-side tests for closed, active, and completed action-control states
- **Risk:** the default root scripts and user-facing install path still have not been switched over to `src/` / `dist`, so the full Phase 6 cutover is not complete yet
- **Next:** switch the default developer flow and docs over to the rebuilt artifact path, then prune obsolete legacy entrypoints in smaller cleanup slices
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`

### Session Start

- **In Progress:** complete the remaining Phase 5 UI slice by adding a typed rebuild surface, centralized content labels, and attribute-driven panel refresh behavior

### Session End

- **Done:** added a centralized content label registry and a pure surface-state projector for panel and overlay rendering decisions
- **Done:** built a typed rebuild panel surface plus synced overlay rendering path that reacts to runtime task completion and current video playback time
- **Done:** extended the runtime task projection to retain completed translation payloads so content can render the rebuild surface without re-querying storage
- **Done:** wired transcript capability updates back into the surface renderer so attribute-only transcript panel mutations can reopen or hide the rebuild surface
- **Done:** closed the remaining Phase 5 checklist items in the rebuild plan
- **Risk:** the rebuild content experience still uses the bottom-right monitor as a diagnostic preview control surface instead of the final production interaction shell
- **Risk:** translation progress events still expose chunk counts rather than streaming text, so the rebuilt panel fills with translated rows on task completion instead of chunk-by-chunk rendering
- **Next:** start Phase 6 by switching the manifest/runtime entrypoints over to the rebuilt content path and deleting duplicate legacy implementation slices
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** wire transcript panel opening, transcript extraction, and preview start controls into the rebuild content path

### Session End

- **Done:** added typed YouTube adapters for video context lookup, transcript panel opening, and transcript extraction under `src/adapters/youtube`
- **Done:** connected the rebuild content monitor to start or resume translation tasks directly from the YouTube page and to request task cancellation
- **Done:** kept the preview path aligned with background keep-alive support so long-running rebuild tasks can stay attached after command dispatch
- **Done:** added rebuild-side tests for YouTube video id parsing and title normalization helpers
- **Risk:** the preview still renders diagnostic controls rather than the final rebuilt panel or overlay UI
- **Risk:** transcript opening still depends on YouTube's current transcript button layout and no DOM fixtures are checked in yet for old/new variants
- **Next:** replace the diagnostic monitor controls with the real rebuilt panel/overlay state machine and transcript render surface
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** extract the first typed YouTube transcript DOM adapter slice and surface capability state in the rebuild content monitor

### Session End

- **Done:** moved transcript button, panel, container, segment, and timestamp detection into `src/adapters/youtube/transcript-dom.ts`
- **Done:** added rebuild-side tests for transcript panel heuristics and transcript button label detection
- **Done:** extended the content preview monitor so it now reports live YouTube transcript DOM capability alongside typed task events
- **Done:** advanced rebuild metadata and docs into the first Phase 5 checkpoint
- **Risk:** the rebuild content path still does not open the transcript panel or render the final panel/overlay UI; this slice only establishes the adapter boundary and visibility into DOM readiness
- **Risk:** Vite build still emits the non-blocking CRX plugin warning about `rollupOptions` vs `rolldownOptions`
- **Next:** use the new adapter boundary to wire transcript panel opening and segment extraction into the rebuild path
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** address rebuild UI review findings around popup responsiveness, cache management, transcript coexistence, and overlay usability

### Session End

- **Done:** removed the popup cache list truncation so all saved bundles can be reviewed and deleted individually
- **Done:** made the rebuilt popup layout responsive down to narrower extension widths and tightened overflow handling for long cache metadata
- **Done:** changed the rebuild transcript surface to coexist with the native YouTube transcript instead of hiding it
- **Done:** constrained the rebuild transcript list with an internal scroll region and added `aria-current` updates for the active playback row
- **Done:** restored practical overlay controls in the rebuild path by adding drag-to-move, wheel-to-resize, and double-click reset behavior
- **Risk:** overlay position and size still reset on reinjection because the rebuild path does not yet persist those preferences to storage
- **Risk:** Vite build still emits the non-blocking CRX plugin warning about `rollupOptions` vs `rolldownOptions`
- **Next:** manually verify the rebuilt popup and YouTube surface on real Chrome extension widths and multiple player sizes before removing more legacy reference paths
- **Validation:** `npm run typecheck`, `npm test`, `npm run build`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** harden the rebuild content preview monitor so it boots once and renders runtime text safely

### Session End

- **Done:** locked the rebuild content message listener behind a one-time bootstrap guard to avoid duplicate runtime consumers on reinjection
- **Done:** rebuilt the in-page preview monitor so runtime values are assigned through DOM `textContent` instead of interpolated `innerHTML`
- **Done:** kept the Phase 4 preview path green after the content hardening pass
- **Risk:** the preview monitor is still a temporary diagnostic surface, not the final panel or overlay UI
- **Risk:** Vite build still emits the non-blocking CRX plugin warning about `rollupOptions` vs `rolldownOptions`
- **Next:** begin Phase 5 by extracting YouTube transcript DOM discovery into dedicated adapter modules
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** validate typed resume orchestration and attach the first rebuild content-side task monitor for runtime events

### Session End

- **Done:** wired `translation.resume` through the rebuild background command router and added partial-cache continuation coverage in `src/background/service.test.js`
- **Done:** added a typed rebuild content event consumer and reducer in `src/content/runtime-event-consumer.ts`
- **Done:** replaced the content scaffold's console-only listener with a lightweight in-page rebuild task monitor in `src/content/index.ts`
- **Done:** updated rebuild metadata and architecture docs to reflect typed resume support plus content-side task event projection
- **Risk:** the rebuild content script still does not initiate commands or keep a service-worker port alive on its own; the full YouTube adapter/panel rebuild remains a Phase 5 task
- **Risk:** Vite build still emits the non-blocking CRX plugin warning about `rollupOptions` vs `rolldownOptions`
- **Next:** start Phase 5 by moving YouTube transcript DOM discovery and capability detection into dedicated adapter modules under `src/adapters`
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** establish rebuild docs, progress tracking, and the first TypeScript/Vite/CRX scaffold

### Session End

- **Done:** created `docs/rebuild/plan.md`, `docs/rebuild/architecture.md`, and `docs/rebuild/progress.md`
- **Done:** added rebuild-in-progress notes to root and technical READMEs
- **Done:** introduced the new `src/` directory layout and typed runtime/model contracts
- **Done:** added Vite + CRX + TypeScript strict configuration and `rebuild:check`
- **Done:** scaffolded a background command router and popup/content placeholders around compatibility-aware storage adapters
- **Blocked:** no DOM fixtures collected yet for old/new YouTube transcript panel variants
- **Risk:** Vite build emits a CRX plugin warning about `rollupOptions` vs `rolldownOptions`; it is non-blocking now but should be reviewed during later phases
- **Next:** start Phase 3 by porting transcript normalization, fingerprinting, chunking, resume, and usage logic into pure typed modules
- **Validation:** `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** port Phase 3 pure logic into `src/domain` and tighten rebuild contracts around cache and resume compatibility

### Session End

- **Done:** ported transcript primitives, normalization, chunking, and resume checkpoint logic into `src/domain`
- **Done:** added typed retry logic and Gemini error policy modules for the rebuild path
- **Done:** aligned rebuild cache contracts around explicit `cacheKey` naming and added schema mismatch invalidation rules
- **Done:** added rebuild-side tests for transcript, resume, retry, usage, Gemini error classification, and cache storage compatibility
- **Done:** updated rebuild meta/docs so the preview build is documented as a scaffold artifact while `extension/` remains the stable baseline
- **Risk:** translation/refine orchestration still returns `NOT_IMPLEMENTED` in `src/background/index.ts`; Phase 4 remains the next critical path
- **Next:** move translation task orchestration and popup integration deeper into the rebuild background worker
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** harden the rebuild preview workflow and normalize settings/cache edge cases before Phase 4

### Session End

- **Done:** blocked default `npm run dev` and `npm run build` so preview artifacts require explicit `dev:rebuild` / `build:rebuild` intent
- **Done:** changed the rebuild preview manifest version away from the stable `2.1.4` release line
- **Done:** normalized settings values from storage and form payloads before rendering or persisting them
- **Done:** ensured partial cache writes self-register in the index when needed, and made cache clearing remove orphaned data keys
- **Done:** expanded rebuild-side tests to cover settings normalization and cache orphan prevention
- **Next:** start Phase 4 task orchestration without carrying preview/build ambiguity or silent settings drift forward
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`, `npm run build` (expected blocked)
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** add the first typed background task orchestration slice for translation, cancellation, and refine flows

### Session End

- **Done:** added a rebuild-side Gemini client adapter with typed translate/refine request builders and JSON parsing safeguards
- **Done:** introduced a typed background task registry, event emitter, and service layer under `src/background`
- **Done:** wired `translation.start`, `translation.cancel`, and `refine.start` through the rebuild command router
- **Done:** persisted partial/final translation cache state and token usage updates from the rebuild background flow
- **Done:** added rebuild-side background tests covering normal translation, cancellation, and retry-then-refine paths
- **Risk:** `translation.resume` is still explicitly `NOT_IMPLEMENTED`, so partial cache continuation is not yet wired end-to-end in the rebuild runtime
- **Risk:** rebuild events are emitted, but no rebuild content consumer is attached yet, so task progress is validated in tests rather than in-page UI
- **Next:** port typed resume orchestration and start connecting content-side task consumers to the rebuild event stream
- **Validation:** `npm run typecheck`, `npm test`, `npm run build:rebuild`
- **Commit / PR:** not recorded yet in this session

### Session Start

- **In Progress:** harden the Phase 4 slice around malformed Gemini payloads, cache persistence failures, and cache title metadata

### Session End

- **Done:** changed the rebuild Gemini adapter so irreparable or empty JSON payloads fail loudly instead of becoming empty success results
- **Done:** made partial/final cache persistence best-effort in the rebuild background flow so storage failures no longer mask successful translation/refine results
- **Done:** added cache title propagation from request metadata or active tab title fallback, eliminating `Unknown Video` for normal rebuild-created cache entries
- **Done:** fixed the `emitRuntimeEvent()` options overload so explicit mock/custom senders work correctly
- **Done:** added regression tests for Gemini parse hard failures, event helper overload behavior, cache-write nonfatal behavior, and title propagation
- **Risk:** `translation.resume` and rebuild content-side event consumers are still pending, so in-page YouTube task UX parity has not been reached yet
- **Next:** implement typed resume orchestration and begin wiring content consumers to the rebuild event stream
- **Validation:** `npm run typecheck`, `npm test`
- **Commit / PR:** not recorded yet in this session
