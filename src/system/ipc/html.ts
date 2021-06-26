import { ipcEnum } from "./ipc enum";
import { ipcRenderer } from "electron";
import { ChipConfig } from "../../api/scripts/chip";
import { DriverConfig } from "../../api/scripts/driver";
import { OpenDialogOptions, SaveDialogOptions } from "electron/main";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { WindowType } from "../../defs/windowtype";

/**
 * Helper function to run an async IPC event, returning the async value for it.
 *
 * @param name Name of the IPC event.
 * @param args The arguments to give to the IPC event.
 * @returns The Promise, that will eventually resolve into the value from the event.
 */
const _async = (name:string, ...args:unknown[]) => {
	return new Promise((res) => {
		ipcRenderer.once(name, (result, value) => {
			res(value);
		});

		ipcRenderer.send(name, ...args);
	});
};

// listen to when the UiMaximize event is passed from the backend, to update the UI state.
ipcRenderer.on(ipcEnum.UiGetMaximize, (event, state:boolean) => {
	window.preload.updateMaximizeButtonState(state);
});

// create the functions table for various IPC actions. This abstracts the actual calling code from the rest of the codebase.
window.ipc = {
	ui: {
		path: () => {
			return new Promise((res) => {
				ipcRenderer.once(ipcEnum.UiPath, (result, value) => {
					window.path = value;
					res(value);
				});

				ipcRenderer.send(ipcEnum.UiPath);
			});
		},
		dialog: {
			open: (cookie:string, settings:OpenDialogOptions) =>
				_async(ipcEnum.UiDialog, window.type, "open", cookie, settings) as Promise<string|undefined>,
			save: (cookie:string, settings:SaveDialogOptions) =>
				_async(ipcEnum.UiDialog, window.type, "save", cookie, settings) as Promise<string|undefined>,
		},
		updateMaximized: () => ipcRenderer.send(ipcEnum.UiGetMaximize, window.type),
		close: () => ipcRenderer.send(ipcEnum.UiClose, window.type),
		zoomIn: () => ipcRenderer.send(ipcEnum.UiZoomIn, window.type),
		zoomOut: () => ipcRenderer.send(ipcEnum.UiZoomOut, window.type),
		zoomSet: (zoom:number) => ipcRenderer.send(ipcEnum.UiZoomSet, window.type, zoom),
		minimize: () => ipcRenderer.send(ipcEnum.UiMinimize, window.type),
		maximize: () => ipcRenderer.send(ipcEnum.UiMaximize, window.type),
		openInBrowser: (url:string) => ipcRenderer.send(ipcEnum.UiOpenURL, url),
		devTools: () => ipcRenderer.send(ipcEnum.UiDevTools),
		inspectElement: () => ipcRenderer.send(ipcEnum.UiInspectElement, window.type),
		console: () => ipcRenderer.send(ipcEnum.UiConsole),
		systemInfo: () => ipcRenderer.send(ipcEnum.UiSystemInfo),
		window: (type:WindowType) => ipcRenderer.send(ipcEnum.UiLoadWindow, type),
	},
	cookie: {
		set: (name:string, value:string) => ipcRenderer.send(ipcEnum.CookieSet, name, value),
		get: (name:string) => _async(ipcEnum.CookieGet, name) as Promise<string | null>,
	},
	chip: {
		findAll: () => _async(ipcEnum.ChipFindAll) as Promise<{ [key:string]: ChipConfig }>,
		muteFM: (channel:number, state:boolean) => ipcRenderer.send(ipcEnum.ChipMuteFM, channel, state),
		mutePSG: (channel:number, state:boolean) => ipcRenderer.send(ipcEnum.ChipMutePSG, channel, state),
	},
	driver: {
		findAll: () => _async(ipcEnum.DriverFindAll) as Promise<{ [key:string]: DriverConfig }>,
	},
}

/**
 * Various handlers for dealing with the console
 */
ipcRenderer.on(ipcEnum.LogInfo, (event, ...args:unknown[]) => {
	console.info(...args);
});

ipcRenderer.on(ipcEnum.LogWarn, (event, ...args:unknown[]) => {
	console.warn(...args);
});

ipcRenderer.on(ipcEnum.LogError, (event, ...args:unknown[]) => {
	console.error(...args);
});

// create the close event handler
const _closeHandler = ZorroEvent.createEvent(ZorroEventEnum.Exit);

// listen to when the UiExit event is passed from the backend, to gracefully close the program (maybe)
ipcRenderer.on(ipcEnum.UiExit, async() => {
	// run all the close handlers
	const cancel = (await _closeHandler()).event.canceled;

	// tell the backend what we decided
	ipcRenderer.send(ipcEnum.UiExit, !cancel);
});