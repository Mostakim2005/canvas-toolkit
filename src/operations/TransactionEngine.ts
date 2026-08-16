import { Notice, type App, TFile } from 'obsidian';
import { CanvasAdapter } from '../canvas/CanvasAdapter';
import type { CanvasDataModel, MarkdownChange, OperationPlan, TransactionRecord } from '../types';

export class TransactionEngine {
	private readonly undoStack: TransactionRecord[] = [];
	private readonly redoStack: TransactionRecord[] = [];
	private active = false;

	constructor(private readonly app: App, private readonly limitProvider: () => number) {}

	async commit(plan: OperationPlan, activeCanvas?: CanvasAdapter | null): Promise<TransactionRecord> {
		if (this.active) throw new Error('Another Canvas Toolkit transaction is already running.');
		if (!plan.reversible) throw new Error('Only reversible plans can be committed.');
		if (!plan.changes.length) throw new Error('There are no changes to commit.');
		this.active = true;
		const record: TransactionRecord = { id: plan.id, createdAt: plan.createdAt, status: 'committing', plan };
		try {
			await this.assertFresh(plan, activeCanvas);
			for (const change of plan.changes) {
				if (change.type === 'replace-canvas') await this.applyCanvas(change.path, change.after, activeCanvas, change.before);
				else await this.applyMarkdown(change);
			}
			await this.assertStateMatches(plan, 'after', activeCanvas);
			record.status = 'committed';
			record.committedAt = Date.now();
			this.undoStack.push(record);
			this.trim(this.undoStack);
			this.redoStack.length = 0;
			return record;
		} catch (error) {
			record.status = 'failed';
			try { await this.applySnapshot(plan, 'before', activeCanvas); } catch { /* preserve original error; rollback is best-effort */ }
			throw error;
		} finally {
			this.active = false;
		}
	}

	async undo(activeCanvas?: CanvasAdapter | null): Promise<boolean> {
		if (this.active) return false;
		const record = this.undoStack[this.undoStack.length - 1];
		if (!record) return false;
		this.active = true;
		try {
			await this.assertStateMatches(record.plan, 'after', activeCanvas);
			await this.applySnapshot(record.plan, 'before', activeCanvas);
			await this.assertStateMatches(record.plan, 'before', activeCanvas);
			this.undoStack.pop();
			this.redoStack.push(record);
			this.trim(this.redoStack);
			new Notice('Canvas Toolkit: operation undone.');
			return true;
		} finally { this.active = false; }
	}

	async redo(activeCanvas?: CanvasAdapter | null): Promise<boolean> {
		if (this.active) return false;
		const record = this.redoStack[this.redoStack.length - 1];
		if (!record) return false;
		this.active = true;
		try {
			await this.assertStateMatches(record.plan, 'before', activeCanvas);
			await this.applySnapshot(record.plan, 'after', activeCanvas);
			await this.assertStateMatches(record.plan, 'after', activeCanvas);
			this.redoStack.pop();
			this.undoStack.push(record);
			this.trim(this.undoStack);
			new Notice('Canvas Toolkit: operation redone.');
			return true;
		} finally { this.active = false; }
	}

	canUndo(): boolean { return !this.active && this.undoStack.length > 0; }
	canRedo(): boolean { return !this.active && this.redoStack.length > 0; }

	private async assertFresh(plan: OperationPlan, activeCanvas?: CanvasAdapter | null): Promise<void> {
		await this.assertStateMatches(plan, 'before', activeCanvas);
	}

	private async assertStateMatches(plan: OperationPlan, side: 'before' | 'after', activeCanvas?: CanvasAdapter | null): Promise<void> {
		for (const change of plan.changes) {
			if (change.type === 'modify-markdown') {
				const file = this.app.vault.getAbstractFileByPath(change.path);
				if (!(file instanceof TFile)) throw new Error(`Markdown file not found: ${change.path}`);
				const expected = side === 'before' ? change.before : change.after;
				const current = await this.app.vault.cachedRead(file);
				if (current !== expected) throw new Error(`File changed since ${side === 'before' ? 'preview' : 'transaction'}: ${change.path}`);
			} else {
				const expected = side === 'before' ? change.before : change.after;
				const current = await this.readCanvas(change.path, activeCanvas);
				if (stableCanvasJson(current) !== stableCanvasJson(expected)) throw new Error(`Canvas changed since ${side === 'before' ? 'preview' : 'transaction'}: ${change.path}`);
			}
		}
	}

	private async readCanvas(path: string, activeCanvas?: CanvasAdapter | null): Promise<CanvasDataModel> {
		if (activeCanvas?.getPath() === path) return activeCanvas.getData();
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(`Canvas not found: ${path}`);
		return CanvasAdapter.parseData(JSON.parse(await this.app.vault.cachedRead(file)), true);
	}

	private async applyCanvas(path: string, data: CanvasDataModel, activeCanvas?: CanvasAdapter | null, expected?: CanvasDataModel): Promise<void> {
		if (activeCanvas?.getPath() === path) {
			if (expected && stableCanvasJson(activeCanvas.getData()) !== stableCanvasJson(expected)) throw new Error(`Canvas changed during transaction: ${path}`);
			activeCanvas.setData(data);
			activeCanvas.save();
			return;
		}
		const abstract = this.app.vault.getAbstractFileByPath(path);
		if (!(abstract instanceof TFile)) throw new Error(`Canvas not found: ${path}`);
		await this.app.vault.process(abstract, current => {
			const currentData = CanvasAdapter.parseData(JSON.parse(current), true);
			if (expected && JSON.stringify(currentData) !== JSON.stringify(expected)) throw new Error(`Canvas changed during transaction: ${path}`);
			return JSON.stringify(CanvasAdapter.toRawData(data), null, 2);
		});
	}

	private async applyMarkdown(change: MarkdownChange): Promise<void> {
		const abstract = this.app.vault.getAbstractFileByPath(change.path);
		if (!(abstract instanceof TFile)) throw new Error(`Markdown file not found: ${change.path}`);
		await this.app.vault.process(abstract, current => {
			if (current !== change.before) throw new Error(`File changed during transaction: ${change.path}`);
			return change.after;
		});
	}

	private async applySnapshot(plan: OperationPlan, side: 'before' | 'after', activeCanvas?: CanvasAdapter | null): Promise<void> {
		const changes = side === 'before' ? [...plan.changes].reverse() : plan.changes;
		for (const change of changes) {
			if (change.type === 'replace-canvas') {
				const expected = side === 'before' ? change.after : change.before;
				const target = side === 'before' ? change.before : change.after;
				await this.applyCanvas(change.path, target, activeCanvas, expected);
			} else {
				const expected = side === 'before' ? change.after : change.before;
				const target = side === 'before' ? change.before : change.after;
				const abstract = this.app.vault.getAbstractFileByPath(change.path);
				if (!(abstract instanceof TFile)) throw new Error(`Markdown file not found: ${change.path}`);
				await this.app.vault.process(abstract, current => {
					if (current !== expected) throw new Error(`Cannot safely restore changed file: ${change.path}`);
					return target;
				});
			}
		}
	}

	private trim(stack: TransactionRecord[]): void { while (stack.length > Math.max(1, Math.floor(this.limitProvider()))) stack.shift(); }
}


function stableCanvasJson(value: unknown): string {
	const normalize = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(normalize);
		if (input && typeof input === 'object') {
			const record = input as Record<string, unknown>;
			return Object.fromEntries(Object.keys(record).sort().map(key => [key, normalize(record[key])]));
		}
		return input;
	};
	return JSON.stringify(normalize(value));
}
