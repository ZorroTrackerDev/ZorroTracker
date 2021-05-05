
import { Chip, YMREG, PSGCMD, ChipConfig } from "../../../api/scripts/chip";
import { YM, YM2612, YM3438 } from "./ym2612/index";

export default class implements Chip {
	private FM:YM|undefined;
//	private PSG:SN76489;
	private storedfmvol = 1;
	private storedpsgvol = 1;
	private curfmvol = 1;
	private curpsgvol = 1;
	private samplerate = 0;

	public init(samplerate: number, config:ChipConfig): void {
		this.storedfmvol = config.fmvol ?? 1;
		this.storedpsgvol = config.psgvol ?? 1;
		this.FM = new YM(config.YM3438 ? YM3438 : YM2612);

	//	this.PSG.init(undefined, samplerate);
	//	this.PSG.config(0xf, 0, 0, 9, 16);

	// note sure what the first param is. `samplerate` and `7*10*6` at least produce sound
		this.FM.resetWithClockRate(7*10*6, this.samplerate = samplerate);
	}

	public reset(): void {
	//	this.PSG.reset();
		this.FM?.resetWithClockRate(7*10*6, this.samplerate);
	}

	public muteYM(bitfield: number): void {
		// TODO: Implement
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
		this.curfmvol = this.storedfmvol * volume;
		this.curpsgvol = this.storedpsgvol * volume;
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

			this.buffer.writeInt16LE(((_fm[addr]     * 4) * this.curfmvol) + (0 * this.curpsgvol), this.bufpos);
			this.buffer.writeInt16LE(((_fm[addr + 1] * 4) * this.curfmvol) + (0 * this.curpsgvol), this.bufpos + 2);
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