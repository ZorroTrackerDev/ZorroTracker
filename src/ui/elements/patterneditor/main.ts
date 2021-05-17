import { PatternIndex } from "../../../api/pattern";
import { shortcutDirection, UIElement } from "../../../api/ui";

/**
 * Class to interact between the UI and the PatternIndex entry. Helps manage UI integration and intercommunication
 */
export class PatternIndexEditor implements UIElement {
	// various standard elements for the pattern editor
	public element!:HTMLElement;
	private elchans!:HTMLElement;
	private elrows!:HTMLElement;
	private elbtns!:HTMLElement;

	// the pattern index this editor is affecting
	public index:PatternIndex;

	constructor(index:PatternIndex) {
		// initialize the pattern index. TODO: Driver-dependant behavior
		this.index = index;
		this.setLayout();

		// generate the first row
		this.insertRow(0);

		// select the first row first channel
		this.select(0, 0);

		// generate fake rows
		for(let i = 1;i < 20; i++){
			this.insertRow(i);
		}
	}

	// scroll by 3 elements per step
	private static FILLER_ROWS = 2;

	private setLayout() {
		// generate the main element for this editor
		this.element = document.createElement("div");
		this.element.classList.add("patterneditor");
		this.element.tabIndex = 0;						// cool so this whole element will break without this line here!

		// generate the channel display for this editor
		this.elchans = document.createElement("div");
		this.elchans.classList.add("patterneditor_channels");
		this.element.appendChild(this.elchans);

		// generate the pattern display for this editor
		this.elrows = document.createElement("div");
		this.elrows.classList.add("patterneditor_rows");
		this.element.appendChild(this.elrows);

		// add the filler rows
		for(let x = PatternIndexEditor.FILLER_ROWS * 2;x > 0;x --){
			this.elrows.appendChild(document.createElement("p"));
		}

		// generate the buttons for this editor
		this.elbtns = document.createElement("div");
		this.elbtns.classList.add("patterneditor_buttons");
		this.element.appendChild(this.elbtns);

		// enable all the standard buttons
		this.standardButtons.forEach((button) => this.appendButton(button.text, button.title, button.click));

		// set editing left column
		this.setEdit(false);

		// enable the channels
		this.setChannels();

		// special handler for scrolling with mousewheel
		this.element.addEventListener("wheel", (event:WheelEvent) => {
			// NOTE: Do not allow vertical scrolling. Horizontal scrolling is unaffected!
			if(event.deltaY) {
				// disable default event
				event.preventDefault();
				event.stopPropagation();

				// scroll according to the wheel
				this.scroll(Math.round(event.deltaY / 100 * PatternIndexEditor.SCROLL_STEP));
			}
		}, { passive: false, });

		// DO NOT register button presses
		this.element.onkeydown = (e) => e.preventDefault();
	}

	// the current text editing mode: false = left, true = right
	private editing = false;

	// the array containing the strings for animation iteration count depending on the editing mode
	private static EDIT_STYLE = (state:boolean) => state ? "infinite" : "0";

	/**
	 * Set the current editing column for text
	 *
	 * @param right Whether we are editing the right column
	 */
	private setEdit(right:boolean) {
		this.editing = right;

		// update CSS styles
		this.element.style.setProperty("--pattern_edit_left", PatternIndexEditor.EDIT_STYLE(!right));
		this.element.style.setProperty("--pattern_edit_right", PatternIndexEditor.EDIT_STYLE(right));
	}

	// scroll by 3 elements per step
	private static SCROLL_STEP = 2;

	/**
	 * Function to scroll the index menu by x number of elements.
	 *
	 * @param speed Positive or negative value in number of elements.
	 */
	private scroll(speed:number) {
		// get the height of the element. The first value takes into account the border size
		const height = 1 + ((this.elrows.children[PatternIndexEditor.FILLER_ROWS] as HTMLDivElement|undefined)?.offsetHeight ?? 0);

		// apply scrolling here
		this.element.scrollTop += speed * height;
	}

	/**
	 * Helper function to ensure a specific row is visible. This is usually done after selection.
	 *
	 * @param row the row to make visible
	 */
	private scrollTo(row:number) {
		// check that the row is valid
		if(row >= 0 && this.index.matrixlen > row){
			// get all the relevant bounding boxes for later
			const target = this.elrows.children[row + PatternIndexEditor.FILLER_ROWS].getBoundingClientRect();
			const chan = this.elchans.getBoundingClientRect();
			const elm = this.element.getBoundingClientRect();
			const butt = this.elbtns.getBoundingClientRect();

			if(target.top - chan.bottom < 0){
				// too far below! must move up
				this.element.scrollTop = this.element.scrollTop + target.top - chan.bottom;

			} else if(target.top > elm.height - butt.height) {
				// too far above! must move down
				this.element.scrollTop = this.element.scrollTop + target.bottom - butt.top + 2;
			}
		}
	}

	/**
	 * All the different standard buttons for controlling the pattern editor. This also has the functionality of these buttons.
	 */
	private standardButtons = [
		{
			text: "↑",
			title: "move selection up",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.selectedRow > 0) {
					// swap this row with the previous
					if(edit.index.swapRows(edit.selectedRow, edit.selectedRow - 1)){
						// re-render rows and re-select
						edit.renderRow(edit.selectedRow);
						edit.renderRow(edit.selectedRow - 1);
						edit.select(edit.selectedRow - 1, edit.selectedChan);

						// fix row indices too
						edit.fixRowIndices();
					}
				}
			},
		},
		{
			text: "insert",
			title: "insert at selection",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.selectedRow >= 0) {
					// insert below selection
					edit.insertRow(edit.selectedRow + 1);
					edit.select(edit.selectedRow + 1, edit.selectedChan);
				}
			},
		},
		{
			text: "delete",
			title: "delete at selection",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.selectedRow >= 0 && edit.index.matrixlen > 1) {
					// delete the currently selected row
					edit.deleteRow(edit.selectedRow);
					edit.select(Math.min(edit.selectedRow, edit.index.matrixlen - 1), edit.selectedChan);
				}
			},
		},
		{
			text: "copy",
			title: "duplicate selection",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.selectedRow >= 0) {
					// insert below selection
					edit.copyRow(edit.selectedRow, edit.selectedRow + 1);
					edit.select(edit.selectedRow + 1, edit.selectedChan);
				}
			},
		},
		{
			text: "↓",
			title: "move selection down",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.selectedRow >= 0) {
					// swap this row with the next
					if(edit.index.swapRows(edit.selectedRow, edit.selectedRow + 1)) {
						// re-render rows and re-select
						edit.renderRow(edit.selectedRow);
						edit.renderRow(edit.selectedRow + 1);
						edit.select(edit.selectedRow + 1, edit.selectedChan);

						// fix row indices too
						edit.fixRowIndices();
					}
				}
			},
		},
	];

	/**
	 * Helper function to create a new button at the bottom row
	 *
	 * @param text The button inner text
	 * @param title The tooltip to display when hovering with a mouse
	 * @param mouseup The event to run when the user clicks on the button
	 */
	private appendButton(text:string, title:string, click:(edit:PatternIndexEditor, event:MouseEvent) => unknown) {
		const button = document.createElement("div");
		button.innerText = text;
		button.title = title;
		button.onmouseup = (event:MouseEvent) => click(this, event);
		this.elbtns.appendChild(button);
	}

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	public receiveShortcut(data:string[]):boolean {
		if(document.querySelector(":focus") === this.element) {
			// focus
			switch(data.shift()) {
				case "move":
					return this.moveSelection(data.shift(), true);

				case "movemax":
					return this.specialSelection(data.shift(), true);

				case "select":
					return this.moveSelection(data.shift(), false);

				case "selmax":
					return this.specialSelection(data.shift(), false);

				case "scroll": {
						// convert direction string to x/y offsets
						const dir = shortcutDirection(data.shift());

						if(!dir || !dir.y) {
							return false;
						}

						// apply scrolling
						this.scroll(dir.y * PatternIndexEditor.SCROLL_STEP);
						return true;
					}

				case "hex":{
					// check that there is a valid selection active
					if(this.selectedRow < 0 || this.selectedChan < 0) {
						return false;
					}

					// parse the value we passed
					const value = parseInt(data.shift() ?? "NaN", 16);

					// make sure the value was 100% sure correct or otherwise ignore this code
					if(!isNaN(value) && value >= 0 && value <= 0xF) {
						// load the previous value for this cell and bail if invalid
						let number = this.index.get(this.selectedChan, this.selectedRow);

						if(number === null) {
							return false;
						}

						// remove the old pattern value if it is otherwise unused
						this.index.trim(this.selectedChan, this.selectedRow);

						// set the current digit to specific value while preserving the other digit
						number &= 0xF << (this.editing ? 4 : 0);
						number |= value << (this.editing ? 0 : 4);

						// set the new pattern value
						this.index.set(this.selectedChan, this.selectedRow, number);

						// if this pattern didn't exist, make it anew
						this.index.makePattern(this.selectedChan, number, false);

						// render this cell
						this.renderAt(this.selectedRow, this.selectedChan);

						if(this.editing) {
							// set to editing the left digit and move selection right
							this.moveSelection("right", false);

						} else {
							// set to editing the right digit
							this.setEdit(true);
						}

						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * Function to move the current selection by arrow keys.
	 *
	 * @param direction The direction we are going to move in as a string
	 * @param both True if moving both the start and end of selection
	 * @returns boolean indicating whether the operation was successful
	 */
	private moveSelection(direction: string|undefined, both: boolean): boolean {
		// convert direction string to x/y offsets
		let dir: undefined | { x:number, y:number } = shortcutDirection(direction);

		if(!dir) {
			return false;
		}

		// if current selection is false, just select the first element
		if(this.selectedRow < 0 || this.selectedChan < 0) {
			this.select(0, 0);
			return true;
		}

		// add selection
		dir = this.wrapPosition({ x: dir.x + this.selectedChan, y: dir.y + this.selectedRow, });
		this.select(dir.y, dir.x);
		return true;
	}

	/**
	 * Function to move the current selection by special keys.
	 *
	 * @param direction The direction we are going to move in as a string
	 * @param both True if moving both the start and end of selection
	 * @returns boolean indicating whether the operation was successful
	 */
	private specialSelection(direction: string|undefined, both: boolean): boolean {
		// convert direction string to x/y offsets
		let dir: undefined | { x:number, y:number } = shortcutDirection(direction);

		if(!dir) {
			return false;
		}

		// add selection
		dir = this.clipPosition({ x: dir.x * Number.MAX_SAFE_INTEGER, y: dir.y * Number.MAX_SAFE_INTEGER, });
		this.select(dir.y, dir.x);
		return true;
	}

	/**
	 * Helper function to wrap the position to be in bounds with the pattern matrix
	 *
	 * @param position The input position to be wrapped
	 * @returns The position but wrapped to be in bounds
	 */
	private wrapPosition(position:{ x:number, y:number }): { x:number, y:number } {
		// handle wrapping the position
		return this.doPosition(position, (start:number, max:number) => {
			let ret = start;

			// if position is negative, add channels length until positive
			while(ret < 0){
				ret += max;
			}

			// if position is too high, subtract channels length until in range
			while(ret >= max){
				ret -= max;
			}

			return ret;
		});
	}

	/**
	 * Helper function to clip the position to be in bounds with the pattern matrix
	 *
	 * @param position The input position to be clipped
	 * @returns The position but clipped to be in bounds
	 */
	private clipPosition(position:{ x:number, y:number }): { x:number, y:number } {
		// handle clipping the position
		return this.doPosition(position, (start:number, max:number) => {
			// clip the position in range 0...max-1
			return Math.max(0, Math.min(max - 1, start));
		});
	}

	/**
	 * Helper function to wrap the position to be in bounds with the pattern matrix
	 *
	 * @param position The input position to be wrapped
	 * @returns The position but wrapped to be in bounds
	 */
	private doPosition(position:{ x:number, y:number }, func:(start:number, max:number) => number): { x:number, y:number } {
		// wrap the positions
		position.x = func(position.x, this.index.channels.length);
		position.y = func(position.y, this.index.matrixlen);

		// return the new data
		return position;
	}

	/**
	 * Function to set the channels this editor recognizes
	 *
	 * @param list List of channel names as string array
	 */
	private setChannels() {
		// helper function to add a new element with text
		const _add = (text:string) => {
			const z = document.createElement("div");
			z.innerText = text;
			this.elchans.appendChild(z);
			return z;
		}

		// add each channel into the mix along with the insert button
		const insert = _add("​");
		this.index.channels.forEach(_add);

		// add class and title for the insert button
		insert.classList.add("patterneditor_insert");
		insert.title = "left click: Insert below\nright click: Insert above";

		// handle clicking the insert button
		insert.onmouseup = (event:MouseEvent) => {
			switch(event.button) {
				case 0:		// left button, generate a new row at the very bottom and scroll down to it
					this.insertRow(this.index.matrixlen);
					this.scrollTo(this.index.matrixlen - 1);
					break;

				case 2:		// right button, generate a new row at the very top and scroll up to it
					this.insertRow(0);
					this.scrollTo(0);
					break;
			}
		}
	}

	// the classname that is used for a selected item. Make sure LESS files also use the same name.
	private static SELECT_CLASS = "selected";

	/**
	 * Clear the user selection
	 */
	private clearSelect() {
		// clear editing setting too
		this.setEdit(false);

		// remove class from all rows
		for(const row of this.elrows.children){
			row.classList.remove(PatternIndexEditor.SELECT_CLASS);

			// remove class from all elements
			for(const e of row.children){
				e.classList.remove(PatternIndexEditor.SELECT_CLASS);
			}
		}
	}

	// the currently selected row and channel. Use -1 for invalid values
	private selectedRow = -1;
	private selectedChan = -1;

	/**
	 * Function to set the current selection of the pattern editor
	 *
	 * @param row The row to select
	 * @param channel The channel to select
	 * @returns True if selection can be applied, false if not
	 */
	public select(row:number, channel:number):boolean {
		// clear any previous selections
		this.clearSelect();

		// check if this row exists
		if(row >= 0 && this.index.matrixlen > row) {
			const erow = this.elrows.children[row + PatternIndexEditor.FILLER_ROWS];

			// check if the channel exists
			if(channel >= 0 && erow.children.length > channel) {
				const echan = erow.children[channel + 1];

				// apply special styles
				erow.classList.add(PatternIndexEditor.SELECT_CLASS);
				echan.classList.add(PatternIndexEditor.SELECT_CLASS);

				// also update the selection too
				this.selectedRow = row;
				this.selectedChan = channel;

				// ensure the element is visible
				this.scrollTo(this.selectedRow);
				return true;
			}
		}

		// unable to select
		this.selectedRow = -1;
		return false;
	}

	/**
	 * Function to insert a new row into a specific position
	 *
	 * @param position position to insert a new row into
	 * @returns boolean indicating if the operation was successful
	 */
	public insertRow(position:number):boolean {
		// generate a new row in the pattern index object
		const ixrow = this.index.generateRow();

		// generate new patterns at values
		this.index.makePatternsRow(ixrow, false);

		// attempt to insert this new row at position. If it fails, return
		if(!this.index.insertRow(position, ixrow)){
			return false;
		}

		// add the row to the UI now
		return this.insertRowUI(position);
	}

	/**
	 * Function to insert a new row UI into a specific position
	 *
	 * @param position position to insert a new row into
	 * @param data The data to show on the UI buttons
	 * @returns boolean indicating if the operation was successful
	 */
	private insertRowUI(position:number):boolean {
		// insert a new row element based on the position
		const row = document.createElement("div");
		this.elrows.insertBefore(row, this.index.matrixlen <= position ? null : this.elrows.children[position + PatternIndexEditor.FILLER_ROWS]);

		// render the row at position
		if(!this.renderRow(position)){
			return false;
		}

		// fix the row indices
		this.fixRowIndices();
		return true;
	}

	/**
	 * Function to render a single row of the UI. This will not correctly update the row index, however.
	 *
	 * @param position The row index to update
	 * @returns boolean indicating success
	 */
	private renderRow(position:number) {
		// get the row data and check if it's null (invalid row)
		const data = this.index.getRow(position);

		if(data === null) {
			return false;
		}

		// get the row element
		const row = this.elrows.children[position + PatternIndexEditor.FILLER_ROWS] as HTMLDivElement;

		// remove all children
		while(row.children.length > 0){
			row.removeChild(row.children[0]);
		}

		// generate all the pattern indices for this row (based on channel count)
		for(let channel = 0;channel <= data.length; channel++) {
			// generate a new cell with the new value (number of rows... I know)
			const cell = document.createElement("div");
			row.appendChild(cell);

			// ignore the row index number
			if(channel !== 0){
				this.byteToHTML(cell, data[channel - 1]);

				// when clicked, select the item
				cell.onmouseup = (event:MouseEvent) => {
					switch(event.button) {
						case 0:	{	// left button
								// clear any previous selections
								this.clearSelect();

								// select this item
								const index = this.findMe(event.currentTarget as HTMLDivElement);
								this.select(index.row, index.channel);
							}
					}
				}
			}
		}

		return true;
	}

	/**
	 * Helper function to convert the byte value to 2 div elements
	 *
	 * @param element The element to apply style to
	 * @param byte The value to apply here
	 */
	private byteToHTML(element:Element, byte:number) {
		const text = byte.toByte();
		element.innerHTML = /*html*/`<div>${text[0]}</div><div>${text[1]}</div>`;
	}

	/**
	 * Function to fix the row indices, so they always are based on the position
	 */
	private fixRowIndices() {
		for(let i = this.index.matrixlen - 1; i >= 0;i --) {
			// fix the innertext of the first child of each row to be position
			this.byteToHTML((this.elrows.children[i + PatternIndexEditor.FILLER_ROWS].children[0] as HTMLDivElement), i);
		}
	}

	/**
	 * Helper function to re-render a single element
	 *
	 * @param row The row the element is in
	 * @param channel The channel the element is in
	 */
	private renderAt(row:number, channel:number) {
		// get the actual value from the index and check if invalid
		const byte = this.index.get(channel, row);

		if(byte === null) {
			return;
		}

		// get the target element
		const erow = this.elrows.children[row + PatternIndexEditor.FILLER_ROWS] as HTMLDivElement;
		const echan = erow.children[channel + 1] as HTMLDivElement;

		// edit its display value
		this.byteToHTML(echan, byte);
	}

	/**
	 * Helper function to find an element in the pattern matrix, then to return the row and channel it was representing
	 *
	 * @param e The element you are attempting to find
	 * @returns an object containing the row and channel to select, or invalid row if failed to find
	 */
	private findMe(e:HTMLDivElement) {
		// loop through all rows and elements in the row
		for(let r = this.elrows.children.length - 1 - PatternIndexEditor.FILLER_ROWS; r >= PatternIndexEditor.FILLER_ROWS;r --) {
			for(let c = this.elrows.children[r].children.length -1;c >= 1;c --) {

				// check if this is the element we are looking for
				if(this.elrows.children[r].children[c] === e){
					// if yes, return its position
					return { row: r - PatternIndexEditor.FILLER_ROWS, channel: c - 1, };
				}
			}
		}

		// did not find?!
		return { row: -1, channel: -1, };
	}

	/**
	 * Function to remove a row from the pattern matrix
	 *
	 * @param position the position of the row to delete
	 * @returns boolean indicating whether the operation was successful
	 */
	public deleteRow(position:number):boolean {
		// delete the row data from index, and bail if failed
		if(!this.index.deleteRow(position)) {
			return false;
		}

		// remove the UI row
		this.elrows.removeChild(this.elrows.children[position + PatternIndexEditor.FILLER_ROWS]);

		// fix the row indices
		this.fixRowIndices();
		return true;
	}

	/**
	 * Function to insert a new row and copy another row into it.
	 *
	 * @param source The position of the source row to copy data from
	 * @param destination The position of the destination row to insert and copy data to
	 * @returns boolean indicating whether the operation was successful
	 */
	public copyRow(source:number, destination:number):boolean {
		// get the source row from index
		const ixrow = this.index.getRow(source);

		// attempt to insert this new row at destination. If it fails, return
		if(!ixrow || !this.index.insertRow(destination, ixrow)){
			return false;
		}

		// add the row to the UI now
		return this.insertRowUI(destination);
	}
}