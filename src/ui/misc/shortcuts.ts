import { loadSettingsFiles, SettingsTypes } from "../../api/files";
import { receiveShortcutFunc } from "../../api/ui";
import { getKeyMap, IKeyboardMapping } from "native-keymap";

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
const keyMappings:{ [key:string]:{ [key:string]:string[] }} = {
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

/**
 * Translation table between what key is pressed and what shortcut it is executing.
 * This is needed so that when you hold a button down, your shortcut will be remembered, and no other shortcut, even with modifier keys,
 * can override it. This is also good so that when a new higher priority shortcut may be acceptable, that shortcut will not be executed
 * until the previous one is done being held down.
 */
let activeKeys:{ [key:string]: string } = {};

/*
 * Handle user input, to check for special shortcut keys. This won't override things such as input fields, however.
 */
const stdHandler = (type:"keydown"|"keyup", state:boolean) => {
	document.addEventListener(type, (event) => {
		// fetch the key name
		const _key = event.code.toLowerCase();

		// check if this shortcut is active
		if(activeKeys[_key]) {
			// shortcut is already active, prevent default event and handle event correctly
			event.preventDefault();
			event.stopImmediatePropagation();

			// determine if this shortcut should handle being held down
			const hold = activeKeys[_key].startsWith("*");

			if(state) {
				// ignore the keydown event if the shortcut should be held down, otherwise handle it
				return hold ? undefined : doShortcut([ activeKeys[_key], ], event, undefined);
			}

			// get the key before its deleted
			const kk = activeKeys[_key];

			// delete the key so its inactive
			delete activeKeys[_key];

			// handle keyup for hold keys
			return hold ? doShortcut([ kk, ], event, false) : undefined;

		} else if(!state) {
			// if this is keyup, just ignore
			return;
		}

		// check if this key has a registered command
		const arrayname = getKeymappingsName( { ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, });

		// prepare the commands list
		const comlist:string[] = [];

		// get the keymappings for positional key codes and add them to the list
		(keyMappings[arrayname][_key] ?? []).forEach((c) => comlist.push(c));

		// if nothing found, return
		if(comlist.length === 0) {
			return;
		}

		// check all shortcuts
		doShortcut(comlist, event, true).then((rs) => {
			if(rs){
				// found a shortcut, now save it and prevent defaults
				activeKeys[_key] = rs;
			}
		}).catch(console.error);
	});
}

stdHandler("keydown", true);
stdHandler("keyup", false);

// add handler for panicking when the window loses focus
window.addEventListener("blur", () => {
	// copy the active keys array and reset the old one
	const store = activeKeys;
	activeKeys = {};

	// loop through each shortcut that was active
	for(const sc of Object.values(store)) {
		if(sc.startsWith("*")){
			// do the keyup version of the event for each
			doShortcut([ sc, ], undefined, false).catch(console.error);
		}
	}
});

/**
 * Helper function to sort the shortcut names based on their apparent priority
 *
 * @param name The shortcut names list
 * @returns The same list, but sorted
 */
function shortcutSort(name:string[]) {
	// create the priority sorted array
	const sort = name.map((n) => { return { name: n, priority: window.shortcutPriority(n.split(".")), }});

	// sort the actual array and return the names by themselves
	return sort.sort((a, b) => a.priority - b.priority).map((n) => n.name);
}

/**
 * Execute shortcuts from an array of possible shortcuts. This will only execute the first accepted shortcut.
 *
 * @param name The list of shortcuts to execute
 * @param event The KeyboardEvent related to this shortcut, if one exists
 * @param state The state of the key that handles the event. This can be true or false for keydown or keyup, or undefined in some cases
 * @returns The shortcut that was executed, or `undefined` if no shortcut was
 */
export async function doShortcut(name:string[], event?:KeyboardEvent, state?:boolean):Promise<undefined|string> {
	// if loading currently, disable all shortcuts
	if(window.isLoading && state !== false) {
		return;
	}

	// do each shortcut separately
	for(const com of shortcutSort(name)) {
		// split into an array based on dots and get the first element of the array
		const comarr = (com.startsWith("*") ? com.substring(1) : com).toLowerCase().split(".");
		const comkey = comarr.shift() ?? "<null>";

		// check if there is a shortcut function defined here
		if(!shortcutReceivers[comkey]){
			// there is not, log it. TODO: handle this better.
			console.error(`Shortcut key ${comkey} does not exist. Ignoring...`);
			return;
		}

		// prevent event from firing, if one was to exist
		event?.preventDefault();
		event?.stopImmediatePropagation();

		// the function exists, execute it with the current event.
		if(await shortcutReceivers[comkey](comarr, event, state)) {
			// event was accepted, return away
			return com;
		}
	}
}

// common type used in many functions, for storing state
export type ShortcutState = { button: string, ctrl: boolean, alt: boolean, shift: boolean };

/**
 * Function to list all defined shortcuts, allowing the caller to handle it the way they want
 *
 * @param files The list of file contents that should be examined
 * @param callback The callback function whenever a shortcut is detected
 */
export function processShortcuts(files:{ [key: string]: string|string[]}[], callback:(functionName:string, state:ShortcutState) => void):void {
	const merged:{ [key: string]: string|string[]} = {};

	// merge multiple files into 1, dismissing duplicate shortcut definitions
	files.forEach((file) => {
		// run for each shortcut in the array
		for(const functionName in file) {
			merged[functionName] = file[functionName];
		}
	});

	// run for each shortcut in the array
	for(const functionName in merged) {
		// helper function to add each shortcut. This allows to use both string and string[] for functions.
		const addSingleShortcut = (keyCombo:string) => {
			// convert the button state
			const states = convertShortcutState(keyCombo, functionName);

			if(states) {
				// run the callback
				callback(functionName, states);
			}
		}

		if(Array.isArray(merged[functionName])) {
			// add multiple shortcut keys from array
			(merged[functionName] as string[]).forEach(addSingleShortcut);

		} else {
			// this is a single shortcut key
			addSingleShortcut(merged[functionName] as string);
		}
	}
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
	data.shift && arr.unshift("shift");
	data.ctrl && arr.unshift("ctrl");
	data.alt && arr.unshift("alt");
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
	_keymap = getKeyMap();

	// load the files we need to inspect
	const files = loadSettingsFiles(type) as { [key: string]: string|string[]}[];

	// process the shortcuts with this fancy new function
	processShortcuts(files, (fn, states) => {
		// get the array name for the "keyMappings" based on modifier keys, and apply the new shortcut function.
		const arrayname = getKeymappingsName(states);
		const button = states.button.toLowerCase();

		if(!keyMappings[arrayname][button]){
			keyMappings[arrayname][button] = [ fn, ];

		} else if(!keyMappings[arrayname][button].includes(fn)){
			keyMappings[arrayname][button].push(fn);
		}

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

/**
 * Helper function to convert a keyboard shortcut into modifier keys and keycode
 *
 * @param keyCombo The input key combo to convert
 * @param name The name of the function to convert
 */
export function convertShortcutState(keyCombo:string, name:string): ShortcutState|null {
	let ctrl = false, alt = false, shift = false, button:string = keyCombo.toLowerCase();

	// check if modifier keys are applied
	while(true) {
		if(!ctrl && button.startsWith("ctrl+")) {
			// ctrl detected, enable ctrl mode
			ctrl = true;
			button = button.substring(5);

		} else if(!shift && button.startsWith("shift+")) {
			// shift detected, enable shift mode
			shift = true;
			button = button.substring(6);

		} else if(!alt && button.startsWith("alt+")) {
			// alt detected, enable alt mode
			alt = true;
			button = button.substring(4);

		} else {
			// nothing more detected, convert button and break out
			button = button.length === 0 ? "" : convertKey(button);
			break;
		}
	}

	// make sure "button" is not empty. If it is, throw an error.
	if(button.length === 0) {
		console.error(`Failed to parse function ${name} shortcut ${keyCombo}. Ignoring...`);
		return null;
	}

	// return the button states as an array
	return { button: button, ctrl: ctrl, alt: alt, shift: shift, };
}

/**
 * Helper function to take the key text and convert it to key code
 *
 * @param key The key name to convert to key code
 * @returns The real world key code that is represented by this key
 */
export function convertKey(key:string): string {
	let res = scanKey(key.toLowerCase(), [ "value", "withShift", ]);
	/* eslint-disable @typescript-eslint/no-unused-expressions */
	!res && (res = scanKey(key.toLowerCase(), [ "withAltGr", ]));
	!res && (res = scanKey(key.toLowerCase(), [ "withShiftAltGr", ]));
	/* eslint-enable @typescript-eslint/no-unused-expressions */

	// return the key itself if failed
	return res ?? findKey(key) ?? "";
}

let _keymap:IKeyboardMapping;

/**
 * Helper function to scan the entire keymap to determine if this key matches anything
 */
function scanKey(key:string, mode:("value"|"withShift"|"withAltGr"|"withShiftAltGr")[]) {
	for(const k of Object.keys(_keymap)) {
		for(const m of mode) {
			// check if this key in this mode is the same as inputted key
			if(_keymap[k][m].toLowerCase() === key) {
				return k;
			}
		}
	}

	// return null if nothing found
	return null;
}

/**
 * Helper function to scan the entire keymap for the key with the same name
 */
function findKey(key:string) {
	for(const k of Object.keys(_keymap)) {
		// if the key of the keymap and shortcut are the same. If so, return the keymap key
		if(k.toLowerCase() === key) {
			return k;
		}
	}

	return null;
}
