import json5 from "json5";
import fs from "fs";
import { remote } from "electron";

/*
 * this is a translation layer array that converts your keypresses into the appropriate shortcut "codes".
 * "shortcutcodes" contains the actual functions that will be ran when a specific code is found. If the code is invalid,
 * then it is logged to the console and ignored. This array has entry points for the different types of combinations of modifier keys.
 * each modifier key array itself also has arrays of key names that are registered.
 */
const keymap:{ [key:string]:{ [key:string]:string }} = {
	none: {},
	ctrl: {},
	shift: {},
	alt: {},
	ctrlshift: {},
	ctrlalt: {},
	shiftalt: {},
};

/*
 * this is the array containing functions to deal with shortcuts.
 * each shortcut is given its own "code" for sorts. shortcuts.json5 uses these codes to define shortcut keys.
 * this array only shows the code, used by "keymap" and shortcuts.json5 to run them.
 */
const shortcutcodes:{ [key:string]:(e:Event) => unknown|void } = {

	/* shortcut for opening chrome dev tools */
	"ui.opendevtools": () => {
		remote.webContents.getFocusedWebContents().toggleDevTools();
	},

	/* shortcut for inspect element */
	"ui.inspectelement": () => {
		/*
		 * because Electron, we have to actually get the mouse position relative to the SCREEN rather than the current window.
		 * I don't know why but oh well
		 */
		const bounds = remote.getCurrentWindow().getContentBounds();
		const mouse = remote.screen.getCursorScreenPoint();

		// check if the mouse is inside of the browser window
		if(mouse.x >= bounds.x && mouse.x < bounds.x + bounds.width &&
			mouse.y >= bounds.y && mouse.y < bounds.y + bounds.height) {

				// open dev tools here
				remote.webContents.getFocusedWebContents().inspectElement(mouse.x - bounds.x, mouse.y - bounds.y);
				return;
			}

		// open dev tools at an arbitary position
		remote.webContents.getFocusedWebContents().inspectElement(-1, -1);
	},

	"ui.maximize": () => {
		window.preload.maximize();
	},
};

/**
 * Return the proper name for "keymap", for specific modifier key combos.
 * @param ctrl If the control key is pressed
 * @param shift If the shift key is pressed
 * @param alt If the alt key is pressed
 */

function getKeymapName(ctrl:boolean, shift:boolean, alt:boolean): string{
	const ret = (ctrl ? "ctrl" : "") + (shift ? "shift" : "") + (alt ? "alt" : "");

	if(ret.length > 0) {
		return ret;
	}

	// special case: if none are pressed, use "none" instead.
	return "none";
}

/*
 * Handle user input, to check for special shortcut keys. This won't override things such as input fields, however.
 */
document.addEventListener("keyup", (e) => {
	// check if this key has a registered command
	const arrayname = getKeymapName(e.ctrlKey, e.shiftKey, e.altKey);

	const com = keymap[arrayname][e.key];
	if(com) {
		// check if there is a command to be executed here
		if(!shortcutcodes[com]){
			// invalid command, log.
			console.log("!!! Invalid command!!!\nShortcut had an invalid command "+ com);
			return;
		}

		// we can execute the command!!
		shortcutcodes[com](e);
		e.preventDefault();
	}
});

/*
 * Open shortcuts.json5 and dump the shortcut keys mappings into "keymap"
 */
fs.readFile("settings/shortcuts.json5", "utf8", (err, data) => {
	if(err) {
		/*
		 * in case of an error, quickly abandon this idea
		 * TODO: Also let the user know.
		 */
		console.log("!!! FAILED TO LOAD shortcuts.json5!!!\nHere is the error:\n\n", err);
		return;
	}

	try {
		// convert input into an object!
		const input = json5.parse(data);

		for(const command of Object.keys(input)) {
			for(const shortcut of input[command]) {
				// check if modifier keys are applied
				let ctrl = false, alt = false, shift = false, button:string|null = null;

				for(const key of shortcut.split("+")) {
					/*
					 * this switch-case will either enable some flags or set the key
					 * this is lazy and allows things to be set multiple times.
					 */
					switch(key.toLowerCase()) {
						case "ctrl": ctrl = true; break;
						case "shift": shift = true; break;
						case "alt": alt = true; break;
						default: button = key; break;
					}
				}

				// make sure "button" is not null. Will skip this check if so
				if(button === null) {
					console.log("!!! FAILED TO PARSE shortcuts.json5!!!\nInvalid key combo for "+ command +": "+ shortcut);
					continue;
				}

				// grab the array name for these key combos
				const arrayname = getKeymapName(ctrl, shift, alt);

				// check if there is a collision here
				if(keymap[arrayname][button]) {
					console.log("!!! FAILED TO PARSE shortcuts.json5!!!\nShortcut collision for "+ command +": "+ shortcut);
					continue;
				}

				// apply the new code
				keymap[arrayname][button] = command;
			}
		}

	} catch(ex) {
		/*
		 * in case of an error, quickly abandon this idea
		 * TODO: Also let the user know.
		 */
		console.log("!!! FAILED TO PARSE shortcuts.json5!!!\nHere is the error:\n\n", ex);
	}
});