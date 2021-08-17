import { Position } from "./ui";
import { ZorroEvent, ZorroEventEnum, ZorroSenderTypes } from "./events";
import { TrackerCommands } from "./commands";
import { Tab } from "../ui/misc/tab";
import { PatternCellData } from "./driver";

/**
 * Class for a single pattern cell, which can only be used to store its immediate values.
 */
 export class PatternCell implements PatternCellData {
	public note: number;
	public volume: number|null;
	public instrument: number|null;
	public effects: { id: TrackerCommands|number, value: number, }[];

	constructor(){
		this.note = 0;
		this.volume = this.instrument = null;
		this.effects = [
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
			{ id: TrackerCommands.Empty, value: 0, },
		];
	}

	/**
	 * Method to convert this pattern cell  into data
	 */
	public save(): number[] {
		const ret = [];

		// generate a bitfield for what info is saved
		let bits = 0;
		bits |= (this.note !== 0 ? 1 : 0) << 7;
		bits |= (this.instrument !== null ? 1 : 0) << 6;
		bits |= (this.volume !== null ? 1 : 0) << 5;

		// check if any effect is used
		for(const c of this.effects) {
			if(c.id !== 0){
				bits |= 1;
				break;
			}
		}

		ret.push(bits);

		// convert the note to bytes
		if(this.note !== 0) {
			ret.push(this.note);
		}

		// convert the volume and instrument to bytes
		if(this.instrument !== null) {
			ret.push(this.instrument);
		}

		if(this.volume !== null) {
			ret.push(this.volume);
		}

		// push each command to res
		if(bits & 1) {
			for(const c of this.effects) {
				// push the command ID
				ret.push(c.id & 0xFF, c.id >> 8);

				if(c.id > 0) {
					ret.push(c.value & 0xFF);
				}

				if(c.id >= 0x8000) {
					ret.push((c.value >> 8) & 0xFF);
				}

				if(c.id >= 0xC000) {
					ret.push((c.value >> 16) & 0xFF);
				}

				if(c.id >= 0xD000) {
					ret.push((c.value >> 24) & 0xFF);
				}

				if(c.id >= 0xE000) {
					ret.push((c.value >> 32) & 0xFF);
				}

				if(c.id >= 0xF000) {
					ret.push((c.value >> 40) & 0xFF);
				}
			}
		}

		return ret;
	}

	/**
	 * Function to convert a Buffer to PatternCell instance
	 *
	 * @param data The data `Buffer` to read from
	 * @param idx The starting position of the data to read
	 * @returns The new position
	 */
	public load(data:Buffer, idx:number, width:number): number {
		let index = idx;

		// load the bit data and check if any are set
		const bits = data[index++];

		if(bits === 0){
			return index;
		}

		// load the note, instrument and volume
		if(bits & 0x80) {
			this.note = data[index++];
		}

		if(bits & 0x40) {
			this.instrument = data[index++];
		}

		if(bits & 0x20) {
			this.volume = data[index++];
		}

		// loop for each command
		if(bits & 1) {
			for(let i = 0;i < width; i++) {
				// load the command ID
				const id = data[index++] | (data[index++] << 8);
				let value = 0;

				// get the value byte by byte, depending on the ID
				if(id > 0) {
					value |= data[index++];
				}

				if(id >= 0x8000) {
					value |= data[index++] << 8;
				}

				if(id >= 0xC000) {
					value |= data[index++] << 16;
				}

				if(id >= 0xD000) {
					value |= data[index++] << 24;
				}

				if(id >= 0xE000) {
					value |= data[index++] << 32;
				}

				if(id >= 0xF000) {
					value |= data[index++] << 40;
				}

				// finally, put dat command in
				this.effects[i].id = id;
				this.effects[i].value = value;
			}
		}

		// return the new position
		return index;
	}
}

/**
 * Class to hold data for a single pattern and help with intercommunication
 */
export class PatternData {
	public cells: PatternCell[];
	public edited = false;

	/**
	 * This is the maximum number of pattern effects. This has no relation to actual number of effects in the channel.
	 */
	public width = 8;

	constructor(){
		this.cells = [];

		for(let i = 256;i > 0; --i){
			this.cells.push(new PatternCell());
		}
	}

	/**
	 * Method to convert this pattern into data
	 */
	public save(): number[] {
		// save the command width of this pattern
		const ret = [ this.cells.length - 1, this.width, ];

		// push each cell data to ret
		for(const c of this.cells) {
			ret.push(...c.save());
		}

		return ret;
	}

	/**
	 * Function to convert a Buffer to PatternData instance
	 *
	 * @param data The data `Buffer` to read from
	 * @param idx The starting position of the data to read
	 * @returns The new position
	 */
	public load(data:Buffer, idx:number): number {
		// load the number of cells for this pattern
		let index = idx;
		const cells = data[index++];

		// load the command width of this pattern
		this.width = data[index++];

		// process every cells one at a time
		for(let i = 0;i <= cells; i++) {
			// load cell data
			index = this.cells[i].load(data, index, this.width);

			// check if this cell was edited. If so, enable to flag to prevent clearing
			if(!this.edited && this.cells[i].instrument !== 0xFF || this.cells[i].volume !== 0xFF || this.cells[i].note !== 0) {
				this.edited = true;
			}
		}

		// return the new position
		return index;
	}
}

/**
 * Class to hold the pattern matrix of the song. Will be managed by both the PatternEditor instance and the wider program.
 */
export class Matrix {
	/**
	 * the tab this matrix is apart of
	 */
	private tab: Tab;

	/**
	 * Stores a list of patterns per channel. Usage: patterns[channel][index]. `null` or `undefined` means the value is unused.
	 */
	public patterns!: (PatternData | null)[][];

	/**
	 * Stores the pattern matrix, where the mappings from song order to pattern index are stored. Usage: matrix[channel][index].
	 */
	public matrix!: Uint8Array[];

	/**
	 * Stores the length of the matrix. Values at greater offsets should always be set to 0. Allows to easily determine long the pattern matrix is.
	 */
	public matrixlen = 0;

	constructor(tab:Tab) {
		this.tab = tab;

		// create events
		this.eventMake = ZorroEvent.createEvent(ZorroEventEnum.PatternMake);
		this.eventTrim = ZorroEvent.createEvent(ZorroEventEnum.PatternTrim);
		this.eventGet = ZorroEvent.createEvent(ZorroEventEnum.MatrixGet);
		this.eventSet = ZorroEvent.createEvent(ZorroEventEnum.MatrixSet);
		this.eventResize = ZorroEvent.createEvent(ZorroEventEnum.MatrixResize);
		this.eventInsert = ZorroEvent.createEvent(ZorroEventEnum.MatrixInsert);
		this.eventRemove = ZorroEvent.createEvent(ZorroEventEnum.MatrixRemove);

		// reset pattern and matrix datas
		this.patterns = [];
		this.matrix = [];

		// initialize the patterns and matrix arrays to max values
		for(let i = 0;i < tab.channels.length;i ++){
			this.patterns.push(new Array(256));
			this.matrix.push(new Uint8Array(256));
		}
	}

	private eventGet:ZorroSenderTypes[ZorroEventEnum.MatrixSet];
	private eventSet:ZorroSenderTypes[ZorroEventEnum.MatrixSet];
	private eventInsert:ZorroSenderTypes[ZorroEventEnum.MatrixInsert];
	private eventRemove:ZorroSenderTypes[ZorroEventEnum.MatrixRemove];
	private eventResize:ZorroSenderTypes[ZorroEventEnum.MatrixResize];
	private eventTrim:ZorroSenderTypes[ZorroEventEnum.PatternTrim];
	private eventMake:ZorroSenderTypes[ZorroEventEnum.PatternMake];

	/**
	 * Function to get the size of the matrix
	 *
	 * @returns The size of the matrix
	 */
	public getSize(): Position {
		return { x: this.getWidth(), y : this.getHeight(), };
	}

	/**
	 * Function to get the height of the matrix
	 *
	 * @returns The height of the matrix
	 */
	public getHeight(): number {
		return this.matrixlen;
	}

	/**
	 * Function to get the width of the matrix
	 *
	 * @returns The width of the matrix
	 */
	public getWidth(): number {
		return this.tab.channels.length;
	}

	/**
	 * Function to get the pattern index for a specified row and column.
	 *
	 * @param channel The channel to generate a row for
	 * @param index The index to use for generating a row
	 * @returns Null if failed, or the index if successful
	 */
	public get(channel:number, index:number): number|null {
		// check that index and channel are valid
		if(index < 0 || index > 0xFF || channel < 0 || channel >= this.tab.channels.length) {
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
	public async getRow(index:number): Promise<Uint8Array|null> {
		// check that the index is valid
		if(index < 0 || index >= this.matrixlen) {
			return null;
		}

		// generate a new data array to store stuff in
		const ret = new Uint8Array(this.tab.channels.length);

		// run through every channel in backwards order, copying the row data
		for(let c = this.tab.channels.length - 1;c >= 0;c --) {
			// send the get event for this cell and see what should happen
			const _e = await this.eventGet(this, c, index, this.matrix[c][index]);

			// event canceled, cancel everything
			if(_e.event.canceled){
				return null;
			}

			// copy the value from matrix or event
			ret[c] = _e.value ?? this.matrix[c][index];
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
	public async getRegion(rows:number[], columns:number[]): Promise<number[]|null> {
		// generate a new array of values
		const ret:number[] = Array(rows.length * columns.length);
		let index = 0;

		for(const c of columns) {
			// run for each channel, and makre sure the channel is valid
			if(c < 0 || c >= this.tab.channels.length){
				return null;
			}

			for(const r of rows) {
				// run for each row, and makre sure the row is valid
				if(r < 0 || r >= this.matrixlen){
					return null;
				}

				// send the get event for this cell and see what should happen
				const _e = await this.eventGet(this, c, r, this.matrix[c][r]);

				// event canceled, cancel everything
				if(_e.event.canceled){
					return null;
				}

				// copy the value from matrix or event
				ret[index++] = _e.value ?? this.matrix[c][r];
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
	public async set(channel:number, index:number, value:number): Promise<boolean> {
		// check that index and channel are valid
		if(value < 0 || value > 0xFF || index < 0 || index > 0xFF || channel < 0 || channel >= this.tab.channels.length) {
			return false;
		}

		// send the set event for this cell and see if we succeeded
		const _e = await this.eventSet(this, channel, index, value);

		if(!_e.event.canceled) {
			// set the value at channel and index and indicate success
			this.matrix[channel][index] = _e.value ?? value;
			this.tab.project.dirty();
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
	public async setRow(index:number, data:Uint8Array): Promise<boolean> {
		// check that the index is valid
		if(index < 0 || index > 0xFF) {
			return false;
		}

		let ret = false;

		// run through every channel in backwards order, replacing the row data
		for(let c = this.tab.channels.length - 1;c >= 0;c --) {
			const _e = await this.eventSet(this, c, index, data[c]);

			// call the event and apply only if allowed
			if(!_e.event.canceled) {
				this.matrix[c][index] = _e.value ?? data[c];
				this.tab.project.dirty();
				ret = true;
			}
		}

		// return whether we edited any value
		return ret;
	}

	/**
	 * Function to set a region of matrix elements from a flat array
	 *
	 * @param rows The list of rows to return. Will be reformatted in order
	 * @param columns The list of columns to retrurn. Will be reformatted in order
	 * @param values The flat array of values to set
	 * @returns boolean indicating whether the entire operation succeeded
	 */
	public async setRegion(rows:number[], columns:number[], values:number[]): Promise<boolean> {
		// make sure the array is the right length
		if(values.length !== rows.length * columns.length) {
			return false;
		}

		let index = 0;

		for(const c of columns) {
			// run for each channel, and makre sure the channel is valid
			if(c < 0 || c >= this.tab.channels.length){
				return false;
			}

			for(const r of rows) {
				// run for each row, and makre sure the row is valid
				if(r < 0 || r >= this.matrixlen){
					return false;
				}

				// check if we can set the value
				const _e = await this.eventSet(this, c, r, values[index]);
				index++;

				if(!_e.event.canceled) {
					// get the appropriate value
					const _v = _e.value ?? values[index - 1];

					// make the pattern if it doesnt exist
					if(!await this.makePattern(c, _v, false)) {
						return false;
					}

					// copy the value from matrix
					this.matrix[c][r] = _v;
					this.tab.project.dirty();
				}
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
	public async swapRows(row1:number, row2:number): Promise<boolean> {
		// if we're trying to use the same row, bail out
		if(row1 === row2) {
			return false;
		}

		// copy the row1 and row2 data into buffers
		const rd1 = await this.getRow(row1);
		const rd2 = await this.getRow(row2);

		// if either row failed, return
		if(!rd1 || !rd2) {
			return false;
		}

		// copy row data over and return the resulting boolean
		let ret = true;
		ret &&= await this.setRow(row1, rd2);
		ret &&= await this.setRow(row2, rd1);
		return ret;
	}

	/**
	 * Helper function to generate a new row of data to be passed to the caller. This will NOT add it to the matrix
	 *
	 * @returns Uint8Array containing the row data for each channel
	 */
	public generateRow(): Uint8Array {
		const ret = new Uint8Array(this.tab.channels.length);

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
	public async insertRow(index:number, data:Uint8Array): Promise<boolean> {
		// check that the index is valid, matrix can fit data, and the input data is the right size
		if(index < 0 || index > this.matrixlen || this.matrixlen > 0xFF || data.length !== this.tab.channels.length) {
			return false;
		}

		// check if we've allowed to insert
		if((await this.eventInsert(this, index, data)).event.canceled) {
			return false;
		}

		// check if we're allowed to resize
		if((await this.eventResize(this, this.matrixlen + 1, this.tab.channels.length)).event.canceled) {
			return false;
		}

		// run through every channel in backwards order
		for(let c = this.tab.channels.length - 1;c >= 0;c --) {
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
	public async deleteRow(index:number): Promise<boolean> {
		// check that the index is valid
		if(index < 0 || index >= this.matrixlen) {
			return false;
		}

		// check if we've allowed to insert
		if((await this.eventRemove(this, index)).event.canceled) {
			return false;
		}

		// check if we're allowed to resize
		if((await this.eventResize(this, this.matrixlen - 1, this.tab.channels.length)).event.canceled) {
			return false;
		}

		// run through every channel in backwards order
		for(let c = this.tab.channels.length - 1;c >= 0;c --) {
			// if this index was empty and not referenced elsewhere, remove it altogether
			await this.trim(c, index);

			for(let x = index;x < this.matrixlen; x++){
				// shift entries up until we are at the end
				this.matrix[c][x] = this.matrix[c][x + 1];
			}

			// clear the last entry
			this.matrix[c][this.matrixlen] = 0;
		}

		// indicate there is 1 less entry in the matrix now and return success
		this.matrixlen--;
		this.tab.project.dirty();
		return true;
	}

	/**
	 * Helper function to create new patterns for a single row.
	 *
	 * @param data The array of indices to create for each channel
	 * @param replace Whether we can replace pre-existing patterns. VERY DANGEROUS
	 * @returns Whether every operation succeeded
	 */
	public async makePatternsRow(data:Uint8Array, replace:boolean): Promise<boolean> {
		// check that the input data is the right size
		if(data.length !== this.tab.channels.length){
			return false;
		}

		let ret = true;

		// make each pattern for each channel, while ANDing the return value with true
		for(let c = this.tab.channels.length - 1;c >= 0;c --) {
			ret = ret && await this.makePattern(c, data[c], replace);
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
	public async makePattern(channel:number, index:number, replace:boolean): Promise<boolean> {
		// check that index and channel are valid
		if(index < 0 || index > 0xFF || channel < 0 || channel >= this.tab.channels.length) {
			return false;
		}

		// check if we can't replace a pre-existing pattern should one be there.
		if(!replace && this.patterns[channel][index]){
			return true;
		}

		// run the make event and check if we failed
		if((await this.eventMake(this, channel, index)).event.canceled){
			return false;
		}

		// create a new pattern here and indicate success
		this.patterns[channel][index] = new PatternData();
		this.tab.project.dirty();
		return true;
	}

	/**
	 * Function to trim all the unused patterns that are not edited
	 */
	public async trimAll(): Promise<void> {
		// run through every channel in backwards order
		for(let c = this.tab.channels.length - 1;c >= 0;c --) {
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
					if(remove && !(await this.eventTrim(this, c, x)).event.canceled) {
						this.patterns[c][x] = null;
						this.tab.project.dirty();
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
	public async trim(channel:number, index:number): Promise<boolean> {
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

		// run the trim event and check if we failed
		if((await this.eventTrim(this, channel, index)).event.canceled){
			return false;
		}

		// set this pattern as unused and indicate success
		this.patterns[channel][check] = null;
		this.tab.project.dirty();
		return true;
	}

	/**
	 * Function to return the current matrix data
	 *
	 * @returns The data representing the current matrix
	 */
	// eslint-disable-next-line require-await
	public async saveMatrix(): Promise<Uint8Array> {
		// prepare the output buffer
		const h = this.getHeight();
		const ret = new Uint8Array(h * this.getWidth());

		// loop for each channel and each position
		for(let c = 0;c < this.tab.channels.length;c ++){
			for(let i = 0;i < this.matrixlen;i ++) {
				// copy the byte at this cell
				ret[(c * h) + i] = this.matrix[c][i];
			}
		}

		// return the array back
		return ret;
	}

	/**
	 * Function to load matrix state from a `Buffer`
	 *
	 * @returns Boolean indicating whether it was successful or not
	 */
	public loadMatrix(data:Buffer): boolean {
		// get the data height for this matrix
		const height = data.length / this.tab.channels.length;

		// if the data is not divisibly by channel count, then it is invalid!
		if(height !== Math.round(height)) {
			return false;
		}

		// set matrix height
		this.matrixlen = height;

		// loop for each channel and each position
		for(let c = 0;c < this.tab.channels.length;c ++){
			for(let i = 0;i < height;i ++) {
				// copy the byte at this cell
				this.matrix[c][i] = data[(c * height) + i];
			}
		}

		// success!
		return true;
	}

	/**
	 * Function to return the current patterns data
	 *
	 * @returns The data representing the current list of patterns
	 */
	public async savePatterns(): Promise<Uint8Array> {
		await this.trimAll();

		// accumulator of channel datas
		const chans:number[] = [];

		// load each channel
		for(let c = 0;c < this.tab.channels.length;c ++){
			const ixs:number[] = [];

			// loop for each index collecting its data
			for(let i = 0;i < 256;i ++){
				if(this.patterns[c][i]) {
					// load the data from within the pattern
					ixs.push(...(this.patterns[c][i] as PatternData).save());

				} else {
					// the pattern is null, just say it has 0 rows
					ixs.push(0);
				}
			}

			// push each byte to the chans array
			chans.push(...ixs);
		}

		// convert `chans` to Uint8Array
		const array = new Uint8Array(chans.length);

		for(let a = 0;a < chans.length;a ++) {
			array[a] = chans[a];
		}

		// return the array back
		return array;
	}

	/**
	 * Function to load patterns state from a `Buffer`
	 *
	 * @returns Boolean indicating whether it was successful or not
	 */
	public loadPatterns(data:Buffer): boolean {
		let index = 0;

		// load each channel
		for(let c = 0;c < this.tab.channels.length;c ++){
			// loop for each index
			for(let i = 0;i < 256;i ++){
				if(data[index] === 0) {
					// empty element!
					index++;
					this.patterns[c][i] = null;

				} else {
					// there is data here
					this.patterns[c][i] = new PatternData();
					index = (this.patterns[c][i] as PatternData).load(data, index);
				}
			}
		}

		return true;
	}
}
