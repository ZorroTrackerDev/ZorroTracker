import { Channel } from "../../api/driver";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { PatternIndex } from "../../api/matrix";
import { WindowType } from "../../defs/windowtype";
import { LoadSaveData, LoadType, Module, Project } from "./project";

const tabRecordEvent = ZorroEvent.createEvent(ZorroEventEnum.TabRecordMode);
const tabPlayModeEvent = ZorroEvent.createEvent(ZorroEventEnum.TabPlayMode);

/**
 * Helper class to store all state related to the current opened tab
 */
export class Tab {
	/**
	 * The currently active tab
	 */
	public static active:Tab|undefined;

	/**
	 * Initialize a new tab
	 *
	 * @param project
	 */
	constructor(project:Project) {
		this._project = project;

		if(window.type === WindowType.Editor) {
			// set the save and load handlers for the project
			project.setDataHandlers((data:LoadSaveData<LoadType>, module:Module) => {
				// set the channels
				this.channels = module.channels?.map(c => { return {
					info: c,
					muted: false,
				}}) ?? [];

				// create the new matrix
				this.matrix = new PatternIndex(this);

				// load buffers for matrix and patterns files
				const _mat = data.matrix(), _pat = data.patterns();

				// load the data for the matrix
				if(_mat && _pat) {
					this.matrix.loadMatrix(_mat);
					this.matrix.loadPatterns(_pat);
				}

			}, () => {
				return {
					patterns: this.matrix.savePatterns(),
					matrix: this.matrix.saveMatrix(),
				}
			});
		}
	}

	/**
	 * The channels actgive in this tab
	 */
	public channels!:Channel[];

	/**
	 * The matrix that the current tab is using
	 */
	public matrix!:PatternIndex;

	/**
	 * The project opened in this tab
	 */
	private _project:Project;

	public get project():Project {
		return this._project;
	}

	/**
	 * Flag controlling whether the application is in record mode or not
	 */
	private _recordMode = false;

	public get recordMode():boolean {
		return this._recordMode;
	}

	public set recordMode(mode:boolean) {
		// tell the event system that the record mode was changed
		tabRecordEvent(this, this._recordMode = mode).catch(console.error);
	}

	/**
	 * Flag controlling the playback mode used currectly
	 */
	private _playMode = PlayMode.Stopped;

	public get playMode():PlayMode {
		return this._playMode;
	}

	public set playMode(mode:PlayMode) {
		// tell the event system that the play mode was changed
		tabPlayModeEvent(this, this._playMode = mode).catch(console.error);
	}
}

/**
 * These defined all the valid playing modes. Note that the numbers also define the button ID's in the play bar to use.
 * Be careful when changing or adding more things here as the playbar might break
 */
export enum PlayMode {
	Stopped = 0,				// not playing anything right now
	PlayAll = 1,				// playing the entire song in repeat (including loop point)
	PlayPattern = 2,			// playing the current pattern
}
