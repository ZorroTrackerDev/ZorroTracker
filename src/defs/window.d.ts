import { DriverConfig } from "../api/scripts/driver";
import { ChipConfig } from "../api/scripts/chip";

export {};
declare global {
	export interface Window {
		exports: unknown,

		/**
		 * The absolute path for the program data directory. This is where the exe file is in production, or the build directory in development.
		 */
		path: string,

		preload: {
			/**
			 * Helper function to update the maximize UI button depending on the window state. This info comes from the Node side using IPC.
			 *
			 * @param mode This is the mode for the button to use (maximized or not).
			 */
			updateMaximizeButtonState: (mode:boolean) => void,

			/**
			 * Helper function to handle the `open` UI function (for example with CTRL+O)
			 */
			open: () => void,
		},
		toolbarFunc: {
			/**
			 * handle the dropdown menu interactions correctly.
			 *
			 * @param element the target element that will be acted upon
			 * @param event the event that triggered this interaction
			 * @returns false
			 */
			handleDropdown (element:Element, event:Event): void,

			/**
			 * Helper function to open the Github repository in an external browser.
			 */
			openGithub: () => void,
		},
		ipc: {
			ui: {
				/**
				 * Get the program path from backend. This is saved to window.path
				 *
				 * @returns A promise that indicates when the action is completed.
				 */
				path: () => Promise<void>,

				/**
				 * Request the backend for the maximized state.
				 */
				updateMaximized: () => void,

				/**
				 * Helper function to close the current window.
				 */
				close: () => void,

				/**
				 * Helper function to minimize the current window.
				 */
				minimize: () => void,

				/**
				 * Helper function to maximize the current window.
				 */
				maximize: () => void,

				/**
				 * Helper function to open a browser window in an external browser, usually the default browser in the OS.
				 *
				 * @param url The URL to open.
				 */
				openInBrowser: (url:string) => void,

				/**
				 * Helper function to open Chrome DevTools
				 */
				devTools: () => void,

				/**
				 * Helper function to open inspect element at cursor
				 */
				inspectElement: () => void,
			},
			cookie: {
				/**
				 * Set a browser cookie for later. These persist across runs.
				 *
				 * @param name Name of the cookie to edit
				 * @param value the value to save to the cookie
				 */
				set: (name:string, value:string) => void,

				/**
				 * Get a browser cookie from storage.
				 *
				 * @param name Name of the cookie to edit
				 * @returns array of Cookie objects that match the cookie name.
				 */
				get: (name:string) => Promise<string | null>,
			},
			audio: {
				/**
				 * Find all chip scripts and return their configurations.
				 *
				 * @returns A promise which resolves to the list of chip configurations.
				 */
				findAll: () => Promise<{ [key:string]: ChipConfig }>,

				/**
				 * Initialize the audio adapter instance.
				 *
				 * @param chip This is the configuration for the chip the system is going to use
				 * @param driver This is the configuration for the driver the system is going to use
				 */
				init: (chip:ChipConfig, driver:DriverConfig) => void,

				/**
				 * Set the volume for the audio adapter instance.
				 *
				 * @param volume The new volume to use
				 */
				volume: (volume:number) => void,

				/**
				 * Tell the driver to start playing audio using the audio adapter instance.
				 */
				play: (special?:string) => void,

				/**
				 * Tell the driver to start playing stop/pause using the audio adapter instance.
				 */
				stop: () => void,

				/**
				 * Close the audio adapter instance, stopping any audio and disposing the instance.
				 */
				close: () => void,
			},
			driver: {
				/**
				 * Find all driver scripts and return their configurations.
				 *
				 * @returns A promise which resolves to the list of driver configurations.
				 */
				findAll: () => Promise<{ [key:string]: DriverConfig }>,
			}
		},
	}
}