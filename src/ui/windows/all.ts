/* load object extensions */
import { SettingsTypes } from "../../api/files";
import { receiveShortcutFunc } from "../../api/ui";
import { WindowType } from "../../defs/windowtype";
import "../extensions";
import "../misc/logger";
import { addShortcutReceiver, loadDefaultShortcuts } from "../misc/shortcuts";

window.isLoading = false;

// if not initialized, create a new function to load shortcut priority
if(!window.shortcutPriority) {
	window.shortcutPriority = () => 0;
}

/**
 * Helper function to update the maximize UI button depending on the window state. This info comes from the Node side using IPC.
 *
 * @param mode This is the mode for the button to use (maximized or not).
 */
window.preload.updateMaximizeButtonState = (mode:boolean) => {
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
}

export function loadStandardShortcuts(type:SettingsTypes, extras:{ [key:string]: receiveShortcutFunc, }): void {
	loadDefaultShortcuts(type);

	// add default window open handler
	// eslint-disable-next-line require-await
	addShortcutReceiver("window", async(data) => {
		const c = data.shift();

		switch(c) {
			case "projectinfo":
				window.ipc.ui.window(WindowType.ProjectInfo);
				return true;

			case "shortcuts":
				window.ipc.ui.window(WindowType.Shortcuts);
				return true;
		}

		// shortcut was not handled
		return false;
	});

	// add default UI shortcuts handler
	addShortcutReceiver("ui", (data, event, state) => {
		const c = data.shift();

		switch(c) {
			/* shortcut for opening chrome dev tools */
			case "opendevtools":
				window.ipc.ui.devTools();
				return true;

			/* shortcut for inspect element */
			case "inspectelement":
				window.ipc.ui.inspectElement();
				return true;

			/* shortcut for fullscreen */
			case "fullscreen":
				window.ipc.ui.maximize();
				return true;

			/* shortcut for zooming in the window */
			case "zoomin":
				window.ipc.ui.zoomIn();
				return true;

			/* shortcut for zooming out the window */
			case "zoomout":
				window.ipc.ui.zoomOut();
				return true;

			/* shortcut for resetting zoom level to 100% */
			case "zoomreset":
				window.ipc.ui.zoomSet(1);
				return true;

			case undefined:
				break;

			default:
				// handle extra commands here
				if(extras[c]){
					return extras[c](data, event, state);
				}
				break;
		}

		// shortcut was not handled
		return false;
	});
}
