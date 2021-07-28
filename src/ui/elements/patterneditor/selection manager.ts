import { Bounds, Position } from "../../../api/ui";
import { theme } from "../../misc/theme";
import { PatternEditor } from "./main";

type SingleSelection = {
	/**
	 * The channel index that is selected
	 */
	channel: number,
	/**
	 * The channel element that is selected
	 */
	element: number,
	/**
	 * The pattern that is selected
	 */
	pattern: number,
	/**
	 * The row in a pattern that is selected
	 */
	row: number,
};

type MultiSelection = [ SingleSelection, SingleSelection, ];

export class PatternEditorSelectionManager {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;
	}

	/**
	 * The currently active selections
	 */
	public single!: SingleSelection;
	public multi!: MultiSelection|null;

	/**
	 * Preview of the selection that will be applied when the mouse cursor is released
	 */
	public preview!: MultiSelection|null;

	/**
	 * Function to run once the parent initializes
	 */
	public init(): void {
		// initialize the selections to default values
		this.parent.scrollwrapper.addEventListener("pointermove", (e) => this.pointerMove( { x: e.offsetX, y: e.offsetY, }));
		this.parent.scrollwrapper.addEventListener("pointerleave", () => this.pointerLeave());
		this.parent.scrollwrapper.addEventListener("pointerenter", (e) => this.pointerEnter(e));
		this.parent.scrollwrapper.addEventListener("pointerdown", (e) => this.pointerDown(e));
		this.parent.scrollwrapper.addEventListener("pointerup", (e) => this.pointerUp(e));
	}

	/**
	 * Function to run once the parent loads
	 */
	public load(): void {
		// initialize the selections to default values
		this.multi = null;
		this.single = { channel: 0, element: 0, pattern: 0, row: 0, };
	}

	/**
	 * The number of pixels for the height of each row element
	 */
	public rowHeight = 25;

	/**
	 * The selection widths for each element
	 */
	public selectionWidths!:number[];

	/**
	 * The selection offsets for each element
	 */
	private selectionOffsets!:number[];

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public reloadTheme(): void {
		// load some variables
		this.rowHeight = theme?.pattern?.worker?.params?.rowHeight ?? 25;
		this.selectionWidths = theme?.pattern?.worker?.selwidths ?? [];
		this.selectionOffsets = theme?.pattern?.worker?.seloffsets ?? [];
	}

	/**
	 * Function that is ran when any vertical or horizontal scrolling is applied to the parent
	 */
	public scroll(): void {
		// force cursor position to update
		this.pointerMove(this.lastCursor);
	}

	/**
	 * Function to handling mouse button being pressed
	 */
	private pointerDown(e:PointerEvent) {
		// MUST be right click!
		if(e.button !== 0) {
			return;
		}

		// initiate the preview selection
		const sel = this.findElementAt(this.getAbsolutePointer({ x: e.offsetX, y: e.offsetY, }));

		// check if the selection is valid
		if(this.isSelectionValid(sel)) {
			this.preview = [ sel, sel, ];

			// give the hold class to the cursor
			this.parent.cursor.classList.add("hold");

			// clear multiselection
			this.clearMultiSelection();
		}
	}

	/**
	 * Function to handling mouse button being released
	 */
	private pointerUp(e:PointerEvent) {
		// MUST be right click!
		if((e.buttons & 1) === 0) {
			this.preview = null;

			// take the hold class from the cursor
			this.parent.cursor.classList.remove("hold");
		}
	}

	/**
	 * Function to track the mouse cursor entering the element
	 */
	private pointerEnter(e:PointerEvent) {
		this.cursorInBounds = true;

		if(this.preview && (e.buttons & 1) === 0) {
			// right click was released outside of the window, run the pointerUp handler
			this.pointerUp(e);
		}
	}

	/**
	 * Boolean indicating if the cursor is in bounds of the parent
	 */
	private cursorInBounds = true;

	/**
	 * Function to track the mouse cursor leaving the element
	 */
	private pointerLeave() {
		// set cursor out of bounds
		this.cursorInBounds = false;

		if(!this.preview) {
			// if not selecting with the cursor, then hide the cursor
			this.setBounds(new Bounds(-10000, -10000), this.parent.cursor);
		}
	}

	/**
	 * The last cursor position
	 */
	private lastCursor:Position = { x: -10000, y: -10000, };

	/**
	 * Function to track the mouse cursor to show the mouse highlighter
	 */
	private pointerMove(cursor:Position) {
		// ignore the cursor when out of bounds when not selecting
		if(!this.preview && !this.cursorInBounds) {
			return;
		}

		this.lastCursor = cursor;

		// find the currently targeted element
		const r = this.findElementAt(this.getAbsolutePointer(cursor));

		if(this.preview) {
			// apply multi-selection instead
			this.preview[1] = this.clampSelection(r, this.preview[0].pattern);

			// find the on-screen position for the cursor
			const b = this.getMultiBounds(this.preview);

			// update the bounds for the cursor
			this.setBounds(b, this.parent.cursor);

			// update the z-index
			this.parent.cursor.style.zIndex = "24";

		} else {
			// apply single-selection
			const b = cursor.x < 35 ? this.getRowNumberBounds(r) : this.getElementBounds(r);

			// update the bounds for the cursor
			this.setBounds(b, this.parent.cursor);

			// update the z-index
			this.parent.cursor.style.zIndex = cursor.x < 35 ? "31" : "24";
		}
	}

	/**
	 * Function to convert screen position into absolute position in the pattern editor space.
	 *
	 * @param cursor The input position in screen coordinates
	 * @returns The output position in absolute coordinates
	 */
	private getAbsolutePointer(cursor:Position): Position {
		return {
			x: cursor.x - 35 + this.parent.scrollManager.horizScroll,
			y: cursor.y - this.parent.scrollManager.scrollMiddle + ((this.parent.scrollManager.currentRow) * this.rowHeight),
		}
	}

	/**
	 * Helper function to check if a selection is valid
	 *
	 * @param data The selection data to inspect
	 * @returns Boolean indicating if this selection is valid
	 */
	private isSelectionValid(data:SingleSelection): boolean {
		// check if pattern is valid
		if(data.pattern < 0 || data.pattern >= this.parent.tab.matrix.matrixlen) {
			return false;
		}

		// check if channel is valid
		if(data.channel < 0 || data.channel >= this.parent.tab.channels.length) {
			return false;
		}

		return true;
	}

	/**
	 * Function to clamp the selection to be valid and within bounds. This will be used for things like multi-selection.
	 *
	 * @param data The selection to inspect and modify
	 * @param pattern The pattern to clamp to
	 * @returns The modified selection object that is clamped
	 */
	private clampSelection(data:SingleSelection, pattern:number): SingleSelection {
		// ensure that the selection is capped to the same pattern
		if(data.pattern > pattern) {
			data.pattern = pattern;
			data.row = this.parent.patternLen - 1;

		} else if(data.pattern < pattern) {
			data.pattern = pattern;
			data.row = 0;
		}

		// cap the channel properly
		if(data.channel < 0) {
			data.channel = 0;
			data.element = 0;

		} else if(data.channel >= this.parent.tab.channels.length){
			data.channel = this.parent.tab.channels.length - 1;
			data.element = 0;
		}

		// return the mutated object
		return data;
	}

	/**
	 * Function to find the element at these absolute coordinates
	 *
	 * @param x The x-position to fetch the element from
	 * @param y The y-position to fetch the element from
	 */
	private findElementAt(point:Position): SingleSelection {
		// calculate the pattern and rows
		const row = Math.floor(point.y / this.rowHeight);
		const pattern = Math.floor(row / this.parent.patternLen);
		const rip = ((row + this.parent.patternLen) % this.parent.patternLen);

		// calculate the channel
		let channel = -1, xoff = 0;

		if(point.x >= 0) {
			// loop for each channel, finding the correct channel
			for(;channel < this.parent.tab.channels.length;channel ++) {
				// special check for last channel
				if(channel === this.parent.tab.channels.length - 1) {
					if(this.parent.channelInfo[channel].right + 4 > point.x) {
						// store the x-offset within the channel
						xoff = point.x - this.parent.channelInfo[channel].left;
						break;
					}

					// check if the channel is too far to the right, and if so, we found the channel
				} else if(this.parent.channelInfo[channel + 1].left > point.x){
					// store the x-offset within the channel
					xoff = point.x - this.parent.channelInfo[channel].left;
					break;
				}
			}
		}

		// calculate the element of the channel
		let element = 0;

		if(channel >= 0 && channel < this.parent.tab.channels.length) {
			// valid channel, calculate the element
			for(;element + 1 < this.parent.channelInfo[channel].offsets.length;element++) {
				// check if the next element is too far right
				if(this.parent.channelInfo[channel].offsets[element + 1] > xoff) {
					break;
				}
			}
		}

		// return all this fancy info
		return { pattern, row: rip, channel, element, };
	}

	/**
	 * Function to get the element bounds on-screen
	 */
	private getElementBounds(data:SingleSelection): Bounds {
		if(!this.isSelectionValid(data)) {
			// invalid channel or pattern
			return new Bounds(-10000, -10000);
		}

		// calculate the real element ID
		const element = this.parent.channelInfo[data.channel].elements[data.element];

		// normal bounds
		return new Bounds(this.getElementLeft(data, element), this.getElementTop(data), this.selectionWidths[element], this.rowHeight);
	}

	/**
	 * Function to calculate the left of the element
	 *
	 * @param data The selection to use for calculations
	 * @param element The calculated element ID
	 * @returns The screen position for the left of the element
	 */
	private getElementLeft(data:SingleSelection, element:number) : number {
		const base = this.parent.channelInfo[data.channel].left + this.parent.channelInfo[data.channel].offsets[data.element];
		return base + this.selectionOffsets[element] - this.parent.scrollManager.horizScroll + 35;
	}

	/**
	 * Function to calculate the top of the element
	 *
	 * @param data The selection to use for calculations
	 * @returns The screen position for the top of the element
	 */
	private getElementTop(data:SingleSelection) : number {
		const row = ((data.pattern * this.parent.patternLen) + data.row) - this.parent.scrollManager.currentRow;
		return (row * this.rowHeight) + this.parent.scrollManager.scrollMiddle;
	}

	/**
	 * Function to get the multi-bounds area by arranging the 4 corners in an order and calculating it
	 *
	 * @param data The multi-selection to base this bounds object on
	 * @returns The bounds object that encompasses the entire area
	 */
	private getMultiBounds(data:MultiSelection): Bounds {
		const b = new Bounds();

		// calculate orientation
		const tp = ((data[0].pattern === data[1].pattern) ? (data[0].row < data[1].row) : (data[0].pattern < data[1].pattern)) ? 0 : 1;
		const tl = ((data[0].channel === data[1].channel) ? (data[0].element < data[1].element) : (data[0].channel < data[1].channel)) ? 0 : 1;

		// calculate the real element ID's
		const element = [
			this.parent.channelInfo[data[tl].channel].elements[data[tl].element],
			this.parent.channelInfo[data[1-tl].channel].elements[data[1-tl].element],
		];

		// calculate the positions
		b.y = this.getElementTop(data[tp]);
		b.x = this.getElementLeft(data[tl], element[0]);
		b.height = this.getElementTop(data[1-tp]) + this.rowHeight - b.y;
		b.width = this.getElementLeft(data[1-tl], element[1]) + this.selectionWidths[element[1]] - b.x;

		// return the bounds now
		return b;
	}

	/**
	 * Function to get the row number bounds on-screen
	 */
	private getRowNumberBounds(data:SingleSelection): Bounds {
		if(data.pattern < 0 || data.pattern >= this.parent.tab.matrix.matrixlen) {
			// invalid pattern
			return new Bounds(-10000, -10000);
		}

		// row bounds
		return new Bounds(
			// eslint-disable-next-line
			0, ((((data.pattern * this.parent.patternLen) + data.row) - this.parent.scrollManager.currentRow) * this.rowHeight) + this.parent.scrollManager.scrollMiddle,
			31, this.rowHeight
		);
	}

	/**
	 * Update the boundaries of a single HTML element
	 */
	private setBounds(b:Bounds, e:HTMLElement) {
		e.style.top = b.top +"px";
		e.style.left = b.left +"px";
		e.style.width = b.width +"px";
		e.style.height = b.height +"px";
	}

	/**
	 * Helper function to clear the multi selection object
	 */
	private clearMultiSelection() {
		// clear selection
		this.multi = null;

		// set the object itself far away and height to 0
		this.parent.multiSelection.style.top = "-10000px";
		this.parent.multiSelection.style.height = "0px";
	}
}
