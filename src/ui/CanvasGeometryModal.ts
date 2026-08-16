import { Modal, Notice, type App } from 'obsidian';
import type CanvasToolkitPlugin from '../main';
import { CanvasAdapter } from '../canvas/CanvasAdapter';
import { LayoutEngine, type LayoutKind } from '../layout/LayoutEngine';
import { ConnectionOptimizer } from '../routing/ConnectionOptimizer';
import { SnapEngine } from '../routing/SnapEngine';
import { align, distribute, type AlignmentMode, type DistributionMode } from '../layout/Alignment';
import { OperationPlanner } from '../operations/OperationPlanner';
import { OperationPreviewModal } from '../operations/OperationPreviewModal';

export class CanvasGeometryModal extends Modal {
	private readonly layoutEngine = new LayoutEngine();
	private readonly optimizer = new ConnectionOptimizer();
	private readonly snapEngine = new SnapEngine();
	private readonly planner = new OperationPlanner();
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin, private readonly adapter: CanvasAdapter) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-geometry-modal');
		this.titleEl.setText('Canvas geometry');
		const root = this.contentEl; root.empty();
		const selection = this.adapter.getSelectionIds();
		root.createDiv({ cls: 'ctk-geometry-summary', text: `${selection.length ? `${selection.length} selected nodes` : 'Entire Canvas'} · ${this.adapter.getData().nodes.length} nodes` });
		const layout = root.createDiv({ cls: 'ctk-control-section' });
		layout.createEl('h3', { text: 'Layout' });
		const layoutSelect = layout.createEl('select');
		for (const kind of ['grid','hierarchical','radial','mind-map','compact'] as LayoutKind[]) layoutSelect.createEl('option', { value: kind, text: titleCase(kind) });
		layout.createEl('button', { text: 'Preview layout' }).addEventListener('click', () => this.preview(this.layoutEngine.layout(this.adapter.getData(), layoutSelect.value as LayoutKind, selection.length ? selection : undefined, { gapX: this.plugin.settings.layoutGap, gapY: this.plugin.settings.layoutGap }), `Apply ${titleCase(layoutSelect.value)} layout`));

		const alignSection = root.createDiv({ cls: 'ctk-control-section' });
		alignSection.createEl('h3', { text: 'Align / distribute' });
		const alignSelect = alignSection.createEl('select');
		for (const mode of ['left','center','right','top','middle','bottom'] as AlignmentMode[]) alignSelect.createEl('option', { value: mode, text: titleCase(mode) });
		alignSection.createEl('button', { text: 'Preview align' }).addEventListener('click', () => {
			if (selection.length < 2) { new Notice('Select at least two nodes.'); return; }
			this.preview(align(this.adapter.getData(), selection, alignSelect.value as AlignmentMode), `Align selected (${titleCase(alignSelect.value)})`);
		});
		const distSelect = alignSection.createEl('select');
		distSelect.createEl('option', { value: 'horizontal', text: 'Horizontal' }); distSelect.createEl('option', { value: 'vertical', text: 'Vertical' });
		alignSection.createEl('button', { text: 'Preview distribute' }).addEventListener('click', () => {
			if (selection.length < 3) { new Notice('Select at least three nodes.'); return; }
			this.preview(distribute(this.adapter.getData(), selection, distSelect.value as DistributionMode), `Distribute selected (${titleCase(distSelect.value)})`);
		});

		const snap = root.createDiv({ cls: 'ctk-control-section' });
		snap.createEl('h3', { text: 'Snap' });
		const snapGrid = snap.createEl('input', { attr: { type: 'number' } }); snapGrid.value = String(this.plugin.settings.snapGridSize); snapGrid.min = '1';
		snap.createEl('label', { text: 'Grid size' }).appendChild(snapGrid);
		snap.createEl('button', { text: 'Preview snap' }).addEventListener('click', () => {
			if (!selection.length) { new Notice('Select at least one node.'); return; }
			this.preview(this.snapEngine.snapNodes(this.adapter.getData(), selection, { grid: Number(snapGrid.value) || 20, alignmentTolerance: 12, avoidOverlap: true }), 'Snap selected nodes');
		});

		const optimize = root.createDiv({ cls: 'ctk-control-section' });
		optimize.createEl('h3', { text: 'Connections' });
		optimize.createEl('button', { text: 'Preview optimized anchors' }).addEventListener('click', () => this.preview(this.optimizer.optimize(this.adapter.getData(), { preserveAxes: true, crossingPenalty: 160, preferExisting: 10 }), 'Optimize connection anchors'));
	}
	onClose(): void { this.contentEl.empty(); }
	private preview(after: ReturnType<CanvasAdapter['getData']>, description: string): void {
		const before = this.adapter.getData();
		const plan = this.planner.create('layout-preset', description, [this.planner.canvasChange(this.adapter.getPath() ?? '', before, after)]);
		new OperationPreviewModal(this.app, plan, this.plugin.transactionEngine, this.adapter).open();
	}
}
function titleCase(value: string): string { return value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
