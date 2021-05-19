import electron from "electron/main";

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
 */
export type receiveShortcutFunc = (data:string[], event:KeyboardEvent) => Promise<boolean>;

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