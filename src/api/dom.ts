import { loadShortcutKeys } from "../ui/misc/shortcuts";

let _uniqueID = 0;

/**
 * Function to give an element an unique identifier, to facilitate proper labelling
 *
 * @returns An unique DOM element ID
 */
export function getUniqueID(): string {
	return "u-"+ (_uniqueID++);
}

/**
 * Helper function to generate standard form tooltip text for shortcuts
 *
 * @param text The text above the shortcut
 * @param shortcut The shortcut to load
 */
export function tooltipShortcutText(text:string|undefined, shortcut:string|undefined): string {
	// load the shortcut keys
	const sc = shortcut ? loadShortcutKeys(shortcut)[0] : undefined;

	// create an array of valid elements
	const tt = [ text, sc ? "Shortcut: "+ sc : undefined, ].filter((t) => t !== undefined);

	// return the final shortcut text
	return tt.join("\n");
}
