# YouTube AI Translator Legacy Runtime Reference

> Archived technical reference for the pre-TypeScript `extension/` implementation.  
> For the current runtime, setup steps, and main architecture, use the [root README](../README.md), [Korean README](../README.ko.md), and the migration docs under [../docs/rebuild/](../docs/rebuild/architecture.md).

> [!NOTE]
> `src/` is now the default extension runtime and builds into `dist/`. This `extension/` tree is no longer the load target for normal development or installation. It stays in the repository only as a regression and cleanup reference while the remaining obsolete slices are trimmed down.

![Docs](https://img.shields.io/badge/Docs-Legacy%20Reference-0A7EA4?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Node%20Built--in-5FA04E?style=flat-square&logo=node.js&logoColor=white)

## Status

- Main runtime: `src/`
- Main build output: `dist/`
- Legacy reference: `extension/`
- Recommended local quality gate: `npm run check`

## Core Legacy Capabilities

- Context injection across caption chunks
- Streaming panel and overlay updates
- Resume mode with partial-save reuse
- Task cancellation and service-worker keep-alive
- Local cache persistence and token tracking

## Legacy File Structure

```text
extension/
├── manifest.json
├── README.md
├── README.ko.md
├── background/
├── content/
├── core/
├── infrastructure/
├── lib/
└── popup/
```

## When To Read This Folder

- You are comparing legacy and current behavior during cleanup.
- You need to trace how an older UI or storage path used to work.
- You are removing duplicated logic that still survives only in `extension/`.

If you are building, testing, or loading the current extension, start from `src/`, `dist/`, and the root README instead.
