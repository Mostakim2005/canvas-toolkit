import type { CanvasDataModel } from '../types';

export interface ExpansionOptions {
	direction: 'incoming' | 'outgoing' | 'both';
	depth: number;
	maxNodes: number;
}

export interface ExpansionResult {
	nodeIds: string[];
	edgeIds: string[];
}

export class GraphExpander {
	expand(data: CanvasDataModel, startIds: string[], options: ExpansionOptions): ExpansionResult {
		const edgesBySource = new Map<string, string[]>();
		const edgesByTarget = new Map<string, string[]>();
		for (const edge of data.edges) {
			(edgesBySource.get(edge.fromNode) ?? (edgesBySource.set(edge.fromNode, []), edgesBySource.get(edge.fromNode)!)).push(edge.id);
			(edgesByTarget.get(edge.toNode) ?? (edgesByTarget.set(edge.toNode, []), edgesByTarget.get(edge.toNode)!)).push(edge.id);
		}
		const nodeById = new Map(data.nodes.map(n => [n.id, n]));
		const visited = new Set(startIds.filter(id => nodeById.has(id)));
		const edgeIds = new Set<string>();
		let frontier = [...visited];
		for (let depth = 0; depth < Math.max(0, options.depth) && frontier.length; depth++) {
			const next: string[] = [];
			for (const nodeId of frontier) {
				const candidateEdges: string[] = [];
				if (options.direction === 'outgoing' || options.direction === 'both') candidateEdges.push(...(edgesBySource.get(nodeId) ?? []));
				if (options.direction === 'incoming' || options.direction === 'both') candidateEdges.push(...(edgesByTarget.get(nodeId) ?? []));
				for (const edgeId of candidateEdges) {
					const edge = data.edges.find(e => e.id === edgeId);
					if (!edge) continue;
					edgeIds.add(edge.id);
					const other = edge.fromNode === nodeId ? edge.toNode : edge.fromNode;
					if (nodeById.has(other) && visited.size < Math.max(1, options.maxNodes) && !visited.has(other)) { visited.add(other); next.push(other); }
				}
			}
			frontier = next;
		}
		return { nodeIds: [...visited], edgeIds: [...edgeIds] };
	}
}
