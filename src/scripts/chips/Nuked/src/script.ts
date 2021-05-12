
import { Chip, YMREG, PSGCMD, ChipConfig } from "../../../../api/scripts/chip";
import { YMChip, YM2612, ASICYM3438, DiscreteYM3438, YM2612WithMD1 } from "nuked-opn2-node";

export default class implements Chip {
	private FM:YMChip|undefined;
//	private PSG:SN76489;
	private curfmvol = 1;
	private curpsgvol = 1;
	private volumefactor = 1 << 18;
	private config:ChipConfig|null = null;
	private type = "";

	public init(samplerate: number, config:ChipConfig): void {
		this.config = config;
		this.FM = new YMChip(this.type = [ YM2612, ASICYM3438, DiscreteYM3438, YM2612WithMD1, ][Math.abs(config.type as number) % 4]);

	//	this.PSG.init(undefined, samplerate);
	//	this.PSG.config(0xf, 0, 0, 9, 16);

		// psg is / 15
		this.FM.resetWithClockRate((this.config.MLCK as number / 7) | 0, this.config.samplerate = samplerate);
		this.FM.setType(this.type);
	}

	public reset(): void {
	//	this.PSG.reset();
		this.FM?.resetWithClockRate((this.config?.MLCK as number / 7) | 0, this.config?.samplerate as number);
		this.FM?.setType(this.type);

		this.FM?.setMutemask(this.fmmute);
	//	this.PSG?.setMutemask(this.psgmute);
	}

	// muted FM channels for this chip
	private fmmute = 0;

	public muteYM(channel:number, state:boolean): void {
		const last = this.fmmute;

		if(state) {
			this.fmmute |= 1 << channel;

		} else {
			this.fmmute &= 0x7F - (1 << channel);
		}

		if(last !== this.fmmute){
			this.FM?.setMutemask(this.fmmute);
		}
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

	// muted PSG channels for this chip
	private psgmute = 0;

	public mutePSG(channel: number, state:boolean): void {
		const last = this.psgmute;

		if(state) {
			this.psgmute |= 1 << channel;

		} else {
			this.psgmute &= 0x0F - (1 << channel);
		}

		if(last !== this.psgmute){
		//	this.PSG?.setMutemask(this.psgmute);
		}
	}

	public writePSG(command: PSGCMD): void {
	//	this.PSG.write(command);
	}

	// eslint-disable-next-line class-methods-use-this
	public readPSG(): null {
		return null;
	}

	public setVolume(volume:number): void {
		this.curfmvol = (this.config?.fmvol ?? 1) * volume * this.volumefactor;
		this.curpsgvol = (this.config?.psgvol ?? 1) * volume * this.volumefactor;
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
		const _fm = (this.FM as YMChip).update(smp);
	//	const _psg = this.FM?.clock();

		for(let addr = 0;addr < smp * 2;addr += 2) {

			this.buffer.writeInt32LE(Math.max(Math.min(
				((_fm[addr]) * this.curfmvol) + (0 * this.curpsgvol), 0x7FFFFFFF), -0x80000000), this.bufpos);
			this.buffer.writeInt32LE(Math.max(Math.min(
				((_fm[addr + 1]) * this.curfmvol) + (0 * this.curpsgvol), 0x7FFFFFFF), -0x80000000), this.bufpos + 4);
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
}