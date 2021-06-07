import { loadSettingsFiles, SettingsTypes } from "../../api/files";
import { receiveShortcutFunc } from "../../api/ui";
import { Undo } from "../../api/undo";
import { fadeToLayout, LayoutType, loadLayout } from "./layout";
import { Project } from "./project";

/**
 * add a class for various shortcut errors
 */
class ShortcutError extends Error {
	name = "ShortcutError";

	constructor(message?:string) {
		super(message)
	}
}

// container for the shortcutReceiverFun instances used by the UI currently.
const shortcutReceivers:{ [key:string]: receiveShortcutFunc } = {};

/**
 * Function to add a functiont for handling nested schortcuts
 *
 * @param key The key name for the receiver
 * @param target The actual receiver function for shortcuts
 */
export function addShortcutReceiver(key:string, target:receiveShortcutFunc):void {
	shortcutReceivers[key] = target;
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
	ctrlshiftalt: {},
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
document.addEventListener("keydown", (event) => {
	// check if this key has a registered command
	const arrayname = getKeymappingsName(event.ctrlKey, event.shiftKey, event.altKey);

	// get the function name from "keyMappings", and return if none were defined
	const com = keyMappings[arrayname][event.key.toUpperCase()];

	if(!com) {
		return;
	}

	// do shortcut and prevent default event
	doShortcut([ com, ], event);
	event.preventDefault();
});

export function doShortcut(name:string[], event?:KeyboardEvent):void {
	// if loading currently, disable all shortcuts
	if(window.isLoading) {
		return;
	}

	(async() => {
		// do each shortcut separately
		for(const com of name) {
			// split into an array based on dots and get the first element of the array
			const comarr = com.toLowerCase().split(".");
			const comkey = comarr.shift() ?? "<null>";

			// check if there is a shortcut function defined here
			if(!shortcutReceivers[comkey]){
				// there is not, log it. TODO: handle this better.
				console.error("!!! Invalid command!!!\nShortcut had an invalid command "+ comkey);
				return;
			}

			// the function exists, execute it with the current event.
			if(await shortcutReceivers[comkey](comarr, event)) {
				// event was accepted, return away
				return;
			}
		}
	})().catch(console.error);
}

/**
 * Add shortcuts to the program. Duplicated shortcuts will override previous ones.
 *
 * @param shortcuts the data describing the shortcut key functionality.
 */
export function addShortcuts(shortcuts:{ [key:string]: string|string[] }):void {
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
				const ku = key.toUpperCase();
				switch(ku) {
					case "CTRL": ctrl = true; break;
					case "SHIFT": shift = true; break;
					case "ALT": alt = true; break;
					case "": break;
					default: button = ku; break;
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
export function loadDefaultShortcuts(): void {
	// load the files we need to inspect and pass them right to "addShortcuts" function. This pretends files are in the correct format.
	const files = loadSettingsFiles(SettingsTypes.shortcuts) as { [key: string]: string|string[]}[];
	files.forEach(addShortcuts);

	// add default UI shortcuts handler
	// eslint-disable-next-line require-await
	addShortcutReceiver("ui", async(data) => {
		switch(data.shift()) {
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

			/* shortcut for opening a file or a project */
			case "open": {
				const result = await window.ipc.ui.dialog.open("openfolder", {
					properties: [ "openFile", ],
					filters: [
						{ name: "ZorroTracker Module Files", extensions: [ "ztm", ], },
						{ name: "ZorroTracker Files", extensions: [ "zip", ], },
						{ name: "All Files", extensions: [ "*", ], },
					],
				});

				// if invalid file was applied or operation was cancelled, abort
				if(!result) {
					return false;
				}

				// open loading animation
				await loadLayout(LayoutType.Loading);
				Undo.clear();

				// try to load the project
				const p = await Project.loadProject(result);

				if(!p){
					await loadLayout(LayoutType.NoLoading);
					return false;
				}

				// save project as current
				Project.current = p;
				await fadeToLayout(LayoutType.ProjectInfo);
				await loadLayout(LayoutType.NoLoading);
				return true;
			}

			/* shortcut for creating a new project */
			case "new": {
				// open loading animation
				await loadLayout(LayoutType.Loading);
				Undo.clear();

				// try to load the project
				const p = await Project.createProject();

				if(!p){
					await loadLayout(LayoutType.NoLoading);
					return false;
				}

				// save project as current
				Project.current = p;
				await fadeToLayout(LayoutType.ProjectInfo);
				await loadLayout(LayoutType.NoLoading);
				return true;
			}

			/* shortcut for closing a project */
			case "close":
				return false;

			/* shortcut for doing a redo action */
			case "redo":
				return Undo.redo();

			/* shortcut for doing a undo action */
			case "undo":
				return Undo.undo();

			/* shortcut for doing a save action */
			case "save":
				try {
					return await Project.current?.save(false) ?? false;

				} catch(ex)  {
					console.error(ex);
				}

				return false;

			/* shortcut for doing a save as action */
			case "saveas":
				try {
					return await Project.current?.saveAs() ?? false;

				} catch(ex)  {
					console.error(ex);
				}

				return false;
		}

		// shortcut was not handled
		return false;
	});
}