import "../../system/ipc/html";
import { ipcRenderer } from "electron";
import { ChipConfig } from "../../api/scripts/chip";
import { DriverConfig } from "../../api/scripts/driver";
import { Module, Project } from "../../ui/misc/project";
import { ipcEnum } from "./ipc enum";
import { loadToModule } from "../../ui/windows/editor";

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

// listen to requests to update project name
ipcRenderer.on(ipcEnum.ProjectSetName, (event, name:string) => {
	if(Project.current) {
		// set name and mark as dirty
		Project.current.config.name = name;
		Project.current.dirty();
	}
});

// listen to requests to update project driver
ipcRenderer.on(ipcEnum.ProjectSetDriver, (event, uuid:string) => {
	if(Project.current) {
		// set name and mark as dirty. TODO: convert driver data
		Project.current.config.driver = uuid;
		Project.current.dirty();
	}
});

// listen to requests to select a module
ipcRenderer.on(ipcEnum.ProjectSelectModule, (event, index:number) => loadToModule(index));

// listen to requests to update module data
ipcRenderer.on(ipcEnum.ProjectSetModule, (event, data:Module) => {
	// ensure the module is valid
	if(Project.current && Project.current.activeModuleIndex >= 0 && Project.current.activeModuleIndex < Project.current.modules.length) {
		// set module data and request update
		Project.current.modules[Project.current.activeModuleIndex] = data;
		Project.current.changeModule();
	}
});

// listen to requests to add new module with filename
ipcRenderer.on(ipcEnum.ProjectAddModule, async(event, file:string) => {
	// ensure the project is valid
	if(Project.current) {
		// create a new module and get its index
		const m = Project.current.addModule(file);
		const ix = Project.current.getModuleIndexByFile(m.file);


		// switch to module by its index
		// eslint-disable-next-line require-await
		await loadToModule(ix, async() => {
			// TEMP
			Project.current?.index.setChannels(await window.ipc.driver.getChannels());
		});
	}
});

// listen to requests to update module data
ipcRenderer.on(ipcEnum.ProjectDeleteModule, async(event, index:number) => {
	// delete the module and do nothin
	await Project.current?.deleteModule(index);
});

// listen to requests to update module data
ipcRenderer.on(ipcEnum.ProjectCloneModule, async(event, index:number) => {
	// ensure the project is valid
	if(Project.current) {
		// load the source module
		const clone = Project.current.modules[index];

		// create a new module and get its index
		const mod = Project.current.addModule();

		// delete the module and do nothin
		await Project.current.cloneModule(clone, mod);
	}
});
