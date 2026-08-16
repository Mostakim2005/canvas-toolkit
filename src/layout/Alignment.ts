import type { CanvasDataModel } from '../types';

export type AlignmentMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributionMode = 'horizontal' | 'vertical';

export function align(data: CanvasDataModel, ids: string[], mode: AlignmentMode): CanvasDataModel {
	const result = structuredClone(data) as CanvasDataModel;
	const nodes = result.nodes.filter(n => ids.includes(n.id));
	if (nodes.length < 2) return result;
	const minX = Math.min(...nodes.map(n=>n.x)), maxRight = Math.max(...nodes.map(n=>n.x+n.width));
	const minY = Math.min(...nodes.map(n=>n.y)), maxBottom = Math.max(...nodes.map(n=>n.y+n.height));
	const centerX = nodes.reduce((s,n)=>s+n.x+n.width/2,0)/nodes.length;
	const centerY = nodes.reduce((s,n)=>s+n.y+n.height/2,0)/nodes.length;
	for (const n of nodes) switch(mode) {
		case 'left': n.x=minX; break; case 'center': n.x=centerX-n.width/2; break; case 'right': n.x=maxRight-n.width; break;
		case 'top': n.y=minY; break; case 'middle': n.y=centerY-n.height/2; break; case 'bottom': n.y=maxBottom-n.height; break;
	}
	return result;
}

export function distribute(data: CanvasDataModel, ids: string[], mode: DistributionMode): CanvasDataModel {
	const result = structuredClone(data) as CanvasDataModel;
	const nodes = result.nodes.filter(n => ids.includes(n.id)).sort((a,b)=> mode==='horizontal' ? a.x-b.x : a.y-b.y);
	if (nodes.length < 3) return result;
	const first = nodes[0]!, last = nodes[nodes.length-1]!;
	const firstPos = mode==='horizontal' ? first.x : first.y;
	const lastPos = mode==='horizontal' ? last.x : last.y;
	const step = (lastPos-firstPos)/(nodes.length-1);
	nodes.forEach((n,i)=> { if (mode==='horizontal') n.x=firstPos+step*i; else n.y=firstPos+step*i; });
	return result;
}
