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
