import { ipcRenderer } from "electron";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { Matrix } from "../../api/matrix";
import { _async } from "../../system/ipc/html";
import { ipcEnum } from "../../system/ipc/ipc enum";
import { Tab } from "./tab";

// create events
const position = ZorroEvent.createEvent(ZorroEventEnum.PlaybackPosition);

// listen to updates on the playback position
ipcRenderer.on(ipcEnum.ManagerPosition, (event, row:number) => {
	// pass straight to the event system
	return position(row);
});

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
	init = false;
	currentTab = tab;

	console.time("init-playback")
	// eslint-disable-next-line max-len
	await _async(ipcEnum.DriverInit, tab.channels.length);
	await setFlags(tab);

	// send all the data to the playback engine
	await uploadInitial(tab.matrix);
	console.timeEnd("init-playback")
	return undefined;
}

let init = false;

async function uploadInitial(matrix:Matrix) {
	// send the matrix first and prepare promises array
	await setMatrix(matrix.matrix);

	// loop for all channels in pattern data
	for(let c = 0;c < matrix.matrix.length;c ++) {
		const loaded = Array(256).fill(false);

		// loop for all patterns for this channel
		for(let row = 0;row < matrix.matrixlen;row ++) {
			const pat = matrix.matrix[c][row];

			if(typeof pat === "number" && !loaded[pat]) {
				// needs to be loaded
				loaded[pat] = true;
				ipcRenderer.send(ipcEnum.ManagerPattern, c, pat, matrix.patterns[c][pat]?.cells);
			}
		}
	}

	init = true;
}

/**
 * Function to start playback of the module inside of the tab
 *
 * @param row The absolute row number to start playback in
 * @param repeat Whether to repeat the above mentioned pattern infinitely
 * @param step Whether to execute playback via the keyboard, or in normal mode
 */
export async function startPlayback(row:number, repeat:boolean, step:boolean): Promise<boolean> {
	// if init is not done, do not allow playback
	if(!init) {
		return false;
	}

	// initialize playback
	await _async(ipcEnum.DriverPlay, row, repeat, step);
	return true;
}

/**
 *
 *
 * @param tab The tab that is the target of the playback
 */
export async function setFlags(tab:Tab): Promise<void> {
	// eslint-disable-next-line max-len
	tab.secondsPerTick = await _async(ipcEnum.ManagerFlags, tab.module?.patternRows ?? 64, tab.module?.rate ?? 1, tab.module?.ticksPerRow ?? 1, tab.matrix.matrixlen) as number;
}

/**
 * Function to send the entire matrix to the playback engine
 *
 * @param data The actual matrix data
 */
export async function setMatrix(data:Uint8Array[]): Promise<void> {
	await _async(ipcEnum.ManagerMatrix, data);
}

let matrixTimeout:undefined|NodeJS.Timeout;

function matrixSend(matrix:Matrix){
	// clear previous timeouts
	if(matrixTimeout) {
		clearTimeout(matrixTimeout);
	}

	// make sure to call the timeout when matrix is fully updated
	matrixTimeout = setTimeout(() => {
		matrixTimeout = undefined;
		setMatrix(matrix.matrix).catch(console.error);
	}, 1);
}

/**
 * Function to send the pattern data at a certain position
 *
 * @param data The actual matrix data
 */
export function setPattern(matrix:Matrix, channel:number, pattern:number): void {
	ipcRenderer.send(ipcEnum.ManagerPattern, channel, pattern, matrix.patterns[channel][pattern]?.cells);
}

let currentTab: Tab;

/**
 * Events that make the need for reloading the managers
 */
ZorroEvent.addListener(ZorroEventEnum.SelectModule, async() => {
	await stopPlayback();
});

/**
 * Events that make the need for the matrix to be re-rendered
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixSet, async(event, matrix) => matrixSend(matrix));
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixInsert, async(event, matrix) => matrixSend(matrix));
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixRemove, async(event, matrix) => matrixSend(matrix));

/**
 * Events that make the need for flags to be updated
 */
ZorroEvent.addListener(ZorroEventEnum.MatrixResize, async() => { await setFlags(currentTab); });
ZorroEvent.addListener(ZorroEventEnum.ProjectPatternRows, async() => { await setFlags(currentTab); });

/**
 * Events that make the need for pattern data to be updated
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.PatternMake, async(event, matrix, channel, position) => { setPattern(matrix, channel, position); });
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.PatternData, async(event, matrix, channel, pattern) => { setPattern(matrix, channel, pattern); });
