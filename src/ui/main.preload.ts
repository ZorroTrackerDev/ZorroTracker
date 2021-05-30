/**
 * So.. In oreder for Jest testing to work, we need to load stuff as modules. However, browsers really don't like CommonJS modules
 * Also, Electron does not work with ES2015 modules. Also, trying to use mix of both is apparently borked to hell. Here we have an
 * amazing solution: Just pretend "exports" exists. Yeah. This will be filled with garbage, probably. But this fixes the issue
 * where browsers don't support CommonJS modules. As it turns out, this single line will fix the issues we're having. I hate this.
 */
window.exports = {};

import { webFrame } from "electron";
webFrame.setZoomFactor(1);		// testing only

/* load object extensions */
import "./extensions";

/* ipc communication */
import "./ipc ui";
import { LayoutType } from "./misc/layout";
import { doShortcut } from "./misc/shortcuts";

window.isLoading = false;

window.preload = {
	/**
	 * Helper function to update the maximize UI button depending on the window state. This info comes from the Node side using IPC.
	 *
	 * @param mode This is the mode for the button to use (maximized or not).
	 */
	updateMaximizeButtonState: (mode:boolean) => {
		// a helper function to update a single element class
		const update = (element:Element|null) => {
			// if we could not find the element, just ignore this.
			if(!element) {
				return;
			}

			// add or remove the actual class here. The UI will handle the rest.
			element.classList[mode ? "add" : "remove"]("maximized");
		}

		// update both the main toolbar and the maximize button
		update(document.getElementById("main_toolbar"));
		update(document.getElementById("main_toolbar_maximize"));
	},

	/* open a VGM file */
	vgm: async function() {
		const result = await window.ipc.ui.dialog("openfolder", {
			properties: [ "openFile", ],
			filters: [
				{ name: "Vgm Files", extensions: [ "vgm", ], },
				{ name: "All Files", extensions: [ "*", ], },
			],
		});

		// if invalid file was applied or operation was cancelled, abort
		if(!result || result.filePaths.length !== 1) {
			return;
		}

		// stop the audio playback and restart it with the new file opened. TODO: This is only test code!
		window.ipc.audio.stop();
		setTimeout(() => window.ipc.audio.play(result.filePaths[0]), 50);
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

// request the appPath variable from main thread
window.ipc.ui.path().then(() => {
	/* logging helpers */
	import("./misc/logger").catch(console.error);

	/* load shortcuts handler file */
	import("./misc/shortcuts").then((module) => {
		module.loadDefaultShortcuts();
	}).catch(console.error);

	// load the editor layout
	import("./misc/layout").then((module) => {
		return module.loadLayout(LayoutType.ProjectInfo);
	}).catch(console.error);

	return window.ipc.chip.findAll();

}).then((emus) => {
	return window.ipc.driver.findAll().then((drivers) => {
		// TODO: Temporary code to initiate the audio system with an emulator and set volume. Bad!
		if(emus["9d8d2954-ad94-11eb-8529-0242ac130003"] && drivers["9d8d267a-ad94-11eb-8529-0242ac130003"]){
			// @ts-ignore
			window.ipc.audio.init(emus["9d8d2954-ad94-11eb-8529-0242ac130003"], drivers["9d8d267a-ad94-11eb-8529-0242ac130003"]);
		}

	}).catch(console.error);

}).catch(console.error);
