import { Channel, ChannelType, Driver, DriverConfig } from "../../../../api/scripts/driver";
import { Chip } from "../../../../api/scripts/chip";

export default class implements Driver {
	private chip:Chip|undefined;

	constructor() {

	}

	public init(samplerate:number, config:DriverConfig|null, chip:Chip):void {
		this.chip = chip;
	}

	public reset():void {

	}

	public play():void {

	}

	public stop():void {

	}

	public buffer(initSamples: number, advance:(samples:number) => number):void {
		if(!this.chip) {
			throw new Error("chip is null");
		}
	}

	public getChannels(): Channel[] {
		return [
			{ name: "FM1", id: 0, type: ChannelType.YM2612FM, },
			{ name: "FM2", id: 1, type: ChannelType.YM2612FM, },
			{ name: "FM3", id: 2, type: ChannelType.YM2612FM, },
			{ name: "FM4", id: 3, type: ChannelType.YM2612FM, },
			{ name: "FM5", id: 4, type: ChannelType.YM2612FM, },
			{ name: "FM6", id: 5, type: ChannelType.YM2612FM, },
			{ name: "PCM1", id:10, type: ChannelType.YM2612DAC, },
			{ name: "PCM2", id:11, type: ChannelType.YM2612DAC, },
			{ name: "PSG1", id: 6, type: ChannelType.YM7101PSG, },
			{ name: "PSG2", id: 7, type: ChannelType.YM7101PSG, },
			{ name: "PSG3", id: 8, type: ChannelType.YM7101PSG, },
			{ name: "PSG4", id: 9, type: ChannelType.YM7101PSG, },
		];
	}

	public muteChannel(id:number, state:boolean): boolean {
		if(id < 6) {
			// FM
			this.chip.muteYM(id, state);
			return true;

		} else if(id < 10) {
			// PSG
			this.chip.mutePSG(id - 6, state);
			return true;

		} else if(id < 12) {
			// DAC
			return false;
		}

		return false;
	}

	public enableChannel():boolean {
		return true;
	}

	public disableChannel():boolean {
		return true;
	}
}
