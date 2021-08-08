import { ipcRenderer } from "electron";
import { PatternCellData, PatternRowData } from "../../api/driver";
import { _async } from "../../system/ipc/html";
import { ipcEnum } from "../../system/ipc/ipc enum";
import { Tab } from "./tab";

/**
 * Function to stop any playback that is currently happening
 */
export function stopPlayback(): Promise<unknown> {
	return _async(ipcEnum.DriverStop);
}

/**
 * Function to start playback of the module inside of the tab
 *
 * @param tab The tab that is the target of the playback
 * @param pattern The pattern to start the playback in
 * @param repeat Whether to repeat the above mentioned pattern infinitely
 */
export function startPlayback(tab:Tab, pattern:number, repeat:boolean): Promise<unknown> {
	targetTab = tab;
	return _async(ipcEnum.DriverPlay, pattern, repeat, tab.module?.rate ?? 1, tab.module?.ticksPerRow ?? 1, tab.matrix.matrixlen);
}

let targetTab:Tab;

// handle requests from the audio backend to get pattern data
ipcRenderer.on(ipcEnum.DriverFetchRow, (event, token:number, patternRow:number) => {
	let ret:PatternRowData|null = null;

	// check if this row is valid
	if(targetTab && patternRow >= 0 && patternRow < targetTab.matrix.matrixlen) {
		ret = [];

		// store tab so that the reference won't be borked accidentally
		const _tab = targetTab;

		// handle channel by channel
		for(let c = 0;c < _tab.channels.length;c ++) {
			// generate channel array
			ret[_tab.channels[c].info.id] = [];

			// get the pattern data
			const rp = _tab.matrix.matrix[c][patternRow];
			const pat = _tab.matrix.patterns[c][rp];

			// fill the channel array
			for(let r = 0;r < (_tab.module?.patternRows ?? 0);r ++) {
				// create the data element and check if cell exists
				const dat = { effects: [], } as PatternCellData;
				const cell = pat?.cells[r];

				if(pat && cell) {
					/* eslint-disable @typescript-eslint/no-unused-expressions */
					cell.note !== 0 && (dat.note = cell.note);
					cell.volume !== null && (dat.volume = cell.volume);
					cell.instrument !== null && (dat.instrument = cell.instrument);
					/* eslint-enable @typescript-eslint/no-unused-expressions */
				}

				// save the data element
				ret[_tab.channels[c].info.id].push(dat);
			}
		}
	}

	ipcRenderer.send(ipcEnum.DriverFetchRow, token, ret);
});
