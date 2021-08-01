import { Channel, ChannelType, NoteReturnType } from "../../api/driver";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { Matrix } from "../../api/matrix";
import { WindowType } from "../../defs/windowtype";
import { LoadSaveData, LoadType, Module, Project } from "./project";

const tabRecordEvent = ZorroEvent.createEvent(ZorroEventEnum.TabRecordMode);
const tabPlayModeEvent = ZorroEvent.createEvent(ZorroEventEnum.TabPlayMode);
const tabSetMute = ZorroEvent.createEvent(ZorroEventEnum.TabMute);

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

				// also set the selected channel
				this.selectedChannel = this.channels[0];

				// create the new matrix
				this.matrix = new Matrix(this);

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
	 * The currently selected channel in the pattern editor
	 */
	public selectedChannelId = 0;

	/**
	 * The currently selected channel in the pattern editor
	 */
	public selectedChannel!:Channel;

	/**
	 * Function to set the selected channel for the tab
	 *
	 * @param channel The channel to set active
	 */
	public setSelectedChannel(channel:number): void {
		this.selectedChannelId = channel;
		this.selectedChannel = this.channels[channel];
	}

	/**
	 * The channels actgive in this tab
	 */
	public channels!:Channel[];

	/**
	 * Function to change the mute mode all channels
	 *
	 * @param state The new state of the channel.
	 * @returns array of booleans indicating which channels changed state and which did not.
	 */
	public setMuteAll(state:boolean): Promise<boolean[]> {
		// map all channels into the `setMute` function, which is zipped with `Promise.all`
		return Promise.all(this.channels.map((c) => this.setMute(c, state)));
	}

	/**
	 * Function to change the mute mode all channels
	 *
	 * @param channel The channel to set to solo
	 * @returns array of booleans indicating which channels changed state and which did not.
	 */
	public setSolo(channel:Channel): Promise<boolean[]> {
		// map all channels into the `setMute` function, which is zipped with `Promise.all`
		return Promise.all(this.channels.map((c) => this.setMute(c, c !== channel)));
	}

	/**
	 * Function to change the mute mode of the channel
	 *
	 * @param channel The channel to change mute mode
	 * @param state The new state of the channel
	 * @returns whether or not the state was changed
	 */
	public async setMute(channel:Channel, state:boolean): Promise<boolean> {
		// check if the mute mode was not changed. If not, just ignore
		if(channel.muted === state) {
			return false;
		}

		// must actually do something! Tell the driver about the new state
		await window.ipc.driver.mute(channel, channel.muted = state);
		await tabSetMute(this, channel, state);
		return true;
	}

	/**
	 * Function to check if a channel is doing a solo or all are muted
	 *
	 * @param channel The channel to check for solo
	 * @returns Boolean indicating whether input channel is doing a solo
	 */
	public isSolo(channel:Channel): boolean {
		// check all channels one at a time
		for(const c of this.channels) {
			// check if inspecting the channel we are already checking. If so, ignore, otherwise must be muted
			if((c !== channel) && !c.muted) {
				return false;
			}
		}

		// check was successful! Is in solo!
		return true;
	}

	/**
	 * Function to check if all channels are muted or unmuted
	 *
	 * @param state The mute state of all channels to check
	 * @returns Boolean indicating whether all channels are of the supplied state
	 */
	public allMute(state:boolean): boolean {
		// check all channels one at a time
		for(const c of this.channels) {
			// check if channel mute state is the same as supplied state
			if(c.muted !== state) {
				return false;
			}
		}

		// check was successful!
		return true;
	}

	/**
	 * The matrix that the current tab is using
	 */
	public matrix!:Matrix;

	/**
	 * The project opened in this tab
	 */
	private _project:Project;

	public get project():Project {
		return this._project;
	}

	/**
	 * Get the currently active module
	 */
	public get module():Module|undefined {
		return this._project.modules[this._project.activeModuleIndex];
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

	/**
	 * List of note info caches from the driver
	 */
	private notesCache:{ [key: number]: NoteReturnType } = {};

	/**
	 * Function to fetch the note cache data
	 *
	 * @param type The type of the channel to fetch
	 * @returns The cache of note data
	 */
	public async getNotes(type:ChannelType): Promise<NoteReturnType> {
		// if notes are not cached, fetch them first
		if(!this.notesCache[type]) {
			return this.notesCache[type] = await window.ipc.driver.getNotes(type);
		}

		// is cached, return
		return this.notesCache[type];
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
