import { _async } from "../../system/ipc/html";
import { ipcRenderer } from "electron";
import { Module, Project } from "../../ui/misc/project";
import { ipcEnum } from "./ipc enum";
import { loadToModule } from "../../ui/windows/editor";
import { Tab } from "../../ui/misc/tab";

// add some extra ipc functions
window.ipc.rpc = {
	init: () => ipcRenderer.send(ipcEnum.RpcInit),
	set: (details:string, state:string) => ipcRenderer.send(ipcEnum.RpcSet, details, state),
}

window.ipc.audio = {
	setChip: async(uuid:string) => {
		const res = await window.ipc.chip.findAll();
		ipcRenderer.send(ipcEnum.AudioChip, res[uuid]);
	},

	setDriver: async(uuid:string) => {
		const res = await window.ipc.driver.findAll();
		await _async(ipcEnum.AudioDriver, res[uuid]);
	},

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
	window.ipc.project?.init(Tab.active?.project);
});

// listen to requests to update project name
ipcRenderer.on(ipcEnum.ProjectSetName, (event, name:string) => {
	if(Tab.active) {
		// set name and mark as dirty
		Tab.active.project.config.name = name;
		Tab.active.project.dirty();
	}
});

// listen to requests to update project driver
ipcRenderer.on(ipcEnum.ProjectSetDriver, (event, uuid:string) => {
	if(Tab.active) {
		// set name and mark as dirty. TODO: convert driver data
		Tab.active.project.config.driver = uuid;
		Tab.active.project.dirty();

		// set driver instance
		window.ipc.audio?.setDriver(uuid);
	}
});

// listen to requests to select a module
ipcRenderer.on(ipcEnum.ProjectSelectModule, (event, index:number) => loadToModule(index));

// listen to requests to update module data
ipcRenderer.on(ipcEnum.ProjectSetModule, (event, data:Module) => {
	// ensure the module is valid
	if(Tab.active && Tab.active.project.activeModuleIndex >= 0 && Tab.active.project.activeModuleIndex < Tab.active.project.modules.length) {
		// set module data and request update
		Tab.active.project.modules[Tab.active.project.activeModuleIndex] = data;
		Tab.active.project.changeModule();
	}
});

// listen to requests to add new module with filename
ipcRenderer.on(ipcEnum.ProjectAddModule, async(event, file:string) => {
	console.log("add", file)
	// ensure the project is valid
	if(Tab.active) {
		// create a new module and get its index
		const m = Tab.active.project.addModule(file);
		const ix = Tab.active.project.getModuleIndexByFile(m.file);

		// switch to module by its index
		await loadToModule(ix);
	}
});

// listen to requests to update module data
ipcRenderer.on(ipcEnum.ProjectDeleteModule, async(event, index:number) => {
	// delete the module and do nothin
	await Tab.active?.project.deleteModule(index);
});

// listen to requests to update module data
ipcRenderer.on(ipcEnum.ProjectCloneModule, async(event, index:number) => {
	// ensure the project is valid
	if(Tab.active) {
		// load the source module
		const clone = Tab.active.project.modules[index];

		// create a new module and get its index
		const mod = await Tab.active.project.addModule();

		// delete the module and do nothin
		await Tab.active.project.cloneModule(clone, mod);
	}
});
