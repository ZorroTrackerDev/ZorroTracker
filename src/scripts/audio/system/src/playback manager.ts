import { PatternCellData, PatternRowData, PlaybackManagerAPI } from "../../../../api/driver";
import { PlaybackAPI } from "../../../../api/playback API";
import { ipcEnum } from "../../../../system/ipc/ipc enum";

/**
 * Helper type for message functions to the UI
 */
export type UIMessageFunction = (async:boolean, code:ipcEnum, data:unknown, callback:(result:unknown) => void) => void;

export class PlaybackManager implements PlaybackManagerAPI {
	/**
	 * The playback API the sound driver is using
	 */
	private api: PlaybackAPI;

	/**
	 * Get the playback API from the manager instance
	 */
	public getAPI(): PlaybackAPI {
		return this.api;
	}

	/**
	 * The messaging function to talk back to the UI
	 */
	private messageFunc: UIMessageFunction;

	// eslint-disable-next-line max-len
	constructor(channels:number, message:UIMessageFunction) {
		this.channels = channels;

		// initialize the playback api
		this.api = new PlaybackAPI(this);

		// initialize other variables
		this.messageFunc = message;

		// initialize matrix
		this.matrix = [];

		for(let c = 0;c < channels;c ++) {
			this.matrix.push(new Uint8Array(256).fill(0));
		}

		// initialize patterns
		this.patterns = [];

		for(let c = 0;c < channels;c ++) {
			const p = [];

			// generate the row data as nulls
			for(let y = 0;y < 256;y ++) {
				p.push(Array(256).fill(null));
			}

			this.patterns.push(p);
		}
	}

	/**
	 * The number of rows in a pattern
	 */
	private patternLen: number;

	/**
	 * The total number of patterns
	 */
	private length: number;

	/**
	 * The total number of channels
	 */
	private channels: number;

	public setFlags(patternLen:number, rate:number, ticksPerRow:number, length:number): void {
		this.patternLen = patternLen;
		this.length = length;
		this.api.setFlags(rate, ticksPerRow);
	}

	/**
	 * Whether to repeat this single pattern
	 */
	private repeat: boolean;

	/**
	 * Whether to only step to the next row regardless of speed
	 */
	private step: boolean;

	/**
	 * The current pattern we are playing
	 */
	private pattern: number;

	/**
	 * The current row in a pattern we are playing
	 */
	private row: number;

	/**
	 * Function to set playback mode
	 */
	public setMode(row:number, repeat:boolean, step:boolean): void {
		if(row >= 0) {
			this.pattern = Math.floor(row / this.patternLen);
			this.row = row % this.patternLen;
		}

		this.repeat = repeat;
		this.step = step;
		this.api.stepMode = step;

		if(step) {
			this.api.steps++;

		} else {
			this.api.steps = 0;
		}
	}

	/**
	 * Helper function to load the next row data and keep the UI up to date
	 */
	public loadDataRow(): PatternCellData[]|null {
		// send the current row to ui
		this.messageFunc(false, ipcEnum.ManagerPosition, this.row + (this.pattern * this.patternLen), () => 0);

		// load the current row data into ret variable
		const ret:PatternCellData[] = [];

		for(let c = 0;c < this.channels;c ++) {
			// load the pattern from matrix and push that data out
			const pat = this.matrix[c][this.pattern];
			ret.push(this.patterns[c][pat][this.row]);
		}

		// handle row math
		if(++this.row >= this.patternLen) {
			// the next row would be out of bounds, go to next pattern
			this.row = 0;

			if(!this.repeat) {
				// update pattern and loop to 0. TODO: Loop points via song
				if(++this.pattern >= this.length) {
					this.pattern = 0;
				}
			}
		}

		// return the previous row
		return ret;
	}

	/**
	 * Inform the UI the playback has stopped
	 */
	public stop(): void {
		if(!this.step) {
			// send the current row to ui
			this.messageFunc(false, ipcEnum.ManagerPosition, -1, () => 0);
		}
	}

	/**
	 * Stores the pattern matrix, where the mappings from song order to pattern index are stored. Usage: matrix[channel][index].
	 */
	private matrix: Uint8Array[];

	/**
	 * Function to load matrix data into the internal instance
	 */
	public loadMatrix(data:Uint8Array[]): void {
		this.matrix = data;
	}

	/**
	 * Stores a list of patterns per channel. Usage: patterns[channel][index][row]. `null` or `undefined` means the value is unused.
	 */
	private patterns: PatternRowData;

	/**
	 * Function to load pattern data into the internal instance
	 *
	 * @param channel The channel number that this data belongs to
	 * @param index The row index of this data
	 * @param data The actual data for this row
	 */
	public loadPatterns(channel:number, index:number, data:PatternCellData[]|null): void {
		this.patterns[channel][index] = data;
	}
}
