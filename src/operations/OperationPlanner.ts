import type { CanvasDataModel, MarkdownChange, OperationPlan, OperationType, PlannedChange } from '../types';

export class OperationPlanner {
	create(type: OperationType, description: string, changes: PlannedChange[], warnings: string[] = []): OperationPlan {
		return { id: crypto.randomUUID(), createdAt: Date.now(), type, description, changes, warnings, reversible: true };
	}
	canvasChange(path: string, before: CanvasDataModel, after: CanvasDataModel): PlannedChange {
		return { type: 'replace-canvas', path, before: structuredClone(before), after: structuredClone(after) };
	}
	markdownChange(change: Omit<MarkdownChange, 'type'>): MarkdownChange {
		return { type: 'modify-markdown', ...change };
	}
}
