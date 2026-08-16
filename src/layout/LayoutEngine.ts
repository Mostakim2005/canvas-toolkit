import type { CanvasDataModel, CanvasNodeModel } from '../types';

export type LayoutKind = 'grid' | 'hierarchical' | 'radial' | 'mind-map' | 'compact';
export interface LayoutOptions { gapX?: number; gapY?: number; center?: {x:number;y:number}; }

export class LayoutEngine {
	layout(data: CanvasDataModel, kind: LayoutKind, ids?: string[], options: LayoutOptions = {}): CanvasDataModel {
		const result = structuredClone(data) as CanvasDataModel;
		const selected = ids?.length ? result.nodes.filter(n => ids.includes(n.id)) : result.nodes;
		if (selected.length < 2) return result;
		const gapX = options.gapX ?? 80, gapY = options.gapY ?? 80;
		switch (kind) {
			case 'grid': return this.grid(result, selected, gapX, gapY);
			case 'hierarchical': return this.hierarchical(result, selected, gapX, gapY);
			case 'radial': return this.radial(result, selected, options.center ?? {x:0,y:0});
			case 'mind-map': return this.mindMap(result, selected, options.center ?? {x:0,y:0}, gapX);
			case 'compact': return this.compact(result, selected, gapX, gapY);
		}
	}

	private grid(data: CanvasDataModel, nodes: CanvasNodeModel[], gapX: number, gapY: number): CanvasDataModel {
		const columns = Math.ceil(Math.sqrt(nodes.length));
		nodes.forEach((n, i) => { n.x = (i % columns) * (averageWidth(nodes) + gapX); n.y = Math.floor(i / columns) * (averageHeight(nodes) + gapY); });
		return data;
	}

	private hierarchical(data: CanvasDataModel, nodes: CanvasNodeModel[], gapX: number, gapY: number): CanvasDataModel {
		const selected = new Set(nodes.map(n => n.id));
		const incoming = new Map<string, number>();
		for (const n of nodes) incoming.set(n.id, 0);
		for (const e of data.edges) if (selected.has(e.fromNode) && selected.has(e.toNode)) incoming.set(e.toNode, (incoming.get(e.toNode) ?? 0) + 1);
		let roots = nodes.filter(n => (incoming.get(n.id) ?? 0) === 0);
		if (!roots.length) roots = [nodes[0]!];
		const level = new Map<string, number>(roots.map(n => [n.id, 0]));
		const queue = roots.map(n => n.id);
		const children = new Map<string, string[]>();
		for (const e of data.edges) if (selected.has(e.fromNode) && selected.has(e.toNode)) {
			const arr = children.get(e.fromNode) ?? []; arr.push(e.toNode); children.set(e.fromNode, arr);
		}
		while (queue.length) { const id = queue.shift()!; for (const child of children.get(id) ?? []) if (!level.has(child)) { level.set(child, (level.get(id) ?? 0) + 1); queue.push(child); } }
		for (const n of nodes) if (!level.has(n.id)) level.set(n.id, 0);
		const rows = new Map<number, CanvasNodeModel[]>();
		for (const n of nodes) { const l = level.get(n.id)!; (rows.get(l) ?? (rows.set(l, []), rows.get(l)!)).push(n); }
		for (const [l, row] of rows) row.forEach((n, i) => { n.x = i * (averageWidth(nodes) + gapX); n.y = l * (averageHeight(nodes) + gapY); });
		return data;
	}

	private radial(data: CanvasDataModel, nodes: CanvasNodeModel[], center: {x:number;y:number}): CanvasDataModel {
		const radius = Math.max(220, nodes.length * 40);
		nodes.forEach((n, i) => { const a = i / nodes.length * Math.PI * 2; n.x = center.x + Math.cos(a) * radius - n.width/2; n.y = center.y + Math.sin(a) * radius - n.height/2; });
		return data;
	}

	private mindMap(data: CanvasDataModel, nodes: CanvasNodeModel[], center: {x:number;y:number}, gap: number): CanvasDataModel {
		const root = nodes[0]!; root.x = center.x - root.width/2; root.y = center.y - root.height/2;
		const others = nodes.slice(1);
		others.forEach((n, i) => { const side = i % 2 === 0 ? -1 : 1; const row = Math.floor(i/2); n.x = center.x + side * (root.width + gap); n.y = center.y + (row - Math.ceil(others.length/4)) * (n.height + gap); });
		return data;
	}

	private compact(data: CanvasDataModel, nodes: CanvasNodeModel[], gapX: number, gapY: number): CanvasDataModel {
		const sorted = [...nodes].sort((a,b) => (a.y-b.y) || (a.x-b.x));
		let x = 0, y = 0, rowHeight = 0;
		const maxWidth = Math.max(1000, Math.sqrt(nodes.length) * 500);
		for (const n of sorted) { if (x && x + n.width > maxWidth) { x = 0; y += rowHeight + gapY; rowHeight = 0; } n.x = x; n.y = y; x += n.width + gapX; rowHeight = Math.max(rowHeight, n.height); }
		return data;
	}
}

function averageWidth(nodes: CanvasNodeModel[]): number { return nodes.reduce((s,n) => s+n.width, 0)/Math.max(1,nodes.length); }
function averageHeight(nodes: CanvasNodeModel[]): number { return nodes.reduce((s,n) => s+n.height, 0)/Math.max(1,nodes.length); }
