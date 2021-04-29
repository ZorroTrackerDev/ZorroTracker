import { ipcMain, session } from "electron";
import { Worker } from "worker_threads";
import path from "path";
import { ipcEnum } from "./ipc enum";
import * as ScriptHelper from "./script helper";
import { Cookie, IpcMainEvent } from "electron/main";
import { EmulatorConfig } from "../api/scripts/emulator";
import { DriverConfig } from "../api/scripts/driver";

// set a browser cookie. This is useful for settings that are irrelevant for the user.
export function setCookie(name:string, value:string):void {
	session.defaultSession.cookies.set({ url: "http://ZorroTracker", name: name, value: value, expirationDate: 4102488000, }).catch(() => {
		// if we failed just ignore it.
	});
}

// get a browser cookie. This is useful for settings that are irrelevant for the user.
export function getCookie(name:string):Promise<Cookie[]> {
	return session.defaultSession.cookies.get({ url: "http://ZorroTracker", name: name, });
}

// set cookie to value
ipcMain.on(ipcEnum.CookieSet, (event, name:string, value:string) => {
	setCookie(name, value);
});

// set cookie to value
ipcMain.on(ipcEnum.CookieGet, (event, name:string) => {
	getCookie(name).then((res:Cookie[]) => {
		// check if any cookie exists
		if(res.length > 0){
			event.reply(ipcEnum.CookieGet, res[0].value);

		} else {
			event.reply(ipcEnum.CookieGet, null);
		}

	}).catch(() => {
		event.reply(ipcEnum.CookieGet, null);
	});
});

// find all x type scripts
ipcMain.on(ipcEnum.AudioFindAll, (event) => _findall("chips", ipcEnum.AudioFindAll, event));
ipcMain.on(ipcEnum.DriverFindAll, (event) => _findall("drivers", ipcEnum.DriverFindAll, event));

function _findall(folder:string, eventName:string, event:IpcMainEvent) {
	ScriptHelper.findAll(folder).then((res) => {
		event.reply(eventName, res);

	}).catch(() => {
		event.reply(eventName, []);
	})
}

// set the volume of the audio instance
ipcMain.on(ipcEnum.AudioVolume, (event, volume:number) => {
	worker.postMessage({ code: "volume", data: volume, });
});

// create the audio instance
ipcMain.on(ipcEnum.AudioCreate, (event, emu:EmulatorConfig, driver:DriverConfig) => {
	worker.postMessage({ code: "emulator", data: emu, });
	worker.postMessage({ code: "driver", data: driver, });
	worker.postMessage({ code: "load", data: undefined, });
});

// close the audio instance
ipcMain.on(ipcEnum.AudioClose, () => {
	worker.postMessage({ code: "close", data: undefined, });
});

// play the audio
ipcMain.on(ipcEnum.AudioPlay, (event, special?:string) => {
	worker.postMessage({ code: "play", data: special, });
});

// stop the audio
ipcMain.on(ipcEnum.AudioStop, () => {
	worker.postMessage({ code: "stop", });
});

const worker = new Worker(path.join(__dirname, "emulator.js"));