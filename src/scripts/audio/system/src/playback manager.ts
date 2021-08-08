import { PatternRowData, PlaybackManagerAPI } from "../../../../api/driver";
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

	constructor(pattern:number, repeat:boolean, rate:number, ticksPerRow:number, length:number, message:UIMessageFunction) {
		// initialize the playback api
		this.api = new PlaybackAPI(this, rate, ticksPerRow);

		// initialize other variables
		this.messageFunc = message;
		this.pattern = pattern;
		this.repeat = repeat;
		this.length = length;
	}

	/**
	 * Whether to repeat this single pattern
	 */
	private repeat: boolean;

	/**
	 * The current pattern **to be loaded**
	 */
	private pattern: number;

	/**
	 * The total number of patterns
	 */
	private length: number;

	/**
	 * The next row data
	 */
	private nextRow: PatternRowData|null;

	/**
	 * Helper function to load the next pattern row data
	 */
	public loadPatternRow(): PatternRowData|null {
		// request the next pattern row from the UI
		this.messageFunc(ipcEnum.DriverFetchRow, this.pattern, (result) => {
			this.nextRow = result as PatternRowData;
		});

		// go to the next pattern and loop it all
		if(!this.repeat) {
			if(++this.pattern >= this.length) {
				this.pattern = 0;
			}
		}

		// return the previous row
		return this.nextRow;
	}
}
