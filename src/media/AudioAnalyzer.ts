import type { App, TFile } from 'obsidian';

export interface WaveformData {
	filePath: string;
	mtime: number;
	points: number[];
	duration: number;
	rms?: number[];
	pitchHz?: number[];
}

export class AudioAnalyzer {
	private readonly cache = new Map<string, WaveformData>();
	constructor(private readonly app: App) {}

	async analyze(file: TFile, points = 180): Promise<WaveformData> {
		points = Math.min(1200, Math.max(24, Math.floor(points)));
		const cached = this.cache.get(file.path);
		if (cached?.mtime === file.stat.mtime) return cached;
		const buffer = await this.app.vault.readBinary(file);
		const AudioContextCtor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextCtor) throw new Error('Web Audio is unavailable in this environment.');
		const context = new AudioContextCtor();
		try {
			const decoded = await context.decodeAudioData(buffer.slice(0));
			const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
			const length = Math.min(decoded.length, decoded.sampleRate * 900);
			const bucket = Math.max(1, Math.floor(length / points));
			const waveform: number[] = [];
			const rms: number[] = [];
			for (let i = 0; i < points; i++) {
				const start = i * bucket;
				const end = Math.min(length, start + bucket);
				let peak = 0; let energy = 0; let count = 0;
				for (let s = start; s < end; s += Math.max(1, Math.floor(bucket / 80))) {
					let sample = 0;
					for (const channel of channels) sample += channel[s] ?? 0;
					sample /= Math.max(1, channels.length);
					peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; count++;
				}
				waveform.push(Math.min(1, peak));
				rms.push(Math.sqrt(energy / Math.max(1, count)));
			}
			const result: WaveformData = { filePath: file.path, mtime: file.stat.mtime, points: waveform, rms, duration: decoded.duration };
			this.cache.set(file.path, result);
			return result;
		} finally { await context.close(); }
	}
	clear(filePath?: string): void { if (filePath) this.cache.delete(filePath); else this.cache.clear(); }
}
