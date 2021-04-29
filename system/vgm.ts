import { Driver, DriverConfig } from "../api/scripts/driver";
import fs from "fs";
import { Emulator } from "../api/scripts/emulator";

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
	private emulator:Emulator|undefined;

	constructor() {
		this.vgm = this.block = Buffer.alloc(0);
	}

	public init(samplerate:number, config:DriverConfig|null, emulator:Emulator):void {
		this.emulator = emulator;
	}

	public loadVGM(file:string):void {
		this.block = Buffer.alloc(0);
		this.vgm = fs.readFileSync(file);
		this.blockAddr = 0;

		// verify this is a vgm file
		if(this.vgm.readUInt32BE(0) !== 0x56676d20 /* "Vgm " */) {
			throw new Error("Not a VGM file");
		}

		// get the vgm version
		this.version = this.vgm.readUInt16LE(8);

		// read the starting address, and lenghts and loop point
		this.addr = this.version <= 0x150 ? 0x40 : this.vgm.readUInt32LE(0x34) + 0x34;
		this.length = this.vgm.readUInt32LE(0x18) + 0x18;
		this.loop = this.vgm.readUInt32LE(0x1C);

		if(this.loop !== 0) {
			this.loop += 0x1C;
		}
	}

	public play(special?:string):void {
		if(special) {
			this._play = false;
			this.loadVGM(special);
			this.emulator?.reset();
		}

		this._play = true;
	}

	public stop():void {
		this._play = false;
	}

	private _ticks = 0;
	private _play = false;

	public buffer(samples: number, volume:number):Buffer {
		if(!this.emulator) {
			throw new Error("emulator is null");
		}

		this.emulator.initBuffer(samples);

		if(!this._play){
			// WILL mute
			return this.emulator.getBuffer();
		}

		let left = samples;

		if(this._ticks >= samples) {
			// only ticks
			this.emulator.runBuffer(samples, volume);
			this._ticks -= samples;
			return this.emulator.getBuffer();

		} else if(this._ticks > 0){
			this.emulator.runBuffer(this._ticks, volume);
			left -= this._ticks;
			this._ticks = 0;
		}

		// handle VGM commands
		while(left > 0) {

			for(;this.addr < this.length;) {
				let delay = 0;

				switch(this.vgm[this.addr++]) {
					case 0x52:
						this.emulator.writeYM1(this.vgm[this.addr++], this.vgm[this.addr++]);
						break;

					case 0x53:
						this.emulator.writeYM2(this.vgm[this.addr++], this.vgm[this.addr++]);
						break;

					case 0x4F: case 0x50:
						this.emulator.writePSG(this.vgm[this.addr++]);
						break;

					case 0x66:
						if(this.loop !== 0){
							this.addr = this.loop;
							break;

						} else {
							// no more data 4 u
							this._ticks = Infinity;
							this.emulator.runBuffer(left, volume);
							return this.emulator.getBuffer();
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
							this.emulator.writeYM1(0x2A, this.block[this.blockAddr++])
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
								throw new Error("Data block type "+ this.vgm[this.addr - 1].toString(16) +" was not recognized!");
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
					this.emulator.runBuffer(left, volume);
					this._ticks = delay - left;
					return this.emulator.getBuffer();

				} else if(delay > 0) {
					this.emulator.runBuffer(delay, volume);
					left -= delay;
				}
			}
		}

		return this.emulator.getBuffer();
	}
}