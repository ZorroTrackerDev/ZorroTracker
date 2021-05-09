import { ipcEnum } from "../system/ipc enum";
import { ipcRenderer } from "electron";
import { ChipConfig } from "../api/scripts/chip";
import { DriverConfig } from "../api/scripts/driver";
import { OpenDialogOptions, OpenDialogReturnValue } from "electron/main";

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
		updateMaximized: () => {
			ipcRenderer.send(ipcEnum.UiGetMaximize);
		},
		close: () => {
			ipcRenderer.send(ipcEnum.UiClose);
		},
		minimize: () => {
			ipcRenderer.send(ipcEnum.UiMinimize);
		},
		maximize: () => {
			ipcRenderer.send(ipcEnum.UiMaximize);
		},
		openInBrowser: (url:string) => {
			ipcRenderer.send(ipcEnum.UiOpenURL, url);
		},
		devTools: () => {
			ipcRenderer.send(ipcEnum.UiDevTools);
		},
		inspectElement: () => {
			ipcRenderer.send(ipcEnum.UiInspectElement);
		},
		dialog: (cookie:string, settings:OpenDialogOptions) => _async(ipcEnum.UiDialog, cookie, settings) as Promise<OpenDialogReturnValue>,
	},
	cookie: {
		set: (name:string, value:string) => {
			ipcRenderer.send(ipcEnum.CookieSet, name, value);
		},
		get: (name:string) => _async(ipcEnum.CookieGet, name) as Promise<string | null>,
	},
	audio: {
		init: (emu:ChipConfig, driver:DriverConfig) => {
			ipcRenderer.send(ipcEnum.AudioCreate, emu, driver);
		},

		volume: (volume:number) => {
			ipcRenderer.send(ipcEnum.AudioVolume, volume);
		},

		play: (special?:string) => {
			ipcRenderer.send(ipcEnum.AudioPlay, special);
		},

		stop: () => {
			ipcRenderer.send(ipcEnum.AudioStop);
		},

		close: () => {
			ipcRenderer.send(ipcEnum.AudioClose);
		},
	},
	chip: {
		findAll: () => _async(ipcEnum.ChipFindAll) as Promise<{ [key:string]: ChipConfig }>,

		muteFM: (channel:number, state:boolean) => {
			ipcRenderer.send(ipcEnum.ChipMuteFM, channel, state);
		},

		mutePSG: (channel:number, state:boolean) => {
			ipcRenderer.send(ipcEnum.ChipMutePSG, channel, state);
		},
	},
	driver: {
		findAll: () => _async(ipcEnum.DriverFindAll) as Promise<{ [key:string]: DriverConfig }>,
	},
}
