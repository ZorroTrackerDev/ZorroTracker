import { PatternIndex } from "../../../api/pattern";
import { Position, shortcutDirection, UIElement } from "../../../api/ui";

enum editMode {
	Normal, Write, Paste,
}

/**
 * Class to interact between the UI and the PatternIndex entry. Helps manage UI integration and intercommunication
 */
export class PatternIndexEditor implements UIElement {
	// various standard elements for the pattern editor
	public element!:HTMLElement;
	private elchans!:HTMLElement;
	private elrows!:HTMLElement;
	private elbtns!:HTMLElement;
	private elscroll!:HTMLElement;

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
		// clear some flags
		this.mode = editMode.Normal;
		this.editing = false;
		this.altSelect = false;
		this.selecting = null;
		this.sameselect = false;
		this.pasteData = null;

		// generate the main element for this editor
		this.element = document.createElement("div");
		this.element.classList.add("patterneditor");
		this.element.tabIndex = 0;						// cool so this whole element will break without this line here!

		// generate the channel display for this editor
		this.elchans = document.createElement("div");
		this.elchans.classList.add("patterneditor_channels");
		this.element.appendChild(this.elchans);

		// generate the pattern display for this editor
		this.elscroll = document.createElement("div")
		this.elscroll.classList.add("patterneditor_rows");
		this.element.appendChild(this.elscroll);

		this.elrows = document.createElement("div");
		this.elscroll.appendChild(this.elrows);

		// add the filler rows
		for(let x = PatternIndexEditor.FILLER_ROWS * 2;x > 0;x --){
			this.elrows.appendChild(document.createElement("p"));
		}

		// generate the buttons for this editor
		this.elbtns = document.createElement("div");
		this.elbtns.classList.add("patterneditor_buttons");
		this.element.appendChild(this.elbtns);

		// enable all the standard buttons
		this.setButtons(this.standardButtons);

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
	private mode = editMode.Normal;

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
		this.element.style.setProperty("--pattern_edit_pos", PatternIndexEditor.EDIT_STYLE(this.editing));
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
		const chan = this.elchans.getBoundingClientRect();
		const elm = this.elscroll.getBoundingClientRect();
		const butt = this.elbtns.getBoundingClientRect();

		// herlp function to grab the position of the row we're requesting
		const getPos = (r:number, position:"top"|"bottom") => {
			// check that the row is valid
			if(r >= -1 && this.index.getHeight() >= r){
				// get the row bounding box
				return this.elscroll.scrollTop - chan.height - butt.height +
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
	 * All the different standard buttons for controlling the pattern editor. This also has the functionality of these buttons.
	 */
	private standardButtons = [
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" stroke-width="10" d="
						M 50 8
						V 92
						M 8 50
						H 92
					"/>
				</svg>
			`,
			title: "increment digit",
			class: [ "left", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.change(1).catch(console.error);
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" stroke-width="10" d="
						M 12 50
						H 88
					"/>
				</svg>
			`,
			title: "decrement digit",
			class: [ "last", "left", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.change(-1).catch(console.error);
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
						M 50 92
						H 12
						V 8
						H 88
						V 55

						M 50 72
						L 69 92
						L 88 72

						M 69 92
						V 50
					"/>
				</svg>
			`,
			title: "insert at selection",
			class: [ "first", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.insert();
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
						M 30 8
						H 88
						V 80

						M 50 20
						H 15
						V 92
						H 75
						V 45
						L 50 20
						V 45
						H 75
					"/>
				</svg>
			`,
			title: "copy selection into clipboard",
			class: [],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.copy();
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
						M 27 20
						H 17
						V 92
						H 83
						V 20
						H 73

						M 67 32
						H 33
						V 16
						H 40
						Q 50,3 60,16
						H 67
						V 32

						M 32 45
						H 68

						M 32 60
						H 68

						M 32 75
						H 68
					"/>
				</svg>
			`,
			title: "paste pattern data from clipboard",
			class: [],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.pasteInit().catch(console.error);
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
						M 20 25
						V 82
						Q 20,92 30,92
						H 70
						Q 80,92 80,82
						V 25

						M 90 25
						H 10

						M 30 25
						L 38 8
						H 62
						L 70 25

						M 37 40
						V 75

						M 50 40
						V 75

						M 63 40
						V 75
					"/>
				</svg>
			`,
			title: "delete at selection",
			class: [ "last", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.delete();
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" d="
						M 35 22
						V 55
						H 12
						L 50 92
						L 88 55
						H 65
						V 22
						Z

						M 20 8
						H 80
					"/>
				</svg>
			`,
			title: "move selection down",
			class: [ "right", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.shiftDown().catch(console.error);
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" d="
						M 35 78
						V 45
						H 12
						L 50 8
						L 88 45
						H 65
						V 78
						Z

						M 20 92
						H 80
					"/>
				</svg>
			`,
			title: "move selection up",
			class: [ "first", "right", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode !== editMode.Paste) {
					edit.shiftUp().catch(console.error);
				}
			},
		},
	];

	/**
	 * All the different paste buttons for controlling the pattern editor. This also has the functionality of these buttons.
	 */
	private pasteButtons = [
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
						M 15 15
						L 85 85

						M 85 15
						L 15 85
					"/>
				</svg>
			`,
			title: "cancel the paste action",
			class: [ "first", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode === editMode.Paste) {
					edit.pasteExit();
				}
			},
		},
		{
			svg: /*html*/`
				<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
					<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
						M 80 25
						L 45 80
						L 20 60
					"/>
				</svg>
			`,
			title: "apply the paste area",
			class: [ "last", ],
			click: (edit:PatternIndexEditor, event:MouseEvent) => {
				if(event.button === 0 && edit.mode === editMode.Paste) {
					edit.pasteApply().catch(console.error);
				}
			},
		},
	];

	/**
	 * Set the bottom row buttons layout. Will clear the previous layout out first.
	 *
	 * @param buttons The list of buttons to apply
	 */
	private setButtons(buttons:{ svg:string, title:string, class:string[], click:(edit:PatternIndexEditor, event:MouseEvent) => void, }[]) {
		// remove all existing children!
		while(this.elbtns.children.length > 0) {
			this.elbtns.removeChild(this.elbtns.children[0]);
		}

		// apply the buttons
		buttons.forEach((button) => this.appendButton(button.svg, button.title, button.class, button.click));
	}

	/**
	 * Helper function to create a new button at the bottom row
	 *
	 * @param svg The button inner svg
	 * @param title The tooltip to display when hovering with a mouse
	 * @param classes The list of classes to apply
	 * @param mouseup The event to run when the user clicks on the button
	 */
	private appendButton(svg:string, title:string, classes:string[], click:(edit:PatternIndexEditor, event:MouseEvent) => unknown) {
		const button = document.createElement("div");
		button.innerHTML = svg;
		button.title = title;
		classes.forEach((name) => button.classList.add(name));
		button.onmouseup = (event:MouseEvent) => click(this, event);
		this.elbtns.appendChild(button);
	}

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[]):Promise<boolean> {
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
					return this.select(false, {
						start: { x: 0, y: 0, },
						offset: { x: this.index.getWidth() - 1, y: this.index.getHeight() - 1, },
					});

				case "selrow":
					// select the entire row
					return this.select(false, {
						start: { x: 0, y: this.selectStart.y, },
						offset: { x: this.index.getWidth() - 1, y: this.selectOff.y, },
					});

				case "selcolumn":
					// select the entire column
					return this.select(false, {
						start: { x: this.selectStart.x, y: 0, },
						offset: { x: this.selectOff.x, y: this.index.getHeight() - 1, },
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

				case "hex": {
					// disable in paste mode
					if(this.mode === editMode.Paste) {
						return false;
					}

					// parse the value we passed
					const value = parseInt(data.shift() ?? "NaN", 16);

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
					const values = this.index.getRegion(rows, columns);

					if(!values) {
						return false;
					}

					// loop for all elements to change values
					for(let i = values.length - 1;i >= 0;i--) {
						values[i] = values[i] & and | or;
					}

					// save the region and check if succeeded
					if(!await this.index.setRegion(rows, columns, values)){
						return false;
					}

					// make sure to trim all the unused patterns
					this.index.trimAll();

					// re-render rows and fix indices
					for(const r of rows) {
						if(!this.renderRow(r)) {
							return false;
						}

						this.fixRowIndex(r);
					}

					if(this.editing) {
						// check the next column
						let col = this.selectStart.x + Math.abs(this.selectOff.x) + 1, row = this.selectStart.y, mv = null;

						const h = this.index.getWidth();
						if(col >= h) {
							// need to wrap back to the beginning (go to the row below)
							col -= h;
							row = this.selectStart.y + Math.abs(this.selectOff.y) + 1;

							// wrap row address
							const w = this.index.getHeight();
							if(row >= w) {
								row -= w;
							}

							// focus on the end
							mv = false;
						}

						// if was editing the low nybble, move the selection forward also
						if(!this.select(mv, { start: { x: col, y: row, }, })){
							return false;
						}

					} else if(!this.reselect(null)){
						// if editing high nybble failed, return
						return false;
					}

					// swap editing position
					this.setEdit(!this.editing);
					return true;
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
	 * @returns boolean on whether or not the change was applied
	 */
	private async change(amount:number) {
		// load the selection and prepare the values
		const { rows, columns, single, } = this.getSelection();
		const realamt = amount * (this.editing ? 1 : 0x10);

		// do not edit in single mode without isEdit
		if(single && this.mode !== editMode.Write) {
			return false;
		}

		// load the region values and check if its valid
		const values = this.index.getRegion(rows, columns);

		if(!values) {
			return false;
		}

		// loop for all elements to modify values
		for(let i = values.length - 1;i >= 0;i--) {
			values[i] += realamt;
			values[i] &= 0xFF;
		}

		// save the region and check if succeeded
		if(!await this.index.setRegion(rows, columns, values)){
			return false;
		}

		// make sure to trim all the unused patterns
		this.index.trimAll();

		// re-render rows and fix indices
		for(const r of rows) {
			if(!this.renderRow(r)) {
				return false;
			}

			this.fixRowIndex(r);
		}

		// re-render selection
		return this.reselect(null);
	}

	/**
	 * Function to shift the selection upwards
	 *
	 * @returns boolean indicating if the operation was successful
	 */
	private async shiftUp() {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// single mode is special uwu
			if(!await this.index.swapRows(startY, startY - 1)) {
				return false;
			}

			// re-render the 2 rows
			this.renderRow(startY);
			this.renderRow(startY - 1);
			this.fixRowIndex(startY);
			this.fixRowIndex(startY - 1);

		} else {
			// gather some basic variables to reference later
			const size = this.index.getHeight();
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
			if(!await this.index.setRegion([ firstcol, ], columns, swap)){
				return false;
			}

			// set the rest of the region now. We need to be sure to insert the right way round
			_rows = _rows.filter((value) => value !== firstcol);
			_rows[_rowmd](swapcol);

			// add the region and check for failure
			if(!await this.index.setRegion(_rows, columns, main)){
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
	private async shiftDown() {
		// load the selection
		const { startY, offY, single, rows, columns, } = this.getSelection();

		if(single) {
			// single mode is special uwu
			if(!await this.index.swapRows(startY, startY + 1)) {
				return false;
			}

			// re-render the 2 rows
			this.renderRow(startY);
			this.renderRow(startY + 1);
			this.fixRowIndex(startY);
			this.fixRowIndex(startY + 1);

		} else {
			// gather some basic variables to reference later
			const size = this.index.getHeight();
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
			if(!await this.index.setRegion([ lastcol, ], columns, swap)){
				return false;
			}

			// set the rest of the region now. We need to be sure to insert the right way round
			_rows = _rows.filter((value) => value !== lastcol);
			_rows[_rowmd](swapcol);

			// add the region and check for failure
			if(!await this.index.setRegion(_rows, columns, main)){
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
				start: { x: this.selectStart.x, y: dir.y > 0 ? this.index.getHeight() - 1 : 0, },
				offset: { x: this.selectOff.x, y: 0, },
			});

		} else {
			// handle extending selection
			return this.select(false, {
				offset: { x: this.selectOff.x, y: (dir.y > 0 ? this.index.getHeight() - 1 : 0) - this.selectStart.y, },
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
				x: f1(this.selectStart.x + position.x, this.index.getWidth()),
				y: f1(this.selectStart.y + position.y, this.index.getHeight()),
			},
			// apply the offset position if both = false
			offset: both ? undefined :  {
				x: f2(this.selectOff.x + position.x, this.index.getWidth()),
				y: f2(this.selectOff.y + position.y, this.index.getHeight()),
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
		const _add = (text:string, index:number) => {
			const z = document.createElement("div");
			z.innerText = text;
			this.elchans.appendChild(z);

			// when you click on a channel, select that column
			if(index >= 0) {
				z.onmouseup = (event:MouseEvent) => {
					// select the entire index
					this.select(null, { start: { x: index, y: 0, }, offset: { x: 0, y: this.index.getHeight() - 1, }, });
					event.preventDefault();
				}
			}
			return z;
		}

		// add each channel into the mix along with the insert button
		const insert = _add("​", -1);
		this.index.channels.forEach(_add);

		// add class and title for the insert button
		insert.classList.add("patterneditor_insert");
		insert.title = "left click: Insert below\nright click: Insert above";

		// handle clicking the insert button
		insert.onmouseup = (event:MouseEvent) => {
			switch(event.button) {
				case 0:	{	// left button, generate a new row at the very bottom and scroll down to it
					const h = this.index.getHeight();
					this.insertRow(h);
					this.scrollTo(h - 1, h - 1, true);
					break;
				}

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

	// the classname that is used for a pasting an item. Make sure LESS files also use the same name.
	private static PASTE_CLASS = "pasting";

	// whether to use an alternate select class
	private altSelect = false;

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
				e.classList.remove(PatternIndexEditor.PASTE_CLASS);
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
			const xmx = this.index.getWidth();
			if(pos.x < (negative ? -(xmx - 1) : 0) || pos.x >= xmx){
				return;
			}

			// validate y-position
			const ymx = this.index.getHeight();
			if(pos.y < (negative ? -(ymx - 1) : 0) || pos.y >= ymx){
				return;
			}

			// if in paste mode, limit the size
			if(negative && this.mode === editMode.Paste) {
				pos.x = Math.min(this.pasteSize.x - 1, Math.max(-this.pasteSize.x + 1, pos.x));
				pos.y = Math.min(this.pasteSize.y - 1, Math.max(-this.pasteSize.y + 1, pos.y));
			}

			// completely fine, change the position
			change(pos);
			changed = true;
		};

		// copy old rows selection
		const oldrows = this.getSelection().rows;

		// validate start and end positions
		setPos(false, target.start, (pos:Position) => this.selectStart = pos);
		setPos(true, target.offset, (pos:Position) => this.selectOff = pos);

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
			newrows.forEach((row) => this.renderRow(row) && this.fixRowIndex(row));
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
			const erow = this.elrows.children[y + PatternIndexEditor.FILLER_ROWS];

			if(!this.altSelect && !edit) {
				erow.classList.add(PatternIndexEditor.SELECT_CLASS);
			}

			// loop for every channel giving it the selected or editing class
			columns.forEach((x) => {
				erow.children[x + 1].classList.add(this.altSelect ? PatternIndexEditor.PASTE_CLASS :
					!edit || this.selecting !== null ? PatternIndexEditor.SELECT_CLASS :
					PatternIndexEditor.EDIT_CLASS);
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
		const w = this.index.getWidth(), h = this.index.getHeight();

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
		this.elrows.insertBefore(row, this.index.getHeight() <= position ? null : this.elrows.children[position + PatternIndexEditor.FILLER_ROWS]);

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
		const size = this.index.getSize();
		let rows:null|number[] = null, columns:null|number[] = null;
		let psx = 0, psy = 0;

		// get the row data and check if it's null (invalid row)
		const data = this.index.getRow(position);

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
				cell.onmousedown = (event:MouseEvent) => {
					if(event.button === 0) {
						// check if we're selecting the same item as before
						const sel = this.findMe(event.currentTarget as HTMLDivElement);

						if(this.mode === editMode.Normal) {
							// if selecting the same cell, enable special flag
							this.sameselect = this.selectOff.x === 0 && this.selectOff.y === 0 &&
								this.selectStart.x === sel.x && this.selectStart.y === sel.y;

						} else {
							// disable special flag and write mode
							this.sameselect = false;
							if(this.mode === editMode.Write) {
								this.mode = editMode.Normal;
							}
						}

						// enable selection mode and select the current node
						this.selecting = true;
						this.select(null, { start: sel, offset: { x: 0, y: 0, }, });

						// when we release the button, just stop selecting
						this.documentDragFinish();
					}
				}

				// when dragging on the channel
				this.doDrag(cell, position);

			} else {
				// handle dragging on the indices row
				cell.onmousedown = (event:MouseEvent) => {
					if(event.button === 0) {
						// disable write mode
						if(this.mode === editMode.Write) {
							this.mode = editMode.Normal;
						}

						// enable selection mode and select the current node
						this.selecting = false;
						this.select(null, { start: { x: 0,  y: position, }, offset: { x: this.index.getWidth() - 1, y: 0, }, });

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
		el.onmousemove = (event:MouseEvent) => {
			if(this.selecting === true) {
				// handle selecting matrix
				const sel = this.findMe(event.currentTarget as HTMLDivElement);

				// check for invalid selection
				if(sel.y < 0) {
					return;
				}

				// move selection over
				this.select(null, { offset: { x: sel.x - this.selectStart.x, y: sel.y - this.selectStart.y, }, });

			} else if(this.selecting === false) {
				// handle selecting rows
				this.select(null, { offset: { x: this.index.getWidth() - 1, y: extra as number - this.selectStart.y, }, });
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
				if(this.selectOff.x === 0 && this.selectOff.y === 0 && this.sameselect) {
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
		for(let i = this.index.getHeight() - 1; i >= 0;i --) {
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
		if(row >= 0 && row < this.index.getHeight()) {
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
		if(this.index.getHeight() === 0){
			// insert a new row then
			if(!this.insertRow(0)){
				return false;
			}
		}

		// reset edit mode
		if(this.mode === editMode.Write){
			this.mode = editMode.Normal;
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
		// multi mode, copy to copy buffer: TODO: <- this feature
		const pos = this.selectStart, size = this.selectOff;

		// make sure x-position is the right way round
		if(size.x < 0) {
			pos.x += size.x;
			size.x = -size.x;
		}

		// make sure x-position is the right way round
		if(size.y < 0) {
			pos.y += size.y;
			size.y = -size.y;
		}

		// copy this region
		return this.copyRegion(pos, size) !== null;
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

	/**
	 * Function to copy a region into the clipboard
	 *
	 * @param position The position of the start row to start copying from
	 * @param size The size of the selection to copy
	 * @returns null if failed or string that is also sent to the clipboard
	 */
	private copyRegion(position:Position, size:Position) {
		const str:string[] = [];

		// get matrix size so we can wrap things properly
		const msz = this.index.getSize();

		// loop for all rows
		for(let y = position.y;y <= position.y + size.y;y++) {
			const s:string[] = [];

			// load the row data and check if its valid
			const row = this.index.getRow(y % msz.y);

			if(!row) {
				return null;
			}

			// loop for all channels copying the values
			for(let x = position.x;x <= position.x + size.x;x++) {
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
		navigator.clipboard.writeText(ret).catch(console.error);
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
	private async pasteInit() {
		try {
			// load the clipboard data as a string
			const str = await navigator.clipboard.readText();
			const rows = str.trim().split("\n");

			// if there are no rows, return
			if(rows.length === 0 || rows.length > this.index.getHeight()){
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
					if(cols.length === 0 || rowlen > this.index.getWidth()){
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
			this.select(null, { offset: { x: rowlen - 1, y: rows.length - 1, }, });

			// enable all the paste buttons
			this.setButtons(this.pasteButtons);
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
	private async pasteApply() {
		// check even if in paste mode
		if(this.mode !== editMode.Paste) {
			return false;
		}

		// load selection bounds
		const size = this.index.getSize();
		const { startX, startY, offX, offY, } = this.getSelection();
		const psx = startX + (offX < 0 ? offX : 0);
		const psy = startY + (offY < 0 ? offY : 0);

		// run through each row
		for(let i = 0, y = 0;y <= Math.abs(offY);y ++){
			// load the row data and check if valid
			const row = this.index.getRow((size.y + psy + y) % size.y);

			if(!row) {
				return false;
			}

			// apply the new row data
			for(let x = 0;x <= Math.abs(offX);x ++) {
				row[(size.x + psx + x) % size.x] = (this.pasteData as number[])[i++];
			}

			// save the new row data
			if(!await this.index.setRow((size.y + psy + y) % size.y, row)) {
				return false;
			}
		}

		// trim all unused indices
		this.index.trimAll();

		// re-render selection and exit paste mode
		return this.pasteExit();
	}

	/**
	 * Function to exit paste mode
	 *
	 * @returns whether the operation was successful
	 */
	private pasteExit() {
		// check even if in paste mode
		if(this.mode !== editMode.Paste) {
			// if not, just set selection size
			return this.select(null, { offset: { x: 0, y: 0, }, });
		}

		// enable all the standard buttons
		this.setButtons(this.standardButtons);

		// reset to normal mod
		this.mode = editMode.Normal;
		this.pasteData = null;
		this.altSelect = false;

		// re-render selection
		const { rows, } = this.getSelection();
		rows.forEach((row) => this.renderRow(row) && this.fixRowIndex(row));
		return this.reselect(null);
	}
}
