import type { CanvasDataModel, CanvasNodeModel } from '../types';
import { overlapArea, snapRect, type Rect } from '../geometry';

export interface SnapOptions {
	grid?: number;
	alignmentTolerance?: number;
	avoidOverlap?: boolean;
}

export class SnapEngine {
	snapNodes(data: CanvasDataModel, ids: string[], options: SnapOptions = {}): CanvasDataModel {
		const result = structuredClone(data) as CanvasDataModel;
		const selected = new Set(ids);
		const tolerance = Math.max(1, options.alignmentTolerance ?? 10);
		const targets = result.nodes.filter((node) => !selected.has(node.id));
		for (const node of result.nodes) {
			if (!selected.has(node.id)) continue;
			if (options.grid) Object.assign(node, snapRect(node, options.grid));
			this.snapToNeighbors(node, targets, tolerance);
			if (options.avoidOverlap) this.nudgeFromOverlap(node, targets, 12);
		}
		return result;
	}

	private snapToNeighbors(node: CanvasNodeModel, targets: CanvasNodeModel[], tolerance: number): void {
		const candidatesX = targets.flatMap((t) => [t.x, t.x + t.width, t.x + t.width / 2 - node.width / 2]);
		const candidatesY = targets.flatMap((t) => [t.y, t.y + t.height, t.y + t.height / 2 - node.height / 2]);
		const nearestX = nearest(node.x, candidatesX, tolerance);
		const nearestY = nearest(node.y, candidatesY, tolerance);
		if (nearestX !== null) node.x = nearestX;
		if (nearestY !== null) node.y = nearestY;
	}

	private nudgeFromOverlap(node: CanvasNodeModel, targets: CanvasNodeModel[], step: number): void {
		let guard = 0;
		while (guard++ < 8 && targets.some((t) => overlapArea(node as Rect, t as Rect) > 0)) node.x += step;
	}
}

function nearest(value: number, candidates: number[], tolerance: number): number | null {
	let best: number | null = null;
	let distance = tolerance + 0.0001;
	for (const candidate of candidates) {
		const d = Math.abs(candidate - value);
		if (d <= tolerance && d < distance) { distance = d; best = candidate; }
	}
	return best;
}
