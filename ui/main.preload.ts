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

	/* maximize/unmaximize the current window */
	maximize: function() {
		const window = remote.getCurrentWindow();

		// maximize or unmaximize depending on the current state
		if (!window.isMaximized()) {
			window.maximize();

		} else {
			window.unmaximize();
		}
	},

	/* function to open an URL in an external browser. DO NOT open in Electron please! */
	openInBrowser: function(url:string){
		shell.openExternal(url).catch(() => {
			// TODO: Do not ignore error
		});
	},
}