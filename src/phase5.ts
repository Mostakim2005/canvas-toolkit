import { Modal, Notice, type App } from 'obsidian';
import { LayoutEngine } from './layout/LayoutEngine';
import { ConnectionOptimizer } from './routing/ConnectionOptimizer';
import { OperationPlanner } from './operations/OperationPlanner';
import { OperationPreviewModal } from './operations/OperationPreviewModal';
import type CanvasToolkitPlugin from './main';
import type { CanvasRule, LayoutPreset } from './types';
export { graphStats } from './graph/GraphAnalyzer';

export class Phase5Modal extends Modal {
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-phase5-modal');
		this.titleEl.setText('Canvas toolkit power tools');
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
				if (!adapter) { new Notice('Open a canvas first.'); return; }
				const before = adapter.getData();
				let after = new LayoutEngine().layout(before, preset.kind, adapter.getSelectionIds().length ? adapter.getSelectionIds() : undefined, { gapX: preset.gapX, gapY: preset.gapY });
				if (this.plugin.settings.autoOptimizeConnections) {
					after = new ConnectionOptimizer().optimize(after, { preserveAxes: true, crossingPenalty: 160, preferExisting: 10 });
				}
				const planner = new OperationPlanner();
				const plan = planner.create('layout-preset', `Apply layout preset: ${preset.name}`, [planner.canvasChange(adapter.getPath() ?? '', before, after)]);
				new OperationPreviewModal(this.app, plan, this.plugin.transactionEngine, adapter).open();
			});
			const remove = row.createEl('button', { text: 'Remove' });
			remove.addEventListener('click', () => { this.plugin.settings.layoutPresets.splice(index, 1); void this.plugin.saveSettings().then(() => this.render()); });
		}
		const actions = section.createDiv({ cls: 'ctk-inline-row' });
		const name = actions.createEl('input', { placeholder: 'Preset name' });
		const kind = actions.createEl('select');
		for (const value of ['grid','hierarchical','radial','mind-map','compact'] as const) kind.createEl('option', { value, text: value });
		actions.createEl('button', { text: 'Save current preset' }).addEventListener('click', () => {
			if (!name.value.trim()) return;
			this.plugin.settings.layoutPresets.push({ name: name.value.trim(), kind: kind.value as LayoutPreset['kind'], gapX: this.plugin.settings.layoutGap, gapY: this.plugin.settings.layoutGap });
			void this.plugin.saveSettings().then(() => this.render());
		});
	}
	private addRuleSection(): void {
		const section = this.contentEl.createDiv({ cls: 'ctk-control-section' });
		section.createEl('h3', { text: 'Per-canvas rules' });
		const path = this.plugin.currentCanvasPath() ?? '';
		section.createDiv({ cls: 'ctk-operation-summary', text: path ? `Current canvas: ${path}` : 'Open a Canvas to configure a rule.' });
		if (!path) return;
		let rule = this.plugin.getCanvasRule(path);
		const sync = section.createEl('select');
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
		actions.createEl('button', { text: 'Export settings' }).addEventListener('click', () => {
			void navigator.clipboard.writeText(JSON.stringify(this.plugin.exportConfiguration(), null, 2)).then(() => new Notice('Settings copied to clipboard.'));
		});
		actions.createEl('button', { text: 'Import settings' }).addEventListener('click', () => new ImportSettingsModal(this.app, this.plugin, () => this.render()).open());
	}
}

class ImportSettingsModal extends Modal {
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin, private readonly refresh: () => void) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal'); this.titleEl.setText('Import settings');
		const area = this.contentEl.createEl('textarea', { placeholder: 'Paste exported JSON…' });
		area.addClass('ctk-import-settings-textarea');
		const button = this.contentEl.createEl('button', { text: 'Import' }); button.addClass('mod-cta');
		button.addEventListener('click', () => { void this.importSettings(area.value); });
	}
	private async importSettings(value: string): Promise<void> {
		try {
			await this.plugin.importConfiguration(JSON.parse(value) as unknown);
			new Notice('Settings imported.');
			this.refresh();
			this.close();
		} catch (error) {
			new Notice(`Canvas Toolkit: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
		}
	}
	onClose(): void { this.contentEl.empty(); }
}
