import { PatternCellData, PatternRowData, PlaybackManagerAPI } from "../../../../api/driver";
import { PlaybackAPI } from "../../../../api/playback API";
import { ipcEnum } from "../../../../system/ipc/ipc enum";

/**
 * Helper type for message functions to the UI
 */
export type UIMessageFunction = (code:ipcEnum, data:unknown, callback:(result:unknown) => void) => void;

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

	constructor(row:number, patternLen:number, repeat:boolean, rate:number, ticksPerRow:number, length:number, message:UIMessageFunction) {
		// initialize the playback api
		this.api = new PlaybackAPI(this, rate, ticksPerRow);

		// initialize other variables
		this.messageFunc = message;
		this.pattern = Math.floor(row / patternLen);
		this.row = row % patternLen;
		this.patternLen = patternLen;
		this.repeat = repeat;
		this.length = length;

		// request the next pattern row from the UI
		this.messageFunc(ipcEnum.DriverFetchRow, this.pattern, (result) => {
			this.thisRow = result as PatternRowData;

			this.messageFunc(ipcEnum.DriverFetchRow, this.pattern + 1, (result) => {
				this.nextRow = result as PatternRowData;
			});
		});
	}

	/**
	 * Whether to repeat this single pattern
	 */
	private repeat: boolean;

	/**
	 * The current pattern we are playing
	 */
	private pattern: number;

	/**
	 * The current row in a pattern we are playing
	 */
	private row: number;

	/**
	 * The number of rows in a pattern
	 */
	private patternLen: number;

	/**
	 * The total number of patterns
	 */
	private length: number;

	/**
	 * The next row data
	 */
	private nextRow: PatternRowData|null;
	private thisRow: PatternRowData|null;

	/**
	 * Helper function to load the next row data and keep the UI up to date
	 */
	public loadDataRow(): PatternCellData[]|null {
		if(!this.thisRow) {
			return null;
		}

		// load the current row data into ret variable
		const ret:PatternCellData[] = [];

		for(let c = 0;c < this.thisRow.length;c ++) {
			ret.push(this.thisRow[c][this.row]);
		}

		// handle row math
		if(++this.row >= this.patternLen) {
			// the next row would be out of bounds, force a reload
			this.thisRow = null;
			this.row = 0;

			// go to the next pattern and loop it all
			if(!this.repeat) {
				if(++this.pattern >= this.length) {
					this.pattern = 0;
				}
			}

			this.thisRow = this.nextRow;

			// request the next pattern row from the UI
			this.messageFunc(ipcEnum.DriverFetchRow, this.pattern + 1, (result) => {
				this.nextRow = result as PatternRowData;
			});
		}

		// return the previous row
		return ret;
	}
}
