import electron from "electron";
import path from "path";
import { test } from "./system/test";

// function that creates a new window and loads ui/main.html.
async function createWindow () {
	const settings = await loadWindowSettings("main");

	const win = new electron.BrowserWindow({
		width: settings.w, height: settings.h,
		minWidth: 400, minHeight: 400,
		x: settings.x, y: settings.y,
		frame: process.env.NODE_ENV === "test",
		show: true, backgroundColor: "#222222",

		webPreferences: {
			preload: path.join(__dirname, "ui/main.preload.js"),
			contextIsolation: false,		// TODO: possible security risk. Need to be careful about how to access anything outside the app ecosystem
			enableRemoteModule: true,
		},
	});

	// TEST: remove dev tools! They're evil!
	if (process.env.NODE_ENV === "test") {
		win.webContents.closeDevTools();

	} else if(settings.devtools) {
		// if not in test, open devtools if devtools flag was set
		win.webContents.openDevTools();
	}

	// maximize window if the settings tell to
	if(settings.maximized) {
		win.maximize();
	}

	win.removeMenu();			// remove default shortcuts
	win.loadFile(path.join(__dirname, "./ui/main.html")).catch(() => {
		// TODO: should we add a logging file that will log errors?
		electron.app.quit();
	});

	// focus the window
	win.focus();

	// when the window is closed, update the cookies
	win.on("close", async() => {
		setCookie("main_devtools", win.webContents.isDevToolsOpened() +"");
		await electron.session.defaultSession.cookies.flushStore();
	});

	// when window is unmaximized, update the cookie value
	win.on("unmaximize", () => {
		setCookie("main_maximized", "false");
	});

	// when window is maximized, update the cookie value
	win.on("maximize", () => {
		setCookie("main_maximized", "true");
	});

	// when window is resized and not maximized, update its coordinates
	win.on("resize", () => {
		if(!win.isMaximized()) {
			setCookie("main_w", ""+ win.getNormalBounds().width);
			setCookie("main_h", ""+ win.getNormalBounds().height);
		}
	});

	// when window is moved and not maximized, update its coordinates
	win.on("move", () => {
			if(!win.isMaximized()) {
			setCookie("main_x", ""+ win.getNormalBounds().x);
			setCookie("main_y", ""+ win.getNormalBounds().y);
		}
	});

	// extra code for loading the chip emulation routines
	try {
		await test();

	} catch(ex) {
		console.log(ex);
	}
}

// this is responsible for creating the window.
electron.app.whenReady().then(async() => {
	await createWindow()

	// on Mac OS, we want to be able to respawn the app without fully closing it apparently
	electron.app.on("activate", async() => {
		try {
			if (electron.BrowserWindow.getAllWindows().length === 0) {
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

// get a browser cookie. This is useful for settings that are irrelevant for the user.
function getCookie(name:string){
	return electron.session.defaultSession.cookies.get({ url: "http://ZorroTracker", name: name, });
}

// set a browser cookie. This is useful for settings that are irrelevant for the user.
function setCookie(name:string, value:string){
	electron.session.defaultSession.cookies.set({ url: "http://ZorroTracker", name: name, value: value, expirationDate: 4102488000, }).catch(() => {
		// if we failed just ignore it.
	});
}