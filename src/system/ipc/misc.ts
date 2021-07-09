import { ipcMain, session, screen, app } from "electron";
import os from "os";
import process from "process"
import { ipcEnum } from "./ipc enum";
import * as ScriptHelper from "../script helper";
import { Cookie, IpcMainEvent } from "electron/main";
import { windows } from "../../main";
import { log } from "./editor";

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
type ScriptFolders = "chips"|"drivers"|"themes";

// find all different kind of scripts.
ipcMain.on(ipcEnum.ChipFindAll, (event) => _findall("chips", ipcEnum.ChipFindAll, event));
ipcMain.on(ipcEnum.DriverFindAll, (event) => _findall("drivers", ipcEnum.DriverFindAll, event));
ipcMain.on(ipcEnum.ThemeFindAll, (event) => _findall("themes", ipcEnum.ThemeFindAll, event));

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
		log.error(ex);
		event.reply(eventName, []);
	})
}

// handle UI requesting system information
ipcMain.on(ipcEnum.UiSystemInfo, async() => {
	const uptime = os.uptime();
	const gpu = await app.getGPUInfo("complete")  as { auxAttributes: Record<string, unknown>, gpuDevice: Record<string, unknown>[] };

	// dump info
	windows.editor?.webContents.send(ipcEnum.LogInfo, [
		"System information:",
		os.version() +" "+ os.arch() +" "+ os.release(),
		"cores: "+ os.cpus().length +"x "+ os.cpus()[0].model,
		"memory: "+ (Math.round(os.totalmem() / 1024 / 1024) / 1024) +" GB",
		"displays: ["+ screen.getAllDisplays().map((display) => display.size.width +"x"+ display.size.height +"@"+ display.displayFrequency +" "+
			display.colorDepth +"bpp scale="+ display.scaleFactor).join(", ") +"]",
		"gpus: ["+ gpu.gpuDevice.map((g) => (g.active ? "*active* " : "")
			+"vendor="+ (g.vendorId as number).toString(16)
			+" device="+ (g.deviceId as number).toString(16)
			+" revision="+ g.revision
			+" driverVendor="+ (g.driverVendor ?? "")).join(", ") +"]",
		"gpu features: [" + [
			gpu.auxAttributes.vulkanVersion, gpu.auxAttributes.glVersion, gpu.auxAttributes.glRenderer, gpu.auxAttributes.dx12FeatureLevel,
		].filter((x) => !!x).join(", ") +"]",
		"uptime: "+ Math.round(uptime / 60 / 60 / 24) +"d "+ (Math.round(uptime / 60 / 60) % 24) +"h "+ (Math.round(uptime / 60) % 60) +"m ",
		"chrome: "+ process.versions.chrome,
		"electron: "+ process.versions.electron,
	].join("\n"));
});
