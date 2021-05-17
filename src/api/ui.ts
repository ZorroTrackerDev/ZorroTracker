/**
 * A common UI type for positional data
 */
export type Position = { x:number, y:number };

/**
 * A common interface for handling UI shortcuts for this element. This helps make development easier
 */
export type receiveShortcutFunc = (data:string[], event:KeyboardEvent) => boolean;

export interface UIShortcutHandler {
	receiveShortcut: receiveShortcutFunc;
}

/**
 * Function to convert direction string to x/y deltas.
 *
 * @param direction The direction string to convert
 * @returns object representing the movement direction
 */
export function shortcutDirection(direction:string|undefined): undefined|Position {
	switch((direction ?? "").toLowerCase()) {
		case "up":		return { x: 0, y: -1, };
		case "down":	return { x: 0, y: 1, };
		case "left":	return { x: -1, y: 0, };
		case "right":	return { x: 1, y: 0, };
	}

	// invalid string: no movement
	return undefined;
}

/**
 * A common interface for handling various UI elements in ZorroTracker. This helps make development easier
 */
export interface UIElement extends UIShortcutHandler {
	element:HTMLElement;
}