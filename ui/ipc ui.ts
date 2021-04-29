import { ipcEnum } from "../system/ipc enum";
import { ipcRenderer } from "electron";
import { EmulatorConfig } from "../api/scripts/emulator";
import { DriverConfig } from "../api/scripts/driver";

const _async = (name:string, ...args:unknown[]) => {
	return new Promise((res) => {
		ipcRenderer.once(name, (result, value) => {
			res(value);
		});

		ipcRenderer.send(name, ...args);
	});
};

window.ipc = {
	cookie: {
		set: (name:string, value:string) => {
			ipcRenderer.send(ipcEnum.CookieSet, name, value);
		},
		get: (name:string) => _async(ipcEnum.CookieGet, name) as Promise<string | null>,
	},
	audio: {
		findAll: () => _async(ipcEnum.AudioFindAll) as Promise<{ [key:string]: EmulatorConfig }>,

		init: (emu:EmulatorConfig, driver:DriverConfig) => {
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
	driver: {
		findAll: () => _async(ipcEnum.DriverFindAll) as Promise<{ [key:string]: DriverConfig }>,
	},
}