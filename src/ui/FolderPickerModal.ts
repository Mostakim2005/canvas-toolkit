import { FuzzySuggestModal, TFolder, type App } from 'obsidian';

export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	constructor(app: App, private readonly onSelectFolder: (folder: TFolder) => void) {
		super(app);
		this.setPlaceholder('Choose a media folder…');
	}

	getItems(): TFolder[] {
		return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder);
	}

	getItemText(item: TFolder): string {
		return item.path || '/';
	}

	onChooseItem(item: TFolder): void {
		this.onSelectFolder(item);
	}
}
