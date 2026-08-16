import { Modal, Notice, type App } from 'obsidian';
import { LayoutEngine } from './layout/LayoutEngine';
import { OperationPlanner } from './operations/OperationPlanner';
import { OperationPreviewModal } from './operations/OperationPreviewModal';
import type CanvasToolkitPlugin from './main';
import type { CanvasRule, LayoutPreset } from './types';

export function graphStats(data: { nodes: { id: string }[]; edges: { fromNode: string; toNode: string }[] }) {
	const degree = new Map<string, number>();
	for (const node of data.nodes) degree.set(node.id, 0);
	for (const edge of data.edges) { degree.set(edge.fromNode, (degree.get(edge.fromNode) ?? 0) + 1); degree.set(edge.toNode, (degree.get(edge.toNode) ?? 0) + 1); }
	const components = connectedComponents(data);
	const averageDegree = data.nodes.length ? (2 * data.edges.length) / data.nodes.length : 0;
	const possible = data.nodes.length * Math.max(0, data.nodes.length - 1);
	return { nodes: data.nodes.length, edges: data.edges.length, averageDegree, components, density: possible ? data.edges.length / possible : 0, maxDegree: Math.max(0, ...degree.values()) };
}

function connectedComponents(data: { nodes: { id: string }[]; edges: { fromNode: string; toNode: string }[] }): number {
	const adj = new Map<string, Set<string>>();
	for (const n of data.nodes) adj.set(n.id, new Set());
	for (const e of data.edges) { adj.get(e.fromNode)?.add(e.toNode); adj.get(e.toNode)?.add(e.fromNode); }
	const visited = new Set<string>(); let count = 0;
	for (const n of data.nodes) if (!visited.has(n.id)) { count++; const stack = [n.id]; visited.add(n.id); while (stack.length) { for (const next of adj.get(stack.pop()!) ?? []) if (!visited.has(next)) { visited.add(next); stack.push(next); } } }
	return count;
}

export class Phase5Modal extends Modal {
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-phase5-modal');
		this.titleEl.setText('Canvas Toolkit power tools');
		this.render();
	}
	onClose(): void { this.contentEl.empty(); }
	private render(): void {
		this.contentEl.empty();
		this.addPresetSection();
		this.addRuleSection();
		this.addDataSection();
	}
	private addPresetSection(): void {
		const section = this.contentEl.createDiv({ cls: 'ctk-control-section' });
		section.createEl('h3', { text: 'Layout presets' });
		for (const [index, preset] of this.plugin.settings.layoutPresets.entries()) {
			const row = section.createDiv({ cls: 'ctk-inline-row' });
			row.createSpan({ text: preset.name });
			row.createSpan({ cls: 'ctk-pill', text: preset.kind });
			const apply = row.createEl('button', { text: 'Apply' });
			apply.addEventListener('click', () => {
				const adapter = this.plugin.currentCanvas();
				if (!adapter) { new Notice('Open a Canvas first.'); return; }
				const before = adapter.getData();
				const after = new LayoutEngine().layout(before, preset.kind, adapter.getSelectionIds().length ? adapter.getSelectionIds() : undefined, { gapX: preset.gapX, gapY: preset.gapY });
				const planner = new OperationPlanner();
				const plan = planner.create('layout-preset', `Apply layout preset: ${preset.name}`, [planner.canvasChange(adapter.getPath() ?? '', before, after)]);
				new OperationPreviewModal(this.app, plan, this.plugin.transactionEngine, adapter).open();
			});
			const remove = row.createEl('button', { text: 'Remove' });
			remove.addEventListener('click', async () => { this.plugin.settings.layoutPresets.splice(index, 1); await this.plugin.saveSettings(); this.render(); });
		}
		const actions = section.createDiv({ cls: 'ctk-inline-row' });
		const name = actions.createEl('input', { placeholder: 'Preset name' }) as HTMLInputElement;
		const kind = actions.createEl('select') as HTMLSelectElement;
		for (const value of ['grid','hierarchical','radial','mind-map','compact'] as const) kind.createEl('option', { value, text: value });
		actions.createEl('button', { text: 'Save current preset' }).addEventListener('click', async () => {
			if (!name.value.trim()) return;
			this.plugin.settings.layoutPresets.push({ name: name.value.trim(), kind: kind.value as LayoutPreset['kind'], gapX: this.plugin.settings.layoutGap, gapY: this.plugin.settings.layoutGap });
			await this.plugin.saveSettings(); this.render();
		});
	}
	private addRuleSection(): void {
		const section = this.contentEl.createDiv({ cls: 'ctk-control-section' });
		section.createEl('h3', { text: 'Per-Canvas rules' });
		const path = this.plugin.currentCanvasPath() ?? '';
		section.createDiv({ cls: 'ctk-operation-summary', text: path ? `Current Canvas: ${path}` : 'Open a Canvas to configure a rule.' });
		if (!path) return;
		let rule = this.plugin.getCanvasRule(path);
		const sync = section.createEl('select') as HTMLSelectElement;
		for (const value of ['off','suggest','apply'] as const) sync.createEl('option', { value, text: `Sync: ${value}` });
		sync.value = rule?.syncMode ?? this.plugin.settings.syncMode;
		const save = () => void this.plugin.setCanvasRule({ canvasPath: path, syncMode: sync.value as CanvasRule['syncMode'], autoOptimizeConnections: rule?.autoOptimizeConnections ?? false, snapEnabled: rule?.snapEnabled ?? this.plugin.settings.snapEnabled, snapGridSize: rule?.snapGridSize ?? this.plugin.settings.snapGridSize, defaultLayout: rule?.defaultLayout });
		sync.addEventListener('change', () => { rule = { ...(rule ?? { canvasPath: path, autoOptimizeConnections: false, snapEnabled: true, snapGridSize: this.plugin.settings.snapGridSize }), syncMode: sync.value as CanvasRule['syncMode'] }; save(); });
		section.createEl('button', { text: 'Save rule' }).addEventListener('click', save);
	}
	private addDataSection(): void {
		const section = this.contentEl.createDiv({ cls: 'ctk-control-section' });
		section.createEl('h3', { text: 'Configuration' });
		const actions = section.createDiv({ cls: 'ctk-inline-row' });
		actions.createEl('button', { text: 'Export settings' }).addEventListener('click', async () => {
			await navigator.clipboard.writeText(JSON.stringify(this.plugin.exportConfiguration(), null, 2)); new Notice('Canvas Toolkit: settings copied to clipboard.');
		});
		actions.createEl('button', { text: 'Import settings' }).addEventListener('click', () => new ImportSettingsModal(this.app, this.plugin, () => this.render()).open());
	}
}

class ImportSettingsModal extends Modal {
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin, private readonly refresh: () => void) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal'); this.titleEl.setText('Import settings');
		const area = this.contentEl.createEl('textarea', { placeholder: 'Paste exported JSON…' }) as HTMLTextAreaElement;
		area.style.width = '100%'; area.style.minHeight = '260px';
		const button = this.contentEl.createEl('button', { text: 'Import' }); button.addClass('mod-cta');
		button.addEventListener('click', async () => {
			try { await this.plugin.importConfiguration(JSON.parse(area.value) as unknown); new Notice('Canvas Toolkit: settings imported.'); this.refresh(); this.close(); }
			catch (error) { new Notice(`Canvas Toolkit: ${error instanceof Error ? error.message : 'invalid JSON'}`); }
		});
	}
	onClose(): void { this.contentEl.empty(); }
}
