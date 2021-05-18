import { PatternIndex } from "../../../api/pattern";
import { Position, shortcutDirection, UIElement } from "../../../api/ui";

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
		this.select(false, { start: { x: 0, y: 0, }, offset: { x: 0, y: 0, }, });

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

	// if we are editing a single row currently. Multirow editing will be enabled even when this is false
	private isEdit = false;

	// the array containing the strings for animation iteration count depending on the editing mode
	private static EDIT_STYLE = (state:boolean) => state ? "patterneditor_text_flicker" : "";

	/**
	 * Set the current editing column for text
	 *
	 * @param right Whether we are editing the right column
	 */
	private setEdit(right:boolean) {
		this.editing = right;

		// refresh the animation
		this.refreshEdit();
	}

	/**
	 * Helper function to refresh the editing animation so its synced
	 */
	private refreshEdit() {
		// disable animations
		this.element.style.setProperty("--pattern_edit_left", PatternIndexEditor.EDIT_STYLE(false));
		this.element.style.setProperty("--pattern_edit_right", PatternIndexEditor.EDIT_STYLE(false));

		// update CSS styles as active
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				this.element.style.setProperty("--pattern_edit_left", PatternIndexEditor.EDIT_STYLE(!this.editing));
				this.element.style.setProperty("--pattern_edit_right", PatternIndexEditor.EDIT_STYLE(this.editing));
			});
		});
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

	// the last "second" value for the scrollTo function
	private lastScrollPref = true;

	/**
	 * Helper function to ensure a specific row is visible. This is usually done after selection.
	 *
	 * @param row1 One of the rows to make visible
	 * @param row2 One of the rows to make visible
	 * @param second Whether to prefer to focus on first or second row (true = second). null = last selection
	 */
	private scrollTo(row1:number, row2:number, second:boolean|null) {
		const sec = second ?? this.lastScrollPref;
		this.lastScrollPref = sec;

		// get all the relevant bounding boxes for later
		const chan = this.elchans.getBoundingClientRect();
		const elm = this.element.getBoundingClientRect();
		const butt = this.elbtns.getBoundingClientRect();

		// herlp function to grab the position of the row we're requesting
		const getPos = (r:number, position:"top"|"bottom") => {
			// check that the row is valid
			if(r >= -1 && this.index.matrixlen >= r){
				// get the row bounding box
				return this.element.scrollTop - chan.height - butt.height +
					this.elrows.children[r + PatternIndexEditor.FILLER_ROWS].getBoundingClientRect()[position];
			}

			// plz same position
			return 0;
		}

		// get row scroll positions
		const rtop = getPos(row1 < row2 ? row1 - 1 : row2 - 1, "top");
		const rbot = getPos(row1 > row2 ? row1 + 0 : row2 + 0, "bottom");
		const _h = elm.height - butt.height - butt.height;

		if(rbot - rtop > _h){
			// too much space, just focus on one of the nodes
			const target = getPos(sec ? row1 : row2, "top");
			this.element.scrollTop = target - (_h / 2);

		} else if(this.element.scrollTop > rtop){
			// average the position, enough space
			this.element.scrollTop -= (this.element.scrollTop - rtop);

		} else if(this.element.scrollTop + _h <= rbot){
			// average the position, enough space
			this.element.scrollTop += rbot - (this.element.scrollTop + _h);
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
				if(event.button === 0) {
					edit.shiftUp();
				}
			},
		},
		{
			text: "insert",
			title: "insert at selection",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0) {
					edit.insert();
				}
			},
		},
		{
			text: "delete",
			title: "delete at selection",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0) {
					edit.delete();
				}
			},
		},
		{
			text: "copy",
			title: "duplicate selection",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0) {
					edit.copy();
				}
			},
		},
		{
			text: "↓",
			title: "move selection down",
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0) {
					edit.shiftDown();
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
			// has focus, process the shortcut
			switch(data.shift()) {
				case "shiftdown":	return this.shiftUp();
				case "shiftup":		return this.shiftDown();
				case "insert":		return this.insert();
				case "delete":		return this.delete();
				case "copy":		return this.copy();
				case "paste":		return false;
				case "move":		return this.moveSelection(data.shift(), true);
				case "movemax":		return this.specialSelection(data.shift(), true);
				case "select":		return this.moveSelection(data.shift(), false);
				case "selmax":		return this.specialSelection(data.shift(), false);

				case "selall":
					// select the entire matrix
					return this.select(false, {
						start: { x: 0, y: 0, },
						offset: { x: this.index.channels.length - 1, y: this.index.matrixlen - 1, },
					});

				case "selrow":
					// select the entire row
					return this.select(false, {
						start: { x: 0, y: this.selectStart.y, },
						offset: { x: this.index.channels.length - 1, y: this.selectOff.y, },
					});

				case "selcolumn":
					// select the entire column
					return this.select(false, {
						start: { x: this.selectStart.x, y: 0, },
						offset: { x: this.selectStart.x, y: this.index.matrixlen - 1, },
					});

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

				case "hex":/*{
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
				}*/
			}
		}

		return false;
	}

	/**
	 * Function to shift the selection upwards
	 *
	 * @returns boolean indicating if the operation was successful
	 */
	private shiftUp() {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// single mode is special uwu
			if(!this.index.swapRows(startY, startY - 1)) {
				return false;
			}

			// re-render the 2 rows
			this.renderRow(startY);
			this.renderRow(startY - 1);
			this.fixRowIndex(startY);
			this.fixRowIndex(startY - 1);

		} else {
			// gather some basic variables to reference later
			const size = this.index.matrixlen;
			let swapcol = (size - 1 + startY + (offY < 0 ? offY : 0)) % size;
			let firstcol = (size + startY + (offY > 0 ? offY : 0)) % size;

			// copy to _rows variable because eslint
			let _rows = rows;
			let _rowmd:"push"|"unshift" = offY > 0 ? "push" : "unshift";

			if(rows.length === size) {
				// if full selection, we need to do some special shenanigans
				swapcol = 0;
				firstcol = size - 1;
				_rowmd = "unshift";

				// create new set of rows! yes!
				_rows = [];
				for(let i = 1;i < size; i ++){
					_rows.push(i);
				}
			}

			// collect the region information
			const main = this.index.getRegion(_rows, columns);
			const swap = this.index.getRegion([ swapcol, ], columns);

			// if we failed to gather the regions
			if(!main || !swap) {
				return false;
			}

			// add the swap row data in already
			if(!this.index.setRegion([ firstcol, ], columns, swap)){
				return false;
			}

			// set the rest of the region now. We need to be sure to insert the right way round
			_rows = _rows.filter((value) => value !== firstcol);
			_rows[_rowmd](swapcol);

			// add the region and check for failure
			if(!this.index.setRegion(_rows, columns, main)){
				return false;
			}

			// re-render all rows
			this.renderRow(firstcol);

			_rows.forEach((r) => {
				this.renderRow(r);
			});

			// fix indices
			this.fixRowIndices();
		}

		// move the selection up by 1 row
		this.moveSelection("up", true);
		return true;
	}

	/**
	 * Function to shift the selection downwards
	 *
	 * @returns boolean indicating if the operation was successful
	 */
	private shiftDown() {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// single mode is special uwu
			if(!this.index.swapRows(startY, startY + 1)) {
				return false;
			}

			// re-render the 2 rows
			this.renderRow(startY);
			this.renderRow(startY + 1);
			this.fixRowIndex(startY);
			this.fixRowIndex(startY + 1);

		} else {
			// gather some basic variables to reference later
			const size = this.index.matrixlen;
			let swapcol = (size + 1 + startY + (offY > 0 ? offY : 0)) % size;
			let lastcol = (size + startY + (offY < 0 ? offY : 0)) % size;

			// copy to _rows variable because eslint
			let _rows = rows;
			let _rowmd:"push"|"unshift" = offY > 0 ? "push" : "unshift";

			if(rows.length === size) {
				// if full selection, we need to do some special shenanigans
				swapcol = size - 1;
				lastcol = 0;
				_rowmd = "push";

				// create new set of rows! yes!
				_rows = [];
				for(let i = 0;i < size - 1; i ++){
					_rows.push(i);
				}
			}

			// collect the region information
			const main = this.index.getRegion(_rows, columns);
			const swap = this.index.getRegion([ swapcol, ], columns);

			// if we failed to gather the regions
			if(!main || !swap) {
				return false;
			}

			// add the swap row data in already
			if(!this.index.setRegion([ lastcol, ], columns, swap)){
				return false;
			}

			// set the rest of the region now. We need to be sure to insert the right way round
			_rows = _rows.filter((value) => value !== lastcol);
			_rows[_rowmd](swapcol);

			// add the region and check for failure
			if(!this.index.setRegion(_rows, columns, main)){
				return false;
			}

			// re-render all rows
			this.renderRow(lastcol);

			_rows.forEach((r) => {
				this.renderRow(r);
			});

			// fix indices
			this.fixRowIndices();
		}

		// move the selection up by 1 row
		this.moveSelection("down", true);
		return true;
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
		const dir: undefined | Position = shortcutDirection(direction);

		if(!dir) {
			return false;
		}

		// if we are editing
		if(both && (this.isEdit || !this.getSelection().single)) {
			if(dir.x < 0) {
				// check for edit mode when moving left
				if(this.editing) {
					this.setEdit(false);
					return true;
				}

				// change editing but move also
				this.setEdit(true);

			} else if(dir.x > 0) {
				// check for edit mode when moving right
				if(!this.editing) {
					this.setEdit(true);
					return true;
				}

				// change editing but move also
				this.setEdit(false);
			}
		}

		// handle normal selection
		this.select(dir.y === 0 ? null : !both ? false : !!(+(dir.y > 0) ^ +(this.selectOff.y >= 0)),
			this.doPosition(dir, both, (start:number, max:number) => {
			// wrap position in 0 ... max-1 range
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

		}, (start:number, max:number) => {
			// wrap position in -max-1 ... max-1 range
			let ret = start;

			// if position is negative, add channels length until in range
			while(ret <= -max){
				ret += max;
			}

			// if position is too high, subtract channels length until in range
			while(ret >= max){
				ret -= max;
			}

			return ret;
		}));

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
		const dir: undefined | Position = shortcutDirection(direction);

		if(!dir) {
			return false;
		}

		if(both) {
			// handle moving selection
			return this.select(false, {
				start: { x: this.selectStart.x, y: dir.y > 0 ? this.index.matrixlen - 1 : 0, },
				offset: { x: this.selectOff.x, y: 0, },
			});

		} else {
			// handle extending selection
			return this.select(false, {
				offset: { x: this.selectOff.x, y: (dir.y > 0 ? this.index.matrixlen - 1 : 0) - this.selectStart.y, },
			});
		}
	}

	/**
	 * Helper function to wrap the position to be in bounds with the pattern matrix
	 *
	 * @param position The input position to be wrapped
	 * @returns The object for this.select call
	 */
	private doPosition(position:Position, both:boolean,
		f1:(start:number, max:number) => number, f2:(start:number, max:number) => number): { start?:Position, offset?: Position } {

		return {
			// apply start only if both = true
			start: !both ? undefined : {
				x: f1(this.selectStart.x + position.x, this.index.channels.length),
				y: f1(this.selectStart.y + position.y, this.index.matrixlen),
			},
			// apply the offset position if both = false
			offset: both ? undefined :  {
				x: f2(this.selectOff.x + position.x, this.index.channels.length),
				y: f2(this.selectOff.y + position.y, this.index.matrixlen),
			},
		};
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
					this.scrollTo(this.index.matrixlen - 1, this.index.matrixlen - 1, true);
					break;

				case 2:		// right button, generate a new row at the very top and scroll up to it
					this.insertRow(0);
					this.scrollTo(0, 0, true);
					break;
			}
		}
	}

	// the classname that is used for a selected item. Make sure LESS files also use the same name.
	private static SELECT_CLASS = "selected";

	// the classname that is used for a editing an item. Make sure LESS files also use the same name.
	private static EDIT_CLASS = "editing";

	/**
	 * Clear the user selection
	 */
	private clearSelect() {
		// remove class from all rows
		for(const row of this.elrows.children){
			row.classList.remove(PatternIndexEditor.SELECT_CLASS);

			// remove class from all elements
			for(const e of row.children){
				e.classList.remove(PatternIndexEditor.SELECT_CLASS);
				e.classList.remove(PatternIndexEditor.EDIT_CLASS);
			}
		}
	}

	// the currently selected row and channel. Use -1 for invalid values
	private selectStart:Position = { x: -1, y: -1, };
	private selectOff:Position = { x: -1, y: -1, };

	/**
	 * Function to set the current selection of the pattern editor
	 *
	 * @param offset Whether to prefer focusing on the node at offset (true) or start (false)
	 * @param target An object describing the new targeted position(s) of selection.
	 * @returns True if selection can be applied, false if not
	 */
	public select(offset:boolean|null, target:{ start?: Position, offset?: Position }):boolean {
		let changed = false;

		// helper function to process a position
		const setPos = (negative:boolean, pos:Position|undefined, change:(pos:Position) => void) => {
			// validate that we were given a valid position
			if(!pos) {
				return;
			}

			// validate x-position
			const xmx = this.index.channels.length;
			if(pos.x < (negative ? -xmx : 0) || pos.x >= xmx){
				return;
			}

			// validate y-position
			const ymx = this.index.matrixlen;
			if(pos.y < (negative ? -ymx : 0) || pos.y >= ymx){
				return;
			}

			// completely fine, change the position
			change(pos);
			changed = true;
		};

		// validate start and end positions
		setPos(false, target.start, (pos:Position) => this.selectStart = pos);
		setPos(true, target.offset, (pos:Position) => this.selectOff = pos);

		// if nothing was changed, return
		if(!changed){
			return false;
		}

		// clear any previous selections
		this.clearSelect();

		// organize the selection boundaries
		const { rows, columns, single, } = this.getSelection();
		const edit = !single || this.isEdit;

		// loop for every row
		rows.forEach((y) => {
			// get the row element and give it the selected class (only in single mode!)
			const erow = this.elrows.children[y + PatternIndexEditor.FILLER_ROWS];

			if(!edit) {
				erow.classList.add(PatternIndexEditor.SELECT_CLASS);
			}

			// loop for every channel giving it the selected or editing class
			columns.forEach((x) => {
				erow.children[x + 1].classList.add(!edit ? PatternIndexEditor.SELECT_CLASS : PatternIndexEditor.EDIT_CLASS);
			});
		});

		// handle scrolling if offset is not null
		if(offset !== null) {
			this.scrollTo(rows[0], rows[rows.length - 1], offset);
		}

		// refresh edit animations
		this.refreshEdit();
		return true;
	}

	/**
	 * Helper function to get the current selection bounds object, bound to be within the matrix.
	 *
	 * @returns An object with the selection start and end values, and if only a single tile is selected.
	 * **Note:** This is inclusive. startY can equal to endY!
	 */
	private getSelection() {
		// get the height and width of the area
		const w = this.index.channels.length, h = this.index.matrixlen;

		// helper function for wrapping offsets
		const wrapOff = (size:number, off:number) => {
			if(off > size) {
				// too high above = wrap
				return off % size;

			} else if(off < -size) {
				// too high below = wrap
				return off % size;
			}

			// nowrap
			return off;
		}

		// calculate the positions
		const sy = Math.max(0, Math.min(h - 1, this.selectStart.y));
		const sx = Math.max(0, Math.min(w - 1, this.selectStart.x));
		const oy = wrapOff(h, this.selectOff.y);
		const ox = wrapOff(w, this.selectOff.x);

		// check if in single mode
		const single = ox === 0 && oy === 0;
		const rows:number[] = [], columns:number[] = [];

		if(ox >= 0) {
			// get columns: forward
			for(let x = 0; x <= ox; x++) {
				columns.push((x + sx) % w);
			}

		} else {
			// get columns: backward
			for(let x = 0; x >= ox; x--) {
				columns.push((w + x + sx) % w);
			}
		}

		if(oy >= 0) {
			// get rows: forward
			for(let y = 0; y <= oy; y++) {
				rows.push((y + sy) % h);
			}

		} else {
			// get rows: backward
			for(let y = 0; y >= oy; y--) {
				rows.push((h + y + sy) % h);
			}
		}

		// return the object
		return { startY: sy, startX: sx, offY: oy, offX: ox, height: h, width: w, single: single, rows: rows, columns: columns, };
	}

	/**
	 * Function to insert a new row right below selection
	 *
	 * @returns boolean indicating if the operation was successful
	 */
	private insert() {
		// insert below selection
		const { startY, offY, } = this.getSelection();
		if(!this.insertRow(startY + offY + 1)){
			return false;
		}

		// succeeded, select next row
		this.moveSelection("down", true);
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
								// select this item only
								this.select(false, { start: this.findMe(event.currentTarget as HTMLDivElement), offset: { x: 0, y: 0, }, });
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
			this.fixRowIndex(i);
		}
	}

	/**
	 * Function to fix row index of a single element
	 *
	 * @param row The row index to update
	 */
	private fixRowIndex(row:number) {
		if(row >= 0 && row < this.index.matrixlen) {
			// fix the innerText of this row
			this.byteToHTML((this.elrows.children[row + PatternIndexEditor.FILLER_ROWS].children[0] as HTMLDivElement), row);
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
	private findMe(e:HTMLDivElement): Position {
		// loop through all rows and elements in the row
		for(let r = this.elrows.children.length - 1 - PatternIndexEditor.FILLER_ROWS; r >= PatternIndexEditor.FILLER_ROWS;r --) {
			for(let c = this.elrows.children[r].children.length -1;c >= 1;c --) {

				// check if this is the element we are looking for
				if(this.elrows.children[r].children[c] === e){
					// if yes, return its position
					return { y: r - PatternIndexEditor.FILLER_ROWS, x: c - 1, };
				}
			}
		}

		// did not find?!
		return { y: -1, x: -1, };
	}

	/**
	 * Function to remove a rows at selection
	 *
	 * @returns boolean indicating whether the operation was successful
	 */
	private delete() {
		// grab the selection
		const { rows, startX, offX, startY, offY, } = this.getSelection();

		// delete the currently selected rows
		while(rows.length > 0) {
			const r = rows.shift() as number;

			// check if row can safely be deleted
			if(!this.deleteRow(r)) {
				return false;
			}

			// fix all the subsequent rows
			for(let y = 0;y < rows.length;y ++){
				if(rows[y] >= r){
					// fix the row index
					rows[y]--;
				}
			}
		}

		// check if there are no rows anymore
		if(this.index.matrixlen === 0){
			// insert a new row then
			if(!this.insertRow(0)){
				return false;
			}
		}

		// force selection to the next rows
		this.select(false, { start: { x: startX, y: startY + (offY < 0 ? offY : 0), }, offset:{ x: offX, y: 0, }, });
		return true;
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
	 * Function to duplicate a row or get data to the copy buffer
	 *
	 * @returns boolean indicating whether the operation was successful
	 */
	private copy() {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// single mode: this is a special case
			if(!this.copyRow(startY, startY + 1)){
				return false;
			}

			// if succeeded, move selection down
			this.moveSelection("down", true);
			return true;
		}

		// multi mode, copy to copy buffer: TODO: <- this feature
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