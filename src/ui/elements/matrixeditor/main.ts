import { tooltipShortcutText } from "../../../api/dom";
import { Bounds, clipboard, ClipboardType, Position, shortcutDirection, UIElement } from "../../../api/ui";
import { Undo, UndoSource } from "../../../api/undo";
import { Tab } from "../../misc/tab";
import { standardButtons, pasteButtons, PatternIndexEditorButtonList } from "./buttons";

// the editing mode enum
export enum editMode {
	Normal, Write, Paste,
}

/**
 * Class to interact between the UI and the Matrix entry. Helps manage UI integration and intercommunication
 */
export class MatrixEditor implements UIElement {
	// various standard elements for the matrix editor
	public element!:HTMLElement;
	private elchans!:HTMLElement;
	private elrows!:HTMLElement;
	private elbtns!:HTMLElement;
	private elscroll!:HTMLElement;

	/**
	 * This is the tab that the pattern editor is working in
	 */
	private tab:Tab;

	/**
	 * Initialize this MatrixEditor instance
	 *
	 * @param index The Matrix this PatternEditor is targeting
	 */
	constructor(tab:Tab) {
		this.tab = tab;
		this.setLayout();
	}

	// amount of filler rows at the top (fixes broken scroll behavior)
	private static FILLER_ROWS = 1;

	private setLayout() {
		// clear some flags
		this.mode = editMode.Normal;
		this.editing = false;
		this.altSelect = false;
		this.selecting = null;
		this.sameselect = false;
		this.pasteData = null;

		// generate the main element for this editor
		this.element = document.createElement("div");
		this.element.classList.add("matrix");
		this.element.tabIndex = 0;						// cool so this whole element will break without this line here!

		// generate the pattern display for this editor
		this.elscroll = document.createElement("div")
		this.elscroll.classList.add("matrix_wrap");
		this.element.appendChild(this.elscroll);

		// generate the channel display for this editor
		this.elchans = document.createElement("div");
		this.elchans.classList.add("matrix_channels");
		this.elscroll.appendChild(this.elchans);

		// add the pattern rows itself
		this.elrows = document.createElement("div");
		this.elrows.classList.add("matrix_rows");
		this.elscroll.appendChild(this.elrows);

		// generate the buttons for this editor
		this.elbtns = document.createElement("div");
		this.elbtns.classList.add("matrix_buttons");
		this.element.appendChild(this.elbtns);

		// enable all the standard buttons
		this.setButtons(standardButtons);

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
				this.scroll(Math.round(event.deltaY / 100 * MatrixEditor.SCROLL_STEP));
			}
		}, { passive: false, });

		// DO NOT register button presses
		this.element.onkeydown = (e) => e.preventDefault();

		// update the layout to comply with index
		this.resetMatrixDisplay().catch(console.error);
	}

	/**
	 * Function to fully reset and update matrix view depending on the index
	 */
	private async resetMatrixDisplay() {
		// remove all existing children!
		while(this.elrows.children.length > 0) {
			this.elrows.removeChild(this.elrows.children[0]);
		}

		// add the filler rows
		for(let x = MatrixEditor.FILLER_ROWS;x > 0;x --){
			this.elrows.appendChild(document.createElement("p"));
		}

		// fill in rows
		for(let r = 0; r < this.tab.matrix.matrixlen;r ++) {
			if(await this.insertRowUI(r)) {
				this.fixRowIndex(r);
			}
		}

		// if the matrix is completely empty, insert a row here
		if(this.tab.matrix.matrixlen === 0) {
			const dirty = Tab.active?.project.isDirty();
			await this.insertRow(0);

			// if project was not dirty, pretend we didn't do any edits yet
			if(!dirty) {
				Tab.active?.project.clean();
			}
		}

		// select the first element
		await this.select(null, { x: 0, y: 0, h: 0, w: 0, });
	}

	// the current text editing mode: false = left, true = right
	private editing = false;

	// if we are editing a single row currently. Multirow editing will be enabled even when this is false
	mode = editMode.Normal;

	/**
	 * Helper function to handle mode toggling (usually with the enter button)
	 *
	 * @returns boolean indicating success
	 */
	private editToggle() {
		switch(this.mode) {
			case editMode.Normal: this.mode = editMode.Write; return this.reselect(null);
			case editMode.Write: this.mode = editMode.Normal; return this.reselect(null);
			case editMode.Paste: return this.pasteApply();
		}

		return false;
	}

	// the array containing the strings for animation iteration count depending on the editing mode
	private static EDIT_STYLE = (state:boolean) => state ? "49%" : "16%";

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
		this.element.style.setProperty("--pattern_edit_pos", MatrixEditor.EDIT_STYLE(this.editing));
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
		const height = 1 + ((this.elrows.children[MatrixEditor.FILLER_ROWS] as HTMLDivElement|undefined)?.offsetHeight ?? 0);

		// apply scrolling here
		this.elscroll.scrollTop += speed * height;
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
		const chanh = this.elchans.getBoundingClientRect().height * 2;
		const elm = this.elscroll.getBoundingClientRect();

		// herlp function to grab the position of the row we're requesting
		const getPos = (r:number, position:"top"|"bottom") => {
			// check that the row is valid
			if(r >= -1 && this.tab.matrix.getHeight() >= r){
				// get the row bounding box
				return this.elscroll.scrollTop - chanh +
					this.elrows.children[r + MatrixEditor.FILLER_ROWS].getBoundingClientRect()[position];
			}

			// plz same position
			return 0;
		}

		// get row scroll positions
		const rtop = getPos(row1 < row2 ? row1 - 1 : row2 - 1, "top");
		const rbot = getPos(row1 > row2 ? row1 + 0 : row2 + 0, "bottom");
		const _h = elm.height - chanh;

		if(rbot - rtop > _h){
			// too much space, just focus on one of the nodes
			const target = getPos(sec ? row1 : row2, "top");
			this.elscroll.scrollTop = target - (_h / 2);

		} else if(this.elscroll.scrollTop > rtop){
			// average the position, enough space
			this.elscroll.scrollTop -= (this.elscroll.scrollTop - rtop);

		} else if(this.elscroll.scrollTop + _h <= rbot){
			// average the position, enough space
			this.elscroll.scrollTop += rbot - (this.elscroll.scrollTop + _h);
		}
	}

	/**
	 * Set the bottom row buttons layout. Will clear the previous layout out first.
	 *
	 * @param buttons The list of buttons to apply
	 */
	private setButtons(buttons:PatternIndexEditorButtonList[]) {
		// remove all existing children!
		while(this.elbtns.children.length > 0) {
			this.elbtns.removeChild(this.elbtns.children[0]);
		}

		// apply the buttons
		buttons.forEach((button) => this.appendButton(button));
	}

	/**
	 * Helper function to create a new button at the bottom row
	 *
	 * @param svg The button inner svg
	 * @param title The tooltip to display when hovering with a mouse
	 * @param classes The list of classes to apply
	 * @param mouseup The event to run when the user clicks on the button
	 */
	private appendButton(data:PatternIndexEditorButtonList) {
		const button = document.createElement("div");
		data.class.forEach((name) => button.classList.add(name));

		data.items.forEach((d) => {
			const b = document.createElement("div");
			b.innerHTML = d.svg;
			b.title = tooltipShortcutText(d.tooltip, d.shortcut);

			// if there is a click event, add it
			if(d.click) {
				b.onmouseup = (event:MouseEvent) => d.click?.(this, event);
			}

			// if there is a load event, run it
			if(d.load) {
				d.load(b, this);
			}

			// add to the main button
			button.appendChild(b);
		});

		// add to the button list
		this.elbtns.appendChild(button);
	}

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[], e:KeyboardEvent|undefined, state:boolean|undefined):Promise<boolean> {
		if(document.querySelector(":focus") === this.element) {
			// has focus, process the shortcut
			switch(data.shift()) {
				case "edit":		return this.editToggle();
				case "shiftdown":	return this.mode !== editMode.Paste && this.shiftDown();
				case "shiftup":		return this.mode !== editMode.Paste && this.shiftUp();
				case "insert":		return this.mode !== editMode.Paste && this.insert();
				case "delete":		return this.mode !== editMode.Paste && this.delete();
				case "copy":		return this.mode !== editMode.Paste && this.copy();
				case "move":		return this.moveSelection(data.shift(), true);
				case "movemax":		return this.specialSelection(data.shift(), true);
				case "select":		return this.moveSelection(data.shift(), false);
				case "selmax":		return this.specialSelection(data.shift(), false);
				case "pasteenter":	return this.mode !== editMode.Paste && this.pasteInit();
				case "pasteexit":	return this.pasteExit();

				case "selall":
					// select the entire matrix
					return this.select(false, { x: 0, y: 0, w: this.tab.matrix.getWidth() - 1, h: this.tab.matrix.getHeight() - 1, });

				case "selrow":
					// select the entire row
					return this.select(false, { x: 0, w: this.tab.matrix.getWidth() - 1, });

				case "selcolumn":
					// select the entire column
					return this.select(false, { y: 0, h: this.tab.matrix.getHeight() - 1, });

				case "scroll": {
					// convert direction string to x/y offsets
					const dir = shortcutDirection(data.shift());

					if(!dir || !dir.y) {
						return false;
					}

					// apply scrolling
					this.scroll(dir.y * MatrixEditor.SCROLL_STEP);
					return true;
				}

				case "hex": {
					// parse the value we passed
					const value = parseInt(data.shift() ?? "NaN", 16);

					// convert to hex
					return this.setHex(value);
				}

				case "change": {
					// disable in paste mode
					if(this.mode === editMode.Paste) {
						return false;
					}

					// convert direction string to x/y offsets
					const dir = shortcutDirection(data.shift());

					if(!dir || !dir.y) {
						return false;
					}

					// apply the change
					return this.change(dir.y * -1);
				}
			}
		}

		return false;
	}

	/**
	 * Function to change digits by an amount.
	 *
	 * @param amount The amount to change by. This is affected by the digit
	 * @param digit The digit to affect, or `undefined` if it is to be chosen based on selection
	 * @returns boolean on whether or not the change was applied
	 */
	// eslint-disable-next-line require-await
	async change(amount:number, digit?:boolean):Promise<boolean> {
		// load the selection and prepare the values
		const { rows, columns, single, } = this.getSelection();
		const realamt = amount * ((digit ?? this.editing) ? 1 : 0x10);

		// do not edit in single mode without write mode and no digit set
		if(digit === undefined && single && this.mode !== editMode.Write) {
			return false;
		}

		// make a clone of the bounds object
		const clone = this.selection.clone();

		// helper function to execute the actual query
		const _do = async(amt:number) => {
			// load the region values and check if its valid
			const values = await this.tab.matrix.getRegion(rows, columns);

			if(!values) {
				return false;
			}

			// loop for all elements to modify values
			for(let i = values.length - 1;i >= 0;i--) {
				values[i] += amt;
				values[i] &= 0xFF;
			}

			// save the region and check if succeeded
			if(!await this.tab.matrix.setRegion(rows, columns, values)){
				return false;
			}

			// make sure to trim all the unused patterns
			await this.tab.matrix.trimAll();

			// re-render rows and fix indices
			if(!await this.renderRows(rows)) {
				return false;
			}

			// re-apply selection
			return this.select(null, clone);
		}

		// create the undo action
		return Undo.add({
			source: UndoSource.Matrix,
			redo: () => _do(realamt),
			undo: () => _do(-realamt),
		}) as Promise<boolean>;
	}

	/**
	 * Function to change cell digits to a specific value
	 *
	 * @param value The value to set cells to
	 * @returns boolean indicating whether it was successful
	 */
	private async setHex(value:number) {
		// disable in paste mode
		if(this.mode === editMode.Paste) {
			return false;
		}

		// make sure the value was 100% sure correct or otherwise ignore this code
		if(isNaN(value) || value < 0 || value > 0xF) {
			return false;
		}

		// load the selection and prepare the values
		const { rows, columns, single, } = this.getSelection();
		const and = 0xF << (this.editing ? 4 : 0);
		const or = value << (this.editing ? 0 : 4);

		// do not edit in single mode without isEdit
		if(single && this.mode !== editMode.Write) {
			return false;
		}

		// load the region values and check if its valid
		const values = await this.tab.matrix.getRegion(rows, columns);

		if(!values) {
			return false;
		}

		// create copies of the array and selection
		const _vcopy = values.slice();
		const clone = this.selection.clone();
		const edit = this.editing;

		// loop for all elements to change values
		for(let i = values.length - 1;i >= 0;i--) {
			values[i] = values[i] & and | or;
		}

		// helper function for updating selection and other stuff
		const help = async() => {
			// make sure to trim all the unused patterns
			await this.tab.matrix.trimAll();

			// re-render rows and fix indices
			return this.renderRows(rows);
		}

		// create the undo entry for this action
		return Undo.add({
			source: UndoSource.Matrix,
			undo: async() => {		// save the region and check if succeeded
				if(!await this.tab.matrix.setRegion(rows, columns, _vcopy)){
					return false;
				}

				// re-render stuffs and things
				if(!await help()) {
					return false;
				}

				// re-apply selection
				this.setEdit(edit);
				return this.select(null, clone);
			},
			redo: async() => {
				// save the region and check if succeeded
				if(!await this.tab.matrix.setRegion(rows, columns, values)){
					return false;
				}

				// re-render stuffs and things
				if(!await help()) {
					return false;
				}

				// reset the selection before editing it
				if(!this.select(null, clone)){
					return false;
				}

				if(edit) {
					// check the next column
					let col = this.selection.x + Math.abs(this.selection.width) + 1, row = this.selection.y, mv = null;

					const h = this.tab.matrix.getWidth();
					if(col >= h) {
						// need to wrap back to the beginning (go to the row below)
						col -= h;
						row = this.selection.y + Math.abs(this.selection.height) + 1;

						// wrap row address
						const w = this.tab.matrix.getHeight();
						if(row >= w) {
							row -= w;
						}

						// focus on the end
						mv = false;
					}

					// if was editing the low nybble, move the selection forward also
					if(!await this.select(mv, { x: col, y: row, })){
						return false;
					}
				}

				// swap editing position
				this.setEdit(!edit);
				return true;
			},
		}) as Promise<boolean>;
	}

	/**
	 *
	 * @param position Position to swap from
	 * @param offset The offset of the row to swap with
	 */
	private async simpleSwap(position: number, offset:-1|1) {
		const selClone = this.selection.clone();

		const swap = async (sel:number) => {
			// swap the actual rows
			if(!await this.tab.matrix.swapRows(position, position + offset)) {
				return false;
			}

			// re-render the 2 rows
			const render = await this.renderRow(position) && await this.renderRow(position + offset);
			this.fixRowIndex(position);
			this.fixRowIndex(position + offset);

			// re-select
			return this.select(true, { x: selClone.x, y: selClone.y + sel, w: 0, h: 0, }) && render;
		}

		// single mode has super simple method
		return await Undo.add({ source: UndoSource.Matrix, undo: () => swap(0), redo: () => swap(offset), }) as Promise<boolean>;
	}

	/**
	 * Function to shift the selection upwards
	 *
	 * @returns boolean indicating if the operation was successful
	 */
	async shiftUp():Promise<boolean> {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// check if we are selecting the first row already
			if(startY === 0) {
				return false;
			}

			// run the swap operation
			return this.simpleSwap(startY, -1);
		}

		// gather some basic variables to reference later
		const size = this.tab.matrix.getHeight();
		let swapcol = (size - 1 + startY + (offY < 0 ? offY : 0)) % size;
		let firstcol = (size + startY + (offY > 0 ? offY : 0)) % size;

		// copy to _rows variable because eslint
		let _rows = rows;
		let urows = rows;
		let _rowmd:"push"|"unshift" = offY > 0 ? "push" : "unshift";

		if(rows.length === size) {
			// if full selection, we need to do some special shenanigans
			swapcol = 0;
			firstcol = size - 1;
			_rowmd = "unshift";

			// create new set of rows! yes!
			_rows = [];
			urows = [];

			for(let i = 1;i < size; i ++){
				_rows.push(i);
				urows.push(i);
			}
		}

		// collect the region information
		const main = await this.tab.matrix.getRegion(_rows, columns);
		const swap = await this.tab.matrix.getRegion([ swapcol, ], columns);

		// if we failed to gather the regions
		if(!main || !swap) {
			return false;
		}

		// prepare _rows data
		_rows = _rows.filter((value) => value !== firstcol);
		_rows[_rowmd](swapcol);

		// clone the selection
		const _sel = this.selection.clone();

		// add to the undo stack
		return await Undo.add({
			source: UndoSource.Matrix,
			undo: async() => {
				// reset the first row region
				if(!await this.tab.matrix.setRegion([ swapcol, ], columns, swap)){
					return false;
				}

				// reset the main data
				if(!await this.tab.matrix.setRegion(urows, columns, main)){
					return false;
				}

				// re-render all rows
				await this.renderRow(swapcol);
				await this.renderRows(urows);

				// fix indices
				this.fixRowIndices();

				// re-select rows
				return this.select(null, _sel);
			},
			redo: async() => {
				// add the swap row data in already
				if(!await this.tab.matrix.setRegion([ firstcol, ], columns, swap)){
					return false;
				}

				// add the region and check for failure
				if(!await this.tab.matrix.setRegion(_rows, columns, main)){
					return false;
				}

				// re-render all rows
				await this.renderRow(firstcol);
				await this.renderRows(_rows);

				// fix indices
				this.fixRowIndices();

				// re-select rows
				if(!await this.select(null, _sel)) {
					return false;
				}

				// move the selection up by 1 row
				return this.moveSelection("up", true);
			},
		}) as Promise<boolean>;
	}

	/**
	 * Function to shift the selection downwards
	 *
	 * @returns boolean indicating if the operation was successful
	 */
	async shiftDown():Promise<boolean> {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// check if we are selecting the last row already
			if(startY === this.tab.matrix.getHeight() - 1) {
				return false;
			}

			// run the swap operation
			return this.simpleSwap(startY, 1);
		}

		// gather some basic variables to reference later
		const size = this.tab.matrix.getHeight();
		let swapcol = (size + 1 + startY + (offY > 0 ? offY : 0)) % size;
		let lastcol = (size + startY + (offY < 0 ? offY : 0)) % size;

		// copy to _rows variable because eslint
		let _rows = rows;
		let urows = rows;
		let _rowmd:"push"|"unshift" = offY > 0 ? "push" : "unshift";

		if(rows.length === size) {
			// if full selection, we need to do some special shenanigans
			swapcol = size - 1;
			lastcol = 0;
			_rowmd = "push";

			// create new set of rows! yes!
			_rows = [];
			urows = [];

			for(let i = 0;i < size - 1; i ++){
				_rows.push(i);
				urows.push(i);
			}
		}

		// collect the region information
		const main = await this.tab.matrix.getRegion(_rows, columns);
		const swap = await this.tab.matrix.getRegion([ swapcol, ], columns);

		// if we failed to gather the regions
		if(!main || !swap) {
			return false;
		}

		// prepare _rows data
		_rows = _rows.filter((value) => value !== lastcol);
		_rows[_rowmd](swapcol);

		// clone the selection
		const _sel = this.selection.clone();

		// add to the undo stack
		return await Undo.add({
			source: UndoSource.Matrix,
			undo: async() => {
				// reset the first row region
				if(!await this.tab.matrix.setRegion([ swapcol, ], columns, swap)){
					return false;
				}

				// reset the main data
				if(!await this.tab.matrix.setRegion(urows, columns, main)){
					return false;
				}

				// re-render all rows
				await this.renderRow(swapcol);
				await this.renderRows(urows);

				// fix indices
				this.fixRowIndices();

				// re-select rows
				return this.select(null, _sel);
			},
			redo: async() => {
				// add the swap row data in already
				if(!await this.tab.matrix.setRegion([ lastcol, ], columns, swap)){
					return false;
				}

				// add the region and check for failure
				if(!await this.tab.matrix.setRegion(_rows, columns, main)){
					return false;
				}

				// re-render all rows
				await this.renderRow(lastcol);
				await this.renderRows(_rows);

				// fix indices
				this.fixRowIndices();

				// re-select rows
				if(!await this.select(null, _sel)) {
					return false;
				}

				// move the selection down by 1 row
				return this.moveSelection("down", true);
			},
		}) as Promise<boolean>;
	}

	/**
	 * Function to move the current selection by arrow keys.
	 *
	 * @param direction The direction we are going to move in as a string
	 * @param both True if moving both the start and end of selection
	 * @returns boolean indicating whether the operation was successful
	 */
	private async moveSelection(direction: string|undefined, both: boolean): Promise<boolean> {
		// convert direction string to x/y offsets
		const dir: undefined | Position = shortcutDirection(direction);

		if(!dir) {
			return false;
		}

		// if we are editing
		if(this.mode !== editMode.Paste && both && (this.mode === editMode.Write || !this.getSelection().single)) {
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
		await this.select(dir.y === 0 ? null : !both ? false : !!(+(dir.y > 0) ^ +(this.selection.height >= 0)),
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
	// eslint-disable-next-line require-await
	private async specialSelection(direction: string|undefined, both: boolean): Promise<boolean> {
		// convert direction string to x/y offsets
		const dir: undefined | Position = shortcutDirection(direction);

		if(!dir) {
			return false;
		}

		if(both) {
			// handle moving selection
			return this.select(false, { y: dir.y > 0 ? this.tab.matrix.getHeight() - 1 : 0, h: 0, });

		} else {
			// handle extending selection
			return this.select(false, { h: (dir.y > 0 ? this.tab.matrix.getHeight() - 1 : 0) - this.selection.y, });
		}
	}

	/**
	 * Helper function to wrap the position to be in bounds with the pattern matrix
	 *
	 * @param position The input position to be wrapped
	 * @returns The object for this.select call
	 */
	private doPosition(position:Position, both:boolean,
		f1:(start:number, max:number) => number, f2:(start:number, max:number) => number): { x?:number, y?:number, w?:number, h?:number } {

		return {
			// apply x/y only if both = true
			x: !both ? undefined : f1(this.selection.x + position.x, this.tab.matrix.getWidth()),
			y: !both ? undefined : f1(this.selection.y + position.y, this.tab.matrix.getHeight()),

			// apply w/h only if both = false
			w: both ? undefined : f2(this.selection.width + position.x, this.tab.matrix.getWidth()),
			h: both ? undefined : f2(this.selection.height + position.y, this.tab.matrix.getHeight()),
		};
	}

	/**
	 * Function to set the channels this editor recognizes
	 *
	 * @param list List of channel names as string array
	 */
	private setChannels() {
		// helper function to add a new element with text
		const _add = (text:string, index:number) => {
			const z = document.createElement("div");
			z.innerText = text;
			this.elchans.appendChild(z);

			// when you click on a channel, select that column
			if(index >= 0) {
				z.onmouseup = async(event:MouseEvent) => {
					// select the entire index
					await this.select(null, { x: index, y: 0, w: 0, h: this.tab.matrix.getHeight() - 1, });
					event.preventDefault();
				}
			}
			return z;
		}

		// add each channel into the mix along with the insert button
		const insert = _add("​", -1);
		this.tab.channels.forEach((channel, index) => _add(channel.info.name, index));

		// add class and title for the insert button
		insert.classList.add("matrix_insert");
		insert.title = "left click: Insert below\nright click: Insert above";

		// handle clicking the insert button
		insert.onmouseup = (event:MouseEvent) => {
			switch(event.button) {
				case 0:	{	// left button, generate a new row at the very bottom and scroll down to it
					const h = this.tab.matrix.getHeight();
					return this.insertMax(h, h - 1);
				}

				case 2:		// right button, generate a new row at the very top and scroll up to it
				return this.insertMax(0, 0);
			}
		}
	}

	/**
	 * Function to insert a row to the top or bottom of the matrix
	 *
	 * @param insert To which position to insert a row
	 * @param scroll To which line to scroll to
	 * @returns Boolean indicating whether or not it was successful
	 */
	private async insertMax(insert:number, scroll:number) {
		if(await Undo.add({
			source: UndoSource.Matrix,
			redo: async() => {
				// insert row to the bottom
				if(await this.insertRow(insert)) {
					// re-render selection
					return this.reselect(null);
				}

				return false;
			},
			undo: async() => {
				// delete the inserted row
				if(await this.deleteRow(insert)) {
					// re-render selection
					return this.reselect(null);
				}

				return false;
			},
		}) as Promise<boolean>) {
			this.scrollTo(scroll - 1, scroll - 1, true);
			return true;
		}

		return false;
	}

	// the classname that is used for the currently active row is the beginning of the loop point.
	private static LOOP_CLASS = "loop";

	// the classname that is used for the currently active row/column. Used for the pattern editor display.
	private static ACTIVE_CLASS = "active";

	// the classname that is used for a selected item. Make sure LESS files also use the same name.
	private static SELECT_CLASS = "selected";

	// the classname that is used for a editing an item. Make sure LESS files also use the same name.
	private static EDIT_CLASS = "editing";

	// the classname that is used for a pasting an item. Make sure LESS files also use the same name.
	private static PASTE_CLASS = "pasting";

	// whether to use an alternate select class
	private altSelect = false;

	/**
	 * Clear the user selection
	 */
	private clearSelect() {
		// remove class from all rows
		for(let i = 0;i < this.elrows.children.length;i ++){
			// remove class from all elements
			for(let x = this.elrows.children[i].children.length - 1;x >= 0; --x){
				const e = this.elrows.children[i].children[x];

				e.classList.remove(MatrixEditor.SELECT_CLASS);
				e.classList.remove(MatrixEditor.EDIT_CLASS);
				e.classList.remove(MatrixEditor.PASTE_CLASS);
			}
		}
	}

	// the currently selected area
	private selection:Bounds = new Bounds();

	/**
	 * Function to set the current selection of the pattern editor
	 *
	 * @param offset Whether to prefer focusing on the node at offset (true) or start (false)
	 * @param target An object describing the new targeted position(s) of selection.
	 * @returns True if selection can be applied, false if not
	 */
	public async select(offset:boolean|null, target:Bounds|{ x?:number, y?:number, w?:number, h?:number }):Promise<boolean> {
		let changed = false;

		// helper function to process a position
		const setPos = (negative:boolean, pos:number|undefined, max:number, change:(pos:number) => void, paste?:number) => {
			// validate that we were given a valid position
			if(pos === undefined) {
				return;
			}

			// validate position
			if(pos < (negative ? -(max - 1) : 0) || pos >= max){
				return;
			}

			let px = pos;

			// if in paste mode, limit the size
			if(negative && this.mode === editMode.Paste) {
				px = Math.min((paste as number) - 1, Math.max(-(paste as number) + 1, pos));
			}

			// completely fine, change the position
			change(px);
			changed = true;
		};

		// copy old rows selection
		const oldrows = this.getSelection().rows;

		// validate the positions
		setPos(false, target.x, this.tab.matrix.getWidth(), (pos:number) => this.selection.x = pos);
		setPos(false, target.y, this.tab.matrix.getHeight(), (pos:number) => this.selection.y = pos);

		setPos(true, target instanceof Bounds ? target.width : target.w,
			this.tab.matrix.getWidth(), (pos:number) => this.selection.width = pos, this.pasteSize.x);
		setPos(true, target instanceof Bounds ? target.height : target.h,
			this.tab.matrix.getHeight(), (pos:number) => this.selection.height = pos, this.pasteSize.y);

		// if nothing was changed, return
		if(!changed){
			return false;
		}

		if(this.mode === editMode.Paste) {
			// get the new rows selection
			const newrows = this.getSelection().rows;

			// combine oldrows and newrows into one
			oldrows.forEach((row) => !newrows.includes(row) && newrows.push(row));

			// re-render all of the rows
			if(!await this.renderRows(newrows)) {
				return false;
			}
		}

		return this.reselect(offset);
	}

	/**
	 * Helper function to re-enable selection area
	 *
	 * @returns boolean indicating success
	 */
	private reselect(offset:boolean|null) {
		// clear any previous selections
		this.clearSelect();

		// organize the selection boundaries
		const { rows, columns, single, } = this.getSelection();
		const edit = !single || this.mode === editMode.Write;

		// loop for every row
		rows.forEach((y) => {
			// get the row element and give it the selected class (only in single mode!)
			const erow = this.elrows.children[y + MatrixEditor.FILLER_ROWS];

			// loop for every channel giving it the selected or editing class
			columns.forEach((x) => {
				erow.children[x + 1].classList.add(this.altSelect ? MatrixEditor.PASTE_CLASS :
					!edit || this.selecting !== null ? MatrixEditor.SELECT_CLASS :
					MatrixEditor.EDIT_CLASS);
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
		const w = this.tab.matrix.getWidth(), h = this.tab.matrix.getHeight();

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
		const sy = Math.max(0, Math.min(h - 1, this.selection.y));
		const sx = Math.max(0, Math.min(w - 1, this.selection.x));
		const oy = wrapOff(h, this.selection.height);
		const ox = wrapOff(w, this.selection.width);

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
	async insert():Promise<boolean> {
		// insert below selection
		const { startY, offY, } = this.getSelection();

		// succeeded, select next row
		const clone = this.selection.clone();

		// add the undo action
		return await Undo.add({
			source: UndoSource.Matrix,
			redo: async() => {
				// insert a row at position
				if(!await this.insertRow(startY + offY + 1)){
					return false;
				}

				// set selection to what it is after
				if(this.select(null, clone)) {
					return this.moveSelection("down", true);
				}

				return false;
			},
			undo: async() => {
				// delete a row from position
				if(!await this.deleteRow(startY + offY + 1)){
					return false;
				}

				// set selection to what it was before
				return this.select(null, clone);
			},
		}) as Promise<boolean>;
	}

	/**
	 * Function to insert a new row into a specific position
	 *
	 * @param position position to insert a new row into
	 * @returns boolean indicating if the operation was successful
	 */
	public async insertRow(position:number):Promise<boolean> {
		// generate a new row in the pattern index object
		const ixrow = this.tab.matrix.generateRow();

		// generate new patterns at values
		if(!await this.tab.matrix.makePatternsRow(ixrow, false)) {
			return false;
		}

		// attempt to insert this new row at position. If it fails, return
		if(!await this.tab.matrix.insertRow(position, ixrow)){
			return false;
		}

		// add the row to the UI now
		return this.insertRowUI(position);
	}

	/**
	 * Function to insert a new row UI into a specific position
	 *
	 * @param position position to insert a new row into
	 * @returns boolean indicating if the operation was successful
	 */
	private async insertRowUI(position:number):Promise<boolean> {
		// insert a new row element based on the position
		const row = document.createElement("div");
		this.elrows.insertBefore(row, this.tab.matrix.getHeight() <= position ? null : this.elrows.children[position + MatrixEditor.FILLER_ROWS]);

		// render the row at position
		if(!await this.renderRow(position)){
			return false;
		}

		// fix the row indices
		this.fixRowIndices();
		return true;
	}

	/**
	 * Function to to re-render multiple rows in the UI.
	 *
	 * @param rows Array of rows to re-render
	 * @returns boolean indicating whether it succeeded
	 */
	private async renderRows(rows:number[]) {
		// re-render rows and fix indices
		for(const r of rows) {
			// render this row and bail if failed
			if(!await this.renderRow(r)) {
				return false;
			}

			// fix its index
			this.fixRowIndex(r);
		}

		// success!
		return true;
	}

	/**
	 * Function to render a single row of the UI. This will not correctly update the row index, however.
	 *
	 * @param position The row index to update
	 * @returns boolean indicating success
	 */
	private async renderRow(position:number) {
		const size = this.tab.matrix.getSize();
		let rows:null|number[] = null, columns:null|number[] = null;
		let psx = 0, psy = 0;

		// get the row data and check if it's null (invalid row)
		const data = await this.tab.matrix.getRow(position);

		if(data === null) {
			return false;
		}

		// if in paste mode, get selection
		if(this.mode === editMode.Paste) {
			const sel = this.getSelection();

			// copy variables
			rows = sel.rows;
			columns = sel.columns;

			// find the start row and column
			psx = sel.startX + (sel.offX < 0 ? sel.offX : 0);
			psy = sel.startY + (sel.offY < 0 ? sel.offY : 0);
		}

		// get the row element
		const row = this.elrows.children[position + MatrixEditor.FILLER_ROWS] as HTMLDivElement;

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
				let byte = data[channel - 1];

				if(this.mode === editMode.Paste) {
					// if in paste mode, check if this cell is overridden
					if((rows as number[]).includes(position) && (columns as number[]).includes(channel - 1)) {
						// get the actual byte now
						byte = (this.pasteData as number[])[
							(((size.x + channel - 1 - psx) % size.x) +
							(((size.y + position - psy) % size.y)) * this.pasteSize.x)] ?? 0;
					}
				}

				// render this cell
				this.byteToHTML(cell, byte);

				// when mousedown, handle drag starting
				cell.onmousedown = async(event:MouseEvent) => {
					if(event.button === 0) {
						// check if we're selecting the same item as before
						const sel = this.findMe(event.currentTarget as HTMLDivElement);

						// check if selecting the same cell as previously
						const same = this.selection.width === 0 && this.selection.height === 0 &&
							this.selection.x === sel.x && this.selection.y === sel.y;

						if(this.mode === editMode.Normal) {
							// if selecting the same cell, enable special flag
							this.sameselect = same;

						} else {
							// disable special flag and write mode (but only if selecting the same cell)
							this.sameselect = false;

							if(same && this.mode === editMode.Write) {
								this.mode = editMode.Normal;
							}
						}

						// enable selection mode and select the current node
						this.selecting = true;
						await this.select(null, { x: sel.x, y: sel.y, w: 0, h: 0, });

						// when we release the button, just stop selecting
						this.documentDragFinish();
					}
				}

				// when dragging on the channel
				this.doDrag(cell, position);

			} else {
				// handle dragging on the indices row
				cell.onmousedown = async(event:MouseEvent) => {
					if(event.button === 0) {
						// disable write mode
						if(this.mode === editMode.Write) {
							this.mode = editMode.Normal;
						}

						// enable selection mode and select the current node
						this.selecting = false;
						await this.select(null, { x: 0,  y: position, w: this.tab.matrix.getWidth() - 1, h: 0, });

						// when we release the button, just stop selecting
						this.documentDragFinish();
					}
				}

				// when dragging on the channel
				this.doDrag(cell, position);
			}
		}

		return true;
	}

	/**
	 * Helper event function to do dragging on the matrix
	 *
	 * @param event the mouse event
	 */
	private doDrag(el:HTMLDivElement, extra?:number) {
		el.onmousemove = async(event:MouseEvent) => {
			if(this.selecting === true) {
				// handle selecting matrix
				const sel = this.findMe(event.currentTarget as HTMLDivElement);

				// check for invalid selection
				if(sel.y < 0) {
					return;
				}

				// move selection over
				await this.select(null, { w: sel.x - this.selection.x, h: sel.y - this.selection.y, });

			} else if(this.selecting === false) {
				// handle selecting rows
				await this.select(null, { w: this.tab.matrix.getWidth() - 1, h: extra as number - this.selection.y, });
			}
		}
	}

	/**
	 * Helper event function to finish the dragging on document
	 *
	 * @param event the mouse event
	 */
	private documentDragFinish() {
		document.onmouseup = (event:MouseEvent) => {
			// check if selecting matrix
			if(this.selecting === true) {
				// check if sameselect = true and only selecting a single cell
				if(this.selection.width === 0 && this.selection.height === 0 && this.sameselect) {
					// check to enable write mode
					if(this.mode === editMode.Normal) {
						this.mode = editMode.Write;
					}
				}

				// release selection
				this.sameselect = false;
			}

			// release selection
			this.selecting = null;
			this.reselect(false);

			// disable event
			event.preventDefault();
			document.onmouseup = null;

			// bug! In paste mode, rewriting the nodes causes the focus to be lost... somehow. Re-focus on the element to receive shortcuts.
			this.element.focus();
		}
	}

	// if true, curently selecting pattern matrix. If false, selecting rows. If null, not selecting
	private selecting:boolean|null = null;

	// if true, selecting the same cell that was already selected
	private sameselect = false;

	/**
	 * Helper function to convert the byte value to 2 div elements
	 *
	 * @param element The element to apply style to
	 * @param byte The value to apply here
	 */
	private byteToHTML(element:HTMLDivElement, byte:number) {
		const text = byte.toByte();
		element.innerText = text;
	}

	/**
	 * Function to fix the row indices, so they always are based on the position
	 */
	private fixRowIndices() {
		for(let i = this.tab.matrix.getHeight() - 1; i >= 0;i --) {
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
		if(row >= 0 && row < this.tab.matrix.getHeight() && row < this.elrows.children.length - MatrixEditor.FILLER_ROWS) {
			// fix the innerText of this row
			this.byteToHTML((this.elrows.children[row + MatrixEditor.FILLER_ROWS].children[0] as HTMLDivElement), row);
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
		const byte = this.tab.matrix.get(channel, row);

		if(byte === null) {
			return;
		}

		// get the target element
		const erow = this.elrows.children[row + MatrixEditor.FILLER_ROWS] as HTMLDivElement;
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
		for(let r = this.elrows.children.length - 1; r >= MatrixEditor.FILLER_ROWS;r --) {
			for(let c = this.elrows.children[r].children.length -1;c >= 1;c --) {

				// check if this is the element we are looking for
				if(this.elrows.children[r].children[c] === e){
					// if yes, return its position
					return { y: r - MatrixEditor.FILLER_ROWS, x: c - 1, };
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
	async delete():Promise<boolean> {
		// grab the selection
		const { rows, startX, offX, startY, offY, } = this.getSelection();

		// generate columns
		const cols:number[] = [];

		for(let x = this.tab.matrix.getWidth() - 1;x >= 0;x --){
			cols.unshift(x);
		}

		// clone the selection
		const clone = this.selection.clone();
		const data = await this.tab.matrix.getRegion(rows, cols);
		let hasnullrow = false;

		// if failed to fetch data, return
		if(!data) {
			return false;
		}

		// add the undo action
		return await Undo.add({
			source: UndoSource.Matrix,
			undo: async() => {
				// insert rows at correct positions
				const nulldata = new Uint8Array(this.tab.matrix.getWidth());

				for(let i = 0;i < rows.length;i ++) {
					// special case because we need at least 1 row
					if(hasnullrow && i === 0) {
						continue;
					}

					// try to add the row with some null data
					if(!await this.tab.matrix.insertRow(rows[i], nulldata)){
						return false;
					}
				}

				// push the actual data into the rows
				if(!await this.tab.matrix.setRegion(rows, cols, data)){
					return false;
				}

				// re-render rows and fix indices
				for(const r of rows) {
					// special case because we need at least 1 row
					if(hasnullrow) {
						hasnullrow = false;
						continue;
					}

					if(!await this.insertRowUI(r)) {
						return false;
					}
				}

				// re-select
				return this.select(null, clone);
			},
			redo: async () => {
				const _rs = rows.slice();

				// delete the currently selected rows
				while(_rs.length > 0) {
					const r = _rs.shift() as number;

					// check if row can safely be deleted
					if(!await this.deleteRow(r)) {
						return false;
					}

					// fix all the subsequent rows
					for(let y = 0;y < _rs.length;y ++){
						if(_rs[y] >= r){
							// fix the row index
							_rs[y]--;
						}
					}
				}

				// check if there are no rows anymore
				if(this.tab.matrix.getHeight() === 0){
					// insert a new row then
					if(!await this.insertRow(0)){
						return false;
					}

					// special case uh oh
					hasnullrow = true;
				}

				// reset edit mode
				if(this.mode === editMode.Write){
					this.mode = editMode.Normal;
				}

				// force selection to the next rows
				return this.select(false, { x: startX, y: startY + (offY < 0 ? offY : 0), w: offX, h: 0, });
			},

		}) as Promise<boolean>;
	}

	/**
	 * Function to remove a row from the pattern matrix
	 *
	 * @param position the position of the row to delete
	 * @returns boolean indicating whether the operation was successful
	 */
	public async deleteRow(position:number):Promise<boolean> {
		// delete the row data from index, and bail if failed
		if(!await this.tab.matrix.deleteRow(position)) {
			return false;
		}

		// remove the UI row
		this.elrows.removeChild(this.elrows.children[position + MatrixEditor.FILLER_ROWS]);

		// fix the row indices
		this.fixRowIndices();
		return true;
	}

	/**
	 * Function to duplicate a row or get data to the copy buffer
	 *
	 * @returns boolean indicating whether the operation was successful
	 */
	async copy():Promise<boolean> {
		// multi mode, copy to copy buffer: TODO: <- this feature
		const pos = this.selection;

		// make sure x-position is the right way round
		if(pos.width < 0) {
			pos.x += pos.width;
			pos.width = -pos.width;
		}

		// make sure x-position is the right way round
		if(pos.height < 0) {
			pos.y += pos.height;
			pos.height = -pos.height;
		}

		// copy this region
		return await this.copyRegion(pos) !== null;
	}

	/**
	 * Function to insert a new row and copy another row into it.
	 *
	 * @param source The position of the source row to copy data from
	 * @param destination The position of the destination row to insert and copy data to
	 * @returns boolean indicating whether the operation was successful
	 */
	public async copyRow(source:number, destination:number):Promise<boolean> {
		// get the source row from index
		const ixrow = await this.tab.matrix.getRow(source);

		// attempt to insert this new row at destination. If it fails, return
		if(!ixrow || !await this.tab.matrix.insertRow(destination, ixrow)){
			return false;
		}

		// add the row to the UI now
		return this.insertRowUI(destination);
	}

	/**
	 * Function to copy a region into the clipboard
	 *
	 * @param pos The boundaries of the copy
	 * @returns null if failed or string that is also sent to the clipboard
	 */
	private async copyRegion(pos:Bounds) {
		const str:string[] = [];

		// get matrix size so we can wrap things properly
		const msz = this.tab.matrix.getSize();

		// loop for all rows
		for(let y = pos.y;y <= pos.y + pos.height;y++) {
			const s:string[] = [];

			// load the row data and check if its valid
			const row = await this.tab.matrix.getRow(y % msz.y);

			if(!row) {
				return null;
			}

			// loop for all channels copying the values
			for(let x = pos.x;x <= pos.x + pos.width;x++) {
				s.push(row[x % msz.x].toByte());
			}

			// join via pipe symbols
			str.push(s.join(" | "));
		}

		// show a little animation for selection
		this.altSelect = true;
		this.reselect(null);

		setTimeout(() => {
			this.altSelect = false;
			this.reselect(null);
		}, 250);

		// copy text to clipboard
		const ret = str.join("\n");

		if(!await clipboard.set(ClipboardType.Matrix, ret)) {
			return null;
		}

		return ret;
	}

	// paste size object
	private pasteSize:Position = { x: 0, y: 0, };

	// paste data object
	private pasteData:number[]|null = null;

	/**
	 * Function to start paste mode
	 *
	 * @returns boolean indicating whether the operation was successful
	 */
	async pasteInit():Promise<boolean> {
		try {
			// load the clipboard data as a string
			const str = await clipboard.get(ClipboardType.Matrix);
			const rows = str?.trim().split("\n");

			// if there are no rows, return
			if(!rows || rows.length === 0 || rows.length > this.tab.matrix.getHeight()){
				return false;
			}

			// prepare some values here... This code won't be too nice
			let rowlen = -1;
			this.pasteData = [];

			// convert each row into the temp array
			for(let r = 0;r < rows.length; r++){
				if(rows[r].trim().length === 0){
					continue;
				}

				const cols = rows[r].split("|");

				// check if we need to update the row length
				if(rowlen < 0){
					// check if there are no columns, bail
					if(cols.length === 0 || rowlen > this.tab.matrix.getWidth()){
						return false;
					}

					// update row length
					rowlen = cols.length;

				} else if(rowlen !== cols.length) {
					// if row length does not match, bail
					return false;
				}

				// convert the input
				const cc = cols.map((s) => parseInt(s.trim(), 16));

				// validate the input, and if invalid, bail
				if(!cc.reduce((acc, cur) => acc && (!isNaN(cur) && cur >= 0 && cur <= 0xFF), true)){
					return false;
				}

				// plop the input into the paste array
				for(let c = 0;c < rowlen;c ++){
					// copy single cell
					this.pasteData[(r * rowlen) + c] = cc[c];
				}
			}

			// enable paste mode
			this.mode = editMode.Paste;
			this.altSelect = true;

			// set size of the selection
			this.pasteSize = { x: rowlen, y: rows.length, };
			await this.select(null, { w: rowlen - 1, h: rows.length - 1, });

			// enable all the paste buttons
			this.setButtons(pasteButtons);
			return true;

		} catch(ex){
			console.error(ex);
		}

		// try to get to a regular working state!
		this.mode = editMode.Paste;
		return this.pasteExit();
	}

	/**
	 * Function to apply paste data at selection
	 *
	 * @returns whether the operation was successful
	 */
	async pasteApply():Promise<boolean> {
		// check even if in paste mode
		if(this.mode !== editMode.Paste) {
			return false;
		}

		// load selection bounds
		const size = this.tab.matrix.getSize();
		const { startX, startY, offX, offY, rows, columns, } = this.getSelection();
		const psx = startX + (offX < 0 ? offX : 0);
		const psy = startY + (offY < 0 ? offY : 0);

		// clone data and selection
		const pasteClone = this.pasteData?.slice() as number[];
		const selClone = this.selection.clone();

		// load the selected area values
		const data = await this.tab.matrix.getRegion(rows, columns);

		if(!data) {
			return false;
		}

		if(!(await Undo.add({
			source: UndoSource.Matrix,
			undo: async() => {
				// reset the selection data
				if(!await this.tab.matrix.setRegion(rows, columns, data)) {
					return false;
				}

				// re-render all those rows
				if(!await this.renderRows(rows)) {
					return false;
				}

				// set selection
				return this.select(null, selClone);
			},
			redo: async() => {
				// run through each row
				for(let i = 0, y = 0;y <= Math.abs(offY);y ++){
					// load the row data and check if valid
					const row = await this.tab.matrix.getRow((size.y + psy + y) % size.y);

					if(!row) {
						return false;
					}

					// apply the new row data
					for(let x = 0;x <= Math.abs(offX);x ++) {
						row[(size.x + psx + x) % size.x] = pasteClone[i++];
					}

					// save the new row data
					if(!await this.tab.matrix.setRow((size.y + psy + y) % size.y, row)) {
						return false;
					}
				}

				// trim all unused indices
				await this.tab.matrix.trimAll();

				// re-render all rows
				if(!await this.renderRows(rows)) {
					return false;
				}

				return this.select(null, selClone);
			},
		}) as Promise<boolean>)) {
			return false;
		}

		// re-render selection and exit paste mode
		return this.pasteExit(false);
	}

	/**
	 * Function to exit paste mode
	 *
	 * @returns whether the operation was successful
	 */
	async pasteExit(render?:boolean):Promise<boolean> {
		// check even if in paste mode
		if(this.mode !== editMode.Paste) {
			// if not, just set selection size
			return this.select(null, { w: 0, h: 0, });
		}

		// enable all the standard buttons
		this.setButtons(standardButtons);

		// reset to normal mod
		this.mode = editMode.Normal;
		this.pasteData = null;
		this.altSelect = false;

		if(render !== false) {
			// re-render all selected rows
			const { rows, } = this.getSelection();

			if(!await this.renderRows(rows)) {
				return false;
			}
		}

		// re-render selection
		return this.reselect(null);
	}
}
