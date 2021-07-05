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
	// helper function to listen to the response
	const f = (data:{ code:string, data:unknown, fn:string|undefined }) => {
		console.log("CHECK", data.code, data.fn, fn)
		if(data.code === code && data.fn === fn){
			// success, now send it along
			worker?.off("message", f);
			log.info("worker ->", code, fn)
			handler(data.data);
		}
	};

	log.info("-> worker ", code, fn)

	// add reponse listener
	worker?.on("message", f);

	// post the messages to the worker
	worker?.postMessage({ code: code, data: data, fn: fn, });
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
ipcMain.on(ipcEnum.AudioDriver, (event, driver:DriverConfig) => {
	// post the DriverConfig
	workerAsync("driver", driver, undefined, () => {
		// tell the UI we finished
		event.reply(ipcEnum.AudioDriver);

		// initialize the audio adapter instance
		worker?.postMessage({ code: "load", data: undefined, });
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
 * Function to create ipc correctly
 */
export async function create(): Promise<void> {
	// find all the audio devices
	const cfg = await ScriptHelper.findAll("audio");

	if(cfg["audio"]){
		// found the audio script, load it as a worker
		worker = new Worker(cfg["audio"].entry);

		// enable messages
		worker.on("message", (data:{ code:string, data:unknown }) => {
			switch(data.code) {
				case "error": log.error(...(data.data as unknown[])); break;
				case "log": log.info(...(data.data as unknown[])); break;
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
ipcMain.on(ipcEnum.DriverFunc, (event, args:[string, unknown[]]) => {
	// create a new message and listen to it
	workerAsync("cd", args[1], args[0], (data) => {
		// valid response, return data
		event.reply(ipcEnum.DriverFunc, data);
	});
});
