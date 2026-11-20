# Visual Feature & Change Log (`VISUAL_LOG.md`)
> **1-Line Summary:** Plain-English, color-coded Obsidian-compatible Mermaid flowcharts explaining how each major flow in Canvas Toolkit operates end to end.

## Feature & Change Flowcharts

### [VISUAL: Plan-Preview-Commit-Transaction-Flow] | Aliases: layout commit, transaction engine, operation planner
> **1-Line Summary:** How layout and geometry changes are converted into an atomic two-phase preview plan before committing to canvas and disk.

* **Plain-English Walkthrough:** When a user selects canvas cards and triggers a layout, alignment, or snapping action, the geometry engine creates an `OperationPlan` containing a whole-canvas snapshot of the before and after state. The user is presented with a visual preview dialog showing exactly what cards will move. Upon confirmation, the `TransactionEngine` acquires the exclusive active transaction lock, asserts that canonical JSON has not drifted, applies the update in-memory to the active view (`setData` + `requestSave`), and journals the change for undo/redo.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef trapNode fill:#b91c1c,stroke:#7f1d1d,color:#ffffff

    Start([User triggers Layout / Snap / Align]):::startNode --> PlanGen[OperationPlanner computes Before and After Snapshots]:::processNode
    PlanGen --> Dialog[Open OperationPreviewModal for Review]:::processNode
    Dialog --> ConfirmChoice{User Confirms Changes?}:::processNode
    
    ConfirmChoice -->|No / Cancel| Abort([Operation Aborted - No Disk Writes]):::outputNode
    ConfirmChoice -->|Yes| LockCheck{TransactionEngine.active is true?}:::processNode

    LockCheck -->|Yes - Reentrant| RejectTrap[Throw Error: Concurrent Transaction Blocked]:::trapNode
    LockCheck -->|No| AcquireLock[Set TransactionEngine.active = true]:::processNode

    AcquireLock --> StateCheck{Canvas matches Before State?}:::processNode
    StateCheck -->|No - Stale File| StaleTrap[Abort Write & Alert User of Concurrent Edit]:::trapNode
    StateCheck -->|Yes| ApplyUpdate[Apply setData + requestSave on Canvas]:::processNode

    ApplyUpdate --> Journal[Push to Undo Journal & Clear Lock]:::processNode
    Journal --> Done([Canvas View Updated Safely]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = Starting User Action / Entry Point]):::startNode
        L2[Teal = Processing & Transformation Step]:::processNode
        L3([Green = Successful Final Outcome]):::outputNode
        L4[Red = Guard Check & Safety Abort]:::trapNode
    end
```

* **Code Anchors (Grep Targets):**
  * `src/operations/OperationPlanner.ts` -> `create`
  * `src/operations/TransactionEngine.ts` -> `commit`, `applySnapshot`
  * `src/operations/OperationPreviewModal.ts` -> `open`
  * `src/canvas/CanvasAdapter.ts` -> `setData`

---

### [VISUAL: Two-Way-Markdown-Canvas-Sync-Flow] | Aliases: wikilink sync, relationship engine, edge reconciliation
> **1-Line Summary:** How relationships between Canvas card nodes and Markdown notes are reconciled without deleting existing note contents.

* **Plain-English Walkthrough:** Canvas Toolkit periodically or on-demand inspects canvas file cards against Obsidian's `metadataCache`. It matches outgoing wikilinks against existing canvas edges. When missing connections are discovered, it creates a safe append-only synchronization plan: canvas edges are added directly, while Markdown links are appended to note footers only if not already present. Conflict warnings are displayed without blocking safe updates.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef trapNode fill:#b91c1c,stroke:#7f1d1d,color:#ffffff

    Start([Reconciliation Triggered: Manual / Auto-Sync]):::startNode --> Extract[Extract File Nodes and Existing Edges]:::processNode
    Extract --> QueryCache[Query metadataCache for Resolved & Unresolved Links]:::processNode
    QueryCache --> DiffPairs[Compute Missing Edges & Missing Markdown Links]:::processNode

    DiffPairs --> DirectionCheck{Directional Conflicts Detected?}:::processNode
    DirectionCheck -->|Yes| WarnUser[Generate Non-Blocking Warning Flags]:::trapNode
    DirectionCheck -->|No| BuildSafe[Build Safe Append-Only Plan]:::processNode
    WarnUser --> BuildSafe

    BuildSafe --> ModeCheck{syncMode setting?}:::processNode
    ModeCheck -->|Suggest| NoticeOnly([Post Deduplicated Notice to User]):::outputNode
    ModeCheck -->|Apply| ExecPlan[TransactionEngine.commit: Add Canvas Edges]:::processNode

    ExecPlan --> AppendMd[Append Wikilinks to Note Footers only if Absent]:::processNode
    AppendMd --> SyncComplete([Two-Way Synchronization Complete]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = Starting User Action / Entry Point]):::startNode
        L2[Teal = Processing & Transformation Step]:::processNode
        L3([Green = Successful Final Outcome]):::outputNode
        L4[Red = Conflict Warning / Non-Blocking Trap]:::trapNode
    end
```

* **Code Anchors (Grep Targets):**
  * `src/relationships/RelationshipEngine.ts` -> `reconcile`
  * `src/main.ts` -> `reconcileCanvasRelationships`
  * `src/operations/TransactionEngine.ts` -> `commit`
