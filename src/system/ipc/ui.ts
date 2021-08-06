
import { app, dialog, ipcMain, screen, shell, WebContents } from "electron";
import { OpenDialogOptions, SaveDialogOptions } from "electron/main";
import path from "path";
import { WindowType } from "../../defs/windowtype";
import { createWindow, windows } from "../../main";
import { ipcEnum } from "./ipc enum";
import { log } from "./editor";
import { getCookie, setCookie } from "./misc";

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
ipcMain.on(ipcEnum.UiPath, (event, token) => {
	console.log(ipcEnum.UiPath, token)
	event.reply(ipcEnum.UiPath, token, { data: dataPath, home: app.getPath("home"), });
});

/**
 * Helper function to tell the UI when the window has been maximized or unmaximized.
 *
 * @param mode Boolean indicating whether window is currently maximized
 */
export function updateMaximized(type:string, mode:boolean): void {
	windows[type]?.webContents.send(ipcEnum.UiGetMaximize, mode);
}

// handle the UI requesting maximized status.
ipcMain.on(ipcEnum.UiGetMaximize, (event, type:string) => {
	updateMaximized(type, windows[type]?.isMaximized() ?? false);
});

// handle the UI requesting the current window to maximize
ipcMain.on(ipcEnum.UiMaximize, (event, type:string) => {
	if(!windows[type]) {
		return;
	}

	// maximize or unmaximize depending on the current state
	if (!windows[type].isMaximized()) {
		windows[type].maximize();

	} else {
		windows[type].unmaximize();
	}
});

// handle the UI requesting the current window to minimize
ipcMain.on(ipcEnum.UiMinimize, (event, type:string) => {
	windows[type]?.minimize();
});

/**
 * Function to close the program safely
 *
 * @returns A promise that will resolve into an exit code for worker, when it is terminated.
 */
export function close(type:string): void {
	// ask the UI to exit gracefully
	windows[type]?.webContents.send(ipcEnum.UiExit);
}

// handle the UI requesting the current window to be closed
ipcMain.on(ipcEnum.UiClose, (event, type:WindowType) => {
	if(type === WindowType.Editor) {
		// special handling for editor
		windows.editor?.close();

	} else {
		// update devtools cookie
		setCookie(type +"_devtools", event.sender.isDevToolsOpened() ? "true" : "");

		// destroy this specific window
		windows[type].destroy();
		delete windows[type];
		log.info("close-window", type);
	}
});

// handle the UI requesting to zoom in
ipcMain.on(ipcEnum.UiZoomIn, (event, type:WindowType) => {
	const z = event.sender.getZoomFactor();
	updateZoom(type +"_zoom", event.sender, Math.min(4, z + (0.1 * z)));
});

// handle the UI requesting to zoom out
ipcMain.on(ipcEnum.UiZoomOut, (event, type:WindowType) => {
	const z = event.sender.getZoomFactor();
	updateZoom(type +"_zoom", event.sender, Math.max(0.33, z - (0.1 * z)));
});

// handle the UI requesting to zoom in
ipcMain.on(ipcEnum.UiZoomSet, (event, type:WindowType, zoom:number) => {
	updateZoom(type +"_zoom", event.sender, zoom);
});

/**
 *
 * @param cookie The target cookie to update with zoom value. null if no update
 * @param target The target webcontents to update
 * @param zoom The target zoom level
 */
export function updateZoom(cookie:string|null, target:WebContents, zoom:number):void {
	// set the zoom level
	target.setZoomFactor(zoom);

	// TODO: Send an event requesting zoom display
	log.info("current-zoom-level", (Math.round(zoom * 10000) / 100) +"%");

	if(cookie) {
		// update cookie
		setCookie(cookie, zoom + "");
	}
}


// handle the UI requesting an URL be opened in an external window
ipcMain.on(ipcEnum.UiOpenURL, (event, url:string) => {
	shell.openExternal(url).catch(() => {
		// TODO: Do not ignore error
	});
});

// handle the UI requesting Developer Tools to be opened
ipcMain.on(ipcEnum.UiDevTools, (event) => {
	if(event.sender.isDevToolsOpened()) {
		event.sender.closeDevTools();

	} else {
		event.sender.openDevTools({ mode: "right", activate: false, });
	}
});

// handle the UI requesting Inspect Element functionality
ipcMain.on(ipcEnum.UiInspectElement, (event, type:string) => {
	if(!windows[type]) {
		return;
	}

	/*
	 * because Electron, we have to actually get the mouse position relative to the SCREEN rather than the current window.
	 * I don't know why but oh well.
	 */
	const bounds = windows[type].getContentBounds();
	const mouse = screen.getCursorScreenPoint();

	// check if the mouse is inside of the browser window
	if(mouse.x >= bounds.x && mouse.x < bounds.x + bounds.width &&
		mouse.y >= bounds.y && mouse.y < bounds.y + bounds.height) {
			// open dev tools at the mouse position relative the to the window
			event.sender.inspectElement(mouse.x - bounds.x, mouse.y - bounds.y);
			return;
		}

	// open dev tools at an arbitary position
	event.sender.inspectElement(-1, -1);
});

// handle the UI requesting Console to be opened
ipcMain.on(ipcEnum.UiConsole, (event) => {
	event.sender.openDevTools({ mode: "right", activate: false, });
});

// handle the UI requesting a new window being opened
ipcMain.on(ipcEnum.UiLoadWindow, async(event, name:string) => {
	if(!windows[name]) {
		// if window already not open, then open it
		await createWindow(name);

	} else {
		// if already open, just focus on the window
		windows[name].focus();
	}
});

// handle the UI requesting a dialog box be opened
ipcMain.on(ipcEnum.UiDialog, async(event, token:number, type:string, mode:string, cookie:string, settings:OpenDialogOptions|SaveDialogOptions) => {
	if(!windows[type]) {
		event.reply(ipcEnum.UiDialog, token, null);
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

	switch(mode) {
		case "open": {		// OpenFileDialog
			const r = await dialog.showOpenDialog(windows[type], settings as OpenDialogOptions);
			result = r.filePaths.length !== 1 ? undefined : r.filePaths[0];
			break;
		}

		case "save": {		// SaveFileDialog
			const r = await dialog.showSaveDialog(windows[type], settings as SaveDialogOptions);
			result = r.filePath;
			break;
		}

		default:		// invalid
			throw Error("Invalid dialog type "+ mode +"!");
	}


	// if the operation was cancelled, do not update the cookie
	if(!result) {
		event.reply(ipcEnum.UiDialog, token, null);
		return;
	}

	// update the requested cookie to remember the last folder in the next run
	setCookie(cookie, path.dirname(result));

	// send the data back to UI
	event.reply(ipcEnum.UiDialog, token, result);
});
