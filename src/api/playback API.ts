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
	 * How many ticks there are between rows
	 */
	public ticksPerRow = 1;

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
		this.ticksPerRow = ticksPerRow;
	}

	/**
	 * Function to fetch the row of
	 */
	public fetchRow(): null|PatternCellData[] {
		return this.manager.loadDataRow();
	}
}
