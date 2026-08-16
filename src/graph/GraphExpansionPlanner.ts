import { TFile, type App } from 'obsidian';
import type { CanvasAdapter } from '../canvas/CanvasAdapter';
import type { CanvasDataModel, CanvasNodeModel, OperationPlan } from '../types';
import { OperationPlanner } from '../operations/OperationPlanner';

export interface VaultExpansionOptions {
	direction: 'incoming' | 'outgoing' | 'both';
	depth: number;
	maxNodes: number;
	maxEdges: number;
}

export class VaultExpansionPlanner {
	private readonly planner = new OperationPlanner();
	constructor(private readonly app: App) {}

	async plan(adapter: CanvasAdapter, options: VaultExpansionOptions): Promise<OperationPlan> {
		const before = adapter.getData();
		const after = structuredClone(before);
		const pathToNode = new Map(after.nodes.filter(n => n.type === 'file' && n.file).map(n => [n.file!, n]));
		const start = [...pathToNode.entries()].filter(([path, node]) => adapter.getSelectionIds().includes(node.id));
		if (!start.length) throw new Error('Select at least one file node.');
		const knownPaths = new Set(pathToNode.keys());
		const queue = start.map(([path]) => ({ path, depth: 0 }));
		const visited = new Set(start.map(([path]) => path));
		const relationships: Array<{ source: string; target: string }> = [];
		const incoming = new Map<string, string[]>();
		for (const source of this.app.metadataCache.resolvedLinks ? Object.keys(this.app.metadataCache.resolvedLinks) : []) {
			for (const target of Object.keys(this.app.metadataCache.resolvedLinks[source] ?? {})) {
				const list = incoming.get(target) ?? []; list.push(source); incoming.set(target, list);
			}
		}
		while (queue.length && visited.size < options.maxNodes) {
			const current = queue.shift()!;
			if (current.depth >= Math.max(0, options.depth)) { continue; }
			const sourceFile = this.app.vault.getAbstractFileByPath(current.path);
			if (!(sourceFile instanceof TFile) || sourceFile.extension.toLowerCase() !== 'md') continue;
			const outgoingTargets = Object.keys(this.app.metadataCache.resolvedLinks[sourceFile.path] ?? {});
			const incomingSources = incoming.get(sourceFile.path) ?? [];
			const targets: Array<[string, string]> = [];
			if (options.direction === 'outgoing' || options.direction === 'both') for (const target of outgoingTargets) targets.push([sourceFile.path, target]);
			if (options.direction === 'incoming' || options.direction === 'both') for (const source of incomingSources) targets.push([source, sourceFile.path]);
			for (const [source, target] of targets) {
				if (relationships.length >= options.maxEdges) break;
				relationships.push({ source, target });
				if (!visited.has(target) && visited.size < options.maxNodes) { visited.add(target); queue.push({ path: target, depth: current.depth + 1 }); }
			}
		}
		const missingPaths = [...visited].filter(path => !knownPaths.has(path));
		const positions = new Map<string, { x: number; y: number }>();
		const selectedIds = adapter.getSelectionIds();
		const anchor = after.nodes.find(n => selectedIds.includes(n.id));
		const startX = anchor ? anchor.x + anchor.width + 100 : 0, startY = anchor?.y ?? 0;
		missingPaths.forEach((path, index) => positions.set(path, { x: startX + (index % 4) * 420, y: startY + Math.floor(index / 4) * 320 }));
		const idsByPath = new Map<string, string>();
		for (const [path, node] of pathToNode) idsByPath.set(path, node.id);
		const usedIds = new Set(after.nodes.map(n => n.id));
		for (const path of missingPaths) {
			let id = crypto.randomUUID(); while (usedIds.has(id)) id = crypto.randomUUID(); usedIds.add(id);
			const pos = positions.get(path)!;
			const node: CanvasNodeModel = { id, type: 'file', file: path, x: pos.x, y: pos.y, width: 360, height: 220 };
			after.nodes.push(node); idsByPath.set(path, id); pathToNode.set(path, node);
		}
		const existingPairs = new Set(after.edges.map(e => `${e.fromNode}\u0000${e.toNode}`));
		const usedEdgeIds = new Set(after.edges.map(e => e.id));
		for (const relation of relationships) {
			const fromNode = idsByPath.get(relation.source), toNode = idsByPath.get(relation.target);
			if (!fromNode || !toNode) continue;
			const pair = `${fromNode}\u0000${toNode}`;
			if (existingPairs.has(pair)) continue;
			let id = crypto.randomUUID(); while (usedEdgeIds.has(id)) id = crypto.randomUUID(); usedEdgeIds.add(id); existingPairs.add(pair);
			after.edges.push({ id, fromNode, toNode, fromSide: 'right', toSide: 'left', toEnd: 'arrow' });
		}
		return this.planner.create('expand-graph', `Expand ${options.direction} relationships`, [this.planner.canvasChange(adapter.getPath() ?? '', before, after)], missingPaths.length > 0 ? [] : ['No new files were required; only relationships were analyzed.']);
	}
}
