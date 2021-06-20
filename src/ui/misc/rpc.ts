import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../api/events";
import { Module, Project } from "./project";

/**
 * function for updating the RPC status
 *
 * @param project The current project that is open, if any
 * @param module The currently module that is active, if any
 * @param noselect If true, then no module is selected
 */
const update = (project:Project|undefined, module:Module|undefined, noselect:boolean) => {
	if(!project) {
		// if no project is loaded currently???
		window.ipc.rpc?.set("No project open", "Just what you think you are doing.");

	} else {
		// load the project details
		let details = project.config.name;

		if(!details){
			details = "untitled project";
		}

		// load the project state
		let state;

		if(noselect) {
			// if no active module, default to this
			state = "editing project details";

		} else {
			// load the active module name
			state = module?.name;

			if(!state) {
				// if it has no name, default to this
				state = "untitled module";
			}

			// plop the editing string in front
			state = "editing "+ state;
		}

		// finally update the RPC
		window.ipc.rpc?.set(details, state);
		console.info("rpc-set", details, state);
	}
}

// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.ProjectOpen, async(event:ZorroEventObject, project:Project|undefined) => {
	update(project, project?.modules[project.activeModuleIndex], (project?.activeModuleIndex ?? -1) < 0);
});

// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.SelectModule, async(event:ZorroEventObject, project:Project|undefined, module:Module|undefined) => {
	update(project, module, project?.modules.length === 0 ?? true);
});

// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.ModuleUpdate, async(event:ZorroEventObject, project:Project|undefined) => {
	update(project, project?.modules[project.activeModuleIndex], (project?.activeModuleIndex ?? -1) < 0);
});