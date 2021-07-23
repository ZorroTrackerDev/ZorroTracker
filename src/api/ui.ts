import electron from "electron/main";
import { Tab } from "../ui/misc/tab";
import { ZorroEvent, ZorroEventEnum } from "./events";

/**
 * A common UI type for positional data
 */
export type Position = { x:number, y:number };

/**
 * A common UI type for rectangular data
 */
 export type Rectangle = electron.Rectangle;

/**
 * A common UI type for bounds data
 */
export class Bounds {
	// the X-position of this object
	public x:number;
	// the Y-position of this object
	public y:number;
	// the width of this object
	public width:number;
	// the height of this object
	public height:number;

	// the left position of this object
	public get left():number {
		return this.x;
	}

	// the right position of this object
	public get right():number {
		return this.x + this.width - 1;
	}

	// the top position of this object
	public get top():number {
		return this.y;
	}

	// the bottom position of this object
	public get bottom():number {
		return this.y + this.height - 1;
	}

	/**
	 * Create a Bounds object from numeric positions
	 *
	 * @param x x/left position of the bounds
	 * @param y y/top position of the bounds
	 * @param w width of the bounds
	 * @param h height of the bounds
	 */
	constructor(x?:number, y?:number, w?:number, h?:number){
		this.x = x ?? 0;
		this.y = y ?? 0;
		this.width = w ?? 0;
		this.height = h ?? 0;
	}

	/**
	 * Clone a Bounds object.
	 *
	 * @returns A clone of the Bounds object
	 */
	public clone():Bounds {
		return new Bounds(this.x, this.y, this.width, this.height);
	}

	/**
	 * Create a Bounds object from rectangle object
	 *
	 * @param rectangle The Rectangle object that represents a Bounds object
	 */
	public static fromRectangle(rectangle:Rectangle): Bounds {
		return new Bounds(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
	}

	/**
	 * Create a Bounds object from rectangle object
	 *
	 * @param position The Position object that represents the position of the Bounds object
	 * @param size The Position object that represents the size of the Bounds object
	 */
	public static fromPosition(position?:Position, size?:Position): Bounds {
		return new Bounds(position?.x, position?.y, size?.x, size?.y);
	}

	/**
	 * Function to get the position of this object
	 *
	 * @param edge If defined, represents the edge to get. Bit 0 = top/bottom, bit 1 = left/right
	 * @returns The Position object that represents the position
	 */
	public getPosition(edge?:number):Position {
		const e = edge ?? 0;

		// return the values
		return {
			x: (e & 2) === 0 ? this.x : this.right,
			y: (e & 1) === 0 ? this.y : this.bottom,
		};
	}

	/**
	 * Function to get the size of this object
	 *
	 * @returns The Position object that represents the size
	 */
	public getSize():Position {
		return { x: this.x, y: this.y, };
	}

	/**
	 * Function to get a Retangle representing this object
	 *
	 * @returns The Rectangle object that represents this object
	 */
	public getRectangle():Rectangle {
		return { x: this.x, y: this.y, width: this.width, height: this.height, };
	}
}

/**
 * A common interface for handling UI shortcuts for this element. This helps make development easier
 *
 * @param data The array of shortcut function names that was triggered
 * @param event The target KeyboardEvent object for this shortcut
 * @param state The shortcut state. For normal shortcuts, this is `undefined`. For special shortcuts, `true` = keydown, `false` = keyup
 * @returns Boolean indicating whether shortcut was processed or not
 */
export type receiveShortcutFunc = (data:string[], event:KeyboardEvent|undefined, state:boolean|undefined) => Promise<boolean>;

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

/**
 * An interface for UI components that have some basic shared functions to facilitate UI loading in steps
 */
export interface UIComponent<T> {
	/**
	 * The main HTML element for this component
	 */
	element: T;

	/**
	 * The tab that this component is apart of
	 */
	tab: Tab,

	/**
	 * Simple function for initializing this component. This function *must* be possible to ran out of order! Also, must NOT use the `tab` property
	 */
	init: () => T|Promise<T>;

	/**
	 * The function that handles loading this component. This function *must* be possible to be ran out of order. Instead, it
	 * should use the current pass to decide whether it can load. Previous passes can then load anything that this component depends on.
	 *
	 * @param pass This is the current pass number. In theory, there is no limit to this
	 * @returns Boolean indicating whether the component requires another pass to load fully
	 */
	load: (pass:number) => boolean|Promise<boolean>;

	/**
	 * The function that handles unloading this component. This function *must* be possible to be ran out of order. Instead, it
	 * should use the current pass to decide whether it can unload. Previous passes can then unload anything that this component depends on.
	 *
	 * @param pass This is the current pass number. In theory, there is no limit to this
	 * @returns Boolean indicating whether the component requires another pass to unload fully
	 */
	unload: (pass:number) => boolean|Promise<boolean>;
}

/**
 * Helper class to deal with UI components
 */
export class UIComponentStore<T extends UIComponent<HTMLElement>> {
	/**
	 * Stored components for this class
	 */
	public components: { [key:string]: T };

	/**
	 * Initialize this component store
	 */
	constructor() {
		this.components = {};
	}

	/**
	 * Function to get a specific component from stored components, cast to a specific type.
	 * Warning: **This is an unsafe cast, use at your own risk!**
	 *
	 * @param name The name of the component to fetch
	 * @returns `undefined` or the component requested, cast to `Y`
	 */
	public get<Y>(name:string): Y|undefined {
		return this.components[name] as unknown as Y|undefined;
	}

	/**
	 * Function to add a component to this component store
	 *
	 * @param component The component to add to this store
	 * @returns The element of the component
	 */
	public addComponent<Y extends HTMLElement>(name:string, component:T): Y|Promise<Y> {
		this.components[name] = component;

		// initialize the component and return the element for it
		return component.init() as Y|Promise<Y>;
	}

	/**
	 * Function to tell all components to load. This will make sure all components will load at their own preferred way
	 *
	 * @param maxpass The maximum number of passes until an error will be thrown
	 * @returns A promise that resolves once all the functions are completed
	 */
	public loadComponents(maxpass:number): Promise<void> {
		return this.handleComponentFunc(maxpass, "load");
	}

	/**
	 * Function to tell all components to unload. This will make sure all components will unload at their own preferred way
	 *
	 * @param maxpass The maximum number of passes until an error will be thrown
	 * @returns A promise that resolves once all the functions are completed
	 */
	public unloadComponents(maxpass:number): Promise<void> {
		return this.handleComponentFunc(maxpass, "unload");
	}

	/**
	 * Function to tell all components to use a different tab internally. This should not directly lead to any side-effects.
	 *
	 * @param tab The tab to use for this function
	 */
	public setComponentTab(tab:Tab): void {
		Object.values(this.components).forEach((c) => c.tab = tab);
	}

	/**
	 * Helper function to actually execute the function calls and passes. This code handles all the hard work,
	 * having the same algorithm for multiple similar functions.
	 *
	 * @param maxpass The maximum number of passes until an error will be thrown
	 * @param func The name of the function to call
	 * @returns A promise that resolves once all the functions are completed
	 */
	private async handleComponentFunc(maxpass:number, func:"load"|"unload"): Promise<void> {
		let pass = -1;

		// eslint-disable-next-line no-constant-condition
		while(true) {
			// increase the pass counter and make sure it doesnt go too high!
			if(++pass > maxpass) {
				throw new Error("Maximum UI load pass reached! This is an internal bug, please report to developers!");
			}

			// run each component update function
			const _p = pass;
			const promises = Object.values(this.components).map((c) => c[func](_p));

			// await all the promises and see if any boolean was `true`
			const result = (await Promise.all(promises)).reduce((a, b) => a || b, false);

			// if all were false, bail out
			if(!result) {
				return;
			}
		}
	}
}

/**
 * Functions for handling clipboard
 */
export const clipboard = {
	/**
	 * Function to read from the clipboard
	 *
	 * @param type The type of the clipboard event we are using
	 * @returns The value in the clipboard currently, or `null` if the event was cancelled
	 */
	get: async (type:ClipboardType):Promise<string|null> => {
		// run the clipboard get event
		const _e = await _clipboardGet(type);

		// if it was cancelled, just return
		if(_e.event.canceled){
			return null;
		}

		// read clipboard or use the return value
		return _e.value ?? navigator.clipboard.readText();
	},

	/**
	 * Function to read from the clipboard
	 *
	 * @param type The type of the clipboard event we are using
	 * @param value The value to set the clipboard to
	 * @returns Boolean indicating whether the event was cancelled or not
	 */
	set: async (type:ClipboardType, value:string):Promise<boolean> => {
		// run the clipboard set event
		const _e = await _clipboardSet(type, value);

		// if it was cancelled, just return
		if(_e.event.canceled){
			return false;
		}

		// write to clipboard and return
		await navigator.clipboard.writeText(_e.value ?? value);
		return true;
	},
}

/**
 * Differnt types of clipboard data events, used so that event listeners can listen to specific clipboard events.
 */
export enum ClipboardType {
	Matrix,
}

// generate event emitters for clipboard events
const _clipboardGet = ZorroEvent.createEvent(ZorroEventEnum.ClipboardGet);
const _clipboardSet = ZorroEvent.createEvent(ZorroEventEnum.ClipboardSet);
