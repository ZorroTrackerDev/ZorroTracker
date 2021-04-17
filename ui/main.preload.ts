import { remote, webFrame, shell } from "electron";
webFrame.setZoomFactor(1);		// testing only

/* load shortcuts handler file */
import "./misc/shortcuts";

window.preload = {
	/* close the current window */
	close: function() {
		remote.getCurrentWindow().close();
	},

	/* minimize the current window */
	minimize: function() {
		remote.getCurrentWindow().minimize();
	},

	/* maximize/unmaximize the current window. Returns the new state as boolean. */
	maximize: function() {
		const window = remote.getCurrentWindow();

		// maximize or unmaximize depending on the current state
		if (!window.isMaximized()) {
			window.maximize();
			return true;

		} else {
			window.unmaximize();
			return false;
		}
	},

	/* function to open an URL in an external browser. DO NOT open in Electron please! */
	openInBrowser: function(url:string){
		shell.openExternal(url).catch(() => {
			// TODO: Do not ignore error
		});
	},

	/*
	 * this method is needed because apparently Electron is silly and won't let me do this in toolbar.ts
	 * what does this amazing function do? Simply, it just updates "main_toolbar_maximize" to correct state
	 * based on whether the program is maximized or not, and then adds event listeners for the state change.
	 * This then applies or removes the .maximized class.
	 * Can't do it in "preload.ts" tho! No way! Too dangerous or something! Really?
	 */
	updateMaximizeButtonState: () => {
		// helper function for code below
		const editClass = (mode:boolean) => {
			const button = document.getElementById("main_toolbar_maximize");

			// if we could not find the button, just ignore this.
			if(!button) {
				return;
			}

			// I do not understand why using a string directly doesn't work, but it doesnt! great!
			button.classList[mode ? "add" : "remove"]("maximized");
		}

		// special handling for the maximize button, to initialize its state
		if(remote.getCurrentWindow().isMaximized()) {
			editClass(true);
		}

		// handle the maximize event, to set the maximize button to different graphic
		remote.getCurrentWindow().on("maximize", () => {
			editClass(true);
		});

		// handle the unmaximize event, to set the maximize button to different graphic
		remote.getCurrentWindow().on("unmaximize", () => {
			editClass(false);
		});
	},
}