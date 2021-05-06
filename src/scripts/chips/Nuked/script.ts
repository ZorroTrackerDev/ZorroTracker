
import { Chip, YMREG, PSGCMD, ChipConfig } from "../../../api/scripts/chip";
import { YM, YM2612, ASICYM3438, DiscreteYM3438 } from "./ym2612/index";

export default class implements Chip {
	private FM:YM|undefined;
//	private PSG:SN76489;
	private curfmvol = 1;
	private curpsgvol = 1;
	private config:ChipConfig|null = null;

	public init(samplerate: number, config:ChipConfig): void {
		this.config = config;
		this.FM = new YM([ YM2612, ASICYM3438, DiscreteYM3438, ][Math.abs(config.type as number) % 3]);

	//	this.PSG.init(undefined, samplerate);
	//	this.PSG.config(0xf, 0, 0, 9, 16);

		// psg is / 15
		this.FM.resetWithClockRate((this.config.MLCK as number / 7) | 0, this.config.samplerate = samplerate);
	}

	public reset(): void {
	//	this.PSG.reset();
		this.FM?.resetWithClockRate((this.config?.MLCK as number / 7) | 0, this.config?.samplerate as number);
	}

	public muteYM(bitfield: number): void {
		this.FM?.setMutemask(bitfield);
	}

	public writeYM1(register: YMREG, value: number): void {
		this.FM?.writeBuffered(0, register);
		this.FM?.writeBuffered(1, value);
	}

	public writeYM2(register: YMREG, value: number): void {
		this.FM?.writeBuffered(2, register);
		this.FM?.writeBuffered(3, value);
	}

	public readYM(): number {
		return this.FM?.read(0) ?? 0x00;
	}

	public mutePSG(bitfield: number): void {
		// TODO: Implement
	}

	public writePSG(command: PSGCMD): void {
	//	this.PSG.write(command);
	}

	// eslint-disable-next-line class-methods-use-this
	public readPSG(): null {
		return null;
	}

	public setVolume(volume:number): void {
		this.curfmvol = (this.config?.fmvol ?? 1) * volume;
		this.curpsgvol = (this.config?.psgvol ?? 1) * volume;
	}

	private buffer:Buffer|undefined;
	private bufpos = 0;

	public initBuffer(totalsamples: number):void {
		this.buffer = Buffer.alloc(totalsamples * 4);
		this.bufpos = 0;
	}

	public runBuffer(samples: number):number {
		if(!this.buffer) {
			throw new Error("initBuffer was not called before runBuffer!");
		}

		const smp = Math.min(samples, (this.buffer.length - this.bufpos) / 4);
		const _fm = (this.FM as YM).update(smp);
	//	const _psg = this.FM?.clock();

		for(let addr = 0;addr < smp * 2;addr += 2) {

			this.buffer.writeInt16LE(Math.max(Math.min(((_fm[addr]) * this.curfmvol) + (0 * this.curpsgvol), 0x7FFF), -0x8000), this.bufpos);
			this.buffer.writeInt16LE(Math.max(Math.min(((_fm[addr + 1]) * this.curfmvol) + (0 * this.curpsgvol), 0x7FFF), -0x8000), this.bufpos + 2);
			this.bufpos += 4;
		}

		return this.bufpos / 4;
	}

	public getBuffer():Buffer {
		if(!this.buffer) {
			throw new Error("initBuffer was not called before getBuffer!");
		}

		return this.buffer;
	}
}