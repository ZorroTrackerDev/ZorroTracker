import electron from "electron";
import path from "path";

function createWindow () {
	const win = new electron.BrowserWindow({
		width: 800,
		height: 600,
		frame: false,
		webPreferences: {
			preload: path.join(__dirname, "ui/main.preload.js"),
			contextIsolation: false,		// NOTE: possible security risk. Need to be careful about how to access anything outside the app ecosystem.
			enableRemoteModule: true,
		},
	});
  
	win.loadFile("ui/main.html");
}
  
electron.app.whenReady().then(() => {
	createWindow()
  
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});
  
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		electron.app.quit();
	}
});