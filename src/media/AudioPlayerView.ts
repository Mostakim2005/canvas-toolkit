import { Modal, Notice, setIcon, type App, type TFile } from 'obsidian';
import { AudioAnalyzer, type WaveformData } from './AudioAnalyzer';
import type { CanvasToolkitSettings } from '../types';

export class AudioPlayerModal extends Modal {
	private readonly analyzer: AudioAnalyzer;
	private audio?: HTMLAudioElement;
	private waveformEl?: HTMLElement;
	private progressEl?: HTMLInputElement;
	private metaEl?: HTMLElement;
	private data?: WaveformData;
	private timer?: number;

	constructor(app: App, private readonly file: TFile, private readonly settings?: CanvasToolkitSettings) {
		super(app);
		this.analyzer = new AudioAnalyzer(app);
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass('ctk-modal', 'ctk-audio-modal');
		this.titleEl.setText(this.file.name);
		const root = this.contentEl;
		root.empty();
		const audio = this.audio = document.createElement('audio');
		audio.controls = false;
		audio.src = this.app.vault.getResourcePath(this.file);
		root.appendChild(audio);
		const graph = this.waveformEl = root.createDiv({ cls: 'ctk-audio-waveform' });
		const meta = this.metaEl = root.createDiv({ cls: 'ctk-audio-meta' });
		meta.setText('Preparing waveform…');
		graph.addEventListener('click', (event: MouseEvent) => {
			if (!this.audio || !this.data) return;
			const rect = graph.getBoundingClientRect();
			this.audio.currentTime = ((event.clientX - rect.left) / Math.max(1, rect.width)) * this.audio.duration;
			this.renderProgress();
		});
		this.renderControls(root);
		try {
			this.data = await this.analyzer.analyze(this.file);
			this.renderWaveform();
		} catch (error) {
			meta.setText(error instanceof Error ? error.message : 'Unable to analyze audio.');
		}
		this.timer = window.setInterval(() => this.renderProgress(), 100);
	}

	onClose(): void {
		if (this.timer !== undefined) window.clearInterval(this.timer);
		this.audio?.pause();
		this.audio?.removeAttribute('src');
		this.audio?.load();
		this.contentEl.empty();
	}

	private renderControls(root: HTMLElement): void {
		const controls = root.createDiv({ cls: 'ctk-audio-controls' });
		const back = controls.createEl('button', { attr: { 'aria-label': 'Seek back 10 seconds' } }); setIcon(back, 'rotate-ccw');
		back.addEventListener('click', () => this.seek(-(this.settings?.audioSeekSeconds ?? 10)));
		const play = controls.createEl('button', { attr: { 'aria-label': 'Play or pause' } }); setIcon(play, 'play');
		play.addEventListener('click', () => { if (!this.audio) return; if (this.audio.paused) void this.audio.play(); else this.audio.pause(); play.empty(); setIcon(play, this.audio.paused ? 'play' : 'pause'); });
		const forward = controls.createEl('button', { attr: { 'aria-label': 'Seek forward 10 seconds' } }); setIcon(forward, 'rotate-cw');
		forward.addEventListener('click', () => this.seek(this.settings?.audioSeekSeconds ?? 10));
		const range = this.progressEl = controls.createEl('input', { type: 'range', min: '0', max: '1', step: '0.001' }) as HTMLInputElement;
		range.value = '0';
		range.addEventListener('input', () => { if (this.audio) this.audio.currentTime = Number(range.value) * this.audio.duration; });
		controls.createSpan({ cls: 'ctk-audio-time', text: '0:00 / 0:00' });
	}

	private seek(amount: number): void { if (this.audio) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || Infinity, this.audio.currentTime + amount)); this.renderProgress(); }

	private renderProgress(): void {
		if (!this.audio || !this.progressEl) return;
		this.progressEl.value = this.audio.duration ? String(this.audio.currentTime / this.audio.duration) : '0';
		const time = this.progressEl.parentElement?.querySelector('.ctk-audio-time');
		if (time) time.textContent = `${formatTime(this.audio.currentTime)} / ${formatTime(this.audio.duration)}`;
	}

	private renderWaveform(): void {
		if (!this.waveformEl || !this.data) return;
		this.waveformEl.empty();
		for (const value of this.data.points) {
			const bar = this.waveformEl.createDiv({ cls: 'ctk-audio-bar' });
			bar.style.setProperty('--ctk-audio-level', String(Math.max(0.04, value)));
		}
		if (this.metaEl) this.metaEl.setText(`${formatTime(this.data.duration)} · waveform · click to seek`);
	}
}

export function openAudioPlayer(app: App, file: TFile, settings?: CanvasToolkitSettings): void {
	if (!file.extension.match(/^(mp3|wav|ogg|m4a|aac|flac|webm)$/i)) { new Notice('Unsupported audio file.'); return; }
	new AudioPlayerModal(app, file, settings).open();
}

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return '0:00';
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
