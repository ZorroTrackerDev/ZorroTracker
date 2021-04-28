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

	public writeYM1(register: YMREG, value: number): void {
		this.FM.write(register & 0xFF, value);
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

	public buffer(samples:number, volume:number): Buffer {
		const buf = Buffer.alloc(samples * 4);
		const bfm = this.FM.update(samples);
		const bpsg = this.PSG.update(samples);

		// mix samples
		for(let addr = 0;addr < samples * 4;addr += 2) {
			buf.writeInt16LE((bfm.readInt16LE(addr) * volume * this.fmvol) + (bpsg.readInt16LE(addr) * volume * this.psgvol), addr);
		}

		return buf;
	}
}