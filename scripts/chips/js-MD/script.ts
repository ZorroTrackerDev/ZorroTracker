import { YM2612 } from "./ym2612";
import { SN76489 } from "./sn76489";
import { Emulator, YMREG, PSGCMD, EmulatorConfig } from "../../../api/scripts/emulator";

export default class implements Emulator {
	private FM:YM2612;
	private PSG:SN76489;
	private fmvol = 1;
	private psgvol = 1;

	constructor() {
		this.FM = new YM2612();
		this.PSG = new SN76489();
	}

	public init(samplerate: number, config:EmulatorConfig): void {
		this.fmvol = config.fmvol ?? 1;
		this.psgvol = config.psgvol ?? 1;
		this.PSG.init(undefined, samplerate);
		this.PSG.config(0xf, 0, 0, 9, 16);

		this.FM.init(undefined, samplerate);
		this.FM.config(9);
		this.FM.reset();
	}

	public reset(): void {
		this.PSG.reset();
		this.FM.reset();
	}

	public writeYM1(register: YMREG, value: number): void {
		this.FM.write(register, value);
	}

	public writeYM2(register: YMREG, value: number): void {
		this.FM.write(register | 0x100, value);
	}

	public writePSG(command: PSGCMD): void {
		this.PSG.write(command);
	}

	public readYM(): number {
		return this.FM.read();
	}

	// eslint-disable-next-line class-methods-use-this
	public readPSG(): number {
		return 0xFF;
	}

	private buffer:Buffer|undefined;
	private bufpos = 0;

	public initBuffer(totalsamples: number):void {
		this.buffer = Buffer.alloc(totalsamples * 4);
		this.bufpos = 0;
	}

	public runBuffer(samples: number, volume:number):number {
		if(!this.buffer) {
			throw new Error("initBuffer was not called before runBuffer!");
		}

		const smp = Math.min(samples, (this.buffer.length - this.bufpos) / 4);
		const _fm = this.FM.update(smp);
		const _psg = this.PSG.update(smp);

		for(let addr = 0;addr < smp * 4;addr += 4) {
			this.buffer.writeInt16LE(
				(_fm.readInt16LE(addr) * volume * this.fmvol) + (_psg.readInt16LE(addr) * volume * this.psgvol), this.bufpos);

			this.buffer.writeInt16LE(
				(_fm.readInt16LE(addr + 2) * volume * this.fmvol) + (_psg.readInt16LE(addr + 2) * volume * this.psgvol), this.bufpos + 2);

			this.bufpos += 4;
		}

		return smp;
	}

	public getBuffer():Buffer {
		if(!this.buffer) {
			throw new Error("initBuffer was not called before getBuffer!");
		}

		return this.buffer;
	}
}