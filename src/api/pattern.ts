import { Position } from "./ui";
import { ZorroEvent, ZorroEventEnum, ZorroListenerTypes } from "../api/events";


/**
 * Class for a single pattern cell, which can only be used to store its immediate values.
 */
 export class PatternCell {
	public note:unknown;
	public volume:unknown;
	public commands:unknown[];

	constructor(){
		this.note = 0;
		this.volume = 0;
		this.commands = [];
	}
}

/**
 * Class to hold data for a single pattern and help with intercommunication
 */
export class PatternData {
	public cells:PatternCell[];
	public owner:string;
	public edited = false;

	constructor(owner:string){
		this.owner = owner;
		this.cells = [];
	}
}

/**
 * Class to hold the pattern index of the song. Will be managed by both the PatternEditor instance and the wider program.
 */
export class PatternIndex {
	// Stores the list of channels this pattern index stores
	public channels:string[];

	// Stores a list of patterns per channel. Usage: patterns[channel][index]. Null/undefined means the value is unused
	public patterns:(PatternData | null)[][];

	// Stores the pattern matrix, where the mappings from song order to pattern index are stored. Usage: matrix[channel][index].
	public matrix:Uint8Array[];

	// Stores the length of the matrix. Values at greater offsets should always be set to 0. Allows to easily determine long the pattern matrix is.
	public matrixlen = 0;

	constructor(channels:string[]) {
		this.channels = channels;
		this.patterns = [];
		this.matrix = [];

		// initialize the patterns and matrix arrays to max values
		for(let i = 0;i < channels.length;i ++){
			this.patterns.push(new Array(256));
			this.matrix.push(new Uint8Array(256));
		}

		// create the set event
		this.eventSet = ZorroEvent.createEvent(ZorroEventEnum.PatternMatrixSet).send;
	}

	private eventSet:ZorroListenerTypes[ZorroEventEnum.PatternMatrixSet]

	/**
	 * Function to get the size of the matrix
	 *
	 * @returns The size of the matrix
	 */
	public getSize():Position {
		return { x: this.getWidth(), y : this.getHeight(), };
	}

	/**
	 * Function to get the height of the matrix
	 *
	 * @returns The height of the matrix
	 */
	public getHeight():number {
		return this.matrixlen;
	}

	/**
	 * Function to get the width of the matrix
	 *
	 * @returns The width of the matrix
	 */
	public getWidth():number {
		return this.channels.length;
	}

	/**
	 * Function to get the pattern index for a specified row and column.
	 *
	 * @param channel The channel to generate a row for
	 * @param index The index to use for generating a row
	 * @returns Null if failed, or the index if successful
	 */
	public get(channel:number, index:number):number|null {
		// check that index and channel are valid
		if(index < 0 || index > 0xFF || channel < 0 || channel >= this.channels.length) {
			return null;
		}

		// return the value at channel and index
		return this.matrix[channel][index];
	}

	/**
	 * Function to get the pattern indices for a specified row.
	 *
	 * @param index Index of the row to get
	 * @returns Null if failed, or an array of pattern indices
	 */
	public getRow(index:number):Uint8Array|null {
		// check that the index is valid
		if(index < 0 || index >= this.matrixlen) {
			return null;
		}

		// generate a new data array to store stuff in
		const ret = new Uint8Array(this.channels.length);

		// run through every channel in backwards order, copying the row data
		for(let c = this.channels.length - 1;c >= 0;c --) {
			ret[c] = this.matrix[c][index];
		}

		// return the entire data array
		return ret;
	}

	/**
	 * Function to get a region of matrix elements into a flat array
	 *
	 * @param rows The list of rows to return. Will be reformatted in order
	 * @param columns The list of columns to retrurn. Will be reformatted in order
	 * @returns null if we failed, or the full list of elements as flat array
	 */
	public getRegion(rows:number[], columns:number[]):number[]|null {
		// generate a new array of values
		const ret:number[] = Array(rows.length * columns.length);
		let index = 0;

		for(const c of columns) {
			// run for each channel, and makre sure the channel is valid
			if(c < 0 || c >= this.channels.length){
				return null;
			}

			for(const r of rows) {
				// run for each row, and makre sure the row is valid
				if(r < 0 || r >= this.matrixlen){
					return null;
				}

				// copy the value from matrix
				ret[index++] = this.matrix[c][r];
			}
		}

		return ret;
	}

	/**
	 * Function to set the pattern index for a specified row and column.
	 *
	 * @param channel The channel to generate a row for
	 * @param index The index to use for generating a row
	 * @param value The value to put into that index
	 * @returns Null if failed, or the index if successful
	 */
	public set(channel:number, index:number, value:number):boolean {
		// check that index and channel are valid
		if(value < 0 || value > 0xFF || index < 0 || index > 0xFF || channel < 0 || channel >= this.channels.length) {
			return false;
		}

		// send the set event for this cell and see if we succeeded
		if(this.eventSet(this, channel, index, value)) {
			// set the value at channel and index and indicate success
			this.matrix[channel][index] = value;
			return true;
		}

		return false;
	}

	/**
	 * Function to override an entire row with data. This is an unsafe operation.
	 *
	 * @param index Index of the row to change
	 * @param data The row data to change to
	 * @returns boolean indicating whether it was successful or not.
	 */
	public setRow(index:number, data:Uint8Array):boolean {
		// check that the index is valid
		if(index < 0 || index > 0xFF) {
			return false;
		}

		// run through every channel in backwards order, replacing the row data
		for(let c = this.channels.length - 1;c >= 0;c --) {
			// call the event and apply only if allowed
			if(this.eventSet(this, c, index, data[c])) {
				this.matrix[c][index] = data[c];
			}
		}

		// return the entire data array
		return true;
	}

	/**
	 * Function to set a region of matrix elements from a flat array
	 *
	 * @param rows The list of rows to return. Will be reformatted in order
	 * @param columns The list of columns to retrurn. Will be reformatted in order
	 * @param values The flat array of values to set
	 * @returns boolean indicating whether the entire operation succeeded
	 */
	public setRegion(rows:number[], columns:number[], values:number[]):boolean {
		// make sure the array is the right length
		if(values.length !== rows.length * columns.length) {
			return false;
		}

		let index = 0;

		for(const c of columns) {
			// run for each channel, and makre sure the channel is valid
			if(c < 0 || c >= this.channels.length){
				return false;
			}

			for(const r of rows) {
				// run for each row, and makre sure the row is valid
				if(r < 0 || r >= this.matrixlen){
					return false;
				}

				// make the pattern if it doesnt exist
				this.makePattern(c, values[index], false);

				// copy the value from matrix
				this.matrix[c][r] = values[index++];
			}
		}

		return true;
	}

	/**
	 * Function to swap the places of 2 rows.
	 *
	 * @param row1 The row to switch `row2` with
	 * @param row2 The row to switch `row1` with
	 * @returns boolean indicating whether it was successful or not.
	 */
	public swapRows(row1:number, row2:number):boolean {
		// if we're trying to use the same row, bail out
		if(row1 === row2) {
			return false;
		}

		// copy the row1 and row2 data into buffers
		const rd1 = this.getRow(row1);
		const rd2 = this.getRow(row2);

		// if either row failed, return
		if(!rd1 || !rd2) {
			return false;
		}

		// copy row data over and return the resulting boolean
		let ret = true;
		ret &&= this.setRow(row1, rd2);
		ret &&= this.setRow(row2, rd1);
		return ret;
	}

	/**
	 * Helper function to generate a new row of data to be passed to the caller. This will NOT add it to the matrix
	 *
	 * @returns Uint8Array containing the row data for each channel
	 */
	public generateRow():Uint8Array {
		const ret = new Uint8Array(this.channels.length);

		// loop through each channel
		for(let c = 0;c < ret.length;c ++){
			// if no free patterns are found, default to FF! This is bad, though...
			ret[c] = 0xFF;

			// find the next free pattern for channel and save the value
			for(let y = 0;y < 256;y ++){
				if(!this.patterns[c][y]) {
					ret[c] = y;
					break;
				}
			}
		}

		// return the entire data array
		return ret;
	}

	/**
	 * Function to insert a row of data at a specified index. Will only work if we can fit it in.
	 *
	 * @returns boolean indicating whether it was successful or not.
	 */
	public insertRow(index:number, data:Uint8Array):boolean {
		// check that the index is valid, matrix can fit data, and the input data is the right size
		if(index < 0 || index > this.matrixlen || this.matrixlen > 0xFF || data.length !== this.channels.length) {
			return false;
		}

		// run through every channel in backwards order
		for(let c = this.channels.length - 1;c >= 0;c --) {
			for(let x = this.matrixlen;x >= index; x--){
				// shift entries down until we are at index
				this.matrix[c][x + 1] = this.matrix[c][x];
			}

			// copy channel data to index
			this.matrix[c][index] = data[c];
		}

		// indicate there is 1 more entry in the matrix now and return success
		this.matrixlen++;
		return true;
	}

	/**
	 * Function to delete a row from the pattern matrix. Will also trim unused patterns.
	 *
	 * @param index Index of the row to delete
	 * @returns boolean indicating success
	 */
	public deleteRow(index:number):boolean {
		// check that the index is valid
		if(index < 0 || index >= this.matrixlen) {
			return false;
		}

		// run through every channel in backwards order
		for(let c = this.channels.length - 1;c >= 0;c --) {
			// if this index was empty and not referenced elsewhere, remove it altogether
			this.trim(c, index);

			for(let x = index;x < this.matrixlen; x++){
				// shift entries up until we are at the end
				this.matrix[c][x] = this.matrix[c][x + 1];
			}

			// clear the last entry
			this.matrix[c][this.matrixlen] = 0;
		}

		// indicate there is 1 less entry in the matrix now and return success
		this.matrixlen--;
		return true;
	}

	/**
	 * Helper function to create new patterns for a single row.
	 *
	 * @param data The array of indices to create for each channel
	 * @param replace Whether we can replace pre-existing patterns. VERY DANGEROUS
	 * @returns Whether every operation succeeded
	 */
	public makePatternsRow(data:Uint8Array, replace:boolean):boolean {
		// check that the input data is the right size
		if(data.length !== this.channels.length){
			return false;
		}

		let ret = true;

		// make each pattern for each channel, while ANDing the return value with true
		for(let c = this.channels.length - 1;c >= 0;c --) {
			ret = ret && this.makePattern(c, data[c], replace);
		}

		return ret;
	}

	/**
	 * Function to create a new pattern at index for a channel.
	 *
	 * @param channel The channel to generate a row for
	 * @param index The index to use for generating a row
	 * @param replace Whether we can replace pre-existing patterns. VERY DANGEROUS
	 * @returns Whether every operation succeeded
	 */
	public makePattern(channel:number, index:number, replace:boolean):boolean {
		// check that index and channel are valid
		if(index < 0 || index > 0xFF || channel < 0 || channel >= this.channels.length) {
			return false;
		}

		// check if we can't replace a pre-existing pattern should one be there.
		if(replace && this.patterns[channel][index]){
			return false;
		}

		// create a new pattern here and indicate success
		this.patterns[channel][index] = new PatternData(this.channels[channel]);
		return true;
	}

	/**
	 * Function to trim all the unused patterns that are not edited
	 */
	public trimAll(): void {
		// run through every channel in backwards order
		for(let c = this.channels.length - 1;c >= 0;c --) {
			for(let x = 0xFF;x >= 0; x--){
				// check if the pattern can be deleted
				if(this.patterns[c][x]?.edited === false){
					let remove = true;

					// check if this is used anywhere
					for(let i = this.matrixlen - 1;i >= 0;i--) {
						if(this.matrix[c][i] === x){
							// is used, no remove
							remove = false;
							break;
						}
					}

					// if the pattern can be removed, then do so here.
					if(remove) {
						this.patterns[c][x] = null;
					}
				}
			}
		}
	}

	/**
	 * Helper function to delete unused unedited patterns, because those are by and in large useless.
	 *
	 * @param channel Channel to check on
	 * @param index Index to find references to and delete
	 * @returns boolean indicating whether it was trimmed or not
	 */
	public trim(channel:number, index:number):boolean {
		// get the pattern index to check for
		const check = this.matrix[channel][index];

		// check if the pattern is edited or is... null... somehow
		if(this.patterns[channel][check]?.edited !== false){
			// if yes, don't waste our time checking
			return false;
		}

		// run through every matrix value
		for(let x = this.matrixlen -1; x >= 0; x--){
			// check if the matrix shares the same index. If so, bail out
			if(x !== index && this.matrix[channel][x] === check) {
				return false;
			}
		}

		// set this pattern as unused and indicate success
		this.patterns[channel][check] = null;
		return true;
	}
}
