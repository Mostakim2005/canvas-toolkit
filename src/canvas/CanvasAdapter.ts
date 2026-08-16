import type { ItemView } from 'obsidian';
import type { CanvasDataModel, CanvasEdgeModel, CanvasNodeModel, CanvasSide } from '../types';

interface CanvasLike {
	getData?: () => unknown;
	setData?: (data: unknown) => void;
	requestSave?: () => void;
	selection?: Set<{ id?: unknown }> | Map<string, unknown>;
}

interface CanvasViewLike extends ItemView {
	canvas?: CanvasLike;
	file?: { path?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asString(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function asNumber(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function asSide(value: unknown): CanvasSide { return value === 'top' || value === 'bottom' || value === 'left' || value === 'right' ? value : 'right'; }

const NODE_KEYS = new Set(['id', 'type', 'x', 'y', 'width', 'height', 'file', 'text', 'url', 'label']);
const EDGE_KEYS = new Set(['id', 'fromNode', 'toNode', 'fromSide', 'toSide', 'label', 'fromEnd', 'toEnd']);

function extrasOf(record: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined {
	const extra: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) if (!known.has(key)) extra[key] = structuredClone(value);
	return Object.keys(extra).length ? extra : undefined;
}

function toRawNode(node: CanvasNodeModel): Record<string, unknown> {
	return {
		...(node.extra ? structuredClone(node.extra) : {}),
		id: node.id, type: node.type, x: node.x, y: node.y, width: node.width, height: node.height,
		...(node.file !== undefined ? { file: node.file } : {}),
		...(node.text !== undefined ? { text: node.text } : {}),
		...(node.url !== undefined ? { url: node.url } : {}),
		...(node.label !== undefined ? { label: node.label } : {}),
	};
}

function toRawEdge(edge: CanvasEdgeModel): Record<string, unknown> {
	return {
		...(edge.extra ? structuredClone(edge.extra) : {}),
		id: edge.id, fromNode: edge.fromNode, toNode: edge.toNode,
		fromSide: edge.fromSide, toSide: edge.toSide,
		...(edge.label !== undefined ? { label: edge.label } : {}),
		...(edge.fromEnd !== undefined ? { fromEnd: edge.fromEnd } : {}),
		...(edge.toEnd !== undefined ? { toEnd: edge.toEnd } : {}),
	};
}

export class CanvasAdapter {
	constructor(private readonly view: CanvasViewLike) {}

	static fromView(view: ItemView): CanvasAdapter | null {
		const candidate = view as CanvasViewLike;
		return view.getViewType() === 'canvas' && candidate.canvas ? new CanvasAdapter(candidate) : null;
	}

	getPath(): string | null { return this.view.file?.path ?? null; }

	static parseData(raw: unknown, strict = false): CanvasDataModel {
		if (!isRecord(raw)) { if (strict) throw new Error('Invalid Canvas JSON object.'); return { nodes: [], edges: [] }; }
		if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) { if (strict) throw new Error('Invalid Canvas data: nodes/edges are missing.'); return { nodes: [], edges: [] }; }
		const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
		const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];
		const nodes: CanvasNodeModel[] = [];
		for (const item of rawNodes) {
			if (!isRecord(item)) continue;
			const typeValue = asString(item.type);
			const type: CanvasNodeModel['type'] = typeValue === 'file' || typeValue === 'text' || typeValue === 'link' || typeValue === 'group' ? typeValue : 'unknown';
			const id = asString(item.id);
			if (!id) continue;
			nodes.push({
				id, type, x: asNumber(item.x), y: asNumber(item.y), width: Math.max(1, asNumber(item.width, 100)), height: Math.max(1, asNumber(item.height, 100)),
				file: asString(item.file), text: asString(item.text), url: asString(item.url), label: asString(item.label),
				extra: extrasOf(item, NODE_KEYS),
			});
		}
		const edges: CanvasEdgeModel[] = [];
		for (const item of rawEdges) {
			if (!isRecord(item)) continue;
			const id = asString(item.id), fromNode = asString(item.fromNode), toNode = asString(item.toNode);
			if (!id || !fromNode || !toNode) continue;
			edges.push({
				id, fromNode, toNode, fromSide: asSide(item.fromSide), toSide: asSide(item.toSide), label: asString(item.label), fromEnd: asString(item.fromEnd), toEnd: asString(item.toEnd),
				extra: extrasOf(item, EDGE_KEYS),
			});
		}
		return { nodes, edges };
	}

	static toRawData(data: CanvasDataModel): Record<string, unknown> {
		return { nodes: data.nodes.map(toRawNode), edges: data.edges.map(toRawEdge) };
	}

	getData(): CanvasDataModel { return CanvasAdapter.parseData(this.view.canvas?.getData?.()); }

	setData(data: CanvasDataModel): void { this.view.canvas?.setData?.(CanvasAdapter.toRawData(data)); }

	save(): void { this.view.canvas?.requestSave?.(); }

	getSelectionIds(): string[] {
		const selection = this.view.canvas?.selection;
		if (!selection) return [];
		const ids: string[] = [];
		if (selection instanceof Map) { for (const id of selection.keys()) ids.push(id); return ids; }
		for (const item of selection) if (typeof item.id === 'string') ids.push(item.id);
		return ids;
	}
}
