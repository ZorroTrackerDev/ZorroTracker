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
}