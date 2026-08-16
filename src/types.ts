export type CanvasNodeType = 'file' | 'text' | 'link' | 'group' | 'unknown';
export type CanvasSide = 'top' | 'bottom' | 'left' | 'right';
export type RelationshipKind = 'markdown-link' | 'canvas-edge' | 'manual' | 'embed' | 'external';
export type SyncMode = 'off' | 'suggest' | 'apply';
export type LayoutKind = 'grid' | 'hierarchical' | 'radial' | 'mind-map' | 'compact';

export interface CanvasNodeModel {
	id: string;
	type: CanvasNodeType;
	x: number;
	y: number;
	width: number;
	height: number;
	file?: string;
	text?: string;
	url?: string;
	label?: string;
	/** Unknown/preserved JSON Canvas fields. Never discard these when rewriting a canvas. */
	extra?: Record<string, unknown>;
}

export interface CanvasEdgeModel {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide: CanvasSide;
	toSide: CanvasSide;
	label?: string;
	fromEnd?: string;
	toEnd?: string;
	/** Unknown/preserved JSON Canvas edge fields. */
	extra?: Record<string, unknown>;
}

export interface CanvasDataModel {
	nodes: CanvasNodeModel[];
	edges: CanvasEdgeModel[];
}

export interface RelationshipModel {
	id: string;
	sourceId: string;
	targetId: string;
	kind: RelationshipKind;
	directed: boolean;
	semantic: boolean;
	sourcePath?: string;
	targetPath?: string;
	subpath?: string;
}

export interface RelationshipCandidate {
	key: string;
	sourceNodeId: string;
	targetNodeId: string;
	sourcePath?: string;
	targetPath?: string;
	direction: 'outgoing' | 'incoming';
	reason: 'markdown-missing-canvas' | 'canvas-missing-markdown' | 'broken-markdown' | 'duplicate-canvas';
}

export interface ReconciliationResult {
	missingCanvasEdges: RelationshipCandidate[];
	missingMarkdownLinks: RelationshipCandidate[];
	brokenMarkdownLinks: RelationshipCandidate[];
	duplicateCanvasEdges: string[];
	conflicts: RelationshipConflict[];
}

export interface RelationshipConflict {
	type: 'direction' | 'target' | 'duplicate' | 'broken';
	message: string;
	key: string;
	sourcePath?: string;
	targetPath?: string;
}

export interface CanvasSnapshot {
	path: string;
	data: CanvasDataModel;
}

export interface MarkdownSnapshot {
	path: string;
	content: string;
	mtime: number;
	size: number;
}

export type RelationshipLinkMode = 'visual' | 'semantic' | 'both';

export type OperationType =
	| 'create-nodes'
	| 'delete-nodes'
	| 'move-nodes'
	| 'create-edges'
	| 'delete-edges'
	| 'modify-edges'
	| 'modify-markdown'
	| 'insert-media'
	| 'expand-graph'
	| 'synchronize-relationships'
	| 'layout-preset'
	| 'import-settings'
	| 'link-nodes'
	| 'unlink-nodes'
	| 'graph-cleanup';

export interface CanvasChange {
	type: 'replace-canvas';
	path: string;
	before: CanvasDataModel;
	after: CanvasDataModel;
}

export interface MarkdownChange {
	type: 'modify-markdown';
	path: string;
	before: string;
	after: string;
}

export type PlannedChange = CanvasChange | MarkdownChange;

export interface OperationPlan {
	id: string;
	createdAt: number;
	type: OperationType;
	description: string;
	changes: PlannedChange[];
	warnings: string[];
	reversible: boolean;
}

export type TransactionStatus = 'planned' | 'committing' | 'committed' | 'rolled-back' | 'failed';

export interface TransactionRecord {
	id: string;
	createdAt: number;
	committedAt?: number;
	status: TransactionStatus;
	plan: OperationPlan;
}

export interface OperationRecord {
	id: string;
	timestamp: number;
	type: OperationType;
	canvasPath?: string;
	description: string;
}

export interface MediaItem {
	path: string;
	name: string;
	kind: 'image' | 'pdf' | 'audio';
	size: number;
	modified: number;
	width?: number;
	height?: number;
}

export interface LayoutPreset {
	name: string;
	kind: LayoutKind;
	gapX: number;
	gapY: number;
}

export interface CanvasRule {
	canvasPath: string;
	syncMode: SyncMode;
	autoOptimizeConnections: boolean;
	snapEnabled: boolean;
	snapGridSize: number;
	defaultLayout?: LayoutKind;
}

export interface CanvasToolkitSettings {
	mediaRoots: string[];
	mediaGridColumns: 2 | 3;
	previewPdf: boolean;
	defaultMediaKind: 'image' | 'pdf' | 'both' | 'audio' | 'all';
	audioWaveformPoints: number;
	audioSeekSeconds: number;
	autoOptimizeConnections: boolean;
	layoutGap: number;
	showMediaMetadata: boolean;
	keepSelectionAfterInsert: boolean;
	snapEnabled: boolean;
	snapGridSize: number;
	syncMode: SyncMode;
	journalLimit: number;
	layoutPresets: LayoutPreset[];
	canvasRules: CanvasRule[];
	showGraphInsightsOnOpen: boolean;
	defaultLinkMode: RelationshipLinkMode;
}

export const DEFAULT_SETTINGS: CanvasToolkitSettings = {
	mediaRoots: [],
	mediaGridColumns: 3,
	previewPdf: true,
	defaultMediaKind: 'all',
	audioWaveformPoints: 180,
	audioSeekSeconds: 10,
	autoOptimizeConnections: false,
	layoutGap: 80,
	showMediaMetadata: true,
	keepSelectionAfterInsert: false,
	snapEnabled: true,
	snapGridSize: 20,
	syncMode: 'off',
	journalLimit: 50,
	layoutPresets: [
		{ name: 'Research map', kind: 'mind-map', gapX: 100, gapY: 80 },
		{ name: 'Flow', kind: 'hierarchical', gapX: 100, gapY: 100 },
		{ name: 'Compact', kind: 'compact', gapX: 40, gapY: 40 },
	],
	canvasRules: [],
	showGraphInsightsOnOpen: false,
	defaultLinkMode: 'visual',
};
