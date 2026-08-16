import { Modal, Notice, Setting, type App, type DropdownComponent, type TextComponent, type ToggleComponent } from 'obsidian';
import type CanvasToolkitPlugin from './main';
import type { CanvasNodeModel, RelationshipLinkMode } from './types';
import { OperationPreviewModal } from './operations/OperationPreviewModal';

export class UniversalRelationshipModal extends Modal {
	private sourceId: string;
	private targetKey = '';
	private query = '';
	private mode: RelationshipLinkMode;
	private label = '';
	private removeMarkdown = false;
	private targetOptions: Array<{ key: string; title: string; subtitle: string; nodeId?: string; filePath?: string }> = [];
	private targetList!: HTMLElement;

	constructor(app: App, private readonly plugin: CanvasToolkitPlugin, sourceId: string) {
		super(app);
		this.sourceId = sourceId;
		this.mode = plugin.settings.defaultLinkMode;
	}

	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-relationship-modal');
		this.titleEl.setText('Connect Canvas elements');
		this.render();
	}
	onClose(): void { this.contentEl.empty(); }

	private render(): void {
		this.contentEl.empty();
		const canvas = this.plugin.currentCanvas();
		if (!canvas) { this.contentEl.createDiv({ cls: 'ctk-empty', text: 'Open a Canvas first.' }); return; }
		const data = canvas.getData();
		const source = data.nodes.find(n => n.id === this.sourceId);
		if (!source) { this.contentEl.createDiv({ cls: 'ctk-empty', text: 'The selected source node is no longer available.' }); return; }

		const sourceCard = this.contentEl.createDiv({ cls: 'ctk-relationship-source' });
		sourceCard.createDiv({ cls: 'ctk-relationship-kicker', text: 'FROM' });
		sourceCard.createDiv({ cls: 'ctk-relationship-title', text: this.describeNode(source) });

		new Setting(this.contentEl)
			.setName('Relationship')
			.setDesc('Visual keeps the Canvas edge only. Semantic adds a Markdown relationship when supported.')
			.addDropdown((dropdown: DropdownComponent) => dropdown
				.addOptions({ visual: 'Visual only', semantic: 'Semantic Markdown link', both: 'Visual + semantic' })
				.setValue(this.mode)
				.onChange((value: string) => { this.mode = value as RelationshipLinkMode; this.renderDetails(); }));

		new Setting(this.contentEl)
			.setName('Search target')
			.addText((text: TextComponent) => text
				.setPlaceholder('Search Canvas nodes or vault files…')
				.setValue(this.query)
				.onChange((value: string) => { this.query = value; this.refreshTargets(data.nodes); }));

		this.targetList = this.contentEl.createDiv({ cls: 'ctk-relationship-targets' });
		this.refreshTargets(data.nodes);
		this.renderDetails();
	}

	private renderDetails(): void {
		this.contentEl.querySelector('.ctk-relationship-details')?.remove();
		const details = this.contentEl.createDiv({ cls: 'ctk-relationship-details' });
		if (this.mode !== 'visual') {
			new Setting(details).setName('Edge label').addText((text: TextComponent) => text.setPlaceholder('Optional').setValue(this.label).onChange((value: string) => this.label = value));
		}
		const actions = details.createDiv({ cls: 'ctk-modal-actions' });
		const cancel = actions.createEl('button', { text: 'Cancel' }); cancel.addEventListener('click', () => this.close());
		const apply = actions.createEl('button', { text: 'Preview connection' }); apply.addClass('mod-cta'); apply.disabled = !this.targetKey;
		apply.addEventListener('click', () => void this.previewLink());
	}

	private refreshTargets(nodes: CanvasNodeModel[]): void {
		if (!this.targetList) return;
		this.targetList.empty();
		const q = this.query.trim().toLowerCase();
		const items: Array<{ key: string; title: string; subtitle: string; nodeId?: string; filePath?: string }> = [];
		for (const node of nodes) {
			if (node.id === this.sourceId) continue;
			const title = node.file ?? node.label ?? node.text?.split(/\n/)[0] ?? node.url ?? node.id;
			const subtitle = node.type === 'file' ? node.file ?? '' : `Canvas ${node.type}`;
			if (q && !`${title} ${subtitle}`.toLowerCase().includes(q)) continue;
			items.push({ key: `node:${node.id}`, title, subtitle, nodeId: node.id });
		}

		for (const file of this.app.vault.getFiles()) {
			const key = `file:${file.path}`;
			if (items.some(item => item.key === key) || nodes.some(node => node.file === file.path)) continue;
			const title = file.basename;
			const subtitle = file.path;
			if (q && !`${title} ${subtitle}`.toLowerCase().includes(q)) continue;
			items.push({ key, title, subtitle, filePath: file.path });
			if (items.length >= 120) break;
		}

		this.targetOptions = items.slice(0, 120);
		if (!this.targetOptions.length) { this.targetList.createDiv({ cls: 'ctk-empty', text: 'No matching Canvas nodes or vault files.' }); return; }
		for (const item of this.targetOptions) {
			const row = this.targetList.createDiv({ cls: 'ctk-relationship-target' });
			if (item.key === this.targetKey) row.addClass('is-selected');
			row.createDiv({ cls: 'ctk-relationship-title', text: item.title });
			row.createDiv({ cls: 'ctk-relationship-sub', text: item.subtitle });
			row.addEventListener('click', () => { this.targetKey = item.key; this.refreshTargets(nodes); this.renderDetails(); });
		}
	}

	private async previewLink(): Promise<void> {
		const canvas = this.plugin.currentCanvas();
		if (!canvas || !this.targetKey) return;
		try {
			const target = this.targetKey.startsWith('node:')
				? { nodeId: this.targetKey.slice(5) }
				: { filePath: this.targetKey.slice(5) };
			const plan = await this.plugin.relationshipEngine.planConnect(canvas, this.sourceId, target, this.mode, this.label);
			this.close();
			new OperationPreviewModal(this.app, plan, this.plugin.transactionEngine, canvas).open();
		} catch (error) { new Notice(`Canvas Toolkit: ${error instanceof Error ? error.message : 'Unable to create relationship.'}`); }
	}

	private describeNode(node: { type: string; file?: string; label?: string; text?: string; url?: string; id: string }): string {
		return node.file ?? node.label ?? node.text?.split(/\n/)[0] ?? node.url ?? node.id;
	}
}

export class UnlinkRelationshipModal extends Modal {
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin, private readonly firstId: string, private readonly secondId: string) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-relationship-modal');
		this.titleEl.setText('Unlink Canvas elements');
		const box = this.contentEl.createDiv({ cls: 'ctk-operation-summary' });
		box.setText('Remove the Canvas connection. Markdown removal is optional and will be previewed before commit.');
		new Setting(this.contentEl).setName('Also remove matching Markdown link').addToggle((toggle: ToggleComponent) => toggle.setValue(false).onChange((value: boolean) => this.removeMarkdown = value));
		const actions = this.contentEl.createDiv({ cls: 'ctk-modal-actions' });
		const cancel = actions.createEl('button', { text: 'Cancel' }); cancel.addEventListener('click', () => this.close());
		const apply = actions.createEl('button', { text: 'Preview unlink' }); apply.addClass('mod-cta'); apply.addEventListener('click', () => void this.preview());
	}
	private removeMarkdown = false;
	private async preview(): Promise<void> {
		const canvas = this.plugin.currentCanvas(); if (!canvas) return;
		try {
			const plan = await this.plugin.relationshipEngine.planUnlinkNodes(canvas, this.firstId, this.secondId, this.removeMarkdown);
			this.close();
			new OperationPreviewModal(this.app, plan, this.plugin.transactionEngine, canvas).open();
		} catch (error) { new Notice(`Canvas Toolkit: ${error instanceof Error ? error.message : 'Unable to unlink.'}`); }
	}
}

export function registerPhase6Commands(plugin: CanvasToolkitPlugin): void {
	plugin.addCommand({
		id: 'canvas-connect-selected', name: 'Canvas: connect selected elements',
		checkCallback: (checking: boolean) => {
			const canvas = plugin.currentCanvas(); const ids = canvas?.getSelectionIds() ?? [];
			if (!canvas || ids.length !== 1) return false;
			const sourceId = ids[0];
			if (!sourceId) return false;
			if (!checking) new UniversalRelationshipModal(plugin.app, plugin, sourceId).open();
			return true;
		},
	});
	plugin.addCommand({
		id: 'canvas-unlink-selected', name: 'Canvas: unlink selected pair',
		checkCallback: (checking: boolean) => {
			const canvas = plugin.currentCanvas(); const ids = canvas?.getSelectionIds() ?? [];
			if (!canvas || ids.length !== 2) return false;
			const firstId = ids[0], secondId = ids[1];
			if (!firstId || !secondId) return false;
			if (!checking) new UnlinkRelationshipModal(plugin.app, plugin, firstId, secondId).open();
			return true;
		},
	});
}
