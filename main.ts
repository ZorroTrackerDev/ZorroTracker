import electron from "electron";
import path from "path";

// function that creates a new window and loads ui/main.html.
function createWindow () {
	const win = new electron.BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 400,
		minHeight: 400,
		frame: process.env.NODE_ENV === "test",

		webPreferences: {
			preload: path.join(__dirname, "ui/main.preload.js"),
			contextIsolation: false,		// TODO: possible security risk. Need to be careful about how to access anything outside the app ecosystem
			enableRemoteModule: true,
		},
	});

	// TEST: remove dev tools! They're evil!
	if (process.env.NODE_ENV === "test") {
		win.webContents.closeDevTools();
	}

	win.removeMenu();			// remove default shortcuts
	win.loadFile(path.join(__dirname, "./ui/main.html")).catch(() => {
		// TODO: should we add a logging file that will log errors?
		electron.app.quit();
	});
}

// this is responsible for enabling the window and recreating window... if its gone?
electron.app.whenReady().then(() => {
	createWindow();

	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) {
			createWindow();
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