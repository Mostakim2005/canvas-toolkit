import type { CanvasDataModel, CanvasEdgeModel, CanvasNodeModel, CanvasSide } from '../types';
import { distance, rectForSide } from '../geometry';

const SIDES: CanvasSide[] = ['top', 'right', 'bottom', 'left'];

export interface ConnectionOptimizationOptions {
	preserveAxes?: boolean;
	crossingPenalty?: number;
	preferExisting?: number;
}

function nodeMap(data: CanvasDataModel): Map<string, CanvasNodeModel> {
	return new Map(data.nodes.map((node) => [node.id, node]));
}

function axisPenalty(from: CanvasNodeModel, to: CanvasNodeModel, fromSide: CanvasSide, toSide: CanvasSide): number {
	const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
	const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
	const horizontal = Math.abs(dx) >= Math.abs(dy);
	const sidesHorizontal = fromSide === 'left' || fromSide === 'right';
	const targetHorizontal = toSide === 'left' || toSide === 'right';
	return horizontal === sidesHorizontal && horizontal === targetHorizontal ? 0 : 80;
}

function segmentCrosses(a: CanvasEdgeModel, b: CanvasEdgeModel, nodes: Map<string, CanvasNodeModel>): boolean {
	const af = nodes.get(a.fromNode); const at = nodes.get(a.toNode);
	const bf = nodes.get(b.fromNode); const bt = nodes.get(b.toNode);
	if (!af || !at || !bf || !bt) return false;
	if (a.fromNode === b.fromNode || a.fromNode === b.toNode || a.toNode === b.fromNode || a.toNode === b.toNode) return false;
	return segmentsIntersect(centerOf(af), centerOf(at), centerOf(bf), centerOf(bt));
}

function centerOf(n: CanvasNodeModel) { return { x: n.x + n.width / 2, y: n.y + n.height / 2 }; }
function orientation(a: {x:number;y:number}, b: {x:number;y:number}, c: {x:number;y:number}): number {
	return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function onSegment(a:{x:number;y:number}, b:{x:number;y:number}, c:{x:number;y:number}): boolean {
	return Math.min(a.x,c.x) <= b.x && b.x <= Math.max(a.x,c.x) && Math.min(a.y,c.y) <= b.y && b.y <= Math.max(a.y,c.y);
}
function segmentsIntersect(a:{x:number;y:number}, b:{x:number;y:number}, c:{x:number;y:number}, d:{x:number;y:number}): boolean {
	const o1 = orientation(a,b,c), o2 = orientation(a,b,d), o3 = orientation(c,d,a), o4 = orientation(c,d,b);
	if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) return true;
	return (o1 === 0 && onSegment(a,c,b)) || (o2 === 0 && onSegment(a,d,b)) || (o3 === 0 && onSegment(c,a,d)) || (o4 === 0 && onSegment(c,b,d));
}

export class ConnectionOptimizer {
	optimize(data: CanvasDataModel, options: ConnectionOptimizationOptions = {}): CanvasDataModel {
		const nodes = nodeMap(data);
		const result = structuredClone(data);
		for (const edge of result.edges) {
			const from = nodes.get(edge.fromNode); const to = nodes.get(edge.toNode);
			if (!from || !to) continue;
			let best = { score: Number.POSITIVE_INFINITY, fromSide: edge.fromSide, toSide: edge.toSide };
			for (const fromSide of SIDES) for (const toSide of SIDES) {
				const a = rectForSide(from, fromSide);
				const b = rectForSide(to, toSide);
				let score = distance(a, b);
				if (options.preserveAxes) score += axisPenalty(from, to, fromSide, toSide);
				if (fromSide === edge.fromSide && toSide === edge.toSide) score -= options.preferExisting ?? 8;
				const candidate = { ...edge, fromSide, toSide };
				for (const other of result.edges) {
					if (other.id === edge.id) continue;
					if (segmentCrosses(candidate, other, nodes)) score += options.crossingPenalty ?? 120;
				}
				if (score < best.score) best = { score, fromSide, toSide };
			}
			edge.fromSide = best.fromSide;
			edge.toSide = best.toSide;
		}
		return result;
	}
}
