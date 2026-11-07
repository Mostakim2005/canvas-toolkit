# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** The permanent source of truth for what Canvas Toolkit does for the user, independent of how the code is implemented.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** Adds the missing editing layer to Obsidian Canvas: it can arrange selected cards into clean layouts, align and distribute them, snap them to a grid, pick better connector sides, synchronize visual connections with Markdown links, expand a map from a note's link neighborhood, inspect graph health, and insert images, PDFs, or audio through a preview picker.
* **How It Must Feel to Use:** Nothing changes on the canvas until the user has seen a review dialog listing exactly which files change and how. Every applied operation can be undone in one step, and a stale file is reported instead of overwritten.

## 2. Active Features (Do Not Break)

### [FEATURE: Five-Automatic-Layouts] | Aliases: grid, hierarchical, radial, mind-map, compact, arrange nodes
> **1-Line Summary:** Arranges the selected nodes (or the whole canvas) into one of five layouts with configurable spacing.
* **User Intention (Non-Negotiable):** A layout must only move nodes; edges, unknown node fields, and unselected nodes must survive untouched.
* **Visual / UI Behavior:** **Canvas: geometry, snapping and layouts** opens a dialog with a layout select and **Preview layout**, which opens the review dialog before anything is written.
* **Code Anchors (Grep Targets):**
  * `src/layout/LayoutEngine.ts` -> `LayoutEngine.layout`, `grid`, `hierarchical`, `radial`, `mindMap`, `compact`
  * `src/ui/CanvasGeometryModal.ts` -> `CanvasGeometryModal.onOpen`

### [FEATURE: Align-And-Distribute] | Aliases: left, center, right, top, middle, bottom, horizontal, vertical
> **1-Line Summary:** Aligns two or more nodes to a shared edge or center, and spaces three or more nodes evenly.
* **User Intention (Non-Negotiable):** Alignment uses the selection's bounding box and centroid; distribution preserves the first and last node positions.
* **Visual / UI Behavior:** Two selects and two preview buttons in the geometry dialog, with notices when the selection is too small (**Select at least two nodes.** / **Select at least three nodes.**).
* **Code Anchors (Grep Targets):**
  * `src/layout/Alignment.ts` -> `align`, `distribute`

### [FEATURE: Magnet-Snapping] | Aliases: grid snap, alignment tolerance, overlap nudge
> **1-Line Summary:** Snaps selected nodes to the grid and then to nearby edges or centers of unselected nodes, nudging them out of overlaps.
* **User Intention (Non-Negotiable):** Snapping only moves selected nodes and never drags a neighbor to accommodate them.
* **Visual / UI Behavior:** Grid-size field plus **Preview snap**; tolerance 12 px, overlap repair up to eight 12 px steps.
* **Code Anchors (Grep Targets):**
  * `src/routing/SnapEngine.ts` -> `snapNodes`, `snapToNeighbors`, `nudgeFromOverlap`
  * `src/geometry.ts` -> `snapValue`, `snapRect`, `overlapArea`

### [FEATURE: Connection-Anchor-Optimization] | Aliases: edge routing, crossing penalty, fromSide, toSide
> **1-Line Summary:** Re-evaluates every edge's four anchor sides on both ends and picks the pairing with the shortest span and fewest crossings.
* **User Intention (Non-Negotiable):** The optimizer only changes `fromSide`/`toSide`; it must not add, remove, or relabel edges.
* **Visual / UI Behavior:** **Preview optimized anchors** in the geometry dialog, reviewed in the same confirmation dialog as layouts.
* **Code Anchors (Grep Targets):**
  * `src/routing/ConnectionOptimizer.ts` -> `ConnectionOptimizer.optimize`, `segmentCrosses`
  * `src/geometry.ts` -> `rectForSide`, `distance`

### [FEATURE: Reversible-Transactions] | Aliases: plan, preview, commit, undo, redo, journal
> **1-Line Summary:** Every mutation is a plan with before/after snapshots that is previewed, committed atomically, and undoable.
* **User Intention (Non-Negotiable):** A failed commit rolls back what it already wrote, and a file that changed since preview is reported instead of overwritten.
* **Visual / UI Behavior:** **Review changes** lists each canvas or Markdown change and any warnings, with **Cancel** and **Apply changes**. Undo/redo notices confirm the result.
* **Code Anchors (Grep Targets):**
  * `src/operations/TransactionEngine.ts` -> `commit`, `undo`, `redo`, `assertStateMatches`, `applySnapshot`
  * `src/operations/OperationPreviewModal.ts` -> `OperationPreviewModal.onOpen`
  * `src/operations/OperationPlanner.ts` -> `create`, `canvasChange`, `markdownChange`

### [FEATURE: Canvas-Insights] | Aliases: graph health, components, density, hubs, cleanup
> **1-Line Summary:** Scores the active canvas and reports duplicates, dangling edges, isolated nodes, and hubs, with a safe duplicate cleanup.
* **User Intention (Non-Negotiable):** The score is advisory only, and cleanup removes duplicates from one direction of each pair while keeping the first edge.
* **Visual / UI Behavior:** **Canvas insights** hero score, four metrics (components, average degree, max degree, density), a tone-coloured insight list, and **Preview relationship cleanup**.
* **Code Anchors (Grep Targets):**
  * `src/phase7.ts` -> `GraphInsightsModal.render`, `analyzeGraph`, `healthScore`
  * `src/phase5.ts` -> `graphStats`

### [FEATURE: Canvas-Markdown-Reconciliation] | Aliases: sync, missing links, broken links, directional conflict
> **1-Line Summary:** Compares canvas edges with Markdown wikilinks in both directions and can add the missing half of each relationship.
* **User Intention (Non-Negotiable):** Markdown edits only ever append wikilinks at the end of a note, and only when the link is not already present.
* **Visual / UI Behavior:** **Canvas: preview relationship reconciliation** reports counts, then opens a review plan when anything can be fixed. Dedicated commands add only the missing canvas edges or only the missing Markdown links.
* **Code Anchors (Grep Targets):**
  * `src/relationships/RelationshipEngine.ts` -> `reconcile`, `planAddMissingCanvasEdges`, `planAddMissingMarkdownLinks`, `planSafeReconciliation`

### [FEATURE: Connect-And-Unlink-Selected] | Aliases: visual link, semantic link, both, unlink pair
> **1-Line Summary:** Connects one selected node to any canvas node or vault file, optionally also writing a Markdown wikilink.
* **User Intention (Non-Negotiable):** Semantic mode requires both endpoints to be Markdown file nodes and refuses otherwise with a clear message.
* **Visual / UI Behavior:** **Canvas: connect selected elements** opens a source card, a mode dropdown, a searchable target list, and an optional edge label. Unlink asks whether to also remove the Markdown link.
* **Code Anchors (Grep Targets):**
  * `src/phase6.ts` -> `UniversalRelationshipModal`, `UnlinkRelationshipModal`, `registerPhase6Commands`
  * `src/relationships/RelationshipEngine.ts` -> `planConnect`, `planLinkNodes`, `planUnlinkNodes`

### [FEATURE: Canvas-Expansion] | Aliases: expand incoming, expand outgoing, expand both, BFS
> **1-Line Summary:** Grows the canvas from selected note cards by pulling in their linked notes, up to a depth and node budget.
* **User Intention (Non-Negotiable):** Expansion must never exceed 100 nodes or 250 edges, and must place new cards without covering the existing ones.
* **Visual / UI Behavior:** Three commands (**expand incoming / outgoing / both connections**), each opening a review plan; a warning appears when no new files were needed.
* **Code Anchors (Grep Targets):**
  * `src/graph/GraphExpansionPlanner.ts` -> `VaultExpansionPlanner.plan`

### [FEATURE: Preview-Media-Picker] | Aliases: insert media, images, PDF, audio, 2x2, 3x3
> **1-Line Summary:** A searchable thumbnail grid of images, PDFs, and audio, scoped to the configured media folders, that inserts the selection into a note or canvas.
* **User Intention (Non-Negotiable):** Selecting media must never modify a file until **Insert** is pressed, and the picker must stay responsive on large vaults.
* **Visual / UI Behavior:** Search with a 120 ms debounce (Escape clears), kind filter, 2×2/3×3 toggle, image resolution and size captions, inline audio controls, optional PDF previews, and a selection count on the Insert button.
* **Code Anchors (Grep Targets):**
  * `src/media/MediaPickerModal.ts` -> `MediaPickerModal.render`, `renderGrid`, `insertSelected`
  * `src/media/MediaScanner.ts` -> `MediaScanner.scan`

### [FEATURE: Audio-Waveform-Player] | Aliases: waveform, seek, play selected audio, RMS
> **1-Line Summary:** Plays a selected audio file with a generated waveform, click-to-seek, and back/forward buttons using the configured interval.
* **User Intention (Non-Negotiable):** The analysis cache is keyed by path and mtime, the decode is capped at 15 minutes, and the playback clock is cleared when the modal closes.
* **Visual / UI Behavior:** Waveform bars, progress slider, elapsed/total time, play/pause icon swap, and a metadata line that says **waveform · click to seek**.
* **Code Anchors (Grep Targets):**
  * `src/media/AudioAnalyzer.ts` -> `AudioAnalyzer.analyze`
  * `src/media/AudioPlayerView.ts` -> `AudioPlayerModal.renderControls`, `renderWaveform`, `openAudioPlayer`

### [FEATURE: Layout-Presets-And-Rules] | Aliases: power tools, save preset, per-canvas sync, import export
> **1-Line Summary:** Saves named layout presets, stores a per-canvas synchronization mode, and exports or imports the whole configuration as JSON.
* **User Intention (Non-Negotiable):** Removing a preset only removes the saved recipe, and importing settings validates and normalizes before saving.
* **Visual / UI Behavior:** **Canvas: power tools and presets** lists presets with Apply/Remove, a preset creator, a rule section for the active canvas, and clipboard export plus a pasted-JSON import dialog.
* **Code Anchors (Grep Targets):**
  * `src/phase5.ts` -> `Phase5Modal.addPresetSection`, `addRuleSection`, `addDataSection`
  * `src/main.ts` -> `getCanvasRule`, `setCanvasRule`, `exportConfiguration`, `importConfiguration`

### [FEATURE: Graph-Inspection-Notice] | Aliases: inspect current canvas, counts, components, orphans
> **1-Line Summary:** A command prints node, edge, component, and orphan-edge counts for the active canvas without opening a modal.
* **User Intention (Non-Negotiable):** Inspection is read-only and must work on any canvas size without writing.
* **Visual / UI Behavior:** Single notice such as **Canvas: 24 nodes, 31 edges · 3 components · 0 orphan edges.**
* **Code Anchors (Grep Targets):**
  * `src/main.ts` -> command `inspect-current-canvas`
  * `src/graph/GraphAnalyzer.ts` -> `GraphAnalyzer.analyze`

### [FEATURE: Frosted-Theme-And-Scoping] | Aliases: glassmorphism, material 3, ctk classes, body class
> **1-Line Summary:** All UI is namespaced under `ctk-*` and an optional body class enables frosted panels and container-responsive layouts.
* **User Intention (Non-Negotiable):** The body class must be removed on unload, and every generated class must exist in `styles.css`.
* **Visual / UI Behavior:** Setting **Frosted Glassmorphism & Material 3** toggles translucent modals, luminous borders, hover elevation, and narrow-pane container queries.
* **Code Anchors (Grep Targets):**
  * `src/main.ts` -> `applyThemePreferences`, `onunload`
  * `src/settings.ts` -> `CanvasToolkitSettingTab.display`
  * `styles.css` -> `ctk-glassmorphic`, `ctk-modal`

## 3. Explicit Non-Goals
* No automatic background rewrite of user canvases; sync defaults to **off**.
* No custom canvas renderer or replacement for Obsidian's canvas view.
* No cloud, AI, or network calls of any kind.
