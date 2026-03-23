<p align="right">
  <a href="transcript-regression-checklist.ko.md">한국어</a>
</p>

# ✅ Transcript Regression Checklist

> Manual verification checklist for YouTube DOM-sensitive changes.

---

## Fixture Anchors

These fixtures are intentionally small snapshots of old and new YouTube transcript structures that the runtime adapters must continue to support.

| Fixture | Path |
|---|---|
| Classic transcript DOM | `extension/adapters/youtube/__fixtures__/transcript-legacy.html` |
| Modern transcript DOM | `extension/adapters/youtube/__fixtures__/transcript-modern.html` |

**Automated regression tests:**

| Test | Path |
|---|---|
| DOM fixture tests | `extension/adapters/youtube/transcript-dom.fixture.test.js` |
| Extractor tests | `extension/adapters/youtube/transcript-extractor.test.js` |
| Opener tests | `extension/adapters/youtube/transcript-opener.test.js` |

> [!NOTE]
> Always run `npm test` before the manual browser checklist. If automated tests pass but manual checks fail, the fixtures may need updating.

---

## Manual Browser Checklist

Use a real Chrome load from `dist/` after `npm run build`.

### 1. Transcript Entry & Panel State

- [ ] `Open Transcript` appears on a watch page where captions are available
- [ ] Opening the transcript works when the panel is **not mounted** yet
- [ ] Opening the transcript works when the panel is already mounted but **hidden**
- [ ] Transcript visibility changes driven only by **attribute updates** do not strand the custom actions

### 2. Transcript Parsing

- [ ] Old `ytd-transcript-segment-renderer` pages extract timestamps and text in order
- [ ] New `transcript-segment-view-model` pages extract timestamps and text in order
- [ ] Translated surface remains mounted **beside** the native YouTube transcript (not replacing it)

### 3. Translation & Recovery

- [ ] **Translate** starts a new run from the transcript panel
- [ ] **Resume** continues from partial cache after a refresh or navigation interruption
- [ ] **Refine** runs against the current translated bundle without losing rows
- [ ] **Import** replaces or restores translated rows correctly
- [ ] **Export** downloads a bundle that can be re-imported successfully

### 4. Popup / Cache Integration

- [ ] Popup settings load existing stored values without reset
- [ ] Popup cache **delete** clears the current YouTube page surface for the matching video
- [ ] Popup cache **clear** removes all in-page translated state for the active YouTube tab

### 5. Overlay Behavior

- [ ] Overlay text stays in sync with playback after a fresh translation run
- [ ] Overlay **hide/show** tears down and restores listeners without resurrecting stale cues
- [ ] **Drag**, **wheel resize**, and **double-click reset** still work on the active overlay

---

> [!TIP]
> Copy this checklist into a PR comment and check off each item during code review.
