import { webFrame } from "electron";
webFrame.setZoomFactor(1);		// testing only

/* load object extensions */
import "../extensions";

window.isLoading = false;

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
