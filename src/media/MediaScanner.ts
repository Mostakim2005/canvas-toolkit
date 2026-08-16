import { normalizePath, type App, type TFile } from 'obsidian';
import type { CanvasToolkitSettings, MediaItem } from '../types';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']);
const PDF_EXTENSIONS = new Set(['pdf']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm']);

function isUnderRoot(path: string, root: string): boolean {
	if (!root) return true;
	const normalized = root.replace(/^\/|\/$/g, '');
	return path === normalized || path.startsWith(`${normalized}/`);
}

function fileKind(file: TFile): MediaItem['kind'] | null {
	const ext = file.extension.toLowerCase();
	if (IMAGE_EXTENSIONS.has(ext)) return 'image';
	if (PDF_EXTENSIONS.has(ext)) return 'pdf';
	if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
	return null;
}

export class MediaScanner {
	constructor(private readonly app: App) {}

	scan(settings: CanvasToolkitSettings): MediaItem[] {
		const roots = settings.mediaRoots.length
			? [...new Set(settings.mediaRoots.map(root => normalizePath(root.trim()).replace(/^\/+|\/+$/g, '')))].filter(Boolean)
			: [''];
		return this.app.vault.getFiles()
			.filter((file: TFile) => roots.some(root => isUnderRoot(file.path, root)))
			.map((file: TFile) => {
				const mediaKind = fileKind(file);
				if (!mediaKind) return null;
				return { path: file.path, name: file.name, kind: mediaKind, size: file.stat.size, modified: file.stat.mtime };
			})
			.filter((item: MediaItem | null): item is MediaItem => item !== null)
			.sort((a: MediaItem, b: MediaItem) => a.name.localeCompare(b.name));
	}
}
