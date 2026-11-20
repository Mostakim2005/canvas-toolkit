import type { CanvasDataModel, RelationshipModel } from '../types';

export interface GraphAnalysis {
	nodeCount: number;
	edgeCount: number;
	orphanEdgeIds: string[];
	duplicateRelationshipPairs: string[];
	isolatedNodeIds: string[];
}

export class GraphAnalyzer {
	analyze(data: CanvasDataModel): GraphAnalysis {
		const nodeIds = new Set(data.nodes.map((node) => node.id));
		const orphanEdgeIds = data.edges
			.filter((edge) => !nodeIds.has(edge.fromNode) || !nodeIds.has(edge.toNode))
			.map((edge) => edge.id);
		const pairCounts = new Map<string, number>();
		for (const edge of data.edges) {
			const key = `${edge.fromNode}\u0000${edge.toNode}`;
			pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
		}
		const duplicateRelationshipPairs = [...pairCounts.entries()]
			.filter(([, count]) => count > 1)
			.map(([pair]) => pair);
		const connected = new Set<string>();
		for (const edge of data.edges) {
			connected.add(edge.fromNode);
			connected.add(edge.toNode);
		}
		const isolatedNodeIds = data.nodes.filter((node) => !connected.has(node.id)).map((node) => node.id);
		return {
			nodeCount: data.nodes.length,
			edgeCount: data.edges.length,
			orphanEdgeIds,
			duplicateRelationshipPairs,
			isolatedNodeIds,
		};
	}

	toRelationships(data: CanvasDataModel): RelationshipModel[] {
		return data.edges.map((edge) => ({
			id: edge.id,
			sourceId: edge.fromNode,
			targetId: edge.toNode,
			kind: 'canvas-edge',
			directed: Boolean(edge.toEnd),
			semantic: false,
		}));
	}
}

export function graphStats(data: { nodes: { id: string }[]; edges: { fromNode: string; toNode: string }[] }) {
	const degree = new Map<string, number>();
	for (const node of data.nodes) degree.set(node.id, 0);
	for (const edge of data.edges) {
		degree.set(edge.fromNode, (degree.get(edge.fromNode) ?? 0) + 1);
		degree.set(edge.toNode, (degree.get(edge.toNode) ?? 0) + 1);
	}
	const components = connectedComponents(data);
	const averageDegree = data.nodes.length ? (2 * data.edges.length) / data.nodes.length : 0;
	const possible = data.nodes.length * Math.max(0, data.nodes.length - 1);
	return {
		nodes: data.nodes.length,
		edges: data.edges.length,
		averageDegree,
		components,
		density: possible ? data.edges.length / possible : 0,
		maxDegree: Math.max(0, ...degree.values()),
	};
}

function connectedComponents(data: { nodes: { id: string }[]; edges: { fromNode: string; toNode: string }[] }): number {
	const adj = new Map<string, Set<string>>();
	for (const n of data.nodes) adj.set(n.id, new Set());
	for (const e of data.edges) {
		adj.get(e.fromNode)?.add(e.toNode);
		adj.get(e.toNode)?.add(e.fromNode);
	}
	const visited = new Set<string>();
	let count = 0;
	for (const n of data.nodes) {
		if (!visited.has(n.id)) {
			count++;
			const stack = [n.id];
			visited.add(n.id);
			while (stack.length) {
				for (const next of adj.get(stack.pop()!) ?? []) {
					if (!visited.has(next)) {
						visited.add(next);
						stack.push(next);
					}
				}
			}
		}
	}
	return count;
}
