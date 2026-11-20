# Project Operating Instructions (`AGENTS.md`)
> **Notice:** This project inherits user persona, confirmation gates, visual standards, and documentation blueprints from the global master `AGENTS.md`. Do not duplicate those rules here.

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
* `docs/` — Core Markdown documentation suite (`PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS_AND_TRAPS.md`, `VISUAL_LOG.md`).
* `preview/` — On-demand interactive HTML/CSS/JS visual previews (e.g., `preview/visual-guide.html`), created only upon explicit request.
* `main.js` at the root is a generated build artifact; edit `src/` instead.
* `styles.css` at the root is the live stylesheet; every UI class is namespaced `ctk-*`.

## 4. Critical Trap Pointers (1-Line Warnings Only)
* **TRAP 1:** Canvas mutations must go through `OperationPlan` and `TransactionEngine.commit` — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Stale-State-Must-Abort]`.
* **TRAP 2:** Never re-enter concurrent transactions; guard with `TransactionEngine.active` — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Single-Active-Transaction]`.
* **TRAP 3:** Preserve unknown node/edge fields in `extra` to avoid silent data loss — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Unknown-Canvas-Fields]`.
* **TRAP 4:** Use `setData` + `requestSave` on active canvas and `vault.process` on background canvases — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Save-After-SetData]`.
* **TRAP 5:** Markdown link reconciliation is append-only; check duplicate link tokens — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Duplicate-Link-Tokens]`.
* **TRAP 6:** Clear audio player intervals and media search debouncers in `onClose` — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Playback-Timer-Cleanup]`.
