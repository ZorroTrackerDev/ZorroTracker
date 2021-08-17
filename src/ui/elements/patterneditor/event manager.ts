import { Channel } from "../../../api/driver";
import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { PlayMode } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { PatternEditor } from "./main";

export class PatternEditorEventManager {
	public parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;
		manager = this;
	}

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public reloadTheme():void {
		// load the tables for backdrop colors
		this.backdropColors = [
			theme?.pattern?.worker?.params?.backdrop ?? "#000",
			theme?.pattern?.worker?.params?.recordbackdrop ?? "#000",
		];

		// update backdrop color
		if(this.parent.tab) {
			this.changeRecordMode();
		}
	}

	/**
	 * The colors for the backdrop of the scrollWrapper
	 */
	private backdropColors!: [ string, string, ];

	/**
	 * Function to update the record mode of the pattern editor
	 */
	public changeRecordMode(): void {
		const backdrop = this.backdropColors[this.parent.tab.recordMode ? 1 : 0];

		// update backdrop color
		this.parent.scrollwrapper.style.backgroundColor = backdrop;

		// tell the scroll manager about it too
		this.parent.scrollManager.changeRecordMode();

		// update channel headers
		for(let c = this.parent.channelInfo.length;c > 0; --c) {
			(this.parent.scrollwrapper.children[c] as HTMLDivElement).style.borderColor = backdrop;
		}
	}

	/**
	 * Function to update the mute state of a single channel
	 *
	 * @param channel The channel to update state for
	 * @param state The actual state to update to
	 */
	public updateMute(channel:Channel, state:boolean): void {
		// get index of the channel
		for(let i = this.parent.tab.channels.length;i > 0; --i) {
			if(this.parent.tab.channels[i - 1] === channel) {
				// found the channel, update status
				const chan = this.parent.scrollwrapper.children[i] as HTMLDivElement;
				chan.classList[state ? "add" : "remove"]("muted");
				return;
			}
		}
	}
}

/**
 * The manager instance itself
 */
let manager:PatternEditorEventManager|undefined;

// listen to playback position updates
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.PlaybackPosition, async(event, row) => {
	if(manager) {
		if(row < 0) {
			// update the song position
			manager.parent.songRow = -1;
			manager.parent.scrollManager.updateSongScroll();

		} else if(manager.parent.tab.playMode !== PlayMode.Stopped){
			// update the song position
			manager.parent.songRow = row;
			manager.parent.scrollManager.updateSongRowData();

			if(manager.parent.tab.follow) {
				// update current row
				manager.parent.selectionManager.single.pattern = Math.floor(row / manager.parent.patternLen);
				manager.parent.selectionManager.single.row = row % manager.parent.patternLen;

				manager.parent.tab.activeRow = row;

				// redraw all and update scroling
				await manager.parent.scrollManager.verticalScroll(0);

			} else {
				// update song scrolling
				manager.parent.scrollManager.updateSongScroll();
			}
		}
	}
});

// listen to theme reloading
ZorroEvent.addListener(ZorroEventEnum.LoadTheme, async() => {
	await manager?.parent.reloadTheme(false);
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabRecordMode, async() => {
	manager?.changeRecordMode();
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabMute, async(event, tab, channel, state) => {
	manager?.updateMute(channel, state);
});

// listen to number of pattern rows changing
ZorroEvent.addListener(ZorroEventEnum.ProjectPatternRows, async(event, project, module, rows) => {
	// handle scrolling
	await manager?.parent.scrollManager.setPatternRows(rows);

	setTimeout(() => {
		// handle selection
		manager?.parent.selectionManager.handleMatrixResize();
		return manager?.parent.selectionManager.render();
	}, 1);
});

// listen to matrix being resized
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixResize, async() => {
	setTimeout(() => {
		// reload the graphics after the matrix resize event is accepted
		manager?.parent.scrollManager.verticalScroll(0);

		// handle selection
		manager?.parent.selectionManager.handleMatrixResize();
		manager?.parent.selectionManager.render();
	}, 1);
});

// listen to matrix cell being set to a value
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixSet, async(event, matrix, channel, row) => {
	setTimeout(() => {
		// tell the scrolling manager about dis
		manager?.parent.scrollManager.patternChanged(channel, row);
	}, 1);
});

// listen to matrix cells being inserted
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixInsert, async(event, matrix, row) => {
	setTimeout(() => {
		// loops for every channel
		for(let ch = (manager?.parent.tab.channels.length ?? 1) - 1;ch >= 0; --ch) {
			// tell the scrolling manager about dis
			manager?.parent.scrollManager.patternShifted(ch, row);
		}
	}, 1);
});

// listen to matrix cells being removed
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixRemove, async(event, matrix, row) => {
	setTimeout(() => {
		// loops for every channel
		for(let ch = (manager?.parent.tab.channels.length ?? 1) - 1;ch >= 0; --ch) {
			// tell the scrolling manager about dis
			manager?.parent.scrollManager.patternShifted(ch, row);
		}
	}, 1);
});
