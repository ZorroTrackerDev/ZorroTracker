export class PatternEditor {
	// various standard elements for the pattern editor
	public element:HTMLElement;
	private elchans:HTMLElement;
	private elrows:HTMLElement;
	private elbtns:HTMLElement;

	constructor() {
		// generate the main element for this editor
		this.element = document.createElement("div");
		this.element.classList.add("patterneditor");

		// generate the channel display for this editor
		this.elchans = document.createElement("div");
		this.elchans.classList.add("patterneditor_channels");
		this.element.appendChild(this.elchans);

		// generate the pattern display for this editor
		this.elrows = document.createElement("div");
		this.elrows.classList.add("patterneditor_rows");
		this.element.appendChild(this.elrows);

		// generate the buttons for this editor
		this.elbtns = document.createElement("div");
		this.elbtns.classList.add("patterneditor_buttons");
		this.element.appendChild(this.elbtns);

		/**
		 * Helper function to create a new button at the bottom row
		 *
		 * @param text The button inner text
		 * @param title The tooltip to display when hovering with a mouse
		 * @param mouseup The event to run when the user clicks on the button
		 */
		const _makebutton = (text:string, title:string, mouseup:(event:MouseEvent) => unknown) => {
			const b = document.createElement("div");
			b.innerText = text;
			b.title = title;
			b.onmouseup = mouseup;
			this.elbtns.appendChild(b);
		}

		// the insert button: Insert a row below the current selection
		_makebutton("insert", "insert at selection", (event:MouseEvent) => {
			if(event.button === 0 && this.selectedRow >= -1) {
				// insert below selection
				this.addRow(this.selectedRow + 1);
				this.select(this.selectedRow + 1, this.selectedChan);
			}
		});

		// the delete button: Delete the currently selected row
		_makebutton("delete", "delete at selection", (event:MouseEvent) => {
			if(event.button === 0 && this.selectedRow >= 0) {
				// delete the currently selected row
				this.deleteRow(this.selectedRow);
				this.select(Math.min(this.selectedRow, this.elrows.children.length -1), this.selectedChan);
			}
		});

		// the copy button: Duplicate the currently selected row below
		_makebutton("copy", "duplicate selection", (event:MouseEvent) => {
			if(event.button === 0 && this.selectedRow >= 0) {
				// insert below selection
				this.copyRow(this.selectedRow, this.selectedRow + 1);
				this.select(this.selectedRow + 1, this.selectedChan);
			}
		});

		// static channel set function. TODO: Driver-dependant behavior
		this.setChannels([ "FM1", "FM2", "FM3", "FM4", "FM5", "FM6", "PCM", "PSG1", "PSG2", "PSG3", "PSG4", ]);

		// generate the first row
		this.addRow(0);

		// select the first row first channel
		this.select(0, 0);
	}

	/**
	 * Function to set the channels this editor recognizes
	 *
	 * @param list List of channel names as string array
	 */
	private setChannels(list:string[]) {
		// helper function to add a new element with text
		const _add = (text:string) => {
			const z = document.createElement("div");
			z.innerText = text;
			this.elchans.appendChild(z);
			return z;
		}

		// add each channel into the mix along with the insert button
		const insert = _add("​");
		list.forEach(_add);

		// add class and title for the insert button
		insert.classList.add("patterneditor_insert");
		insert.title = "left click: Insert below\nright click: Insert above";

		// handle clicking the insert button
		insert.onmouseup = (event:MouseEvent) => {
			switch(event.button) {
				case 0:		// left button, generate a new row at the very bottom and scroll down to it
					this.addRow(Number.MAX_SAFE_INTEGER);
					this.element.scroll({ top: Number.MAX_SAFE_INTEGER, });
					break;

				case 2:		// right button, generate a new row at the very top and scroll up to it
					this.addRow(0);
					this.element.scroll({ top: 0, });
					break;
			}
		}
	}

	/**
	 * Helper function to ensure a specific row is visible. This is usually done after selection.
	 *
	 * @param row the row to make visible
	 */
	private scrollTo(row:number) {
		// check that the row is valid
		if(row >= 0 && this.elrows.children.length > row){
			// get all the relevant bounding boxes for later
			const target = this.elrows.children[row].getBoundingClientRect();
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

	// the classname that is used for a selected item. Make sure LESS files also use the same name.
	private static SELECT_CLASS = "selected";

	/**
	 * Clear the user selection
	 */
	private clearSelect() {
		// remove class from all rows
		for(const row of this.elrows.children){
			row.classList.remove(PatternEditor.SELECT_CLASS);

			// remove class from all elements
			for(const e of row.children){
				e.classList.remove(PatternEditor.SELECT_CLASS);
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
		if(row >= 0 && this.elrows.children.length > row) {
			const erow = this.elrows.children[row];

			// check if the channel exists
			if(channel >= 0 && erow.children.length > channel) {
				const echan = erow.children[channel + 1];

				// apply special styles
				erow.classList.add(PatternEditor.SELECT_CLASS);
				echan.classList.add(PatternEditor.SELECT_CLASS);

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
	 * Function to add a new row into a specific position
	 *
	 * @param position position to add a new row into
	 * @returns boolean indicating if the operation was successful
	 */
	public addRow(position:number):boolean {
		const count = this.elrows.children.length;

		// if the max nmber of rows exist, then abandon ship
		if(count > 0xFF || position < 0) {
			return false;
		}

		// add a new row element based on the position
		const row = document.createElement("div");
		this.elrows.insertBefore(row, count < position ? null : this.elrows.children[position]);

		// generate all the pattern indices for this row (based on channel count)
		for(let channel = 0;channel < this.elchans.children.length; channel++) {
			// generate a new cell with the new value (number of rows... I know)
			const cell = document.createElement("div");
			cell.innerText = count.toByte();
			row.appendChild(cell);

			// ignore the row index number
			if(channel !== 0){
				// when clicked, select the item
				cell.onmouseup = (event:MouseEvent) => {
					switch(event.button) {
						case 0:	{	// left button
								// clear any previous selections
								this.clearSelect();

								// select this item
								const index = this.findMe(event.currentTarget as HTMLDivElement);
								this.select(index.row, index.channel);
								return true;
							}
					}
				}
			}
		}

		// fix the row indices
		this.fixRowIndex();
		return false;
	}

	/**
	 * Function to fix the row indices, so they always are based on the position
	 */
	private fixRowIndex() {
		for(let i = this.elrows.children.length - 1; i >= 0;i --) {
			// fix the innertext of the first child of each row to be position
			(this.elrows.children[i].children[0] as HTMLDivElement).innerText = i.toByte();
		}
	}

	/**
	 * Helper function to find an element in the pattern matrix, then to return the row and channel it was representing
	 *
	 * @param e The element you are attempting to find
	 * @returns an object containing the row and channel to select, or invalid row if failed to find
	 */
	private findMe(e:HTMLDivElement) {
		// loop through all rows and elements in the row
		for(let r = this.elrows.children.length - 1; r >= 0;r --) {
			for(let c = this.elrows.children[r].children.length -1;c >= 1;c --) {

				// check if this is the element we are looking for
				if(this.elrows.children[r].children[c] === e){
					// if yes, return its position
					return { row: r, channel: c - 1, };
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
		// check if the position is valid
		if(position < 0 || position >= this.elrows.children.length){
			return false;
		}

		// remove the entire row
		this.elrows.removeChild(this.elrows.children[position]);

		// fix the row indices
		this.fixRowIndex();
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
		// check if the source position is valid
		if(source < 0 || source >= this.elrows.children.length){
			return false;
		}

		// check if the destination position is valid
		if(destination < 0 || destination > this.elrows.children.length){
			return false;
		}

		// create the new row
		this.addRow(destination);

		// copy each row cells from source to destination
		for(let channel = 0;channel < this.elchans.children.length; channel++) {
			(this.elrows.children[destination].children[channel] as HTMLDivElement).innerText =
				(this.elrows.children[source].children[channel] as HTMLDivElement).innerText;
		}

		// fix the row indices
		this.fixRowIndex();
		return true;
	}
}