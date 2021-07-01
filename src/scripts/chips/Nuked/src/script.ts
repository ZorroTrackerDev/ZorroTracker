import { Chip, PSGCMD, ChipConfig, FMRegisters, PSGRegisters } from "../../../../api/chip";
import { YMChip, YM2612, ASICYM3438, DiscreteYM3438, YM2612WithMD1 } from "nuked-opn2-node";
import { PSGChip } from "nuked-psg-node";

export default class implements Chip {
	private FM:YMChip|undefined;
	private PSG:PSGChip|undefined;
	private curfmvol = 1;
	private curpsgvol = 1;
	private volumefactor = 1 << 18;
	private config:ChipConfig|null = null;
	private type = "";

	public registers = {
		YM2612: new FMRegisters(),
		SN76489: new PSGRegisters(),
	};

	public init(samplerate: number, config:ChipConfig): void {
		this.config = config;
		this.FM = new YMChip(this.type = [ YM2612, ASICYM3438, DiscreteYM3438, YM2612WithMD1, ][Math.abs(config.type as number) % 4]);
		this.PSG = new PSGChip();

		this.config.samplerate = samplerate;
		this.reset();
	}

	public reset(): void {
		this.PSG?.init();

		// psg is / 15
		this.FM?.resetWithClockRate((this.config?.MLCK as number / 7) | 0, this.config?.samplerate as number);
		this.FM?.setType(this.type);

		this.FM?.setMutemask(this.fmmute);
	//	this.PSG?.setMutemask(this.psgmute);

		this.registers.YM2612.reset();
		this.registers.SN76489.reset();
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

	public writeYM(port: 0|1|2|3, value: number): void {
		this.FM?.writeBuffered(port, value);
		this.registers.YM2612.write(port, value);
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
		this.PSG?.writeBuffered(command);
		this.registers.SN76489.write(command);
	}

	public readPSG(): number {
		return this.PSG?.read() ?? 0xFF;
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
		let _psg = 0;

		for(let addr = 0;addr < smp * 2;addr += 2) {
			_psg = (this.PSG as PSGChip).generate();
			_psg = (this.PSG as PSGChip).generate();
			_psg = (this.PSG as PSGChip).generate();
			_psg = (this.PSG as PSGChip).generate();
			_psg = (this.PSG as PSGChip).generate();

			this.buffer.writeInt32LE(Math.max(Math.min(
				((_fm[addr]) * this.curfmvol) + (_psg * this.curpsgvol), 0x7FFFFFFF), -0x80000000), this.bufpos);
			this.buffer.writeInt32LE(Math.max(Math.min(
				((_fm[addr + 1]) * this.curfmvol) + (_psg * this.curpsgvol), 0x7FFFFFFF), -0x80000000), this.bufpos + 4);
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
