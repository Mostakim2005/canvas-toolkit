import {
	Notice,
	normalizePath,
	Plugin,
	MarkdownView,
	ItemView,
	TFile,
	Menu,
	Editor,
	MarkdownFileInfo,
	type MenuItem,
} from 'obsidian';
import { CanvasToolkitSettingTab } from './settings';
import { DEFAULT_SETTINGS, type CanvasToolkitSettings, type CanvasRule } from './types';
import { CanvasAdapter } from './canvas/CanvasAdapter';
import { GraphAnalyzer } from './graph/GraphAnalyzer';
import { OperationJournal } from './operations/OperationJournal';
import { TransactionEngine } from './operations/TransactionEngine';
import { OperationPreviewModal } from './operations/OperationPreviewModal';
import { OperationPlanner } from './operations/OperationPlanner';
import { RelationshipEngine } from './relationships/RelationshipEngine';
import { VaultExpansionPlanner } from './graph/GraphExpansionPlanner';
import { MediaPickerModal, insertIntoMarkdown } from './media/MediaPickerModal';
import { CanvasGeometryModal } from './ui/CanvasGeometryModal';
import { Phase5Modal, graphStats } from './phase5';
import { openAudioPlayer } from './media/AudioPlayerView';
import { registerPhase6Commands } from './phase6';
import { registerPhase7Commands } from './phase7';

export default class CanvasToolkitPlugin extends Plugin {
	settings!: CanvasToolkitSettings;
	readonly journal = new OperationJournal();
	readonly transactionEngine = new TransactionEngine(this.app, () => this.settings?.journalLimit ?? 50);
	private readonly graphAnalyzer = new GraphAnalyzer();
	readonly relationshipEngine = new RelationshipEngine(this.app);
	private readonly expansionPlanner = new VaultExpansionPlanner(this.app);
	private syncNoticeKey = '';

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new CanvasToolkitSettingTab(this.app, this));

		this.addCommand({
			id: 'insert-media-with-preview', name: 'Insert media with preview',
			checkCallback: (checking: boolean) => {
				const target = this.currentTarget(); if (!target) return false;
				if (!checking) void this.openMediaPicker(target); return true;
			},
		});
		this.addCommand({
			id: 'canvas-geometry-tools', name: 'Canvas: geometry, snapping and layouts',
			checkCallback: (checking: boolean) => {
				const adapter = this.currentCanvas(); if (!adapter) return false;
				if (!checking) new CanvasGeometryModal(this.app, this, adapter).open(); return true;
			},
		});
		this.addCommand({
			id: 'canvas-power-tools', name: 'Canvas: power tools and presets',
			checkCallback: (checking: boolean) => {
				if (!this.currentCanvas()) return false;
				if (!checking) new Phase5Modal(this.app, this).open(); return true;
			},
		});
		for (const direction of ['incoming', 'outgoing', 'both'] as const) {
			this.addCommand({
				id: `canvas-expand-${direction}`, name: `Canvas: expand ${direction} connections`,
				checkCallback: (checking: boolean) => {
					const adapter = this.currentCanvas(); if (!adapter || adapter.getSelectionIds().length === 0) return false;
					if (!checking) void this.previewExpansion(adapter, direction); return true;
				},
			});
		}

		this.addCommand({
			id: 'canvas-reconcile-preview', name: 'Canvas: preview relationship reconciliation',
			checkCallback: (checking: boolean) => {
				const adapter = this.currentCanvas(); if (!adapter) return false;
				if (!checking) void this.previewReconciliation(adapter); return true;
			},
		});
		this.addCommand({
			id: 'canvas-add-missing-edges', name: 'Canvas: add missing Markdown connections',
			checkCallback: (checking: boolean) => {
				const adapter = this.currentCanvas(); if (!adapter) return false;
				if (!checking) void this.applyMissingEdges(adapter); return true;
			},
		});
		this.addCommand({
			id: 'canvas-add-missing-markdown-links', name: 'Canvas: add missing Markdown links',
			checkCallback: (checking: boolean) => {
				const adapter = this.currentCanvas(); if (!adapter) return false;
				if (!checking) void this.previewMissingMarkdown(adapter); return true;
			},
		});
		this.addCommand({
			id: 'canvas-undo-toolkit', name: 'Undo',
			checkCallback: (checking: boolean) => {
				if (!this.transactionEngine.canUndo()) return false;
				if (!checking) void this.transactionEngine.undo(this.currentCanvas()); return true;
			},
		});
		this.addCommand({
			id: 'canvas-redo-toolkit', name: 'Redo',
			checkCallback: (checking: boolean) => {
				if (!this.transactionEngine.canRedo()) return false;
				if (!checking) void this.transactionEngine.redo(this.currentCanvas()); return true;
			},
		});
		this.addCommand({
			id: 'inspect-current-canvas', name: 'Inspect current canvas graph',
			checkCallback: (checking: boolean) => {
				const adapter = this.currentCanvas(); if (!adapter) return false;
				if (!checking) {
					const data = adapter.getData(); const analysis = this.graphAnalyzer.analyze(data); const stats = graphStats(data);
					new Notice(`Canvas: ${analysis.nodeCount} nodes, ${analysis.edgeCount} edges · ${stats.components} component${stats.components === 1 ? '' : 's'} · ${analysis.orphanEdgeIds.length} orphan edge${analysis.orphanEdgeIds.length === 1 ? '' : 's'}.`);
				}
				return true;
			},
		});
		this.addCommand({
			id: 'open-audio-player', name: 'Canvas: play selected audio file',
			checkCallback: (checking: boolean) => {
				const adapter = this.currentCanvas(); if (!adapter) return false;
				const filePath = this.selectedCanvasFile(adapter); if (!filePath) return false;
				const abstract = this.app.vault.getAbstractFileByPath(filePath);
				if (!(abstract instanceof TFile) || !/^(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(abstract.extension)) return false;
				if (!checking) openAudioPlayer(this.app, abstract, this.settings); return true;
			},
		});

		registerPhase6Commands(this);
		registerPhase7Commands(this);

		this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu, _editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
			if (view instanceof MarkdownView) menu.addItem((item: MenuItem) => item.setTitle('Insert media with preview').setIcon('image').onClick(() => void this.openMediaPicker(view)));
		}));

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(this.app.workspace.on('active-leaf-change', () => void this.handleAutoSync()));
			this.registerEvent(this.app.metadataCache.on('changed', () => void this.handleAutoSync()));
			void this.handleAutoSync();
		});
	}

	currentCanvas(): CanvasAdapter | null {
		const view = this.app.workspace.getActiveViewOfType(ItemView);
		return view ? CanvasAdapter.fromView(view) : null;
	}
	currentCanvasPath(): string | null { return this.currentCanvas()?.getPath() ?? null; }
	currentTarget(): MarkdownView | CanvasAdapter | null { return this.app.workspace.getActiveViewOfType(MarkdownView) ?? this.currentCanvas(); }
	getCanvasRule(path: string): CanvasRule | undefined { return this.settings.canvasRules.find(rule => rule.canvasPath === path); }
	async setCanvasRule(rule: CanvasRule): Promise<void> {
		this.settings.canvasRules = this.settings.canvasRules.filter(item => item.canvasPath !== rule.canvasPath);
		this.settings.canvasRules.push(rule);
		await this.saveSettings();
	}
	exportConfiguration(): CanvasToolkitSettings { return structuredClone(this.settings); }
	async importConfiguration(value: unknown): Promise<void> {
		if (typeof value !== 'object' || value === null) throw new Error('Configuration must be an object.');
		const data = value as Partial<CanvasToolkitSettings>;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
		this.normalizeSettings();
		await this.saveSettings();
	}

	private async previewExpansion(adapter: CanvasAdapter, direction: 'incoming' | 'outgoing' | 'both'): Promise<void> {
		try {
			const plan = await this.expansionPlanner.plan(adapter, { direction, depth: 2, maxNodes: 100, maxEdges: 250 });
			new OperationPreviewModal(this.app, plan, this.transactionEngine, adapter).open();
		} catch (error) { new Notice(`Canvas Toolkit: ${error instanceof Error ? error.message : 'unable to expand graph'}`); }
	}

	private async previewReconciliation(adapter: CanvasAdapter): Promise<void> {
		const result = await this.relationshipEngine.reconcile(adapter);
		const summary = `Missing Canvas: ${result.missingCanvasEdges.length} · Missing Markdown: ${result.missingMarkdownLinks.length} · Broken: ${result.brokenMarkdownLinks.length} · Duplicate edges: ${result.duplicateCanvasEdges.length}`;
		new Notice(summary);
		if (result.missingCanvasEdges.length || result.missingMarkdownLinks.length) {
			const plan = await this.relationshipEngine.planSafeReconciliation(adapter, result);
			if (plan.changes.length) new OperationPreviewModal(this.app, plan, this.transactionEngine, adapter).open();
		}
	}
	private async applyMissingEdges(adapter: CanvasAdapter): Promise<void> {
		const plan = await this.relationshipEngine.planAddMissingCanvasEdges(adapter);
		if (!plan.changes.some(change => change.type === 'replace-canvas' && change.before.edges.length !== change.after.edges.length)) { new Notice('No missing canvas connections found.'); return; }
		new OperationPreviewModal(this.app, plan, this.transactionEngine, adapter).open();
	}
	private async previewMissingMarkdown(adapter: CanvasAdapter): Promise<void> {
		const plan = await this.relationshipEngine.planAddMissingMarkdownLinks(adapter);
		if (!plan.changes.length) { new Notice('No missing Markdown links found.'); return; }
		new OperationPreviewModal(this.app, plan, this.transactionEngine, adapter).open();
	}
	private async handleAutoSync(): Promise<void> {
		const adapter = this.currentCanvas(); const path = adapter?.getPath(); if (!adapter || !path) return;
		const rule = this.getCanvasRule(path); const mode = rule?.syncMode ?? this.settings.syncMode;
		if (mode === 'off') return;
		try {
			const result = await this.relationshipEngine.reconcile(adapter);
			const count = result.missingCanvasEdges.length + result.missingMarkdownLinks.length;
			const key = `${path}|${result.missingCanvasEdges.map(item => item.key).sort().join(',')}|${result.missingMarkdownLinks.map(item => item.key).sort().join(',')}`;
			if (!count) { this.syncNoticeKey = ''; return; }
			if (key === this.syncNoticeKey) return;
			this.syncNoticeKey = key;
			if (mode === 'suggest') { new Notice(`Canvas Toolkit: ${count} relationship change${count === 1 ? '' : 's'} suggested. Open reconciliation preview to review.`); return; }
			const plan = await this.relationshipEngine.planSafeReconciliation(adapter, result);
			if (plan.changes.length) await this.transactionEngine.commit(plan, adapter);
		} catch (error) { new Notice(`Canvas Toolkit sync: ${error instanceof Error ? error.message : 'failed'}`); }
	}

	private selectedCanvasFile(adapter: CanvasAdapter): string | null {
		const ids = adapter.getSelectionIds(); if (ids.length !== 1) return null;
		return adapter.getData().nodes.find(node => node.id === ids[0] && node.type === 'file')?.file ?? null;
	}
	private async openMediaPicker(target: MarkdownView | CanvasAdapter): Promise<void> {
		const context = target instanceof MarkdownView ? 'markdown' : 'canvas';
		new MediaPickerModal(this.app, {
			settings: this.settings, context,
			onInsert: async (items) => {
				if (target instanceof MarkdownView) {
					await insertIntoMarkdown(target, items);
					this.journal.record('insert-media', `Inserted ${items.length} media item${items.length === 1 ? '' : 's'}`);
					return;
				}
				const before = target.getData();
				const after = structuredClone(before);
				const existingIds = new Set(after.nodes.map(node => node.id));
				const columns = Math.max(1, Math.ceil(Math.sqrt(items.length)));
				const cellWidth = 520, cellHeight = 420;
				const selected = target.getSelectionIds();
				const anchor = selected.length === 1 ? after.nodes.find(node => node.id === selected[0]) : undefined;
				const startX = anchor ? anchor.x + anchor.width + 80 : 0;
				const startY = anchor ? anchor.y : 0;
				for (const [index, item] of items.entries()) {
					let id = crypto.randomUUID();
					while (existingIds.has(id)) id = crypto.randomUUID();
					existingIds.add(id);
					after.nodes.push({ id, type: 'file', file: item.path, x: startX + (index % columns) * cellWidth, y: startY + Math.floor(index / columns) * cellHeight, width: item.kind === 'image' ? 480 : 520, height: item.kind === 'image' ? 320 : 360 });
				}
				const planner = new OperationPlanner();
				const plan = planner.create('insert-media', `Insert ${items.length} media item${items.length === 1 ? '' : 's'} into Canvas`, [planner.canvasChange(target.getPath() ?? '', before, after)]);
				new OperationPreviewModal(this.app, plan, this.transactionEngine, target).open();
			},
		}).open();
	}

	async loadSettings(): Promise<void> {
		const raw = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS, ...(raw as Partial<CanvasToolkitSettings> | null | undefined) };
		this.normalizeSettings();
	}
	private normalizeSettings(): void {
		this.settings.mediaRoots = Array.isArray(this.settings.mediaRoots)
			? [...new Set(this.settings.mediaRoots.filter((v): v is string => typeof v === 'string').map(value => normalizePath(value.trim())).filter(Boolean))]
			: [];
		this.settings.mediaGridColumns = this.settings.mediaGridColumns === 2 ? 2 : 3;
		this.settings.defaultMediaKind = normalizeMediaKind(this.settings.defaultMediaKind);
		this.settings.audioWaveformPoints = Number.isFinite(this.settings.audioWaveformPoints) ? Math.min(600, Math.max(60, this.settings.audioWaveformPoints)) : 180;
		this.settings.audioSeekSeconds = Number.isFinite(this.settings.audioSeekSeconds) ? Math.min(120, Math.max(1, this.settings.audioSeekSeconds)) : 10;
		this.settings.layoutGap = Number.isFinite(this.settings.layoutGap) ? Math.min(500, Math.max(10, this.settings.layoutGap)) : 80;
		this.settings.snapGridSize = Number.isFinite(this.settings.snapGridSize) ? Math.min(500, Math.max(1, this.settings.snapGridSize)) : 20;
		this.settings.journalLimit = Number.isFinite(this.settings.journalLimit) ? Math.min(200, Math.max(5, this.settings.journalLimit)) : 50;
		this.settings.syncMode = this.settings.syncMode === 'apply' || this.settings.syncMode === 'suggest' ? this.settings.syncMode : 'off';
		this.settings.layoutPresets = Array.isArray(this.settings.layoutPresets) ? this.settings.layoutPresets.filter(isValidPreset) : [...DEFAULT_SETTINGS.layoutPresets];
		this.settings.canvasRules = Array.isArray(this.settings.canvasRules) ? this.settings.canvasRules.filter(isValidCanvasRule) : [];
		this.settings.showGraphInsightsOnOpen = Boolean(this.settings.showGraphInsightsOnOpen);
		this.settings.defaultLinkMode = this.settings.defaultLinkMode === 'semantic' || this.settings.defaultLinkMode === 'both' ? this.settings.defaultLinkMode : 'visual';
	}
	async saveSettings(): Promise<void> { await this.saveData(this.settings); }
}


function normalizeMediaKind(value: unknown): CanvasToolkitSettings['defaultMediaKind'] {
	return value === 'image' || value === 'pdf' || value === 'both' || value === 'audio' || value === 'all' ? value : 'all';
}

function isValidPreset(value: unknown): value is import('./types').LayoutPreset {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return typeof v.name === 'string' && v.name.trim().length > 0 && typeof v.kind === 'string' && ['grid','hierarchical','radial','mind-map','compact'].includes(v.kind) && typeof v.gapX === 'number' && Number.isFinite(v.gapX) && typeof v.gapY === 'number' && Number.isFinite(v.gapY);
}

function isValidCanvasRule(value: unknown): value is import('./types').CanvasRule {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return typeof v.canvasPath === 'string' && typeof v.syncMode === 'string' && ['off','suggest','apply'].includes(v.syncMode) && typeof v.autoOptimizeConnections === 'boolean' && typeof v.snapEnabled === 'boolean' && typeof v.snapGridSize === 'number' && Number.isFinite(v.snapGridSize);
}

