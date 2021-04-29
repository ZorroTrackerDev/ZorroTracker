import { GenericConfig } from "./config";
import { Emulator } from "./emulator";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DriverConfig extends GenericConfig {
}

export interface Driver {
	init:(samplerate:number, config:DriverConfig, emulator:Emulator) => void;
	buffer:(samples: number, volume:number) => Buffer;
}