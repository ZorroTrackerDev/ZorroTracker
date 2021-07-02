import { YM2612 } from "./ym2612";
import { SN76489 } from "./sn76489";
import { Chip, PSGCMD, ChipConfig, FMRegisters, PSGRegisters } from "../../../../api/chip";

export default class implements Chip {
	private FM:YM2612;
	private PSG:SN76489;
	private storedfmvol = 1;
	private storedpsgvol = 1;
	private curfmvol = 1;
	private curpsgvol = 1;
	private volumefactor = 1 << 16;

	private latch: [ number, number, ];

	public registers = {
		YM2612: new FMRegisters(),
		SN76489: new PSGRegisters(),
	};

	constructor() {
		this.FM = new YM2612();
		this.PSG = new SN76489();
	}

	public init(samplerate: number, config:ChipConfig): void {
		this.storedfmvol = config.fmvol ?? 1;
		this.storedpsgvol = config.psgvol ?? 1;
		this.PSG.init(undefined, samplerate);
		this.PSG.config(0xf, 0, 0, 9, 16);

		this.FM.init(undefined, samplerate);
		this.FM.config(9);
		this.FM.reset();
	}

	public reset(): void {
		this.PSG.reset();
		this.FM.reset();

		this.latch = [ 0, 0, ];
		this.registers.YM2612.reset();
		this.registers.SN76489.reset();
	}

	public muteYM(bitfield: number): void {
		// TODO: Implement
	}

	public writeYM(port: 0|1|2|3, value: number): void {
		if(port & 1) {
			// value
			this.FM.write(this.latch[Math.round(port / 2)] | [ 0, 0x100, ][Math.round(port / 2)], value);

		} else {
			// register
			this.latch[Math.round(port / 2)] = value;
		}

	}

	public readYM(): number {
		return this.FM.read();
	}

	public mutePSG(bitfield: number): void {
		// TODO: Implement
	}

	public writePSG(command: PSGCMD): void {
		this.PSG.write(command);
	}

	// eslint-disable-next-line class-methods-use-this
	public readPSG(): null {
		return null;
	}

	public setVolume(volume:number): void {
		this.curfmvol = this.storedfmvol * volume * this.volumefactor;
		this.curpsgvol = this.storedpsgvol * volume * this.volumefactor;
	}

	private buffer:Buffer|undefined;
	private bufpos = 0;

	public initBuffer(totalsamples: number):void {
		this.buffer = Buffer.alloc(totalsamples * 8);
		this.bufpos = 0;
	}

	public runBuffer(samples: number):number {
		if(!this.buffer) {
			throw new Error("initBuffer was not called before runBuffer!");
		}

		const smp = Math.min(samples, (this.buffer.length - this.bufpos) / 8);
		const _fm = this.FM.update(smp);
		const _psg = this.PSG.update(smp);

		for(let addr = 0;addr < smp;addr++) {
			this.buffer.writeInt32LE(Math.max(Math.min((_fm.readInt16LE(addr * 4) * this.curfmvol) +
				(_psg.readInt16LE(addr * 4) * this.curpsgvol), 0x7FFFFFFF), -0x80000000), this.bufpos);

			this.buffer.writeInt32LE(Math.max(Math.min((_fm.readInt16LE(addr * 4 + 2) * this.curfmvol) +
				(_psg.readInt16LE(addr * 4 + 2) * this.curpsgvol), 0x7FFFFFFF), -0x80000000), this.bufpos + 4);

			this.bufpos += 8;
		}

		return this.bufpos / 8;
	}

	public getBuffer():Buffer {
		if(!this.buffer) {
			throw new Error("initBuffer was not called before getBuffer!");
		}

		return this.buffer;
	}

	 public pianoTrigger(): boolean {
		return false;
	}

	public pianoRelease(): boolean {
		return false;
	}
}
