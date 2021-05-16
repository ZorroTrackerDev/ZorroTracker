import { PatternIndex } from "../../../api/pattern";

/**
 * Class to interact between the UI and the PatternIndex entry. Helps manage UI integration and intercommunication
 */
export class PatternIndexEditor {
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
	}

	private setLayout() {
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

		// enable all the standard buttons
		this.standardButtons.forEach((button) => this.appendButton(button.text, button.title, button.click));

		// enable the channels
		this.setChannels();
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
				if(event.button === 0 && edit.selectedRow >= 0 && edit.elrows.children.length > 1) {
					// delete the currently selected row
					edit.deleteRow(edit.selectedRow);
					edit.select(Math.min(edit.selectedRow, edit.elrows.children.length -1), edit.selectedChan);
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
					this.insertRow(this.elrows.children.length);
					this.element.scroll({ top: Number.MAX_SAFE_INTEGER, });
					break;

				case 2:		// right button, generate a new row at the very top and scroll up to it
					this.insertRow(0);
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
		if(row >= 0 && this.elrows.children.length > row) {
			const erow = this.elrows.children[row];

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
		this.elrows.insertBefore(row, this.elrows.children.length < position ? null : this.elrows.children[position]);

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
		const row = this.elrows.children[position] as HTMLDivElement;

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
				cell.innerText = data[channel - 1].toByte();

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
	 * Function to fix the row indices, so they always are based on the position
	 */
	private fixRowIndices() {
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
		// delete the row data from index, and bail if failed
		if(!this.index.deleteRow(position)) {
			return false;
		}

		// remove the UI row
		this.elrows.removeChild(this.elrows.children[position]);

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