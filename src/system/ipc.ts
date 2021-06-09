import { ipcMain, session, shell, screen, app, dialog } from "electron";
import { Worker } from "worker_threads";
import path from "path";
import os from "os";
import process from "process"
import { ipcEnum } from "./ipc enum";
import * as ScriptHelper from "./script helper";
import { Cookie, IpcMainEvent, OpenDialogOptions, SaveDialogOptions } from "electron/main";
import { ChipConfig } from "../api/scripts/chip";
import { DriverConfig } from "../api/scripts/driver";
import { window } from "../main";
import createRPC from "discord-rich-presence";

/**
 * The application data directory path. This is where the settings and scripts folders are found.
 * This is needed because development and packed builds have different relative paths from app.getAppPath() for the main directory!
 */
export const dataPath = path.join(
	app.getAppPath(),
	app.isPackaged ? ".." : ".",
	app.isPackaged ? ".." : ".",
	process.env.NODE_ENV === "test" ? "build" : "."
);

/**
 * Various handlers for dealing with the UI.
 */

// handle the UI requesting the application path
ipcMain.on(ipcEnum.UiPath, (event) => {
	event.reply(ipcEnum.UiPath, { data: dataPath, home: app.getPath("home"), });
});

/**
 * Helper function to tell the UI when the window has been maximized or unmaximized.
 *
 * @param mode Boolean indicating whether window is currently maximized
 */
export function updateMaximized(mode:boolean): void {
	window?.webContents.send(ipcEnum.UiGetMaximize, mode);
}

// handle the UI requesting maximized status.
ipcMain.on(ipcEnum.UiGetMaximize, () => {
	updateMaximized(window?.isMaximized() ?? false);
});

// handle the UI requesting the current window to maximize
ipcMain.on(ipcEnum.UiMaximize, () => {
	if(!window) {
		return;
	}

	// maximize or unmaximize depending on the current state
	if (!window.isMaximized()) {
		window.maximize();

	} else {
		window.unmaximize();
	}
});

// handle the UI requesting the current window to minimize
ipcMain.on(ipcEnum.UiMinimize, () => {
	window?.minimize();
});

/**
 * Function to close the program safely
 *
 * @returns A promise that will resolve into an exit code for worker, when it is terminated.
 */
export function close(): Promise<number> {
	return new Promise((res, rej) => {
		// ask the UI to exit gracefully
		window?.webContents.send(ipcEnum.UiExit);

		// listen to the UI's response
		ipcMain.once(ipcEnum.UiExit, (event, state:boolean) => {
			if(!state) {
				// will not be closed
				rej();
				return;
			}

			// quit discord RPC client
			discordRPC?.disconnect();
			discordRPC = undefined;

			// will be closed, tell the worker about it and terminate it
			worker?.postMessage({ code: "quit", });

			worker?.once("message", (data:{ code:string, data:unknown }) => {
				if(data.code === "quit"){
					worker?.terminate().then(res).catch(rej);
				}
			});
		});
	});
}

// handle the UI requesting the current window to be closed
ipcMain.on(ipcEnum.UiClose, () => {
	window?.close();
});

// handle the UI requesting an URL be opened in an external window
ipcMain.on(ipcEnum.UiOpenURL, (event, url:string) => {
	shell.openExternal(url).catch(() => {
		// TODO: Do not ignore error
	});
});

// handle the UI requesting Developer Tools to be opened
ipcMain.on(ipcEnum.UiDevTools, () => {
	if(window?.webContents.isDevToolsOpened()) {
		window?.webContents.closeDevTools();

	} else {
		window?.webContents.openDevTools({ mode: "right", activate: false, });
	}
});

// handle the UI requesting Inspect Element functionality
ipcMain.on(ipcEnum.UiInspectElement, () => {
	if(!window) {
		return;
	}

	/*
	 * because Electron, we have to actually get the mouse position relative to the SCREEN rather than the current window.
	 * I don't know why but oh well.
	 */
	const bounds = window.getContentBounds();
	const mouse = screen.getCursorScreenPoint();

	// check if the mouse is inside of the browser window
	if(mouse.x >= bounds.x && mouse.x < bounds.x + bounds.width &&
		mouse.y >= bounds.y && mouse.y < bounds.y + bounds.height) {
			// open dev tools at the mouse position relative the to the window
			window.webContents.inspectElement(mouse.x - bounds.x, mouse.y - bounds.y);
			return;
		}

	// open dev tools at an arbitary position
	window.webContents.inspectElement(-1, -1);
});

// handle the UI requesting Console to be opened
ipcMain.on(ipcEnum.UiConsole, () => {
	window?.webContents.openDevTools({ mode: "right", activate: false, });
});

// handle the UI requesting a dialog box be opened
ipcMain.on(ipcEnum.UiDialog, async(event, type:string, cookie:string, settings:OpenDialogOptions|SaveDialogOptions) => {
	if(!window) {
		event.reply(ipcEnum.UiDialog, null);
		return;
	}

	// get the supplies cookie value
	const _cookies = await getCookie(cookie);

	if(_cookies.length > 0) {
		// cookie is valid, use it as the default path
		settings.defaultPath = _cookies[0].value;

	} else {
		// otherwise use the user documents folder
		settings.defaultPath = app.getPath("documents");
	}

	// show the dialog to the user
	let result;

	switch(type) {
		case "open": {		// OpenFileDialog
			const r = await dialog.showOpenDialog(window, settings as OpenDialogOptions);
			result = r.filePaths.length !== 1 ? undefined : r.filePaths[0];
			break;
		}

		case "save": {		// SaveFileDialog
			const r = await dialog.showSaveDialog(window, settings as SaveDialogOptions);
			result = r.filePath;
			break;
		}

		default:		// invalid
			throw Error("Invalid dialog type "+ type +"!");
	}


	// if the operation was cancelled, do not update the cookie
	if(!result) {
		event.reply(ipcEnum.UiDialog, null);
		return;
	}

	// update the requested cookie to remember the last folder in the next run
	setCookie(cookie, path.dirname(result));

	// send the data back to UI
	event.reply(ipcEnum.UiDialog, result);
});

/**
 * Various handlers for dealing with the browser.
 */

/**
 * Set a browser cookie for later. These persist across runs.
 *
 * @param name Name of the cookie to edit
 * @param value the value to save to the cookie
 */
export function setCookie(name:string, value:string):void {
	session.defaultSession.cookies.set({ url: "http://ZorroTracker", name: name, value: value, expirationDate: 4102488000, }).catch(() => {
		// if we failed just ignore it.
	});
}

/**
 * Get a browser cookie from storage.
 *
 * @param name Name of the cookie to edit
 * @returns array of Cookie objects that match the cookie name.
 */
export function getCookie(name:string):Promise<Cookie[]> {
	return session.defaultSession.cookies.get({ url: "http://ZorroTracker", name: name, });
}

// handle CookieSet event, for setting cookie to value
ipcMain.on(ipcEnum.CookieSet, (event, name:string, value:string) => {
	setCookie(name, value);
});

// handle CookieGet event, for getting a cookie value, or null if it does not exist.
ipcMain.on(ipcEnum.CookieGet, (event, name:string) => {
	getCookie(name).then((res:Cookie[]) => {
		// check the return value and whether there are cookies or not.
		if(res.length > 0){
			event.reply(ipcEnum.CookieGet, res[0].value);

		} else {
			event.reply(ipcEnum.CookieGet, null);
		}

	}).catch(() => {
		event.reply(ipcEnum.CookieGet, null);
	});
});

/**
 * Various handlers for dealing with scripts.
 */
type ScriptFolders = "chips"|"drivers";

// find all different kind of scripts.
ipcMain.on(ipcEnum.ChipFindAll, (event) => _findall("chips", ipcEnum.ChipFindAll, event));
ipcMain.on(ipcEnum.DriverFindAll, (event) => _findall("drivers", ipcEnum.DriverFindAll, event));

/**
 * Find all scripts and return their configurations.
 *
 * @param folder The subfolder where the resources can be found.
 * @param eventName Name of the command to send to IpcRenderer.
 * @param event The actual event received from the IpcRenderer to respond to.
 */
function _findall(folder:ScriptFolders, eventName:ipcEnum, event:IpcMainEvent) {
	ScriptHelper.findAll(folder).then((res) => {
		event.reply(eventName, res);

	}).catch((ex) => {
		// for some reason this didn't work, just throw an error
		console.log(ex);
		event.reply(eventName, []);
	})
}

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
 * Various handlers for dealing with the audio adapter instance.
 */
let worker:Worker|undefined;


// handle changing the volume of the audio adapter instance.
ipcMain.on(ipcEnum.AudioVolume, (event, volume:number) => {
	worker?.postMessage({ code: "volume", data: volume, });
});

// handle creating the audio adapter instance.
ipcMain.on(ipcEnum.AudioCreate, (event, chip:ChipConfig, driver:DriverConfig) => {
	// post the ChipConfig
	worker?.postMessage({ code: "chip", data: chip, });

	// post the DriverConfig
	worker?.postMessage({ code: "driver", data: driver, });

	// post the finally initialize the audio adapter instance
	worker?.postMessage({ code: "load", data: undefined, });
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
 * Various handlers for dealing with the chip
 */

// handle FM mute command
ipcMain.on(ipcEnum.ChipMuteFM, (event, channel:number, state:boolean) => {
	worker?.postMessage({ code: "mutefm", data: [ channel, state, ], });
});

// handle PSG mute command
ipcMain.on(ipcEnum.ChipMuteFM, (event, channel:number, state:boolean) => {
	worker?.postMessage({ code: "mutepsg", data: [ channel, state, ], });
});

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
		if(window?.webContents.isDestroyed() === false) {
			window.webContents.send(ipcEnum.LogInfo, ...args);
		}
	},
	warn: (...args:unknown[]):void => {
		// send to base console
		console.warn(...args);

		// if window is not destroyed yet, send it to devtools console too
		if(window?.webContents.isDestroyed() === false) {
			window.webContents.send(ipcEnum.LogWarn, ...args);
		}
	},
	error:(...args:unknown[]):void => {
		// send to base console
		console.error(...args);

		// if window is not destroyed yet, send it to devtools console too
		if(window?.webContents.isDestroyed() === false) {
			window.webContents.send(ipcEnum.LogError, ...args);
		}
	},
}

// handle UI requesting systeminformation
ipcMain.on(ipcEnum.UiSystemInfo, () => {
	const uptime = os.uptime();

	// dump info
	window?.webContents.send(ipcEnum.LogInfo, [
		"System information:",
		os.version() +" "+ os.arch() +" "+ os.release(),
		"cores: "+ os.cpus().length +"x "+ os.cpus()[0].model,
		"memory: "+ (Math.round(os.totalmem() / 1024 / 1024) / 1024) +" GB",
		"displays: ["+ screen.getAllDisplays().map((display) => display.size.width +"x"+ display.size.height +"@"+ display.displayFrequency +" "+
			display.colorDepth +"bpp scale="+ display.scaleFactor).join(", ") +"]",
		"uptime: "+ Math.round(uptime / 60 / 60 / 24) +"d "+ (Math.round(uptime / 60 / 60) % 24) +"h "+ (Math.round(uptime / 60) % 60) +"m ",
		"chrome: "+ process.versions.chrome,
		"electron: "+ process.versions.electron,
	].join("\n"));
});

/**
 * Various handlers for dealing with Discord RPC
 */
let discordRPC: createRPC.RP|undefined;
let dateRPC: number|undefined;

// handle RPC init
ipcMain.on(ipcEnum.RpcInit, () => {
	discordRPC = createRPC("851541675050139698");
	dateRPC = Date.now();

	discordRPC.on("error", () => { /* ignore all errors */ });
});

// handle RPC update
ipcMain.on(ipcEnum.RpcSet, (event, details:string, state:string) => {
	discordRPC?.updatePresence({
		startTimestamp: dateRPC,
		largeImageKey: "icon",
	//	smallImageKey: "icon",
		instance: true,
		details: details,
		state: state,
	});
});