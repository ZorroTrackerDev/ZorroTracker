import { loadSettingsFiles, SettingsTypes } from "../../api/files";
import { receiveShortcutFunc } from "../../api/ui";

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
 * @param data The data representing modifier keys that are used
 */
function getKeymappingsName(data:{ ctrl: boolean, alt: boolean, shift: boolean }): string {
	const ret = (data.ctrl ? "ctrl" : "") + (data.shift ? "shift" : "") + (data.alt ? "alt" : "");

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
const stdHandler = (type:"keydown"|"keyup", state:boolean) => {
	document.addEventListener(type, (event) => {
		// check if this key has a registered command
		const arrayname = getKeymappingsName( { ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, });

		// get the function name from "keyMappings", and return if none were defined
		let com = keyMappings[arrayname][event.code.toUpperCase()] ?? keyMappings[arrayname][event.key.toUpperCase()];

		if(!com) {
			return;
		}

		// define the standard state
		let stt = undefined;

		if(com.startsWith("*")) {
			// must ignore repeated keypresses
			if(event.repeat) {
				return;
			}

			// this event wants both keyup and keydown events
			com = com.substring(1);
			stt = state;

		} else if(!state) {
			// ignore key up
			return;
		}

		// do shortcut and prevent default event
		doShortcut([ com, ], event, stt);
		event.preventDefault();
	});
}

stdHandler("keydown", true);
stdHandler("keyup", false);

export function doShortcut(name:string[], event?:KeyboardEvent, state?:boolean):void {
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
			if(await shortcutReceivers[comkey](comarr, event, state)) {
				// event was accepted, return away
				return;
			}
		}
	})().catch(console.error);
}

// common type used in many functions, for storing state
export type ShortcutState = { button: string, ctrl: boolean, alt: boolean, shift: boolean };

export function processShortcuts(files:{ [key: string]: string|string[]}[], callback:(functionName:string, state:ShortcutState) => void):void {
	files.forEach((file) => {
		// run for each shortcut in the array
		for(const functionName in file) {

			// helper function to add each shortcut. This allows to use both string and string[] for functions.
			const addSingleShortcut = (keyCombo:string) => {
				// convert the button state
				const states = convertShortcutState(keyCombo, functionName);

				// run the callback
				callback(functionName, states);
			}

			if(Array.isArray(file[functionName])) {
				// add multiple shortcut keys from array
				(file[functionName] as string[]).forEach(addSingleShortcut);

			} else {
				// this is a single shortcut key
				addSingleShortcut(file[functionName] as string);
			}
		}
	})
}

/**
 * Helper function to convert a keycombo into separated fields depending on combo type
 *
 * @param keyCombo The input key combo to convert
 * @param name The name of the function to convert
 */
export function convertShortcutState(keyCombo:string, name:string): ShortcutState {
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
		throw new ShortcutError(`Failed to parse function ${name} shortcut ${keyCombo}!`);
	}

	// return the button states as an array
	return { button: button, ctrl: ctrl, alt: alt, shift: shift, };
}

/**
 * Convert shortcut data into canonical name.
 *
 * @param data The button state data. This represents modifier keys and the actual button string
 */
export function makeShortcutString(data:ShortcutState): string {
	// generate an array of modifiers and buttons, joining via +
	const arr = [ data.button, ];

	/* eslint-disable @typescript-eslint/no-unused-expressions */
	data.shift && arr.unshift("SHIFT");
	data.ctrl && arr.unshift("CTRL");
	data.alt && arr.unshift("ALT");
	/* eslint-enable @typescript-eslint/no-unused-expressions */

	// convert this to a string
	return arr.join("+");
}

/**
 * Load the default shortcuts for the program.
 *
 * @throws anything. Invalid files will throw just about any error.
 */
export function loadDefaultShortcuts(type:SettingsTypes): void {
	// load the files we need to inspect
	const files = loadSettingsFiles(type) as { [key: string]: string|string[]}[];

	// process the shortcuts with this fancy new function
	processShortcuts(files, (fn, states) => {
		// get the array name for the "keyMappings" based on modifier keys, and apply the new shortcut function.
		const arrayname = getKeymappingsName(states);
		keyMappings[arrayname][states.button] = fn;

		// check if shortcutstore has this key already. If not, create it
		if(!shortcutStores[fn]) {
			shortcutStores[fn] = [];
		}

		// store the shortcut name
		shortcutStores[fn].push(makeShortcutString(states));
	});
}

/**
 * This is sort of a back up of the shortcuts. This stores them by their name, rather than keys.
 * This can be used by the app to display what shortcuts have which keys. Useful for menus
 */
const shortcutStores:{ [key:string]:string[] } = {};

export function loadShortcutKeys(shortcut:string): string[] {
	return shortcutStores[shortcut] ?? [];
}

