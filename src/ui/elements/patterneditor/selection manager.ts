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

type MultiSelection = {
	/**
	 * The channel indides that are selected
	 */
	channel: [ number, number, ],
	/**
	 * The channel elements that are selected
	 */
	element: [ number, number, ],
	/**
	 * The patterns that are selected
	 */
	pattern: [ number, number, ],
	/**
	 * The rows in a pattern that are selected
	 */
	row: [ number, number, ],
};

export class PatternEditorSelectionManager {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;
	}

	/**
	 * The currently active selections
	 */
	public single!: SingleSelection;
	public multi! :MultiSelection|null;

	/**
	 * Function to run once the parent initializes
	 */
	public init(): void {
		// initialize the selections to default values
		this.parent.scrollwrapper.addEventListener("pointermove", (e) => this.pointerMove( { x: e.offsetX, y: e.offsetY, }));
		this.parent.scrollwrapper.addEventListener("pointerleave", () => this.pointerLeave());
		this.parent.scrollwrapper.addEventListener("pointerenter", () => this.pointerEnter());
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
	 * Boolean indicating if the cursor is in bounds of the parent
	 */
	private cursorInBounds = true;

	/**
	 * Function to track the mouse cursor leaving the element
	 */
	private pointerLeave() {
		// set cursor out of bounds and position the cursor element
		this.cursorInBounds = false;
		this.setBounds(new Bounds(-10000, -10000), this.parent.cursor);
	}

	/**
	 * Function to track the mouse cursor entering the element
	 */
	private pointerEnter() {
		this.cursorInBounds = true;
	}

	/**
	 * The last cursor position
	 */
	private lastCursor:Position = { x: -10000, y: -10000, };

	/**
	 * Function to track the mouse cursor to show the mouse highlighter
	 */
	private pointerMove(cursor:Position) {
		// ignore the cursor when out of bounds
		if(!this.cursorInBounds) {
			return;
		}

		this.lastCursor = cursor;

		// find the currently targeted element
		const r = this.findElementAt(cursor.x - 35 + this.parent.scrollManager.horizScroll,
			cursor.y - this.parent.scrollManager.scrollMiddle + ((this.parent.scrollManager.currentRow) * this.rowHeight));

		// find the on-screen position for the cursor
		const b = cursor.x < 35 ? this.getRowNumberBounds(r) : this.getElementBounds(r);

		// update the bounds for the cursor
		this.setBounds(b, this.parent.cursor);

		// update the z-index
		this.parent.cursor.style.zIndex = cursor.x < 35 ? "31" : "24";
	}

	/**
	 * Function to find the element at these absolute coordinates
	 *
	 * @param x The x-position to fetch the element from
	 * @param y The y-position to fetch the element from
	 */
	private findElementAt(x:number, y:number): SingleSelection {
		// calculate the pattern and rows
		const row = Math.floor(y / this.rowHeight);
		const pattern = Math.floor(row / this.parent.patternLen);
		const rip = ((row + this.parent.patternLen) % this.parent.patternLen);

		// calculate the channel
		let channel = -1, xoff = 0;

		if(x >= 0) {
			// loop for each channel, finding the correct channel
			for(;channel + 1 < this.parent.tab.channels.length;channel ++) {
				// check if the channel is too far to the right, and if so, we found the channel
				if(this.parent.channelInfo[channel + 1].left > x){
					// store the x-offset within the channel
					xoff = x - this.parent.channelInfo[channel].left;
					break;
				}
			}

			// check if outside of the bounds of this channel too
			if(this.parent.channelInfo[channel].right + 4 < x){
				// if yes, channel will be invalid once again
				channel++;
			}
		}

		// calculate the element of the channel
		let element = 0;

		if(channel >= 0 && channel < this.parent.tab.channels.length - 1) {
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
		if(data.pattern < 0 || data.pattern >= this.parent.tab.matrix.matrixlen
			|| data.channel < 0 || data.channel >= this.parent.tab.channels.length) {
			// invalid channel or pattern
			return new Bounds(-10000, -10000);
		}

		// calculate the real element ID
		const element = this.parent.channelInfo[data.channel].elements[data.element];

		// normal bounds
		return new Bounds(
			// eslint-disable-next-line
			this.parent.channelInfo[data.channel].left + this.parent.channelInfo[data.channel].offsets[data.element] + this.selectionOffsets[element] - this.parent.scrollManager.horizScroll + 35,
			// eslint-disable-next-line
			((((data.pattern * this.parent.patternLen) + data.row) - this.parent.scrollManager.currentRow) * this.rowHeight) + this.parent.scrollManager.scrollMiddle,
			this.selectionWidths[element],
			this.rowHeight
		);
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
}
