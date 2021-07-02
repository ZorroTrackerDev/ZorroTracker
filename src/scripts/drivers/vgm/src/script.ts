import { Channel, ChannelType, Driver, DriverConfig } from "../../../../api/driver";
import * as fs from "fs";
import { Chip } from "../../../../api/chip";

export default class implements Driver {
	private vgm:Buffer;
	private version = 0;
	private addr = 0;
	private length = 0;
	private loop = 0;
	private waita = 735;
	private waitb = 882;

	private block:Buffer;
	private blockAddr = 0;
	private chip:Chip|undefined;

	constructor() {
		this.vgm = this.block = Buffer.alloc(0);
	}

	public init(samplerate:number, config:DriverConfig|null, chip:Chip):void {
		this.chip = chip;
	}

	public reset():void {
		this.block = Buffer.alloc(0);
		this.blockAddr = 0;

		// verify this is a vgm file
		if(this.vgm.readUInt32BE(0) !== 0x56676d20 /* "Vgm " */) {
			throw new Error("Not a VGM file");
		}

		// get the vgm version
		this.version = this.vgm.readUInt16LE(8);

		// read the starting address, and lenghts and loop point
		this.addr = this.version < 0x150 ? 0x40 : this.vgm.readUInt32LE(0x34) + 0x34;
		this.length = this.vgm.readUInt32LE(0x18) + 0x18;
		this.loop = this.vgm.readUInt32LE(0x1C);

		if(this.loop !== 0) {
			this.loop += 0x1C;
		}
	}

	public loadVGM(file:string):void {
		this.vgm = fs.readFileSync(file);
	}

	public play(special?:string):void {
		if(special) {
			this._play = false;
			this.loadVGM(special);
			this.reset();
			this.chip?.reset();
		}

		this._play = true;
	}

	public stop():void {
		this._play = false;
	}

	private _ticks = 0;
	private _play = false;

	public buffer(initSamples: number, advance:(samples:number) => number):void {
		if(!this.chip) {
			throw new Error("chip is null");
		}

		// need to modify the value over time
		let left = initSamples;

		if(!this._play){
			// playback disabled
			advance(left);
			return;
		}

		if(this._ticks >= left) {
			// only ticks
			advance(left);
			this._ticks -= left;
			return;

		} else if(this._ticks > 0){
			left = advance(this._ticks);
			this._ticks = 0;
		}

		// handle VGM commands
		while(left > 0) {

			for(;this.addr < this.length;) {
				let delay = 0;

				switch(this.vgm[this.addr++]) {
					case 0x52:
						this.chip.writeYM(0, this.vgm[this.addr++]);
						this.chip.writeYM(1, this.vgm[this.addr++]);
						break;

					case 0x53:
						this.chip.writeYM(2, this.vgm[this.addr++]);
						this.chip.writeYM(3, this.vgm[this.addr++]);
						break;

					case 0x4F: case 0x50:
						this.chip.writePSG(this.vgm[this.addr++]);
						break;

					case 0x66:
						if(this.loop !== 0){
							this.addr = this.loop;
							break;

						} else {
							// no more data 4 u
							this._ticks = Infinity;
							left = advance(left);
							return;
						}

					case 0x61:
						delay = this.vgm.readUInt16LE(this.addr);
						this.addr += 2;
						break;

					case 0x62:
						delay = this.waita;
						break;

					case 0x63:
						delay = this.waitb;
						break;

					case 0x70: case 0x71: case 0x72: case 0x73:
					case 0x74: case 0x75: case 0x76: case 0x77:
					case 0x78: case 0x79: case 0x7A: case 0x7B:
					case 0x7C: case 0x7D: case 0x7E: case 0x7F:
						delay = (this.vgm[this.addr - 1] & 0xF) + 1;
						break;

					case 0x80: case 0x81: case 0x82: case 0x83:
					case 0x84: case 0x85: case 0x86: case 0x87:
					case 0x88: case 0x89: case 0x8A: case 0x8B:
					case 0x8C: case 0x8D: case 0x8E: case 0x8F:
						if(this.blockAddr < this.block.length){
							this.chip.writeYM(0, 0x2A);
							this.chip.writeYM(1, this.block[this.blockAddr++]);
						}

						delay = (this.vgm[this.addr - 1] & 0xF);
						break;

					case 0xE0:
						this.blockAddr = this.vgm.readUInt32LE(this.addr);
						this.addr += 4;
						break;

					case 0x67: {	// data block
						if(this.vgm[this.addr++] !== 0x66) {
							throw new Error("Invalid data block.");
						}

						const type = this.vgm[this.addr++];
						const len = this.vgm.readUInt32LE(this.addr);
						this.addr += 4;

						switch(type) {
							case 0: {
								// copy array data
								const array = Buffer.alloc(this.block.length - this.blockAddr + len);
								array.set(this.block.slice(this.blockAddr, this.block.length));
								array.set(this.vgm.slice(this.addr, this.addr + len), this.block.length - this.blockAddr);

								this.block = array;
								this.addr += len;
								this.blockAddr = 0;
								break;
							}

							default:
								throw new Error("Data block type "+ type.toString(16) +" was not recognized!");
						}
						break;
					}

					// ignore
					case 0x90: this.addr += 4; break;
					case 0x91: this.addr += 4; break;
					case 0x92: this.addr += 5; break;
					case 0x93: this.addr += 10; break;
					case 0x94: this.addr += 1; break;
					case 0x95: this.addr += 4; break;

					default:
						throw new Error("Command "+ this.vgm[this.addr - 1].toString(16) +" was not recognized!");
				}

				// if delay processing needed
				if(delay >= left) {
					advance(left);
					this._ticks = delay - left;
					return;

				} else if(delay > 0) {
					left = advance(delay);
				}
			}
		}
	}

	public notes(): undefined {
		return undefined;
	}

	public getChannels(): Channel[] {
		return [
			{ name: "FM1", id: 0, type: ChannelType.YM2612FM, },
			{ name: "FM2", id: 1, type: ChannelType.YM2612FM, },
			{ name: "FM3", id: 2, type: ChannelType.YM2612FM, },
			{ name: "FM4", id: 3, type: ChannelType.YM2612FM, },
			{ name: "FM5", id: 4, type: ChannelType.YM2612FM, },
			{ name: "FM6", id: 5, type: ChannelType.YM2612FM, },
			{ name: "DAC", id: 6, type: ChannelType.YM2612DAC, },
			{ name: "PSG1", id: 7, type: ChannelType.YM7101PSG, },
			{ name: "PSG2", id: 8, type: ChannelType.YM7101PSG, },
			{ name: "PSG3", id: 9, type: ChannelType.YM7101PSG, },
			{ name: "PSG4", id:10, type: ChannelType.YM7101PSG, },
		];
	}

	public muteChannel(id:number, state:boolean): boolean {
		if(id < 7) {
			// FM or DAC
			this.chip.muteYM(id, state);
			return true;

		} else if(id <= 10) {
			// PSG
			this.chip.mutePSG(id - 7, state);
			return true;
		}

		return false;
	}

	public enableChannel():boolean {
		return true;
	}

	public disableChannel():boolean {
		return true;
	}

	public pianoTrigger(): boolean {
		return false;
	}

	public pianoRelease(): boolean {
		return false;
	}
}
