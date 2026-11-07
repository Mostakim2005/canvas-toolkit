# Project Operating Instructions (`AGENTS.md`)
> **Notice:** This project inherits user persona, confirmation gates, and documentation blueprints from the global master `AGENTS.md`. Do not duplicate those rules here.

## 1. Project Tech Stack & Environment
* **Runtime / Language:** Node.js 18+, TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`).
* **Framework / Host:** Obsidian plugin API, `minAppVersion` 1.1.0, desktop and mobile (`isDesktopOnly: false`).
* **Build Output:** `main.js` (CommonJS bundle) at the repository root, shipped with `manifest.json` and `styles.css`.
* **Package Manager / Bundler:** npm + esbuild (`esbuild.config.mjs`, entry `src/main.ts`).

## 2. Mandatory Verification & Build Commands
* **Type Check:** `npx tsc -noEmit -skipLibCheck`
* **Lint:** `npm run lint`
* **Build:** `npm run build`
* **Watch / Dev:** `npm run dev`

## 3. Repository Directory Structure & Conventions
* `src/` — modular TypeScript source; one responsibility per file:
  * `main.ts` — lifecycle, all commands, auto-sync, settings normalization, media insertion dispatch.
  * `canvas/CanvasAdapter.ts` — lossless JSON Canvas parse/serialize plus selection access.
  * `geometry.ts` — shared point/rect math, side anchors, snapping primitives.
  * `layout/LayoutEngine.ts` — grid, hierarchical, radial, mind-map, compact.
  * `layout/Alignment.ts` — six alignment modes and two distribution axes.
  * `routing/SnapEngine.ts` — grid snap, neighbor alignment, overlap nudge.
  * `routing/ConnectionOptimizer.ts` — 16-way side scoring with segment-crossing detection.
  * `operations/` — `OperationPlanner`, `OperationPreviewModal`, `TransactionEngine`, `OperationJournal`.
  * `relationships/RelationshipEngine.ts` — reconciliation, connect, unlink, semantic Markdown edits.
  * `graph/` — `GraphAnalyzer` (counts/duplicates) and `GraphExpansionPlanner` (budgeted BFS).
  * `media/` — `MediaScanner`, `MediaPickerModal`, `AudioAnalyzer`, `AudioPlayerView`.
  * `ui/` — `CanvasGeometryModal`, `FolderPickerModal`; `phase5.ts` power tools, `phase6.ts` link dialogs, `phase7.ts` insights.
  * `settings.ts`, `types.ts` — settings tab and all shared contracts/defaults.
* `docs/` — `PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS_AND_TRAPS.md`, `VISUAL_GUIDE.html`.
* `runtime/` — frozen plug-and-play bundle (`main.js`, `manifest.json`, `styles.css`) kept as the emergency fallback. Never regenerate into this folder.
* `main.js` at the root is a generated build artifact; edit `src/` instead.
* `styles.css` at the root is the live stylesheet; every UI class is namespaced `ctk-*`.

## 4. Repository-Specific Engineering Traps
* **TRAP 1:** All canvas mutations must go through an `OperationPlan` and `TransactionEngine.commit`. Never call `CanvasAdapter.setData` directly from a tool or modal.
* **TRAP 2:** `assertStateMatches` compares canonical JSON (sorted keys). If the file changed since preview, the transaction must throw, never force the write.
* **TRAP 3:** Only one transaction may run at a time. `TransactionEngine.active` guards `commit`, `undo`, and `redo`; auto-sync can re-enter from workspace events.
* **TRAP 4:** Unknown canvas node/edge fields live in `extra` and must be spread first in `toRawNode`/`toRawEdge`; dropping them causes silent data loss.
* **TRAP 5:** The active canvas write path is `setData` + `requestSave`; background canvases use `vault.process`. Mixing them leaves a stale view that overwrites the change.
* **TRAP 6:** `getPath()` can be `null` for an unsaved canvas; plans carry `''` and the active adapter is still used for the write.
* **TRAP 7:** Markdown reconciliation is append-only. Never rewrite or remove existing content, and check both `[[Note]]` and `[[Note|alias]]` before adding.
* **TRAP 8:** Unlink uses the line-anchored regex `^\\s*(!?\\[\\[…\\]\\])\\s*$`; broadening it deletes inline link text.
* **TRAP 9:** Semantic link mode requires both endpoints to be `.md` file nodes and must keep its explicit error for anything else.
* **TRAP 10:** Settings have no version field. Every load and import goes through `normalizeSettings`, which clamps numbers, coerces enums, and drops invalid presets/rules.
* **TRAP 11:** `syncMode` defaults to `off`; **apply** commits without a review dialog by design, so do not change that default casually.
* **TRAP 12:** Media roots use folder-boundary matching, not substring containment; normalize slashes with `normalizePath` before storing.
* **TRAP 13:** The audio player's 100 ms interval and the picker's 120 ms search timer must both be cleared in `onClose`.
* **TRAP 14:** The glassmorphism body class `ctk-glassmorphic` is added on load and must be removed in `onunload`.
