import { Modal, Notice, type App } from 'obsidian';
import CanvasToolkitPlugin from './main';
import { graphStats } from './phase5';
import { OperationPreviewModal } from './operations/OperationPreviewModal';
import { OperationPlanner } from './operations/OperationPlanner';
import type { CanvasDataModel } from './types';

interface Insight { tone: 'good' | 'warn' | 'info'; title: string; detail: string; }

export class GraphInsightsModal extends Modal {
	constructor(app: App, private readonly plugin: CanvasToolkitPlugin) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('ctk-modal', 'ctk-insights-modal');
		this.titleEl.setText('Canvas insights');
		this.render();
	}
	onClose(): void { this.contentEl.empty(); }

	private render(): void {
		this.contentEl.empty();
		const adapter = this.plugin.currentCanvas();
		if (!adapter) { this.contentEl.createDiv({ cls: 'ctk-empty', text: 'Open a Canvas to analyze it.' }); return; }
		const data = adapter.getData();
		const stats = graphStats(data);
		const insights = analyzeGraph(data);

		const hero = this.contentEl.createDiv({ cls: 'ctk-insights-hero' });
		hero.createDiv({ cls: 'ctk-insights-score', text: `${healthScore(data, insights)}` });
		hero.createDiv().createDiv({ cls: 'ctk-insights-kicker', text: 'CANVAS HEALTH' });
		hero.lastChild?.createDiv?.({ cls: 'ctk-insights-heading', text: `${stats.nodes} nodes · ${stats.edges} edges` });

		const metrics = this.contentEl.createDiv({ cls: 'ctk-insights-metrics' });
		for (const [label, value] of [
			['Components', String(stats.components)],
			['Average degree', stats.averageDegree.toFixed(1)],
			['Max degree', String(stats.maxDegree)],
			['Density', `${(stats.density * 100).toFixed(1)}%`],
		]) {
			const metric = metrics.createDiv({ cls: 'ctk-insight-metric' });
			metric.createDiv({ cls: 'ctk-insight-metric-value', text: value });
			metric.createDiv({ cls: 'ctk-insight-metric-label', text: label });
		}

		const list = this.contentEl.createDiv({ cls: 'ctk-insights-list' });
		for (const insight of insights) {
			const row = list.createDiv({ cls: `ctk-insight-row is-${insight.tone}` });
			row.createDiv({ cls: 'ctk-insight-title', text: insight.title });
			row.createDiv({ cls: 'ctk-insight-detail', text: insight.detail });
		}

		const actions = this.contentEl.createDiv({ cls: 'ctk-modal-actions' });
		const reconcile = actions.createEl('button', { text: 'Preview relationship cleanup' });
		reconcile.addEventListener('click', () => void this.previewCleanup(adapter, insights));
		const close = actions.createEl('button', { text: 'Close' });
		close.addEventListener('click', () => this.close());
	}

	private async previewCleanup(adapter: ReturnType<CanvasToolkitPlugin['currentCanvas']>, insights: Insight[]): Promise<void> {
		if (!adapter) return;
		const data = adapter.getData();
		const duplicatePairs = duplicatePairsForCleanup(data);
		if (!duplicatePairs.size) { new Notice('No safe duplicate-edge cleanup is available.'); return; }
		const after = structuredClone(data);
		const seen = new Set<string>();
		after.edges = after.edges.filter(edge => {
			const key = `${edge.fromNode}\u0000${edge.toNode}`;
			if (!duplicatePairs.has(key)) return true;
			if (seen.has(key)) return false;
			seen.add(key); return true;
		});
		const planner = new OperationPlanner();
		const plan = planner.create('graph-cleanup', `Remove ${data.edges.length - after.edges.length} duplicate Canvas edge${data.edges.length - after.edges.length === 1 ? '' : 's'}`, [planner.canvasChange(adapter.getPath() ?? '', data, after)]);
		new OperationPreviewModal(this.app, plan, this.plugin.transactionEngine, adapter).open();
		void insights;
	}
}

function analyzeGraph(data: CanvasDataModel): Insight[] {
	const result: Insight[] = [];
	const degree = new Map<string, number>();
	for (const node of data.nodes) degree.set(node.id, 0);
	for (const edge of data.edges) {
		if (degree.has(edge.fromNode)) degree.set(edge.fromNode, (degree.get(edge.fromNode) ?? 0) + 1);
		if (degree.has(edge.toNode)) degree.set(edge.toNode, (degree.get(edge.toNode) ?? 0) + 1);
	}
	const duplicates = [...duplicatePairsForCleanup(data)].length;
	if (duplicates) result.push({ tone: 'warn', title: 'Duplicate connections', detail: `${duplicates} node pair${duplicates === 1 ? '' : 's'} contain repeated Canvas edges.` });
	const orphanEdges = data.edges.filter(edge => !degree.has(edge.fromNode) || !degree.has(edge.toNode)).length;
	if (orphanEdges) result.push({ tone: 'warn', title: 'Broken Canvas edges', detail: `${orphanEdges} edge${orphanEdges === 1 ? '' : 's'} point to missing nodes.` });
	const isolated = [...degree.values()].filter(value => value === 0).length;
	if (isolated) result.push({ tone: 'info', title: 'Isolated nodes', detail: `${isolated} node${isolated === 1 ? '' : 's'} are not connected to anything.` });
	const hubs = [...degree.entries()].sort((a, b) => b[1] - a[1]).filter(([, value]) => value >= 6).slice(0, 5);
	if (hubs.length) result.push({ tone: 'info', title: 'High-degree hubs', detail: `${hubs.length} node${hubs.length === 1 ? '' : 's'} have six or more connections and may benefit from local layout.` });
	if (!duplicates && !orphanEdges && !isolated) result.push({ tone: 'good', title: 'Graph is structurally clean', detail: 'No duplicate edges, dangling edge references, or isolated nodes were detected.' });
	return result;
}

function duplicatePairsForCleanup(data: CanvasDataModel): Set<string> {
	const counts = new Map<string, number>();
	for (const edge of data.edges) { const key = `${edge.fromNode}\u0000${edge.toNode}`; counts.set(key, (counts.get(key) ?? 0) + 1); }
	return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function healthScore(data: CanvasDataModel, insights: Insight[]): number {
	let score = 100;
	for (const insight of insights) {
		if (insight.tone === 'warn') score -= 12;
		if (insight.title === 'Isolated nodes') score -= 6;
	}
	if (data.nodes.length === 0) score = 100;
	return Math.max(0, Math.min(100, score));
}

export function registerPhase7Commands(plugin: CanvasToolkitPlugin): void {
	plugin.addCommand({
		id: 'canvas-insights', name: 'Canvas: analyze and recommend',
		checkCallback: (checking: boolean) => {
			if (!plugin.currentCanvas()) return false;
			if (!checking) new GraphInsightsModal(plugin.app, plugin).open();
			return true;
		},
	});
}
