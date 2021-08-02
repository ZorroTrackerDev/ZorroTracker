import { loadFlag } from "../../../api/files";
import { Bounds, getMouseInElement, Position } from "../../../api/ui";
import { theme } from "../../misc/theme";
import { PatternEditor } from "./main";

export type SingleSelection = {
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

export type MultiSelection = [ SingleSelection, SingleSelection, ];

export class PatternEditorSelectionManager {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;

		// initialize some flags
		this.edgeScrollDelay = loadFlag<number>("EDGE_SCROLL_DELAY") ?? 800;
		this.doEdgeScrolling = loadFlag<boolean>("EDGE_SCROLL_ENABLED") ?? true;
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
		this.parent.scrollwrapper.onpointerleave = () => this.pointerLeave();
		this.parent.scrollwrapper.onpointerenter = (e) => this.pointerEnter(e);
		this.parent.scrollwrapper.onpointerdown = (e) => this.pointerDown(e);
		this.disableWindowListeners();
	}

	/**
	 * Function to run once the parent loads
	 */
	public async load(): Promise<void> {
		// initialize the selections to default values
		this.multi = null;
		this.single = { channel: 0, element: 0, pattern: 0, row: 0, };

		// set the number of values
		this.parent.horizontalBar.setValues(this.getTotalElements());

		// set the selected tab channel
		await this.parent.tab.setSelectedChannel(this.single.channel);
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
	 * Function that is ran when the elements require rendering
	 */
	public render(): void {
		// force cursor position to update
		this.pointerMove(this.lastCursor);

		if(this.single) {
			// fix single selection position
			const bs = this.getElementBounds(this.single);
			this.setBounds(bs, this.parent.singleSelection);

			// update scrollbars too
			this.parent.horizontalBar.setPosition(this.getSingleElement());
			this.parent.verticalBar.setPosition(this.single.row);
		}

		if(this.multi) {
			// fix multi selection position
			const bm = this.getMultiBounds(this.multi);
			this.setBounds(bm, this.parent.multiSelection);
		}
	}

	/**
	 * If true, the row number is being held down
	 */
	private rowHold = false;

	/**
	 * Function to handling mouse button being pressed
	 */
	private pointerDown(e:PointerEvent) {
		// MUST be right click!
		if(e.button !== 0 || e.target !== e.currentTarget) {
			return;
		}

		// initiate the preview selection
		const sel = this.findElementAt(this.getAbsolutePointer({ x: e.offsetX, y: e.offsetY, }));

		// check if the selection is valid
		if(this.isSelectionValid(sel)) {
			// if holding shift, do some special checking
			if(e.shiftKey) {
				// check if single selection and new selection pattern is the same
				if(this.single.pattern !== sel.pattern) {
					// if not same, just clear multiselection
					return this.clearMultiSelection();
				}

				// extend selection
				this.preview = [ { ...this.single, }, sel, ];

			} else {
				// regular selection
				this.preview = [ { ...sel, }, sel, ];
			}

			// give the hold class to the cursor
			this.parent.cursor.classList.add("hold");

			// clear multiselection
			this.clearMultiSelection();

			// enable window-wide listeners as opposed to just element wide
			this.enableWindowListeners();

			// find the on-screen position for the cursor
			const b = this.getMultiBounds(this.preview);

			// update the bounds for the cursor
			this.setBounds(b, this.parent.cursor);

			// update the z-index
			this.parent.cursor.style.zIndex = "24";

		} else if(e.offsetX < this.parent.padding.left) {
			// special hold mode when clicking the row numbers
			this.rowHold = true;

			// clear multiselection
			this.clearMultiSelection();
		}
	}

	/**
	 * Helper function to enable window-wide listeners and disable element-wide
	 */
	private enableWindowListeners() {
		// generate the pointer up and pointer move handlers
		this.windowListeners = [
			(e:PointerEvent) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				return this.pointerUp(e);
			},
			(e:PointerEvent) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				this.pointerMove(getMouseInElement(this.parent.element, e));
			},
		];

		// apply these listeners to the window
		window.addEventListener("pointerup", this.windowListeners[0]);
		window.addEventListener("pointermove", this.windowListeners[1]);
	}

	/**
	 * Function to handling mouse button being released
	 */
	private async pointerUp(e:PointerEvent) {
		// MUST be right click!
		if((e.buttons & 1) === 0) {
			// take the hold class from the cursor
			this.parent.cursor.classList.remove("hold");

			// stop edge scrolling
			this.clearEdgeScroll();

			// if no preview was set, just ignore this all
			if(!this.preview) {
				if(this.rowHold && e.offsetX < this.parent.padding.left) {
					// disable the window-wide listeners and just use element wide
					this.disableWindowListeners();

					// actually, the row is being held down, update single selection
					const x = this.findElementAt(this.getAbsolutePointer({ x: this.parent.padding.left + 1, y: e.offsetY, }));
					this.single.row = x.row;
					this.single.pattern = x.pattern;

					// tell the scrolling manager to change the current row
					this.parent.scrollManager.scrollToSelection(this.single);

					// disable row hold mode
					this.rowHold = false;
				}
				return;
			}

			// disable the window-wide listeners and just use element wide
			this.disableWindowListeners();

			// disable cursor
			this.setBounds(new Bounds(-10000, -10000), this.parent.cursor);

			// check whether to create multi or single selection
			if(this.arePositionsEqual(...(this.preview as MultiSelection))) {
				// single mode
				this.single = (this.preview as MultiSelection)[0];

				// clear the preview selection
				this.preview = null;

				// tell the scrolling manager to make channels visible
				this.parent.scrollManager.ensureVisibleChannel(this.single.channel, this.single.channel);

				// tell the scrolling manager to change the current row
				this.parent.scrollManager.scrollToSelection(this.single);

				// set the selected tab channel
				await this.parent.tab.setSelectedChannel(this.single.channel);

			} else {
				// multi mode
				this.multi = this.preview as MultiSelection;
				this.single = { ...(this.preview as MultiSelection)[1], };

				// clear the preview selection
				this.preview = null;

				// tell the scrolling manager to make channels visible
				this.parent.scrollManager.ensureVisibleChannel(this.multi[1].channel, this.multi[1].channel);

				// tell the scrolling manager to change the current row
				this.parent.scrollManager.scrollToSelection(this.multi[1]);

				// update scrolling anyway
				this.render();

				// set the selected tab channel
				await this.parent.tab.setSelectedChannel(this.single.channel);
			}
		}
	}

	/**
	 * Window-wide listeners are stored here so they can be easily disabled
	 */
	private windowListeners: undefined|((e:PointerEvent) => unknown)[];

	/**
	 * Helper function to disable window-wide listeners and enable element-wide
	 */
	private disableWindowListeners() {
		if(this.windowListeners) {
			// remove the window listeners
			window.removeEventListener("pointerup", this.windowListeners[0]);
			window.removeEventListener("pointermove", this.windowListeners[1]);
			this.windowListeners = undefined;
		}

		// add the event listeners from the element itself
		this.parent.scrollwrapper.onpointerup = (e) => this.pointerUp(e);
		this.parent.scrollwrapper.onpointermove = (e) => this.pointerMove(getMouseInElement(this.parent.element, e));
	}

	/**
	 * Helper function to check if all selections are equal
	 *
	 * @param d1 The first selection to check
	 * @param d2 The second selection to check
	 * @returns Boolean indicating if selections are equal
	 */
	private arePositionsEqual(...data:SingleSelection[]): boolean {
		// special case: if 1 or 0 elements in an array, it is always equal
		if(data.length < 2) {
			return true;
		}

		// loop for every selection except first one
		for(let s = 1;s < data.length;s ++) {
			// check if any property does not match. If so, then return false
			if(data[s].channel !== data[0].channel || data[s].pattern !== data[0].pattern ||
				data[s].row !== data[0].row || data[s].element !== data[0].element) {
				return false;
			}
		}

		// everything matched, return true
		return true;
	}

	/**
	 * Function to track the mouse cursor entering the element
	 */
	private async pointerEnter(e:PointerEvent) {
		this.cursorInBounds = true;

		if(this.preview && (e.buttons & 1) === 0) {
			// right click was released outside of the window, run the pointerUp handler
			await this.pointerUp(e);
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
		this.clearEdgeScroll();

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

			// check for extra scrolling via edges
			this.checkEdgeScroll(cursor.x);

		} else if(this.rowHold && cursor.x >= this.parent.padding.left){
			// if in row hold mode but mouse is not on a row number, hide cursor
			this.setBounds(new Bounds(-10000, -10000), this.parent.cursor);

		} else {
			// apply single-selection
			const b = cursor.x < this.parent.padding.left ? this.getRowNumberBounds(r) : this.getElementBounds(r);

			// update the bounds for the cursor
			this.setBounds(b, this.parent.cursor);

			// update the z-index
			this.parent.cursor.style.zIndex = cursor.x < this.parent.padding.left ? "31" : "24";
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
			x: cursor.x - this.parent.padding.left + this.parent.scrollManager.horizScroll,
			y: cursor.y - this.parent.scrollManager.scrollMiddle + ((this.parent.scrollManager.scrolledRow) * this.rowHeight),
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
			data.element = this.parent.channelInfo[data.channel].elements.length - 1;
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
					if(this.parent.channelInfo[channel].right + this.parent.scrollManager.channelBorderWidth > point.x) {
						// store the x-offset within the channel
						xoff = point.x - this.parent.channelInfo[channel].left;
						break;
					}

					// check if the channel is too far to the right, and if so, we found the channel
				} else if(this.parent.channelInfo[channel + 1].left > point.x){
					if(channel >= 0){
						// store the x-offset within the channel
						xoff = point.x - this.parent.channelInfo[channel].left;
					}
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
	 * Function to calculate the absolute left of the element
	 *
	 * @param data The selection to use for calculations
	 * @returns The screen position for the left of the element
	 */
	public getElementLeftAbsolute(data:{ channel:number, element:number }) : number {
		const element = this.parent.channelInfo[data.channel].elements[data.element];
		const base = this.parent.channelInfo[data.channel].left + this.parent.channelInfo[data.channel].offsets[data.element];
		return base + this.selectionOffsets[element];
	}

	/**
	 * Function to calculate the left of the element
	 *
	 * @param data The selection to use for calculations
	 * @param element The calculated element ID
	 * @returns The screen position for the left of the element
	 */
	public getElementLeft(data:{ channel:number, element:number }, element:number) : number {
		const base = this.parent.channelInfo[data.channel].left + this.parent.channelInfo[data.channel].offsets[data.element];
		return base + this.selectionOffsets[element] - this.parent.scrollManager.horizScroll + this.parent.padding.left;
	}

	/**
	 * Function to calculate the top of the element
	 *
	 * @param data The selection to use for calculations
	 * @returns The screen position for the top of the element
	 */
	private getElementTop(data:{ pattern:number, row:number }) : number {
		const row = ((data.pattern * this.parent.patternLen) + data.row) - this.parent.scrollManager.scrolledRow;
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
			0, ((((data.pattern * this.parent.patternLen) + data.row) - this.parent.scrollManager.scrolledRow) * this.rowHeight) + this.parent.scrollManager.scrollMiddle,
			this.parent.padding.left - this.parent.scrollManager.rowNumBorderWidth, this.rowHeight
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
	 * Helper function to handle channel resize event
	 */
	public handleChannelResize(): void {
		// remove multi-selection
		this.clearMultiSelection();

		// update the single selection to be in bounds
		if(this.single) {
			// set the number of values
			this.parent.horizontalBar.setValues(this.getTotalElements());

			// calculate the new element
			this.single.element = Math.min(this.single.element, this.parent.channelInfo[this.single.channel].elements.length - 1);

			// update scrolling anyway
			this.render();
		}
	}

	/**
	 * Helper function to handle matrix resize event
	 */
	public handleMatrixResize(): void {
		// remove multi-selection
		this.clearMultiSelection();

		// update the single selection to be in bounds
		if(this.single) {
			this.single.row = Math.min(this.single.row, this.parent.patternLen - 1);
			this.single.pattern = Math.min(this.single.pattern, this.parent.tab.matrix.matrixlen - 1);
		}
	}

	/**
	 * Helper function to clear the multi selection object
	 */
	public clearMultiSelection(): boolean {
		// ignore if no multi selection in the first place
		if(!this.multi) {
			return false;
		}

		// clear selection
		this.multi = null;

		// set the object itself far away and height to 0
		this.parent.multiSelection.style.top = "-10000px";
		this.parent.multiSelection.style.height = "0px";
		return true;
	}

	/**
	 * The width of the edge in pixels
	 */
	private edgeWidth = 20;

	/**
	 * When edge scrolling, this will tell which edge to use.
	 */
	private whichEdge: 1|-1 = 1;

	/**
	 * The interval which will trigger edge scrolling when enabled
	 */
	private edgeInterval: undefined|NodeJS.Timeout;

	/**
	 * Helper function to clear edge scrolling by setting an invalid x-position
	 */
	private clearEdgeScroll() {
		this.checkEdgeScroll(this.parent.padding.left);
	}

	/**
	 * Some flags loaded from the flags file for edge scrolling
	 */
	private edgeScrollDelay = 800;
	private doEdgeScrolling = false;

	/**
	 * Helper function to deal with edge scrolling
	 */
	private checkEdgeScroll(x:number) {
		// helper function to reset the interval to none if enabled in the first place
		const resetInterval = () => {
			if(this.edgeInterval) {
				clearInterval(this.edgeInterval);
				this.edgeInterval = undefined;
			}
		}

		// calculate scroll direction
		const scroll = (x < this.parent.padding.left) ? -1 :
			(x >= this.parent.scrollManager.scrollWidth - this.edgeWidth - this.parent.padding.right) ? 1 : 0;

		if(!this.doEdgeScrolling || scroll === 0) {
			// no scroll, clear the interval if enabled
			resetInterval();
			return;

		} else if(scroll !== this.whichEdge) {
			// if the edge and scroll aren't the same, then update it and clear the interval
			this.whichEdge = scroll;
			resetInterval();
		}

		// if interval is not started, start it
		if(!this.edgeInterval) {
			this.edgeInterval = setInterval(() => {
				this.parent.scrollManager.horizontalScroll(this.whichEdge, false);
			}, this.edgeScrollDelay);
		}
	}

	/**
	 * Helper function to find the total number of elements in the pattern editor
	 *
	 * @returns The total number of elements
	 */
	public getTotalElements(): number {
		return this.parent.channelInfo.reduce((p, c) => p + c.elements.length, 0);
	}

	/**
	 * Helper function to find the absolute element for the single selection
	 *
	 * @returns The absolute element number for the selection
	 */
	public getSingleElement(): number {
		// special case to check if single is valid??
		if(!this.single) {
			return 0;
		}

		// load the element number in the last channel
		let el = this.single.element;

		// loop for each channel to find the element
		for(let ch = this.single.channel - 1;ch >= 0; --ch) {
			el += this.parent.channelInfo[ch].elements.length;
		}

		return el;
	}

	/**
	 * Set the absolute element for the channel, and refreshing scrolling
	 *
	 * @param element The element number to move to
	 */
	public setSingleElement(element:number): Promise<boolean> {
		return this.moveSingle(element - this.getSingleElement(), 0, false);
	}

	/**
	 * Helper function to move the single selection by some amount automatically
	 */
	public async moveSingle(x:number, y:number, wrap:boolean): Promise<boolean> {
		// handle selection movement
		const vscrl = this.moveSelection(this.single, Math.round(x), y, wrap, false);

		// ensure the channel is visible
		this.parent.scrollManager.ensureVisibleChannel(this.single.channel, this.single.channel);

		// set the selected tab channel
		await this.parent.tab.setSelectedChannel(this.single.channel);

		if(!vscrl) {
			// update graphics
			this.render();

		} else {
			// update the scrolled row
			this.parent.scrollManager.scrollToSelection(this.single);
		}

		return true;
	}

	/**
	 * Helper function to move a selection by some amount
	 */
	private moveSelection(selection:SingleSelection, x:number, y:number, wrap:boolean, inpattern:boolean): boolean {
		// find the new element id
		let elm = x + selection.element, vscrl = false;

		// check if we need to go to the previous channel
		while(elm < 0) {
			// wrap channels if needed
			if(--selection.channel < 0){

				if(!wrap) {
					// if wrapping is disabled, cap it instead
					selection.channel = 0;
					elm = 0;
					break;
				}

				selection.channel = this.parent.channelInfo.length - 1;
			}

			elm += this.parent.channelInfo[selection.channel].elements.length;
		}

		// check if we need to go to the next channel
		while(elm >= this.parent.channelInfo[selection.channel].elements.length) {
			elm -= this.parent.channelInfo[selection.channel].elements.length;

			// wrap channels if needed
			if(++selection.channel >= this.parent.channelInfo.length){

				if(!wrap) {
					// if wrapping is disabled, cap it instead
					selection.channel = this.parent.channelInfo.length - 1;
					elm = this.parent.channelInfo[selection.channel].elements.length - 1;
					break;
				}

				selection.channel = 0;
			}
		}

		// save the element now
		selection.element = elm;

		// check if vertical scrolling is possible
		if(wrap || (y < 0 && selection.pattern + selection.row > 0) ||
			(y > 0 && (selection.pattern < this.parent.tab.matrix.matrixlen - 1 || selection.row < this.parent.patternLen - 1))) {
				vscrl = true;

				// get the absolute row from selection
				let r = (inpattern ? 0 : (selection.pattern * this.parent.patternLen)) + selection.row + Math.round(y);

				// if wrapping is disabled, make sure this works correctly
				const ttl = inpattern ? this.parent.patternLen : (this.parent.tab.matrix.matrixlen * this.parent.patternLen);

				if(!wrap && y < 0 && r < 0) {
					r = 0;

				} else if(!wrap && y > 0 && r >= ttl){
					r = ttl - 1;
				}

				// wrap it
				r = (ttl + r) % ttl;

				// save it back
				selection.row = r % this.parent.patternLen;
				if(!inpattern) {
					selection.pattern = Math.floor(r / this.parent.patternLen);
				}
			}

		return vscrl;
	}

	/**
	 * Helper function to move the multi selection by some amount automatically
	 */
	public async moveMulti(x:number, y:number, wrap:boolean): Promise<boolean> {
		if(!this.multi) {
			return false;
		}

		// handle selection movement
		this.moveSelection(this.multi[0], Math.round(x), y, wrap, true);
		this.moveSelection(this.multi[1], Math.round(x), y, wrap, true);

		if(x !== 0) {
			// ensure the channel is visible
			const target = +(x > 0 !== this.multi[0].channel > this.multi[1].channel);
			this.single.channel = this.multi[target].channel;
			this.single.element = this.multi[target].element;
			this.parent.scrollManager.ensureVisibleChannel(this.single.channel, this.single.channel);

			// if no y-offset, then handle redrawing now
			if(y === 0) {
				this.render();
			}

			// set the selected tab channel
			await this.parent.tab.setSelectedChannel(this.single.channel);
		}

		if(y !== 0) {
			// ensure the row is visible
			const row = Math[y > 0 ? "max" : "min"](this.multi[0].row, this.multi[1].row);
			this.single.row = row;
			this.parent.scrollManager.scrollToRow(row + (this.multi[0].pattern * this.parent.patternLen));
		}

		return true;
	}

	/**
	 * Helper function to extend the multi selection by some amount automatically
	 */
	public async extendMulti(x:number, y:number, wrap:boolean): Promise<boolean> {
		if(!this.multi) {
			return false;
		}

		// handle selection movement
		this.moveSelection(this.multi[1], x, y, wrap, true);

		// ensure the channel is visible
		this.parent.scrollManager.ensureVisibleChannel(this.multi[1].channel, this.multi[1].channel);

		// update single selection
		this.single.channel = this.multi[1].channel;
		this.single.element = this.multi[1].element;
		this.single.row = this.multi[1].row;

		// update the scrolled row
		this.parent.scrollManager.scrollToSelection(this.single);

		// set the selected tab channel
		await this.parent.tab.setSelectedChannel(this.single.channel);
		return true;
	}
}
