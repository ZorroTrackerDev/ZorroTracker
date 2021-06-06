import electron, { BrowserWindow } from "electron";
import path from "path";

// add the IPC handlers here
import { getCookie, setCookie, updateMaximized, close as IpcClose, create as IpcCreate } from "./system/ipc";

// static reference to the main window
export let window:BrowserWindow|null = null;

// function that creates a new window and loads ui/main.html.
async function createWindow () {
	// attempt to create the IPC audio worker
	IpcCreate().catch(console.error);

	// load the browser settings
	const settings = await loadWindowSettings("main");
	console.log("spawn-main-window", settings);

	window = new BrowserWindow({
		width: settings.w, height: settings.h,
		minWidth: 400, minHeight: 400,
		x: settings.x, y: settings.y,
		frame: process.env.NODE_ENV === "test",
		show: true, backgroundColor: "#111",
		icon: path.join(__dirname, "icon.png"),

		webPreferences: {
			preload: path.join(__dirname, "ui", "main.preload.js"),
			contextIsolation: false,		// TODO: possible security risk. Need to be careful about how to access anything outside the app ecosystem
			enableRemoteModule: false,
		},
	});

	// TEST: remove dev tools! They're evil!
	if (process.env.NODE_ENV === "test") {
		window.webContents.closeDevTools();

	} else if(settings.devtools) {
		// if not in test, open devtools if devtools flag was set
		window.webContents.openDevTools();
	}

	// maximize window if the settings tell to
	if(settings.maximized) {
		window.maximize();
		updateMaximized(true);
	}

	window.removeMenu();			// remove default shortcuts
	window.loadFile(path.join(__dirname, "ui", "main.html")).catch(() => {
		// TODO: should we add a logging file that will log errors?
		electron.app.quit();
	});

	// focus the window
	window.focus();

	// handle when the window is asked to be closed.
	window.on("close", (event:Event) => {
		// update cookies and flush stored cookies
		setCookie("main_devtools", window?.webContents.isDevToolsOpened() ? "true" : "");
		electron.session.defaultSession.cookies.flushStore()
			// make sure all IPC-related tasks are safe to close
			.then(IpcClose)
			// destroy the current window if successful
			.then(() => window?.destroy())
			// if we failed, just log it as if it's fine.
			.catch(console.error);

		// prevent Electron closing our window before we can be sure its free to close
		event.preventDefault();
		return event.returnValue = false;
	});

	// when window is unmaximized, update the cookie value
	window.on("unmaximize", () => {
		updateMaximized(false);
		setCookie("main_maximized", "false");
	});

	// when window is maximized, update the cookie value
	window.on("maximize", () => {
		updateMaximized(true);
		setCookie("main_maximized", "true");
	});

	// when window is resized and not maximized, update its coordinates
	window.on("resize", () => {
		if(!window?.isMaximized()) {
			setCookie("main_w", ""+ window?.getNormalBounds().width);
			setCookie("main_h", ""+ window?.getNormalBounds().height);
		}
	});

	// when window is moved and not maximized, update its coordinates
	window.on("move", () => {
		if(!window?.isMaximized()) {
			setCookie("main_x", ""+ window?.getNormalBounds().x);
			setCookie("main_y", ""+ window?.getNormalBounds().y);
		}
	});
}

// this is responsible for creating the window.
electron.app.whenReady().then(async() => {
	await createWindow();

	// on Mac OS, we want to be able to respawn the app without fully closing it apparently
	electron.app.on("activate", async() => {
		try {
			if (BrowserWindow.getAllWindows().length === 0) {
				await createWindow();
			}

		} catch(ex) {
			// TODO: should we add a logging file that will log errors?
			electron.app.quit();
		}
	});
}).catch(() => {
	// TODO: should we add a logging file that will log errors?
	electron.app.quit();
});

// when all windows are closed, exit the app.
electron.app.on("window-all-closed", () => {
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
