import { PluginSettingTab, Setting, normalizePath, type App, type ButtonComponent, type DropdownComponent, type SliderComponent, type ToggleComponent } from 'obsidian';
import type { CanvasToolkitSettings } from './types';
import type CanvasToolkitPlugin from './main';
import { FolderPickerModal } from './ui/FolderPickerModal';

export class CanvasToolkitSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly pluginRef: CanvasToolkitPlugin) {
		super(app, pluginRef);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Canvas Toolkit' });

		new Setting(containerEl)
			.setName('Media folders')
			.setDesc('Only media inside these folders is shown by the preview picker. Empty means the entire vault.')
			.addButton((button: ButtonComponent) => button.setButtonText('Add folder').setCta().onClick(() => {
				new FolderPickerModal(this.app, async (folder) => {
					if (!this.pluginRef.settings.mediaRoots.includes(folder.path)) {
						this.pluginRef.settings.mediaRoots.push(folder.path);
						await this.pluginRef.saveSettings();
						this.display();
					}
				}).open();
			}));

		for (const root of this.pluginRef.settings.mediaRoots) {
			new Setting(containerEl)
				.setName(root || '/')
				.addButton((button: ButtonComponent) => button.setButtonText('Remove').onClick(async () => {
					this.pluginRef.settings.mediaRoots = this.pluginRef.settings.mediaRoots.filter((item) => item !== root);
					await this.pluginRef.saveSettings();
					this.display();
				}));
		}

		new Setting(containerEl)
			.setName('Default media filter')
			.setDesc('What the picker shows by default.')
			.addDropdown((dropdown: DropdownComponent) => dropdown
				.addOptions({ image: 'Images', pdf: 'PDF', both: 'Images + PDF', audio: 'Audio', all: 'All media' })
				.setValue(this.pluginRef.settings.defaultMediaKind)
				.onChange(async (value: string) => {
					this.pluginRef.settings.defaultMediaKind = value as CanvasToolkitSettings['defaultMediaKind'];
					await this.pluginRef.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Media grid')
			.addDropdown((dropdown: DropdownComponent) => dropdown
				.addOptions({ '2': '2 columns', '3': '3 columns' })
				.setValue(String(this.pluginRef.settings.mediaGridColumns))
				.onChange(async (value: string) => {
					this.pluginRef.settings.mediaGridColumns = value === '2' ? 2 : 3;
					await this.pluginRef.saveSettings();
				}));

		new Setting(containerEl)
			.setName('PDF previews')
			.setDesc('Show PDF previews in the picker when possible.')
			.addToggle((toggle: ToggleComponent) => toggle.setValue(this.pluginRef.settings.previewPdf).onChange(async (value: boolean) => {
				this.pluginRef.settings.previewPdf = value;
				await this.pluginRef.saveSettings();
			}));

		new Setting(containerEl)
			.setName('Layout spacing')
			.setDesc('Default gap used by Canvas Toolkit layouts.')
			.addSlider((slider: SliderComponent) => slider.setLimits(20, 240, 10).setValue(this.pluginRef.settings.layoutGap).setDynamicTooltip().onChange(async (value: number) => {
				this.pluginRef.settings.layoutGap = value;
				await this.pluginRef.saveSettings();
			}));

		new Setting(containerEl)
			.setName('Audio seek interval')
			.setDesc('Seconds used by the audio player back/forward controls.')
			.addSlider((slider: SliderComponent) => slider.setLimits(5, 30, 5).setValue(this.pluginRef.settings.audioSeekSeconds).setDynamicTooltip().onChange(async (value: number) => {
				this.pluginRef.settings.audioSeekSeconds = value;
				await this.pluginRef.saveSettings();
			}));

		new Setting(containerEl)
			.setName('Relationship synchronization')
			.setDesc('Controls automatic Canvas ↔ Markdown reconciliation. Apply mode changes only relationships that can be safely inferred.')
			.addDropdown((dropdown: DropdownComponent) => dropdown
				.addOptions({ off: 'Off', suggest: 'Suggest changes', apply: 'Apply safe changes' })
				.setValue(this.pluginRef.settings.syncMode)
				.onChange(async (value: string) => { this.pluginRef.settings.syncMode = value as CanvasToolkitSettings['syncMode']; await this.pluginRef.saveSettings(); }));

		new Setting(containerEl)
			.setName('Undo history')
			.setDesc('Maximum undoable Canvas Toolkit transactions kept in memory.')
			.addSlider((slider: SliderComponent) => slider.setLimits(5, 200, 5).setValue(this.pluginRef.settings.journalLimit).setDynamicTooltip().onChange(async (value: number) => { this.pluginRef.settings.journalLimit = value; await this.pluginRef.saveSettings(); }));

		new Setting(containerEl)
			.setName('Default connection mode')
			.setDesc('Initial mode used by the universal Canvas connection tool.')
			.addDropdown((dropdown: DropdownComponent) => dropdown
				.addOptions({ visual: 'Visual only', semantic: 'Semantic Markdown link', both: 'Visual + semantic' })
				.setValue(this.pluginRef.settings.defaultLinkMode)
				.onChange(async (value: string) => { this.pluginRef.settings.defaultLinkMode = value as CanvasToolkitSettings['defaultLinkMode']; await this.pluginRef.saveSettings(); }));

		new Setting(containerEl)
			.setName('Canvas insights')
			.setDesc('Keep graph diagnostics available from the Canvas command palette.')
			.addToggle((toggle: ToggleComponent) => toggle.setValue(this.pluginRef.settings.showGraphInsightsOnOpen).onChange(async (value: boolean) => { this.pluginRef.settings.showGraphInsightsOnOpen = value; await this.pluginRef.saveSettings(); }));

		new Setting(containerEl)
			.setName('Magnet snapping')
			.setDesc('Snap selected Canvas nodes to the configured grid and nearby alignments.')
			.addToggle((toggle: ToggleComponent) => toggle.setValue(this.pluginRef.settings.snapEnabled).onChange(async (value: boolean) => {
				this.pluginRef.settings.snapEnabled = value;
				await this.pluginRef.saveSettings();
			}));
	}
}


