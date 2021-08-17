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
 * Function to initialize the playback state of the module
 *
 * @param tab The tab that is the target of the playback
 */
export async function initPlayback(tab:Tab): Promise<unknown> {
	targetTab = tab;

	// TEMP: upload all data before playing
	console.time("driver-upload")
	// eslint-disable-next-line max-len
	await _async(ipcEnum.DriverInit, tab.module?.patternRows ?? 64, tab.channels.length, tab.module?.rate ?? 1, tab.module?.ticksPerRow ?? 1, tab.matrix.matrixlen);

	// send the matrix first and prepare promises array
	const promises = [ await _async(ipcEnum.DriverMatrix, tab.matrix.matrix), ];

	// loop for all channels in pattern data
	for(let c = 0;c < tab.channels.length;c ++) {
		// loop for all patterns in channel
		for(let pat = 0;pat < tab.matrix.patterns[c].length;pat ++) {
			promises.push(await _async(ipcEnum.DriverPattern, c, pat, tab.matrix.patterns[c][pat]?.cells));
		}
	}

	// wait for everything to finish processing
	await Promise.all(promises);
	console.timeEnd("driver-upload");
	return undefined;
}

/**
 * Function to start playback of the module inside of the tab
 *
 * @param tab The tab that is the target of the playback
 * @param row The absolute row number to start playback in
 * @param repeat Whether to repeat the above mentioned pattern infinitely
 */
export function startPlayback(tab:Tab, row:number, repeat:boolean): Promise<unknown> {
	targetTab = tab;
	return _async(ipcEnum.DriverPlay, row, repeat);
}

let targetTab:Tab;
