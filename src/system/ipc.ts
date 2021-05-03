import { ipcMain, session, shell, screen } from "electron";
import { Worker } from "worker_threads";
import path from "path";
import { ipcEnum } from "./ipc enum";
import * as ScriptHelper from "./script helper";
import { Cookie, IpcMainEvent } from "electron/main";
import { ChipConfig } from "../api/scripts/chip";
import { DriverConfig } from "../api/scripts/driver";
import { window } from "../main";

/**
 * Various handlers for dealing with the UI.
 */

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
	window?.webContents.toggleDevTools();
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
ipcMain.on(ipcEnum.AudioFindAll, (event) => _findall("chips", ipcEnum.AudioFindAll, event));
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

	}).catch(() => {
		event.reply(eventName, []);
	})
}

/**
 * Various handlers for dealing with the audio adapter instance.
 */
const worker = new Worker(path.join(__dirname, "audio.js"));

// handle changing the volume of the audio adapter instance.
ipcMain.on(ipcEnum.AudioVolume, (event, volume:number) => {
	worker.postMessage({ code: "volume", data: volume, });
});

// handle creating the audio adapter instance.
ipcMain.on(ipcEnum.AudioCreate, (event, chip:ChipConfig, driver:DriverConfig) => {
	// post the ChipConfig
	worker.postMessage({ code: "chip", data: chip, });

	// post the DriverConfig
	worker.postMessage({ code: "driver", data: driver, });

	// post the finally initialize the audio adapter instance
	worker.postMessage({ code: "load", data: undefined, });
});

// handle closing the audio adapter instance.
ipcMain.on(ipcEnum.AudioClose, () => {
	worker.postMessage({ code: "close", data: undefined, });
});

// handle telling the audio adapter instance to play audio.
ipcMain.on(ipcEnum.AudioPlay, (event, special?:string) => {
	worker.postMessage({ code: "play", data: special, });
});

// handle telling the audio adapter instance to stop playing audio.
ipcMain.on(ipcEnum.AudioStop, () => {
	worker.postMessage({ code: "stop", });
});
