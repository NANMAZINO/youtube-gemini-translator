# Transcript Regression Checklist

## Fixture Anchors

- Classic transcript DOM fixture: `extension/adapters/youtube/__fixtures__/transcript-legacy.html`
- Modern transcript DOM fixture: `extension/adapters/youtube/__fixtures__/transcript-modern.html`
- Automated regression tests:
  - `extension/adapters/youtube/transcript-dom.fixture.test.js`
  - `extension/adapters/youtube/transcript-extractor.test.js`
  - `extension/adapters/youtube/transcript-opener.test.js`

These fixtures are intentionally small snapshots of the old and new YouTube transcript structures that the runtime adapters must continue to support.

## Manual Browser Checklist

Use a real Chrome load from `dist/` after `npm run build`.

### Transcript Entry And Panel State

- `Open Transcript` appears on a watch page where captions are available.
- Opening the transcript works when the panel is not mounted yet.
- Opening the transcript works when the panel is already mounted but hidden.
- Transcript visibility changes driven only by attribute updates do not strand the custom actions.

### Transcript Parsing

- Old `ytd-transcript-segment-renderer` pages still extract timestamps and text in order.
- New `transcript-segment-view-model` pages still extract timestamps and text in order.
- The translated surface remains mounted beside the native YouTube transcript instead of replacing it.

### Translation And Recovery

- `Translate` starts a new run from the transcript panel.
- `Resume` continues from partial cache after a refresh or navigation interruption.
- `Refine` runs against the current translated bundle without losing rows.
- `Import` replaces or restores translated rows correctly.
- `Export` downloads a bundle that can be re-imported successfully.

### Popup / Cache Integration

- Popup settings still load existing stored values without reset.
- Popup cache delete clears the current YouTube page surface for the matching video.
- Popup cache clear removes all in-page translated state for the active YouTube tab.

### Overlay Behavior

- Overlay text stays in sync with playback after a fresh translation run.
- Overlay hide/show tears down and restores listeners without resurrecting stale cues.
- Drag, wheel resize, and double-click reset still work on the active overlay.
