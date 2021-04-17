import { remote, session } from "electron";
import { loadSettingsFiles, SettingsTypes } from "../../api/files";

/**
 * add a class for various shortcut errors
 */
class ShortcutError extends Error {
	name = "ShortcutError";

	constructor(message?:string) {
		super(message)
	}
}

/*
 * this is a translation layer array that converts your keypresses into the appropriate shortcut "codes".
 * "shortcutcodes" contains the actual functions that will be ran when a specific code is found. If the code is invalid,
 * then it is logged to the console and ignored. This array has entry points for the different types of combinations of modifier keys.
 * each modifier key array itself also has arrays of key names that are registered.
 */
const keyMappings:{ [key:string]:{ [key:string]:string }} = {
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
const shortcutFunction:{ [key:string]:(e:Event) => unknown|void } = {

	/* shortcut for opening chrome dev tools */
	"ui.opendevtools": () => {
		remote.webContents.getFocusedWebContents().toggleDevTools();
	},

	/* shortcut for inspect element */
	"ui.inspectelement": () => {
		/*
		 * because Electron, we have to actually get the mouse position relative to the SCREEN rather than the current window.
		 * I don't know why but oh well.
		 */
		const bounds = remote.getCurrentWindow().getContentBounds();
		const mouse = remote.screen.getCursorScreenPoint();

		// check if the mouse is inside of the browser window
		if(mouse.x >= bounds.x && mouse.x < bounds.x + bounds.width &&
			mouse.y >= bounds.y && mouse.y < bounds.y + bounds.height) {

				// open dev tools at the mouse position relative the to the window
				remote.webContents.getFocusedWebContents().inspectElement(mouse.x - bounds.x, mouse.y - bounds.y);
				return;
			}

		// open dev tools at an arbitary position
		remote.webContents.getFocusedWebContents().inspectElement(-1, -1);
	},

	/* shortcut for fullscreen */
	"ui.fullscreen": () => {
		window.preload.maximize();
	},
};

/**
 * Return the proper name for the "keyMappings" object, for specific modifier key combos.
 *
 * @param ctrl If the control key is pressed
 * @param shift If the shift key is pressed
 * @param alt If the alt key is pressed
 */
function getKeymappingsName(ctrl:boolean, shift:boolean, alt:boolean): string{
	const ret = (ctrl ? "ctrl" : "") + (shift ? "shift" : "") + (alt ? "alt" : "");

	// if any of the modifier keys are pressed, return the calculated value
	if(ret.length > 0) {
		return ret;
	}

	// special case: if none are pressed, use "none" instead.
	return "none";
}

/*
 * Handle user input, to check for special shortcut keys. This won't override things such as input fields, however.
 */
document.addEventListener("keyup", (event) => {
	// check if this key has a registered command
	const arrayname = getKeymappingsName(event.ctrlKey, event.shiftKey, event.altKey);

	// get the function name from "keyMappings", and return if none were defined
	const com = keyMappings[arrayname][event.key];

	if(!com) {
		return;
	}

	// check if there is a shortcut function defined here
	if(!shortcutFunction[com]){
		// there is not, log it. TODO: handle this better.
		console.log("!!! Invalid command!!!\nShortcut had an invalid command "+ com);
		return;
	}

	// the function exists, execute it with the current event.
	shortcutFunction[com](event);
	event.preventDefault();
});

/**
 * Add shortcuts to the program. Duplicated shortcuts will override previous ones.
 *
 * @param shortcuts the data describing the shortcut key functionality.
 */
function addShortcuts(shortcuts:{ [key:string]: string|string[] }) {
	// run for each shortcut in the array
	for(const functionName in shortcuts) {

		// helper function to add each shortcut. This allows to use both string and string[] for functions.
		const addSingleShortcut = (keyCombo:string) => {
			let ctrl = false, alt = false, shift = false, button:string|null = null;

			// check if modifier keys are applied
			for(const key of keyCombo.split("+")) {
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

			// make sure "button" is not null. If it is, throw an error.
			if(button === null) {
				throw new ShortcutError(`Failed to parse function ${functionName} shortcut ${keyCombo}!`);
			}

			// get the array name for the "keyMappings" based on modifier keys, and apply the new shortcut function.
			const arrayname = getKeymappingsName(ctrl, shift, alt);
			keyMappings[arrayname][button] = functionName;
		}

		if(Array.isArray(shortcuts[functionName])) {
			// add multiple shortcut keys from array
			(shortcuts[functionName] as string[]).forEach(addSingleShortcut);

		} else {
			// this is a single shortcut key
			addSingleShortcut(shortcuts[functionName] as string);
		}
	}
}

/**
 * Load the default shortcuts for the program.
 *
 * @throws anything. Invalid files will throw just about any error.
 */
function loadDefaultShortcuts(){
	// load the files we need to inspect and pass them right to "addShortcuts" function. This pretends files are in the correct format.
	const files = loadSettingsFiles(SettingsTypes.shortcuts) as { [key: string]: string|string[]}[];
	files.forEach(addShortcuts);
}

// load the default shortcuts here
try {
	loadDefaultShortcuts();

} catch(ex) {
	// TODO: actual error handling
	console.log("!!! FAILED TO PARSE SHORTCUTS!!!\n", ex);
}