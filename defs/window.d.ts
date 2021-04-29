import { DriverConfig } from "../api/scripts/driver";
import { EmulatorConfig } from "../api/scripts/emulator";

export {};

declare global {
	export interface Window {
		exports: unknown,
		preload: {
			close: () => void,
			minimize: () => void,
			maximize: () => void,
			openInBrowser: (url:string) => void,
			updateMaximizeButtonState: () => void,
			open: () => void,
		},
		toolbarFunc: {
			handleDropdown (element:Element, event:Event): void,
			openGithub: () => void,
		},
		ipc: {
			cookie: {
				set: (name:string, value:string) => void,
				get: (name:string) => Promise<string | null>,
			},
			audio: {
				findAll: () => Promise<{ [key:string]: EmulatorConfig }>,
				init: (emu:EmulatorConfig, driver:DriverConfig) => void,
				volume: (volume:number) => void,
				play: (special?:string) => void,
				stop: () => void,
				close: () => void,
			},
			driver: {
				findAll: () => Promise<{ [key:string]: DriverConfig }>,
			}
		},
	}
}