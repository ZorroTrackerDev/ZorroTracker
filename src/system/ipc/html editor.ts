import "../../system/ipc/html";
import { ipcRenderer } from "electron";
import { ChipConfig } from "../../api/scripts/chip";
import { DriverConfig } from "../../api/scripts/driver";
import { Project } from "../../ui/misc/project";
import { ipcEnum } from "./ipc enum";

// add some extra ipc functions
window.ipc.rpc = {
	init: () => ipcRenderer.send(ipcEnum.RpcInit),
	set: (details:string, state:string) => ipcRenderer.send(ipcEnum.RpcSet, details, state),
}

window.ipc.audio = {
	init: (emu:ChipConfig, driver:DriverConfig) => ipcRenderer.send(ipcEnum.AudioCreate, emu, driver),
	volume: (volume:number) => ipcRenderer.send(ipcEnum.AudioVolume, volume),
	play: (special?:string) => ipcRenderer.send(ipcEnum.AudioPlay, special),
	stop: () => ipcRenderer.send(ipcEnum.AudioStop),
	close: () => ipcRenderer.send(ipcEnum.AudioClose),
}

window.ipc.project = {
	init: (project:Project|undefined) => ipcRenderer.send(ipcEnum.ProjectInit, window.type, project?.config, project?.modules),
}

/**
 * Project related communications
 */
// listen to requests to update project status
ipcRenderer.on(ipcEnum.ProjectInit, () => {
	window.ipc.project?.init(Project.current);
});
