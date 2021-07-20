import { Channel, ChannelInfo, ChannelType, DriverConfig, NoteReturnType } from "../api/driver";
import { ChipConfig } from "../api/chip";
import { OpenDialogOptions, SaveDialogOptions } from "electron";
import { Project } from "../ui/misc/project";

export {};
declare global {
	export interface Window {
		exports: unknown,

		/**
		 * Helper function to forcefully reload the theme
		 */
		reloadTheme:() => void,

		/**
		 * The current window type. This can define how components act.
		 */
		type: WindowType,

		/**
		 * Set to `true` when loading icon is active or otherwise important tasks are being done. If `true`, things like shortcuts are not allowed.
		 */
		isLoading: boolean,

		path: {
			/**
			 * The absolute path for the program data directory. This is where the exe file is in production, or the build directory in development.
			 */
			data: string,
			/**
			 * The absolute path for the program home directory. This is where various files such as log files are stored
			 */
			home: string,
		},

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
			vgm: () => void,

			/**
			 * Execute a shortcut action. This is usually done within UI, such as toolbar
			 *
			 * @param name The name of the shortcut to execute
			 */
			shortcut: (name:string[]) => void,
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

			/**
			 * Helper function to open the Discord server link in an external browser.
			 */
			openDiscord: () => void,

			/**
			 * Helper function to open the Ko-fi site for the main developer
			 */
			openKofi: () => void,
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
				 * Helper function to zoom the window in.
				 */
				zoomIn: () => void,

				/**
				 * Helper function to zoom the window out.
				 */
				zoomOut: () => void,

				/**
				 * Helper function to set the window zoom level.
				 */
				zoomSet: (zoom:number) => void,

				/**
				 * Helper function to open a browser window in an external browser, usually the default browser in the OS.
				 *
				 * @param url The URL to open.
				 */
				openInBrowser: (url:string) => void,

				/**
				 * Helper function to open Chrome DevTools.
				 */
				devTools: () => void,

				/**
				 * Helper function to open inspect element at cursor.
				 */
				inspectElement: () => void,

				/**
				 * Helper function to open the Chrome DevTools console.
				 */
				console: () => void,

				/**
				 * Helper function to load a new window.
				 */
				window: (type:WindowType) => void,

				dialog: {
					/**
					 * Helper function to open a OpenFileDialog and return the result, reading the initial directory from a cookie.
					 *
					 * @param cookie The cookie name to read from
					 * @returns The file that is targeted, or undefined if operation was canceled
					 */
					open: (cookie:string, settings:OpenDialogOptions) => Promise<string|undefined>,

					/**
					 * Helper function to open a SaveFileDialog and return the result, reading the initial directory from a cookie.
					 *
					 * @param cookie The cookie name to read from
					 */
					save: (cookie:string, settings:SaveDialogOptions) => Promise<string|undefined>,
				}

				/**
				 * Request system information to be logged
				 */
				systemInfo: () => void,
			},
			rpc?: {
				/**
				 * Funtion to initialize and enable Discord RPC integration
				 */
				init: () => void,

				/**
				 * Funtion to update Discord RPC status.
				 */
				set: (details:string, state:string) => void,
			},
			log?: {
				info: (...args:unknown[]) => void,
				warn: (...args:unknown[]) => void,
				error: (...args:unknown[]) => void,
			},
			project?: {
				init: (project:Project|undefined) => void,
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
			audio?: {
				/**
				 * Initialize the audio chip instance.
				 *
				 * @param chip This is the UUID for the chip the system is going to use
				 */
				setChip: (chip:string) => void,

				/**
				 * Initialize the audio driver instance.
				 *
				 * @param driver This is the UUID for the driver the system is going to use
				 */
				setDriver: (driver:string) => Promise<void>,

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
			theme: {
				/**
				 * Find all themes and return their configurations
				 *
				 * @returns A promise which resolves to the list of chip configurations.
				 */
				findAll: () => Promise<{ [key:string]: ThemeConfig }>,
			},
			chip: {
				/**
				 * Find all chip scripts and return their configurations.
				 *
				 * @returns A promise which resolves to the list of chip configurations.
				 */
				findAll: () => Promise<{ [key:string]: ChipConfig }>,
			},
			driver: {
				/**
				 * Find all driver scripts and return their configurations.
				 *
				 * @returns A promise which resolves to the list of driver configurations.
				 */
				findAll: () => Promise<{ [key:string]: DriverConfig }>,

				/**
				 * Function for muting or unmuting a channel.
				 *
				 * @param channel The channel to target
				 * @param state Whether to mute or unmute. true = mute, false = unmute
				 * @returns boolean indicating whether it was successful or not
				 */
				mute: (channel:Channel, state:boolean) => Promise<boolean>,

				/**
				 * Function for getting all the valid channels for this driver
				 *
				 * @returns The list of channels
				 */
				getChannels: () => Promise<ChannelInfo[]>,

				/**
				 * Function for trying to enable a channel on the driver.
				 *
				 * @param channel The channel to target
				 * @returns boolean indicating whether it was successful or not
				 */
				enableChannel: (channel:Channel) => Promise<boolean>,

				/**
				 * Function for trying to disable a channel on the driver.
				 *
				 * @param channel The channel to target
				 * @returns boolean indicating whether it was successful or not
				 */
				disableChannel: (channel:Channel) => Promise<boolean>,

				/**
				 * Function to get the driver note data table based on channel type
				 *
				 * @param type The channel type to inspect
				 * @returns The table containing note info
				 */
				getNotes: (type:ChannelType) => Promise<NoteReturnType>,

				/**
				 * Trigger a note via the piano. The channel is a mere suggestion for the driver to know how to handle this.
				 *
				 * @param note The ID of the note to trigger
				 * @param velocity A value between 0 and 1, representing the velocity of the note. 0 = mute
				 * @param channel The ID of the channel to trigger the note on
				 * @returns Whether the note was triggered
				 */
				pianoTrigger: (note:number, velocity:number, channel:number) => Promise<boolean>,

				/**
				 * Release a note via the piano.
				 *
				 * @param note The ID of the note to release
				 * @returns Whether the note was release
				 */
				pianoRelease: (note:number) => Promise<boolean>,
			},
		},
	}
}
