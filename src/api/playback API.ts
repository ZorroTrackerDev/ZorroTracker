import { PatternCellData, PlaybackManagerAPI } from "./driver";

export class PlaybackAPI {
	/**
	 * The manager which is reponsible for communicating to the UI
	 */
	private manager: PlaybackManagerAPI;

	/**
	 * The driver-specific playback rate
	 */
	public rate = 0;

	/**
	 * Store the actual number of ticks between rows
	 */
	public _ticksPerRow = 1;

	/**
	 * How many ticks there are between rows
	 */
	public get ticksPerRow(): number {
		return this.stepMode ? 1 : this._ticksPerRow;
	}

	/**
	 * The current row within the loaded pattern
	 */
	private row: number;

	constructor(manager:PlaybackManagerAPI) {
		this.manager = manager;
		this.row = 0;
	}

	public setFlags(rate:number, ticksPerRow:number): void {
		this.rate = rate;
		this._ticksPerRow = ticksPerRow;
	}

	/**
	 * Whether to control playback via shortcuts in the UI side
	 */
	public stepMode = false;

	/**
	 * The number of steps that should be executed
	 */
	public steps = 0;

	/**
	 * Function to fetch the row of
	 */
	public fetchRow(): null|PatternCellData[] {
		// check step mode
		if(this.stepMode) {
			if(this.steps === 0) {
				return null;
			}

			--this.steps;
		}

		// fetch the row
		return this.manager.loadDataRow();
	}
}
