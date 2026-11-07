# Canvas Toolkit

> [!NOTE]
> **Live Plug-and-Play Runtime Available:** The `runtime/` directory contains the production-tested JavaScript bundle (`main.js`, `manifest.json`, `styles.css`) that runs in the live Obsidian vault. Copy those three files into `<Vault>/.obsidian/plugins/canvas-toolkit/` for immediate use. The TypeScript source in `src/` is a full behavioral port of that bundle: a rebuild produces the same behaviour, with only esbuild's minified identifier names differing.

A modular Obsidian Canvas companion: automatic layouts, alignment and snapping, safer connector routing, reversible transactions, Canvas ↔ Markdown relationship sync, graph insights, and a preview-first media picker.

## Documentation

| File | What it answers |
| --- | --- |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What the plugin must do, feature by feature, with code anchors. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Mermaid system map, settings shape, plan/commit flow, reconciliation pipeline, verification commands, extension recipes. |
| [`docs/DECISIONS_AND_TRAPS.md`](docs/DECISIONS_AND_TRAPS.md) | Why each non-obvious mechanism exists and what must never be changed. |
| [`docs/VISUAL_GUIDE.html`](docs/VISUAL_GUIDE.html) | Self-contained browser dashboard of intent, architecture, decisions and landmines. |
| [`AGENTS.md`](AGENTS.md) | Repository-specific build commands, layout and traps. |

## Source layout

- `src/main.ts` — plugin entry, commands, auto-sync, settings load/save/normalize
- `src/canvas/CanvasAdapter.ts` — lossless canvas parse/serialize and selection access
- `src/geometry.ts` — point/rect math, side anchors, snapping primitives
- `src/layout/LayoutEngine.ts` — grid, hierarchical, radial, mind-map, compact
- `src/layout/Alignment.ts` — align and distribute
- `src/routing/SnapEngine.ts` — grid, neighbor, and overlap snapping
- `src/routing/ConnectionOptimizer.ts` — anchor selection with crossing penalties
- `src/operations/OperationPlanner.ts` / `TransactionEngine.ts` / `OperationPreviewModal.ts` / `OperationJournal.ts`
- `src/relationships/RelationshipEngine.ts` — reconcile, connect, unlink, semantic links
- `src/graph/GraphAnalyzer.ts` / `GraphExpansionPlanner.ts`
- `src/media/MediaScanner.ts` / `MediaPickerModal.ts` / `AudioAnalyzer.ts` / `AudioPlayerView.ts`
- `src/ui/CanvasGeometryModal.ts` / `FolderPickerModal.ts`
- `src/phase5.ts` (presets, rules, export/import), `src/phase6.ts` (connect/unlink), `src/phase7.ts` (insights)
- `src/settings.ts`, `src/types.ts`

## Parity checklist

- [x] Five layouts: grid, hierarchical, radial, mind-map, compact (selection-aware)
- [x] Align (left/center/right/top/middle/bottom) and distribute (horizontal/vertical)
- [x] Magnet snapping with grid, neighbor alignment tolerance, and overlap nudge
- [x] Connection anchor optimizer across 16 side pairs with crossing penalty
- [x] Reversible plan/commit with preview dialog, rollback, undo, redo, journal limit
- [x] Canvas ↔ Markdown reconciliation: missing edges, missing links, broken links, duplicates, conflicts
- [x] Connect selected node to a canvas node or vault file (visual / semantic / both) with edge labels
- [x] Unlink a pair, optionally removing the matching Markdown line
- [x] Expand incoming / outgoing / both relations with depth, node, and edge budgets
- [x] Graph insights: health score, components, degree, density, duplicates, isolates, hubs, safe cleanup
- [x] Graph inspection notice command
- [x] Layout presets (apply, remove, save), per-canvas sync rules, settings export/import
- [x] Media picker: folder roots, kind filter, 2×2/3×3 grid, image resolution, PDF previews, audio previews
- [x] Debounced (120 ms) media search with Escape reset and timer cleanup
- [x] Audio waveform player with click-to-seek, ±interval buttons, cached analysis
- [x] Editor context-menu item for media insertion
- [x] Auto-sync on active-leaf and metadata changes with deduplicated suggestions
- [x] Glassmorphism / Material 3 theme toggle with body-class cleanup
- [x] Data compatibility: exact settings keys and defaults of the live 1.0.0 bundle
- [x] `styles.css` — live stylesheet copied verbatim (245 lines, `ctk-*` scoped)

## Develop

```bash
npm install
npm run dev     # esbuild watch
npm run build   # tsc --noEmit + production bundle -> main.js
npm run lint
```

Manual install: copy `main.js`, `manifest.json`, `styles.css` to `<Vault>/.obsidian/plugins/canvas-toolkit/`.

## License

Code: PolyForm Noncommercial 1.0.0 (see `LICENSE`). Docs: CC BY-NC 4.0. Copyright © Mostakim2005. Source-available: free non-commercial use with credit, no commercial use.
