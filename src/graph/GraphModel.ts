import type { CanvasDataModel, CanvasNodeModel, RelationshipModel } from '../types';

export interface GraphNode extends CanvasNodeModel {
	filePath?: string;
}

export interface GraphModel {
	canvasPath?: string;
	nodes: Map<string, GraphNode>;
	relationships: Map<string, RelationshipModel>;
	incoming: Map<string, Set<string>>;
	outgoing: Map<string, Set<string>>;
}

export class GraphModelBuilder {
	build(data: CanvasDataModel, canvasPath?: string): GraphModel {
		const nodes = new Map<string, GraphNode>();
		for (const node of data.nodes) nodes.set(node.id, { ...node, filePath: node.file });
		const relationships = new Map<string, RelationshipModel>();
		const incoming = new Map<string, Set<string>>();
		const outgoing = new Map<string, Set<string>>();
		for (const node of data.nodes) { incoming.set(node.id, new Set()); outgoing.set(node.id, new Set()); }
		for (const edge of data.edges) {
			const rel: RelationshipModel = { id: edge.id, sourceId: edge.fromNode, targetId: edge.toNode, kind: 'canvas-edge', directed: Boolean(edge.toEnd), semantic: false, sourcePath: nodes.get(edge.fromNode)?.filePath, targetPath: nodes.get(edge.toNode)?.filePath };
			relationships.set(rel.id, rel);
			outgoing.get(rel.sourceId)?.add(rel.id);
			incoming.get(rel.targetId)?.add(rel.id);
		}
		return { canvasPath, nodes, relationships, incoming, outgoing };
	}
}
