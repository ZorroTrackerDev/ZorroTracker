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
	getChannels:() => Channel[];

	/**
	 * Function to mute or unmute a channel based on its ID.
	 *
	 * @param id The ID of the channel to affect
	 * @param state Boolean indicating whether to mute or unmute
	 *
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
}

export interface Channel {
	/**
	 * The channel ID. This can be anything, this only matters
	 */
	id: number;

	/**
	 * The string name for this channel
	 */
	name: string;

	/**
	 * The type of the channel. This helps ZorroTracker use apprioriate elements for channel.
	 */
	type: ChannelType;
}

export enum ChannelType {
	Unspecific = 0,
	TimerA = 1,
	YM2612FM = 0x10,
	YM2612DAC = 0x11,
	YM7101PSG = 0x20,
	YM7101DAC = 0x21,
}
