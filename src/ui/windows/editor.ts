import { doShortcut } from "../misc/shortcuts";
import { loadFlag } from "../../api/files";
import { volumeSlider, SliderEnum } from "../elements/slider/slider";
import { Project } from "../misc/project";
import { WindowType } from "../../defs/windowtype";

/**
 * So.. In order for Jest testing to work, we need to load stuff as modules. However, browsers really don't like CommonJS modules
 * Also, Electron does not work with ES2015 modules. Also, trying to use mix of both is apparently borked to hell. Here we have an
 * amazing solution: Just pretend "exports" exists. Yeah. This will be filled with garbage, probably. But this fixes the issue
 * where browsers don't support CommonJS modules. As it turns out, this single line will fix the issues we're having. I hate this.
 */
window.exports = {};

// set window type
window.type = WindowType.Editor;

// @ts-expect-error - the remaining functions will be defined by all.ts
window.preload = {
	/* open a VGM file */
	vgm: async function() {
		const result = await window.ipc.ui.dialog.open("openfolder", {
			properties: [ "openFile", ],
			filters: [
				{ name: "Vgm Files", extensions: [ "vgm", ], },
				{ name: "All Files", extensions: [ "*", ], },
			],
		});

		// if invalid file was applied or operation was cancelled, abort
		if(!result) {
			return;
		}

		// stop the audio playback and restart it with the new file opened. TODO: This is only test code!
		console.log("VGM", result);
		window.ipc.audio.stop();
		setTimeout(() => window.ipc.audio.play(result), 50);
	},

	/**
	 * Execute a shortcut action. This is usually done within UI, such as toolbar
	 *
	 * @param name The name of the shortcut to execute
	 */
	shortcut: (name:string[]) => {
		doShortcut(name);
	},
}

/* ipc communication */
import "../ipc ui";

// request the appPath variable from main thread
window.ipc.ui.path().then(() => {
	/* load shortcuts handler file */
	import("../misc/shortcuts").then((module) => {
		module.loadDefaultShortcuts();

		// load all.ts asynchronously. This will setup our environment better than we can do here
		import("./all").then(() => {
			/* logging helpers */
			import("../misc/logger").catch(console.error);

			// load the editor layout
			import("../misc/layout").then(async(module) => {
				// create a new project first
				Project.current = await Project.createProject();

				// load the editor
				return module.loadLayout(module.LayoutType.Editor);

			}).catch(console.error);

			if(loadFlag("DISCORD_RPC")) {
				// load Discord RPC integration
				window.ipc.rpc.init();
				import("../misc/rpc").catch(console.error);
			}

			return window.ipc.chip.findAll();

		}).then((emus) => {
			return window.ipc.driver.findAll().then((drivers) => {
				// TODO: Temporary code to initiate the audio system with an emulator and set volume. Bad!
				if(emus["9d8d2954-ad94-11eb-8529-0242ac130003"] && drivers["9d8d267a-ad94-11eb-8529-0242ac130003"]){
					// @ts-ignore
					window.ipc.audio.init(emus["9d8d2954-ad94-11eb-8529-0242ac130003"], drivers["9d8d267a-ad94-11eb-8529-0242ac130003"]);

					// TEMP volume hack
					setTimeout(() => {
						volumeSlider(SliderEnum.Small).catch(console.error);
					}, 100);
				}
			}).catch(console.error);
		}).catch(console.error);
	}).catch(console.error);
}).catch(console.error);