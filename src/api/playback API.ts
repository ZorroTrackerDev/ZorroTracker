import { PatternCellData, PlaybackManagerAPI } from "./driver";

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

	constructor(manager: PlaybackManagerAPI, rate:number, ticksPerRow:number) {
		this.manager = manager;
		this.rate = rate;
		this.ticksPerRow = ticksPerRow;
		this.row = 0;
	}

	/**
	 * Function to fetch the row of
	 */
	public fetchRow(): null|PatternCellData[] {
		return this.manager.loadDataRow();
	}
}
