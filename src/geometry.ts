export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; height: number; }

export function center(r: Rect): Point {
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

export function overlapArea(a: Rect, b: Rect): number {
	const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
	const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
	return x * y;
}

export function rectForSide(r: Rect, side: 'top' | 'bottom' | 'left' | 'right'): Point {
	switch (side) {
		case 'top': return { x: r.x + r.width / 2, y: r.y };
		case 'bottom': return { x: r.x + r.width / 2, y: r.y + r.height };
		case 'left': return { x: r.x, y: r.y + r.height / 2 };
		case 'right': return { x: r.x + r.width, y: r.y + r.height / 2 };
	}
}

export function snapValue(value: number, grid: number): number {
	if (!Number.isFinite(grid) || grid <= 0) return value;
	return Math.round(value / grid) * grid;
}

export function snapRect(r: Rect, grid: number): Rect {
	return { ...r, x: snapValue(r.x, grid), y: snapValue(r.y, grid) };
}
