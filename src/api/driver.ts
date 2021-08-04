import { GenericConfig } from "./config";
import { Chip } from "./chip";

// driver configuration file format
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DriverConfig extends GenericConfig {
}

// interface for the driver emulator. All drivers must use this interface.
export interface Driver {
	/**
	 * Initialize the driver.
	 *
	 * @param samplerate The sample rate that the driver is requested to emulate in.
	 * @param config The configuration object for the driver.
	 * @param chip The chip emulator used for audio emulation.
	 */
	init:(samplerate:number, config:DriverConfig, chip:Chip) => void;

	/**
	 * Emulate a number of samples with the driver.
	 *
	 * @param samples The number of samples requested to be emulated
	 * @param advance A function to advance chip emulation by some number of samples. The returning value is how many samples are left to emulate.
	 */
	buffer:(samples: number, advance:(samples:number) => number) => void;

	/**
	 * Enable driver to continue playing back from hwere it left off.
	 */
	play:(special?: string) => void;

	/**
	 * Tell the driver to stop playing back audio.
	 */
	stop:() => void;

	/**
	 * Reset the driver state. The behavior of this function is dependent on the driver itself.
	 */
	reset:() => void;

	/**
	 * Function to get the possible channels for this driver.
	 *
	 * @returns The list of channels. The array order enforces the display order in the UI.
	 */
	getChannels:() => DriverChannel[];

	/**
	 * Function to mute or unmute a channel based on its ID.
	 *
	 * @param id The ID of the channel to affect
	 * @param state Boolean indicating whether to mute or unmute
	 * @returns whether the action was executed
	 */
	muteChannel:(id:number, state:boolean) => boolean;

	/**
	 * Function to enable a channel. This can check for example if both FM6 and DAC are attempting to enable, as some drivers don't support both.
	 *
	 * @param id The ID of the channel that we are trying to enable
	 * @returns Boolean indicating if the channel was enabled
	 */
	enableChannel:(id:number) => boolean;

	/**
	 * Function to disable a channel. This can check if some channel can be disabled for any reason.
	 *
	 * @param id The ID of the channel that we are trying to disable
	 * @returns Boolean indicating if the channel was disabled
	 */
	disableChannel:(id:number) => boolean;

	/**
	 * Function to get the frequency table based on channel type
	 *
	 * @param type The channel type to inspect
	 * @returns The table containing note info
	 */
	notes:(type:ChannelType) => NoteReturnType,

	/**
	 * Trigger a note via the piano. The channel is a mere suggestion for the driver to know how to handle this.
	 * Be aware that the same note can be triggered multiple times without being released.
	 *
	 * @param note The ID of the note to trigger
	 * @param velocity A value between 0 and 1, representing the velocity of the note. 0 = mute
	 * @param channel The ID of the channel to trigger the note on
	 * @returns Whether the note was triggered
	 */
	pianoTrigger: (note:number, velocity:number, channel:number) => boolean|Promise<boolean>,

	/**
	 * Release a note via the piano.
	 * Be aware that the same note can be released multiple times without being triggered.
	 *
	 * @param note The ID of the note to release
	 * @returns Whether the note was release
	 */
	pianoRelease: (note: number) => boolean|Promise<boolean>,
}

/**
 * Individual note data type
 */
export type NoteData = {
	/**
	 * The frequency of this note. This is driver-dependent and is assumed to follow the conventions of the target chip.
	 * If `undefined`, this note is marked as invalid. It's other properties will be used for piano display
	 */
	frequency: number|undefined,

	/**
	 * Name of the note. Must have a single \u2060 delimiting the note key and octave. Octave must come after key name.
	 */
	name: string,

	/**
	 * Whether this is a sharp note or not. This also defines how the piano should display the note.
	 */
	sharp: ""|"center"|"left"|"right",

};

/**
 * Represents octave information for each chip
 */
export type OctaveInfo = {
	/**
	 * The minimum octave number
	 */
	min: number,

	/**
	 * The maximum octave number
	 */
	max: number,

	/**
	 * Number of notes per octave
	 */
	size: number,

	/**
	 * The note ID that will represent C0 on this chip
	 */
	C0: number,
}

/**
 * Represents the data type the notes array must have
 */
export type NoteReturnType = {
	/**
	 * Special octave settings
	 */
	octave: OctaveInfo,

	/**
	 * The list of actual notes on this chip type
	 */
	notes: Array<NoteData>,
};

export interface DriverChannel {
	/**
	 * The channel ID. This can be anything, this only matters for driver internal functions
	 */
	id: number,

	/**
	 * The string name for this channel
	 */
	name: string,

	/**
	 * The type of the channel. This helps ZorroTracker use apprioriate elements for channel.
	 */
	type: ChannelType,

	/**
	 * The various features this channels supports
	 */
	features: FeatureFlag,
}

export interface ChannelInfo {
	/**
	 * The channel ID. This can be anything, this only matters for driver internal functions
	 */
	id: number,

	/**
	 * The string name for this channel
	 */
	name: string,

	/**
	 * How many effects are displayed
	 */
	effects: number,
}

export interface Channel {
	/**
	 * The channel info, containing some serialized fields
	 */
	info: ChannelInfo,

	/**
	 * Boolean indicating whether the channel is muted
	 */
	muted: boolean,

	/**
	 * The type of the channel. This helps ZorroTracker use apprioriate elements for channel.
	 */
	type: ChannelType,

	/**
	 * The various features this channels supports
	 */
	features: FeatureFlag,
}

export enum ChannelType {
	Unspecific = 0,
	TimerA = 1,
	YM2612FM = 0x10,
	YM2612DAC = 0x11,
	YM7101PSG = 0x20,
	YM7101DAC = 0x21,
}

export enum FeatureFlag {
	NOTE = 1 << 0,
	INSTRUMENT = 1 << 1,
	VOLUME = 1 << 2,
	EFFECTS = 1 << 3,
	ALL = FeatureFlag.NOTE | FeatureFlag.INSTRUMENT | FeatureFlag.VOLUME | FeatureFlag.EFFECTS,

	NOVU = 1 << 8,
}
