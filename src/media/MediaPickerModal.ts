import { Modal, Notice, setIcon, TFile, type App, type MarkdownView } from 'obsidian';
import type { CanvasToolkitSettings, MediaItem } from '../types';
import { MediaScanner } from './MediaScanner';

interface MediaPickerOptions {
	settings: CanvasToolkitSettings;
	context: 'markdown' | 'canvas';
	onInsert: (items: MediaItem[]) => Promise<void>;
}

function humanSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export class MediaPickerModal extends Modal {
	private readonly selected = new Set<string>();
	private items: MediaItem[] = [];
	private query = '';
	private filter: 'image' | 'pdf' | 'audio' | 'all' = 'all';
	private gridColumns: 2 | 3;

	private readonly hostApp: App;

	constructor(app: App, private readonly options: MediaPickerOptions) {
		super(app);
		this.hostApp = app;
		this.gridColumns = options.settings.mediaGridColumns;
		this.filter = options.settings.defaultMediaKind === 'image' || options.settings.defaultMediaKind === 'pdf' || options.settings.defaultMediaKind === 'audio' ? options.settings.defaultMediaKind : 'all';
	}

	onOpen(): void {
		this.modalEl.addClass('ctk-modal');
		this.titleEl.setText('Insert media');
		this.items = new MediaScanner(this.hostApp).scan(this.options.settings);
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		this.contentEl.empty();
		const toolbar = this.contentEl.createDiv({ cls: 'ctk-toolbar' });
		const left = toolbar.createDiv({ cls: 'ctk-toolbar-group ctk-field' });
		const search = left.createEl('input', { attr: { type: 'search', placeholder: 'Search media…' } });
		search.value = this.query;
		search.addEventListener('input', () => {
			this.query = search.value.trim().toLowerCase();
			this.renderGrid();
		});
		const controls = toolbar.createDiv({ cls: 'ctk-toolbar-group' });
		const filter = controls.createEl('select');
		filter.createEl('option', { value: 'all', text: 'All media' });
		filter.createEl('option', { value: 'image', text: 'Images' });
		filter.createEl('option', { value: 'pdf', text: 'PDF' });
		filter.createEl('option', { value: 'audio', text: 'Audio' });
		filter.value = this.filter;
		filter.addEventListener('change', () => { this.filter = filter.value as typeof this.filter; this.renderGrid(); });
		const grid2 = controls.createEl('button', { text: '2×2' });
		const grid3 = controls.createEl('button', { text: '3×3' });
		grid2.toggleClass('mod-cta', this.gridColumns === 2);
		grid3.toggleClass('mod-cta', this.gridColumns === 3);
		grid2.addEventListener('click', () => { this.gridColumns = 2; this.render(); });
		grid3.addEventListener('click', () => { this.gridColumns = 3; this.render(); });
		const insert = controls.createEl('button', { text: `Insert${this.selected.size ? ` (${this.selected.size})` : ''}` });
		insert.addEventListener('click', () => { void this.insertSelected(); });
		this.renderGrid();
	}

	private async insertSelected(): Promise<void> {
		const selected = this.items.filter((item) => this.selected.has(item.path));
		if (!selected.length) {
			new Notice('Select at least one item.');
			return;
		}
		await this.options.onInsert(selected);
		this.close();
	}

	private renderGrid(): void {
		const previous = this.contentEl.querySelector('.ctk-media-grid');
		previous?.remove();
		const emptyPrevious = this.contentEl.querySelector('.ctk-empty');
		emptyPrevious?.remove();
		const results = this.items.filter((item) => (this.filter === 'all' || item.kind === this.filter) && (item.name.toLowerCase().includes(this.query) || item.path.toLowerCase().includes(this.query)));
		if (!results.length) {
			this.contentEl.createDiv({ cls: 'ctk-empty', text: 'No media found in the configured folders.' });
			return;
		}
		const grid = this.contentEl.createDiv({ cls: `ctk-media-grid ctk-grid-${this.gridColumns}` });
		for (const item of results) this.renderCard(grid, item);
	}

	private renderCard(grid: HTMLElement, item: MediaItem): void {
		const card = grid.createDiv({ cls: 'ctk-media-card' });
		card.toggleClass('is-selected', this.selected.has(item.path));
		const preview = card.createDiv({ cls: 'ctk-media-preview' });
		if (item.kind === 'image') {
			const img = preview.createEl('img', { attr: { alt: item.name, loading: 'lazy' } });
			const file = this.hostApp.vault.getAbstractFileByPath(item.path);
			if (file instanceof TFile) {
				img.src = this.hostApp.vault.getResourcePath(file);
				img.addEventListener('load', () => {
					item.width = img.naturalWidth;
					item.height = img.naturalHeight;
					const resolution = meta.querySelector('.ctk-resolution');
					if (resolution) resolution.textContent = `${item.width}×${item.height} · ${humanSize(item.size)}`;
				});
			}
		} else if (item.kind === 'audio') {
			const audio = preview.createEl('audio', { attr: { controls: 'true' } });
			const file = this.hostApp.vault.getAbstractFileByPath(item.path);
			if (file instanceof TFile) {
				audio.src = this.hostApp.vault.getResourcePath(file);
				audio.addEventListener('click', event => event.stopPropagation());
			}
		} else if (this.options.settings.previewPdf) {
			const frame = preview.createEl('iframe', { attr: { title: item.name } });
			const file = this.hostApp.vault.getAbstractFileByPath(item.path);
			if (file instanceof TFile) frame.src = this.hostApp.vault.getResourcePath(file);
		} else {
			const icon = preview.createDiv({ cls: 'ctk-media-icon' });
			setIcon(icon, 'file-text');
		}
		const meta = card.createDiv({ cls: 'ctk-media-meta' });
		meta.createDiv({ cls: 'ctk-media-name', text: item.name });
		const sub = meta.createDiv({ cls: 'ctk-media-sub' });
		sub.createSpan({ text: item.kind.toUpperCase() });
		const details = sub.createSpan({ cls: 'ctk-resolution' });
		details.setText(item.width && item.height ? `${item.width}×${item.height} · ${humanSize(item.size)}` : humanSize(item.size));
		card.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
		});
		card.tabIndex = 0;
		card.setAttribute('role', 'button');
		card.setAttribute('aria-pressed', String(this.selected.has(item.path)));
		card.addEventListener('click', () => {
			if (this.selected.has(item.path)) this.selected.delete(item.path);
			else this.selected.add(item.path);
			this.render();
		});
	}
}

export async function insertIntoMarkdown(
	view: MarkdownView,
	items: MediaItem[],
): Promise<void> {
	const editor = view.editor;
	const lines = items.map((item) => `![[${item.path}]]`);
	editor.replaceSelection(lines.join('\n'));
}
