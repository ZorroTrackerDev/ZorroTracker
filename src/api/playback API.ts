import { PatternCellData, PatternRowData, PlaybackManagerAPI } from "./driver";

export class PlaybackAPI {
	/**
	 * The manager which is reponsible for communicating to the UI
	 */
	private manager: PlaybackManagerAPI;

	/**
	 * The driver-specific playback rate
	 */
	public rate:number;

	/**
	 * How many ticks there are between rows
	 */
	public ticksPerRow:number;

	/**
	 * The current row within the loaded pattern
	 */
	private row: number;

	/**
	 * The currently processed row data
	 */
	private patternRow: PatternRowData|null;

	constructor(manager: PlaybackManagerAPI, rate:number, ticksPerRow:number) {
		this.manager = manager;
		this.rate = rate;
		this.ticksPerRow = ticksPerRow;
		this.row = 0;
		this.patternRow = null;
	}

	/**
	 * Function to fetch the row of
	 */
	public fetchRow(): null|PatternCellData[] {
		// fetch the row data first if invalid
		if(!this.patternRow) {
			this.patternRow = this.manager.loadPatternRow();
			this.row = 0;

			// if failed to fetch data, return null
			if(!this.patternRow) {
				return null;
			}
		}

		// load the current row data into ret variable
		const ret:PatternCellData[] = [];

		for(let c = 0;c < this.patternRow.length;c ++) {
			ret.push(this.patternRow[c][this.row]);
		}

		// handle row math
		if(++this.row >= this.patternRow[0].length) {
			// the next row would be out of bounds, force a reload
			this.patternRow = null;
		}

		return ret;
	}
}
