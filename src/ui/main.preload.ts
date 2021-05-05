/**
 * So.. In oreder for Jest testing to work, we need to load stuff as modules. However, browsers really don't like CommonJS modules
 * Also, Electron does not work with ES2015 modules. Also, trying to use mix of both is apparently borked to hell. Here we have an
 * amazing solution: Just pretend "exports" exists. Yeah. This will be filled with garbage, probably. But this fixes the issue
 * where browsers don't support CommonJS modules. As it turns out, this single line will fix the issues we're having. I hate this.
 */
window.exports = {};

import path from "path";
import { remote, webFrame } from "electron";
webFrame.setZoomFactor(1);		// testing only

/* ipc communication */
import "./ipc ui";

window.preload = {
	/**
	 * Helper function to update the maximize UI button depending on the window state. This info comes from the Node side using IPC.
	 *
	 * @param mode This is the mode for the button to use (maximized or not).
	 */
	updateMaximizeButtonState: (mode:boolean) => {
		const button = document.getElementById("main_toolbar_maximize");

		// if we could not find the button, just ignore this.
		if(!button) {
			return;
		}

		// add or remove the actual class here. The UI will handle the icon.
		button.classList[mode ? "add" : "remove"]("maximized");
	},

	/* open a file or a project and handle response. */
	open: async function() {
		// use the cookie "openfolder" to grab the last path that was used. Otherwise, use the documents folder.
		const folder = (await window.ipc.cookie.get("openfolder")) ?? remote.app.getPath("documents");

		// get the path cookie
		const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
			properties: [ "openFile", ], defaultPath: folder,
			filters: [
				{ name: "Vgm Files", extensions: [ "vgm", ], },
				{ name: "All Files", extensions: [ "*", ], },
			],
		});

		// if invalid file was applied or operation was cancelled, abort
		if(!result || result.filePaths.length !== 1) {
			return;
		}

		// update the "openfolder" cookie to remember the last folder in the next run
		window.ipc.cookie.set("openfolder", path.dirname(result.filePaths[0]));

		// stop the audio playback and restart it with the new file opened. TODO: This is only test code!
		window.ipc.audio.stop();
		setTimeout(() => window.ipc.audio.play(result.filePaths[0]), 50);
	},
}

// request the appPath variable from main thread
window.ipc.ui.path().then(() => {
	/* load shortcuts handler file */
	import("./misc/shortcuts");

	return window.ipc.audio.findAll();

}).then((emus) => {
	// TODO: Temporary code to initiate the audio system with an emulator and set volume. Bad!
	if(emus["nuked"]){
		// @ts-ignore
		window.ipc.audio.init(emus["nuked"], undefined);
		window.ipc.audio.volume(0.75);
	}

}).catch(console.log);
