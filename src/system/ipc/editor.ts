import { ipcMain } from "electron";
import { ChipConfig } from "../../api/chip";
import { DriverConfig } from "../../api/driver";
import { windows } from "../../main";
import { ipcEnum } from "./ipc enum";
import { Worker } from "worker_threads";
import * as ScriptHelper from "../script helper";
import createRPC from "discord-rich-presence";

/**
 * Helper functions to tell the UI about log information
 *
 * @param args Arguments to send to UI
 */
export const log = {
	info: (...args:unknown[]):void => {
		// send to base console
		console.info(...args);

		// if window is not destroyed yet, send it to devtools console too
		if(windows.editor?.webContents.isDestroyed() === false) {
			windows.editor.webContents.send(ipcEnum.LogInfo, ...args);
		}
	},
	warn: (...args:unknown[]):void => {
		// send to base console
		console.warn(...args);

		// if window is not destroyed yet, send it to devtools console too
		if(windows.editor?.webContents.isDestroyed() === false) {
			windows.editor.webContents.send(ipcEnum.LogWarn, ...args);
		}
	},
	error:(...args:unknown[]):void => {
		// send to base console
		console.error(...args);

		// if window is not destroyed yet, send it to devtools console too
		if(windows.editor?.webContents.isDestroyed() === false) {
			windows.editor.webContents.send(ipcEnum.LogError, ...args);
		}
	},
}

/**
 * Various handlers for dealing with the audio adapter instance.
 */
let worker:Worker|undefined;

/**
 * Helper function for listening to worker messages correctly and responding with data
 */
function workerAsync(code:string, data:unknown, fn:string|undefined, handler:(data:unknown) => void): void {
	const _token = Math.random();

	// helper function to listen to the response
	const f = (data:{ token: number, code:string, data:unknown, fn:string|undefined }) => {
		if(data.token === _token && data.code === code && data.fn === fn){
			// success, now send it along
			worker?.off("message", f);
			handler(data.data);
		}
	};

	// add reponse listener
	worker?.on("message", f);

	// post the messages to the worker
	worker?.postMessage({ token: _token, code: code, data: data, fn: fn, });
}

 // handle changing the volume of the audio adapter instance.
ipcMain.on(ipcEnum.AudioVolume, (event, volume:number) => {
	worker?.postMessage({ code: "volume", data: volume, });
});

// handle creating the audio adapter instance.
ipcMain.on(ipcEnum.AudioChip, (event, chip:ChipConfig) => {
	// post the ChipConfig
	worker?.postMessage({ code: "chip", data: chip, });
});

// handle creating the audio adapter instance.
ipcMain.on(ipcEnum.AudioDriver, (event, token, driver:DriverConfig) => {
	// post the DriverConfig
	workerAsync("driver", driver, undefined, () => {
		// initialize the audio adapter instance
		worker?.postMessage({ code: "load", data: undefined, });

		// tell the UI we finished
		event.reply(ipcEnum.AudioDriver, token);
	});

	// close the previous instance of RtAudio if running
	worker?.postMessage({ code: "close", data: undefined, });
});

// handle closing the audio adapter instance.
ipcMain.on(ipcEnum.AudioClose, () => {
	worker?.postMessage({ code: "close", data: undefined, });
});

// handle telling the audio adapter instance to play audio.
ipcMain.on(ipcEnum.AudioPlay, (event, special?:string) => {
	worker?.postMessage({ code: "play", data: special, });
});

// handle telling the audio adapter instance to stop playing audio.
ipcMain.on(ipcEnum.AudioStop, () => {
	worker?.postMessage({ code: "stop", });
});

/**
 * Pass-throughs for various playback controller functions
 */
ipcMain.on(ipcEnum.DriverInit, (event, token, channels) => {
	// post the info
	workerAsync("module-init", { channels, }, undefined, () => {
		// tell the UI we finished
		event.reply(ipcEnum.DriverInit, token);
	});
});

ipcMain.on(ipcEnum.DriverPlay, (event, token, row, repeat) => {
	// post the info
	workerAsync("module-play", { row, repeat, }, undefined, () => {
		// tell the UI we finished
		event.reply(ipcEnum.DriverPlay, token);
	});
});

ipcMain.on(ipcEnum.DriverStop, (event, token) => {
	// post the info
	workerAsync("module-stop", {}, undefined, () => {
		// tell the UI we finished
		event.reply(ipcEnum.DriverStop, token);
	});
});

ipcMain.on(ipcEnum.ManagerMatrix, (event, token, data) => {
	// post the info
	workerAsync("module-matrix", data, undefined, () => {
		// tell the UI we finished
		event.reply(ipcEnum.ManagerMatrix, token);
	});
});

ipcMain.on(ipcEnum.MAnagerPattern, (event, channel, index, data) => {
	worker?.postMessage({ code: "module-pattern", data: { channel, index, data, }, });
});

ipcMain.on(ipcEnum.ManagerFlags, (event, token, patternlen, rate, ticksPerRow, matrixlen) => {
	// post the info
	workerAsync("module-flags", { patternlen, rate, ticksPerRow, length: matrixlen, }, undefined, () => {
		// tell the UI we finished
		event.reply(ipcEnum.ManagerFlags, token);
	});
});

/**
 * Function to create ipc correctly
 */
export async function create(): Promise<void> {
	// find all the audio devices
	const cfg = await ScriptHelper.findAll("audio");

	if(cfg["audio"]){
		// found the audio script, load it as a worker
		worker = new Worker(cfg["audio"].entry);

		// enable messages
		worker.on("message", (data:{ code:string, fn?:string, data:unknown, token?:number }) => {
			switch(data.code) {
				case "error": log.error(...(data.data as unknown[])); break;
				case "log": log.info(...(data.data as unknown[])); break;
				case "async-ui": {
					// load the channel
					const channel = data.fn ?? "null";

					// helper function to listen for the ipc events
					const check = (event:unknown, token:number, result:unknown) => {
						if(token === data.token) {
							// found the message, tell the worker
							ipcMain.off(channel, check);
							(worker as Worker).postMessage({ code: "async-ui", token: data.token, fn: data.fn, data: result, });
						}
					};

					// listen for the channel
					ipcMain.on(channel, check);

					// send the message
					windows["editor"].webContents.send(channel, data.token, data.data);
				}
			}
		});

		// enable error logs
		worker.on("error", log.error);

		// initialize the config file
		worker.postMessage({ code: "config", data: cfg["audio"], });
	}
}

/**
 * Various handlers for dealing with the chip
 */


/**
 * Various handlers for dealing with Discord RPC
 */
export let rpc:{ client:createRPC.RP|undefined, date: number|undefined, } = { client: undefined, date: undefined, };

// handle RPC init
ipcMain.on(ipcEnum.RpcInit, () => {
	// create the client
	rpc = { client: createRPC("851541675050139698"), date: Date.now(), };

	// handle errors
	rpc.client?.on("error", () => { /* ignore all errors */ });
});

// handle RPC update
ipcMain.on(ipcEnum.RpcSet, (event, details:string, state:string) => {
	rpc.client?.updatePresence({
		startTimestamp: rpc.date,
		largeImageKey: "icon",
	//	smallImageKey: "icon",
		instance: true,
		details: details,
		state: state,
	});
});

// listen to the UI telling if its OK to close
ipcMain.on(ipcEnum.UiExit, (event:unknown, state:boolean) => {
	if(!state) {
		// will not be closed
		return;
	}

	// quit discord RPC client
	rpc.client?.disconnect();
	rpc.client = undefined;

	// will be closed, tell the worker about it and terminate it
	workerAsync("quit", undefined, undefined, () => {
		worker?.terminate().then(() => {

			// kill all windows
			for(const w of Object.values(windows)) {
				w.destroy();
			}
		}).catch(log.error);
	});
});

/**
 * Various functions for dealing with drivers
 */
// handle arbitary function calls
ipcMain.on(ipcEnum.DriverFunc, (event, token, args:[string, unknown[]]) => {
	// create a new message and listen to it
	workerAsync("cd", args[1], args[0], (data) => {
		// valid response, return data
		event.reply(ipcEnum.DriverFunc, token, data);
	});
});
