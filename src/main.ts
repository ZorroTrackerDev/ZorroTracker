import electron, { BrowserWindow } from "electron";
import path from "path";
import { create as IpcCreate, log } from "./system/ipc/editor";

// add the IPC handlers here
import { getCookie, setCookie } from "./system/ipc/misc";
import { close as IpcClose, updateMaximized } from "./system/ipc/ui";
import "./system/ipc/sub";

// static references to all loaded windows
export const windows:{ [key:string]: BrowserWindow } = {};

// function that creates a new window and loads ui/main.html.
export async function createWindow(name:string): Promise<BrowserWindow> {
	// load the browser settings
	const settings = await loadWindowSettings(name);
	log.info("spawn-window", name);

	const w = new BrowserWindow({
		width: settings.w, height: settings.h,
		minWidth: 400, minHeight: 400,
		x: settings.x, y: settings.y,
		frame: process.env.NODE_ENV === "test",
		show: true, backgroundColor: "#111",
		icon: path.join(__dirname, "icon.png"),

		webPreferences: {
			preload: path.join(__dirname, "ui", "windows", name +".js"),
			contextIsolation: false,		// TODO: possible security risk. Need to be careful about how to access anything outside the app ecosystem
			enableRemoteModule: false,
		},
	});

	// TEST: remove dev tools! They're evil!
	if (process.env.NODE_ENV === "test") {
		w.webContents.closeDevTools();

	} else if(settings.devtools) {
		// if not in test, open devtools if devtools flag was set
		w.webContents.openDevTools();
	}

	// maximize window if the settings tell to
	if(settings.maximized) {
		w.maximize();
		updateMaximized(name, true);
	}

	w.removeMenu();				// remove default shortcuts
	w.loadFile(path.join(__dirname, "ui", "main.html")).catch(() => {
		// TODO: should we add a logging file that will log errors?
		electron.app.quit();
	});

	// focus the window
	w.focus();

	// handle when the window is asked to be closed.
	w.on("close", (event:Event) => {
		// update cookies and flush cookie store
		setCookie(name +"_devtools", w.webContents.isDevToolsOpened() ? "true" : "");

		electron.session.defaultSession.cookies.flushStore()
			// tell IPC its ok to close
			.then(() => IpcClose("editor"))
			// if we failed, just log it as if it's fine.
			.catch((e) => e !== undefined && log.error(e));

		// prevent Electron closing our window before we can be sure its free to close
		event.preventDefault();
		return event.returnValue = false;
	});

	// when window is unmaximized, update the cookie value
	w.on("unmaximize", () => {
		updateMaximized(name, false);
		setCookie(name +"_maximized", "false");
	});

	// when window is maximized, update the cookie value
	w.on("maximize", () => {
		updateMaximized(name, true);
		setCookie(name +"_maximized", "true");
	});

	// when window is resized and not maximized, update its coordinates
	w.on("resize", () => {
		if(!w.isMaximized()) {
			setCookie(name +"_w", ""+ w.getNormalBounds().width);
			setCookie(name +"_h", ""+ w.getNormalBounds().height);
		}
	});

	// when window is moved and not maximized, update its coordinates
	w.on("move", () => {
		if(!w.isMaximized()) {
			setCookie(name +"_x", ""+ w.getNormalBounds().x);
			setCookie(name +"_y", ""+ w.getNormalBounds().y);
		}
	});

	// return the window
	return windows[name] = w;
}

// this is responsible for creating the window.
electron.app.whenReady().then(async() => {
	await createWindow("editor");

	// attempt to create the IPC audio worker
	IpcCreate().catch(log.error);

	// on Mac OS, we want to be able to respawn the app without fully closing it apparently
	electron.app.on("activate", async() => {
		try {
			if (BrowserWindow.getAllWindows().length === 0) {
				await createWindow("editor");

				// attempt to create the IPC audio worker
				IpcCreate().catch(log.error);
			}

		} catch(ex) {
			// TODO: should we add a logging file that will log errors?
			electron.app.quit();
		}
	});
}).catch(() => {
	electron.app.quit();
});

// when all windows are closed, exit the app.
electron.app.on("window-all-closed", () => {
	delete windows["editor"];

	if (process.platform !== "darwin") {
		electron.app.quit();
	}
});

/**
 * Function to load the window settings that allow it to be started where the user last had it.
 *
 * @param window this is the string name of the element. In the future, subwindows may be supported.
 * @returns the settings as an object.
 */
async function loadWindowSettings(window:string) {
	// little helper function to do parseInt if we get a string
	const cookieToNumber = async(value:string) => {
		const cookie = await getCookieValue(value);

		// if we did not get a cookie, return undefined
		if(!cookie){
			return;
		}

		// parse this as an integer. If we fail, ignore the error and return undefined
		try {
			return parseInt(cookie, 10);

		} catch(ex) {
			// ignore error and return undefined
		}
	}

	// return all the relevant data
	return {
		x: await cookieToNumber(window +"_x"),
		y: await cookieToNumber(window +"_y"),
		w: await cookieToNumber(window +"_w") || 800,
		h: await cookieToNumber(window +"_h") || 600,
		devtools: await getCookieValue(window +"_devtools") === "true",
		maximized: await getCookieValue(window +"_maximized") === "true",
	}
}

/**
 * Returns the value of the cookie you want to check.
 *
 * @param name name of the cookie to find
 * @returns either undefined or the value of the first found cookie
 */
async function getCookieValue(name:string){
	const value = await getCookie(name);

	// check if we got a valid cookie
	if(value && value.length > 0){
		return value[0].value;
	}
}
