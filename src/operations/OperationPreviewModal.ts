import { Modal, Notice, type App } from 'obsidian';
import type { CanvasAdapter } from '../canvas/CanvasAdapter';
import type { OperationPlan } from '../types';
import type { TransactionEngine } from './TransactionEngine';

export class OperationPreviewModal extends Modal {
	constructor(
		app: App,
		private readonly plan: OperationPlan,
		private readonly engine: TransactionEngine,
		private readonly activeCanvas?: CanvasAdapter | null,
		private readonly onCommitted?: () => void,
	) { super(app); }

	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-operation-modal');
		this.titleEl.setText('Review changes');
		const root = this.contentEl;
		root.empty();
		root.createDiv({ cls: 'ctk-operation-summary', text: this.plan.description });
		const list = root.createDiv({ cls: 'ctk-operation-list' });
		for (const change of this.plan.changes) {
			const row = list.createDiv({ cls: 'ctk-operation-row' });
			if (change.type === 'replace-canvas') {
				row.createEl('strong', { text: 'Canvas' });
				row.createSpan({ text: `${change.path}: ${change.before.nodes.length} → ${change.after.nodes.length} nodes, ${change.before.edges.length} → ${change.after.edges.length} edges` });
			} else {
				row.createEl('strong', { text: 'Markdown' });
				row.createSpan({ text: change.path });
			}
		}
		if (this.plan.warnings.length) {
			const warnings = root.createDiv({ cls: 'ctk-warning-box' });
			warnings.createEl('strong', { text: 'Warnings' });
			for (const warning of this.plan.warnings) warnings.createDiv({ text: warning });
		}
		const footer = root.createDiv({ cls: 'ctk-modal-actions' });
		footer.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());
		const apply = footer.createEl('button', { text: 'Apply changes' });
		apply.addClass('mod-cta');
		apply.addEventListener('click', () => { void this.applyChanges(apply); });
	}
	private async applyChanges(button: HTMLButtonElement): Promise<void> {
		button.disabled = true;
		try {
			await this.engine.commit(this.plan, this.activeCanvas);
			new Notice('Changes applied.');
			this.onCommitted?.();
			this.close();
		} catch (error) {
			button.disabled = false;
			new Notice(`Canvas Toolkit: ${error instanceof Error ? error.message : 'Operation failed'}`);
		}
	}

	onClose(): void { this.contentEl.empty(); }
}
