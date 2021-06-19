import { WindowType } from "../../defs/windowtype";
import { Project } from "../misc/project";

/**
 * So.. In order for Jest testing to work, we need to load stuff as modules. However, browsers really don't like CommonJS modules
 * Also, Electron does not work with ES2015 modules. Also, trying to use mix of both is apparently borked to hell. Here we have an
 * amazing solution: Just pretend "exports" exists. Yeah. This will be filled with garbage, probably. But this fixes the issue
 * where browsers don't support CommonJS modules. As it turns out, this single line will fix the issues we're having. I hate this.
 */
window.exports = {};

// set window type
window.type = WindowType.ProjectInfo;

// @ts-expect-error - the remaining functions will be defined by all.ts
window.preload = {};

/* ipc communication */
import "../ipc ui";

window.ipc.ui.path().then(() => {
	// load all.ts asynchronously. This will setup our environment better than we can do here
	import("./all").then(() => {
		// load the project info layout
		import("../misc/layout").then(async(module) => {
			// create a new project first
			Project.current = await Project.createProject();

			// load the editor
			return module.loadLayout(module.LayoutType.ProjectInfo);

		}).catch(console.error);
	}).catch(console.error);
}).catch(console.error);