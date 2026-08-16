import { TFile, type App } from 'obsidian';
import type { CanvasAdapter } from '../canvas/CanvasAdapter';
import type { CanvasDataModel, MarkdownChange, OperationPlan, PlannedChange, ReconciliationResult, RelationshipCandidate, RelationshipLinkMode } from '../types';
import { GraphModelBuilder, type GraphModel } from '../graph/GraphModel';
import { OperationPlanner } from '../operations/OperationPlanner';

export class RelationshipEngine {
	private readonly graphBuilder = new GraphModelBuilder();
	private readonly planner = new OperationPlanner();
	constructor(private readonly app: App) {}

	buildGraph(adapter: CanvasAdapter): GraphModel { return this.graphBuilder.build(adapter.getData(), adapter.getPath() ?? undefined); }

	async reconcile(adapter: CanvasAdapter): Promise<ReconciliationResult> {
		const data = adapter.getData();
		const fileNodes = data.nodes.filter(n => n.type === 'file' && !!n.file);
		const nodeByPath = new Map(fileNodes.map(node => [node.file!, node]));
		const canvasPairs = new Set(data.edges.map(edge => `${edge.fromNode}\u0000${edge.toNode}`));
		const markdownPairs = new Set<string>();
		const missingCanvasEdges: RelationshipCandidate[] = [];
		const missingMarkdownLinks: RelationshipCandidate[] = [];
		const brokenMarkdownLinks: RelationshipCandidate[] = [];
		const conflicts: ReconciliationResult['conflicts'] = [];

		for (const node of fileNodes) {
			const file = this.app.vault.getAbstractFileByPath(node.file!);
			if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'md') continue;
			const resolved = this.app.metadataCache.resolvedLinks[file.path] ?? {};
			const unresolved = this.app.metadataCache.unresolvedLinks[file.path] ?? {};
			for (const targetPath of Object.keys(unresolved)) {
				brokenMarkdownLinks.push({ key: `broken|${file.path}|${targetPath}`, sourceNodeId: node.id, targetNodeId: '', sourcePath: file.path, targetPath, direction: 'outgoing', reason: 'broken-markdown' });
			}
			for (const targetPath of Object.keys(resolved)) {
				const targetNode = nodeByPath.get(targetPath);
				if (!targetNode) continue;
				const key = `${node.id}\u0000${targetNode.id}`;
				const pair = `${file.path}\u0000${targetPath}`;
				markdownPairs.add(pair);
				if (!canvasPairs.has(key)) missingCanvasEdges.push({ key: `mc|${file.path}|${targetPath}`, sourceNodeId: node.id, targetNodeId: targetNode.id, sourcePath: file.path, targetPath, direction: 'outgoing', reason: 'markdown-missing-canvas' });
			}
		}

		for (const edge of data.edges) {
			const source = data.nodes.find(n => n.id === edge.fromNode);
			const target = data.nodes.find(n => n.id === edge.toNode);
			if (!source?.file || !target?.file) continue;
			const pair = `${source.file}\u0000${target.file}`;
			if (!markdownPairs.has(pair) && source.file.toLowerCase().endsWith('.md') && target.file.toLowerCase().endsWith('.md')) {
				missingMarkdownLinks.push({ key: `cm|${source.file}|${target.file}`, sourceNodeId: source.id, targetNodeId: target.id, sourcePath: source.file, targetPath: target.file, direction: 'outgoing', reason: 'canvas-missing-markdown' });
			}
			const reverse = `${target.file}\u0000${source.file}`;
			if (markdownPairs.has(reverse) && source.file.toLowerCase().endsWith('.md') && target.file.toLowerCase().endsWith('.md')) {
				conflicts.push({ type: 'direction', key: `direction|${source.file}|${target.file}`, message: `Canvas direction ${source.file} → ${target.file} conflicts with Markdown direction ${target.file} → ${source.file}.`, sourcePath: source.file, targetPath: target.file });
			}
		}

		const pairCounts = new Map<string, number>();
		for (const edge of data.edges) {
			const pair = `${edge.fromNode}\u0000${edge.toNode}`;
			pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
		}
		const duplicateCanvasEdges = [...pairCounts.entries()].filter(([, count]) => count > 1).map(([pair]) => pair);
		return { missingCanvasEdges, missingMarkdownLinks, brokenMarkdownLinks, duplicateCanvasEdges, conflicts };
	}

	async planAddMissingCanvasEdges(adapter: CanvasAdapter, result?: ReconciliationResult): Promise<OperationPlan> {
		const data = adapter.getData();
		const reconciliation = result ?? await this.reconcile(adapter);
		const after = structuredClone(data) as CanvasDataModel;
		const existing = new Set(after.edges.map(e => e.id));
		const usedPairs = new Set(after.edges.map(e => `${e.fromNode}\u0000${e.toNode}`));
		for (const candidate of reconciliation.missingCanvasEdges) {
			const pair = `${candidate.sourceNodeId}\u0000${candidate.targetNodeId}`;
			if (usedPairs.has(pair)) continue;
			let id = crypto.randomUUID(); while (existing.has(id)) id = crypto.randomUUID(); existing.add(id); usedPairs.add(pair);
			after.edges.push({ id, fromNode: candidate.sourceNodeId, toNode: candidate.targetNodeId, fromSide: 'right', toSide: 'left', toEnd: 'arrow' });
		}
		return this.planner.create('synchronize-relationships', `Add ${reconciliation.missingCanvasEdges.length} missing Canvas connection${reconciliation.missingCanvasEdges.length === 1 ? '' : 's'}`, [this.planner.canvasChange(adapter.getPath() ?? '', data, after)]);
	}

	async planAddMissingMarkdownLinks(adapter: CanvasAdapter, result?: ReconciliationResult): Promise<OperationPlan> {
		const reconciliation = result ?? await this.reconcile(adapter);
		const changes = [] as ReturnType<OperationPlanner['markdownChange']>[];
		const byPath = new Map<string, RelationshipCandidate[]>();
		for (const candidate of reconciliation.missingMarkdownLinks) if (candidate.sourcePath && candidate.targetPath) (byPath.get(candidate.sourcePath) ?? (byPath.set(candidate.sourcePath, []), byPath.get(candidate.sourcePath)!)).push(candidate);
		for (const [path, candidates] of byPath) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) continue;
			const before = await this.app.vault.cachedRead(file);
			let after = before;
			const links = candidates.map(c => `[[${c.targetPath!.replace(/\.md$/i, '')}]]`);
			after += `${after.endsWith('\n') || !after ? '' : '\n'}\n${links.join('\n')}\n`;
			changes.push(this.planner.markdownChange({ path, before, after }));
		}
		return this.planner.create('synchronize-relationships', `Add ${reconciliation.missingMarkdownLinks.length} missing Markdown link${reconciliation.missingMarkdownLinks.length === 1 ? '' : 's'}`, changes);
	}
	async planSafeReconciliation(adapter: CanvasAdapter, result?: ReconciliationResult): Promise<OperationPlan> {
		const reconciliation = result ?? await this.reconcile(adapter);
		const data = adapter.getData();
		const after = structuredClone(data) as CanvasDataModel;
		const usedIds = new Set(after.edges.map(edge => edge.id));
		const usedPairs = new Set(after.edges.map(edge => `${edge.fromNode}\u0000${edge.toNode}`));
		for (const candidate of reconciliation.missingCanvasEdges) {
			const pair = `${candidate.sourceNodeId}\u0000${candidate.targetNodeId}`;
			if (usedPairs.has(pair)) continue;
			let id = crypto.randomUUID();
			while (usedIds.has(id)) id = crypto.randomUUID();
			usedIds.add(id); usedPairs.add(pair);
			after.edges.push({ id, fromNode: candidate.sourceNodeId, toNode: candidate.targetNodeId, fromSide: 'right', toSide: 'left', toEnd: 'arrow' });
		}
		const changes: PlannedChange[] = [];
		if (JSON.stringify(data) !== JSON.stringify(after)) changes.push(this.planner.canvasChange(adapter.getPath() ?? '', data, after));
		const byPath = new Map<string, RelationshipCandidate[]>();
		for (const candidate of reconciliation.missingMarkdownLinks) if (candidate.sourcePath && candidate.targetPath) {
			const list = byPath.get(candidate.sourcePath) ?? []; list.push(candidate); byPath.set(candidate.sourcePath, list);
		}
		for (const [path, candidates] of byPath) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) continue;
			const before = await this.app.vault.cachedRead(file);
			let afterText = before;
			const additions: string[] = [];
			for (const candidate of candidates) {
				const dest = candidate.targetPath!.replace(/\.md$/i, '');
				const token = `[[${dest}]]`;
				if (!afterText.includes(token) && !afterText.includes(`[[${dest}|`)) additions.push(token);
			}
			if (additions.length) {
				afterText += `${afterText && !afterText.endsWith('\n') ? '\n' : ''}${additions.join('\n')}\n`;
				changes.push(this.planner.markdownChange({ path, before, after: afterText }));
			}
		}
		const warnings = reconciliation.conflicts.map(conflict => conflict.message);
		return this.planner.create('synchronize-relationships', `Apply safe relationship reconciliation (${reconciliation.missingCanvasEdges.length} Canvas, ${reconciliation.missingMarkdownLinks.length} Markdown)`, changes, warnings);
	}

	async planConnect(adapter: CanvasAdapter, sourceId: string, target: { nodeId?: string; filePath?: string }, mode: RelationshipLinkMode, label?: string): Promise<OperationPlan> {
		const data = adapter.getData();
		const source = data.nodes.find(node => node.id === sourceId);
		if (!source) throw new Error('Source node no longer exists.');
		if (!target.nodeId && !target.filePath) throw new Error('A target is required.');

		let targetId = target.nodeId;
		let targetNode = targetId ? data.nodes.find(node => node.id === targetId) : undefined;
		const after = structuredClone(data) as CanvasDataModel;
		if (!targetNode && target.filePath) {
			const abstract = this.app.vault.getAbstractFileByPath(target.filePath);
			if (!(abstract instanceof TFile)) throw new Error(`Target file not found: ${target.filePath}`);
			const used = new Set(after.nodes.map(node => node.id));
			targetId = crypto.randomUUID();
			while (used.has(targetId)) targetId = crypto.randomUUID();
			targetNode = {
				id: targetId,
				type: 'file' as const,
				file: target.filePath,
				x: source.x + source.width + 120,
				y: source.y,
				width: 460,
				height: 300,
			};
			after.nodes.push(targetNode);
		}
		if (!targetId || !targetNode) throw new Error('Target could not be resolved.');
		if (sourceId === targetId) throw new Error('A node cannot be linked to itself.');

		const changes: PlannedChange[] = [];
		if (mode === 'visual' || mode === 'both') {
			const duplicate = after.edges.some(edge => edge.fromNode === sourceId && edge.toNode === targetId);
			if (!duplicate) {
				const used = new Set(after.edges.map(edge => edge.id));
				let id = crypto.randomUUID();
				while (used.has(id)) id = crypto.randomUUID();
				after.edges.push({ id, fromNode: sourceId, toNode: targetId, fromSide: 'right', toSide: 'left', toEnd: 'arrow', ...(label?.trim() ? { label: label.trim() } : {}) });
			}
		}
		if (mode === 'semantic' || mode === 'both') {
			if (!source.file || !targetNode.file || !source.file.toLowerCase().endsWith('.md') || !targetNode.file.toLowerCase().endsWith('.md')) {
				throw new Error('Semantic Markdown linking requires Markdown file nodes. Use Visual only for non-Markdown elements.');
			}
			changes.push(...await this.planSemanticMarkdownLink(source.file, targetNode.file));
		}
		if (JSON.stringify(data) !== JSON.stringify(after)) changes.unshift(this.planner.canvasChange(adapter.getPath() ?? '', data, after));
		if (!changes.length) throw new Error('The requested relationship already exists.');
		const targetName = targetNode.file ?? targetNode.label ?? targetNode.text?.split(/\n/)[0] ?? targetNode.url ?? targetNode.id;
		return this.planner.create('link-nodes', `Link ${source.file ?? source.id} → ${targetName}`, changes);
	}

	async planLinkNodes(adapter: CanvasAdapter, sourceId: string, targetId: string, mode: RelationshipLinkMode, label?: string): Promise<OperationPlan> {
		const data = adapter.getData();
		const source = data.nodes.find(node => node.id === sourceId);
		const target = data.nodes.find(node => node.id === targetId);
		if (!source || !target) throw new Error('Both source and target nodes must exist.');
		if (sourceId === targetId) throw new Error('A node cannot be linked to itself.');
		const changes: PlannedChange[] = [];
		const after = structuredClone(data) as CanvasDataModel;
		if (mode === 'visual' || mode === 'both') {
			const duplicate = after.edges.some(edge => edge.fromNode === sourceId && edge.toNode === targetId);
			if (!duplicate) {
				const used = new Set(after.edges.map(edge => edge.id));
				let id = crypto.randomUUID();
				while (used.has(id)) id = crypto.randomUUID();
				after.edges.push({ id, fromNode: sourceId, toNode: targetId, fromSide: 'right', toSide: 'left', toEnd: 'arrow', ...(label?.trim() ? { label: label.trim() } : {}) });
			}
		}
		if (mode === 'semantic' || mode === 'both') {
			if (!source.file || !target.file || !source.file.toLowerCase().endsWith('.md') || !target.file.toLowerCase().endsWith('.md')) {
				throw new Error('Semantic Markdown linking currently requires file nodes that point to Markdown notes.');
			}
			const changesMarkdown = await this.planSemanticMarkdownLink(source.file, target.file);
			changes.push(...changesMarkdown);
		}
		if ((mode === 'visual' || mode === 'both') && JSON.stringify(data) !== JSON.stringify(after)) {
			changes.unshift(this.planner.canvasChange(adapter.getPath() ?? '', data, after));
		}
		if (!changes.length) throw new Error('The requested relationship already exists.');
		return this.planner.create('link-nodes', `Link ${source.file ?? source.id} → ${target.file ?? target.id}`, changes);
	}

	async planUnlinkNodes(adapter: CanvasAdapter, sourceId: string, targetId: string, removeMarkdown: boolean): Promise<OperationPlan> {
		const data = adapter.getData();
		const source = data.nodes.find(node => node.id === sourceId);
		const target = data.nodes.find(node => node.id === targetId);
		if (!source || !target) throw new Error('Both source and target nodes must exist.');
		const after = structuredClone(data) as CanvasDataModel;
		const remaining = after.edges.filter(edge => !(edge.fromNode === sourceId && edge.toNode === targetId));
		if (remaining.length === after.edges.length && !removeMarkdown) throw new Error('No Canvas relationship exists between these nodes.');
		after.edges = remaining;
		const changes: (ReturnType<OperationPlanner['canvasChange']> | MarkdownChange)[] = [];
		if (remaining.length !== data.edges.length) changes.push(this.planner.canvasChange(adapter.getPath() ?? '', data, after));
		if (removeMarkdown && source.file && target.file && source.file.toLowerCase().endsWith('.md') && target.file.toLowerCase().endsWith('.md')) {
			changes.push(...await this.planRemoveSemanticMarkdownLink(source.file, target.file));
		}
		if (!changes.length) throw new Error('No matching relationship found.');
		return this.planner.create('unlink-nodes', `Unlink ${source.file ?? source.id} → ${target.file ?? target.id}`, changes, removeMarkdown ? ['Markdown relationship removal is included; review the exact text diff before committing.'] : []);
	}

	private async planSemanticMarkdownLink(sourcePath: string, targetPath: string): Promise<MarkdownChange[]> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error(`Markdown file not found: ${sourcePath}`);
		const before = await this.app.vault.cachedRead(file);
		const dest = targetPath.replace(/\.md$/i, '');
		const token = `[[${dest}]]`;
		if (before.includes(token) || before.includes(`[[${dest}|`)) return [];
		const after = `${before}${before && !before.endsWith('\n') ? '\n' : ''}${token}\n`;
		return [this.planner.markdownChange({ path: sourcePath, before, after })];
	}

	private async planRemoveSemanticMarkdownLink(sourcePath: string, targetPath: string): Promise<MarkdownChange[]> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error(`Markdown file not found: ${sourcePath}`);
		const before = await this.app.vault.cachedRead(file);
		const escaped = targetPath.replace(/\.md$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const tokenLine = new RegExp(`^\\s*(!?\\[\\[${escaped}(?:\\|[^\\]]+)?\\]\\])\\s*$`, 'gmi');
		const after = before.replace(tokenLine, '');
		if (after === before) return [];
		return [this.planner.markdownChange({ path: sourcePath, before, after })];
	}

}
