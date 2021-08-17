import { GenericConfig } from "./config";
import { Chip } from "./chip";
import { PlaybackAPI } from "./playback API";
import { TrackerCommands } from "./commands";

// driver configuration file format
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DriverConfig extends GenericConfig {
}

// interface for the driver emulator. All drivers must use this interface.
export interface Driver {
	/**
	 * Helper object for dealing with the playback
	 */
	playback: PlaybackAPI|undefined;

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
	 * @param velocity A value between 0 and 1, representing the velocity of the note. 1 = mute, 0 = loudest
	 * @param channel The ID of the channel to trigger the note on
	 * @param instrument The instrument ID to use for this note
	 * @param polyphony Whether to enable polyphony and finding a free channel for this note
	 * @returns Whether the note was triggered
	 */
	pianoTrigger: (note:number, velocity:number, channel:number, instrument:number, polyphony:boolean) => boolean|Promise<boolean>,

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
	 * If 'NaN', this note is marked as a meta note - it can not be played on the piano, but it is a recognized note.
	 * If `undefined`, this note is marked as invalid. It's other properties will be used for piano display.
	 */
	frequency: number|undefined,

	/**
	 * Name of the note. Must only contain the name, octave must be separate
	 */
	name: string,

	/**
	 * Octave of the note. This should only be the octave in the note and nothing else
	 */
	octave: number|null,

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
	 * The maximum volume this chip can use
	 */
	maxvolume: number,

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

/**
 * These are the IDs recommended to be used for drivers.
 */
export enum DefChanIds {
	// Mega Drive FM channels
	YM2612FM1 = 0,
	YM2612FM2 = 1,
	YM2612FM3 = 2,
	YM2612FM4 = 3,
	YM2612FM5 = 4,
	YM2612FM6 = 5,

	// Mega Drive PSG channels
	YM7101PSG1 = 6,
	YM7101PSG2 = 7,
	YM7101PSG3 = 8,
	YM7101PSG4 = 9,

	// Mega Drive FM PCM channels
	YM2612PCM1 = 10,
	YM2612PCM2 = 11,
	YM2612PCM3 = 12,
	YM2612PCM4 = 13,

	// Mega Drive PSG PCM channels
	YM7101PCM1 = 16,
	YM7101PCM2 = 17,
	YM7101PCM3 = 18,
	YM7101PCM4 = 19,

	// Mega Drive FM3 operator channels
	YM2612FM3OP1 = 20,
	YM2612FM3OP2 = 21,
	YM2612FM3OP3 = 22,
	YM2612FM3OP4 = DefChanIds.YM2612FM3,

	// YM2612 special
	YM2612TIMERA = 100,
	YM2612TIMERB = 101,
}

export enum FeatureFlag {
	NOTE = 1 << 0,
	INSTRUMENT = 1 << 1,
	VOLUME = 1 << 2,
	EFFECTS = 1 << 3,
	ALL = FeatureFlag.NOTE | FeatureFlag.INSTRUMENT | FeatureFlag.VOLUME | FeatureFlag.EFFECTS,

	FREQ = 1 << 0,			// TODO
	NOVU = 1 << 8,
}

export type PatternRowData = PatternCellData[][];

export type PatternCellData = {
	/**
	 * The note ID for this row
	 */
	note: number,
	/**
	 * The volume level for this row
	 */
	volume: number|null,
	/**
	 * The instrument ID for this row
	 */
	instrument: number|null,
	/**
	 * The effects for this row
	 */
	effects: { id: TrackerCommands|number, value: number, }[];
}

export interface PlaybackManagerAPI {
	/**
	 * Helper function to load the next pattern row data
	 *
	 * @returns The `PatternRowData` object, or `null` if no valid pattern data was found
	 */
	loadPatternRow(): PatternRowData|null;
}
