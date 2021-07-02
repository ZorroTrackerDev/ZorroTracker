import { GenericConfig } from "./config";

// chip configuration file format
export interface ChipConfig extends GenericConfig {
	// this is the relative FM volume. 1.0 = 100% of the output volume.
	fmvol?: number,

	// this is the relative PSG volume. 1.0 = 100% of the output volume.
	psgvol?: number,

	// any additional properties that are chip-specific
	[x: string]: unknown;
}

// interface for the chip emulator. All chips must use this interface.
export interface Chip {
	registers: {
		/**
		 * The register set for YM2612, if enabled for this chip
		 */
		YM2612?: FMRegisters,

		/**
		 * The register set for SN76489, if enabled for this chip
		 */
		SN76489?: PSGRegisters,
	};

	/**
	 * Initialize the chip.
	 *
	 * @param samplerate The sample rate that the chip is requested to emulate in.
	 * @param config The configuration object for the chip.
	 */
	init:(samplerate:number, config:ChipConfig) => void;

	/**
	 * Reset the chip.
	 */
	reset:() => void;

	/**
	 * Mute some YM2612 channels (separate from doing it via YM2612 registers)
	 *
	 * @param channel Represents the channel to mute, 0-5 = FM 1-6, 6 = DAC
	 * @param state The state of the channel. true = muted, false = not muted
	 */
	muteYM:(channel:number, state:boolean) => void;

	/**
	 * Write command to YM2612 port
	 *
	 * @param port The YM2612 port to write to
	 * @param value The value to write into port
	 */
	writeYM:(port:0|1|2|3, value:number|YMREG) => void;

	/**
	 * Read from YM2612 port 1.
	 *
	 * @returns the current status of the YM2612
	 */
	readYM:() => number;

	/**
	 * Mute some SN76489 channels (separate from doing it via SN76489 commands)
	 *
	 * @param channel Represents the channel to mute, 0-2 = PSG 1-3, 3 = PSG noise
	 * @param state The state of the channel. true = muted, false = not muted
	 */
	mutePSG:(channel:number, state:boolean) => void;

	/**
	 * Write command to SN76489 command port.
	 *
	 * @param command The SN76489 command to write
	 */
	writePSG:(command:PSGCMD) => void;

	/**
	 * Read from SN76489 command port
	 *
	 * @returns the current status of the SN76489, or `null` if the operation is not permitted
	 */
	readPSG:() => number|null;

	/**
	 * Set the chip emulation volume.
	 *
	 * @param volume Volume as percentage from 0% to 200% (0.0 to 2.0)
	 */
	setVolume:(volume:number) => void;

	/**
	 * Initialize a new buffer for audio output. The buffer is expected to be little-endian 32-bit per samples, left and right speakers interleaved.
	 *
	 * @param totalsamples The number of samples that the buffer needs to fit
	 */
	initBuffer:(totalsamples: number) => void;

	/**
	 * Run chip emulation for number of samples before returning.
	 *
	 * @returns The position in the buffer we are now at (in samples, not bytes)
	 */
	runBuffer:(samples: number) => number;

	/**
	 * Get the last audio buffer
	 *
	 * @returns The buffer potentially filled with audio data
	 */
	getBuffer:() => Buffer;
}

/*
 * Common interface allowing chips and drivers to co-operate with current PSG register values in the actual chip.
 * This does not represent internal chip state, but rather what the expected state would be given the commands given.
 * This is to provide the ability to clone state or use it for storing registers for drivers which do that.
 */
export class PSGRegisters {
	private latch = 0;
	private _channels!: [ PSGChannel, PSGChannel, PSGChannel, PSG4Channel, ];

	/**
	 * The list of channels in the PSG chip. PSG4 is a special channel because it does not have frequency
	 */
	public get channels(): [ PSGChannel, PSGChannel, PSGChannel, PSG4Channel, ] {
		return this._channels;
	}

	constructor() {
		this.reset();
	}

	/**
	 * Reset the chip completely
	 */
	public reset(): void {
		this.latch = 0;

		// initialize channels to any value
		this._channels = [
			{ volume: 0xF, frequency: 0, },			// PSG1
			{ volume: 0xF, frequency: 0, },			// PSG2
			{ volume: 0xF, frequency: 0, },			// PSG3
			{ volume: 0xF, noise: 0, },				// PSG4
		];
	}

	/**
	 * Function to write PSG data so that this object can be updated
	 *
	 * @param data The data to write to PSG
	 */
	public write(data:number): void {
		if(data < 0x80) {
			if(this.latch === 3) {
				// write latched noise mode on PSG4
				this._channels[3].noise = data & 7;

			} else {
				// write latched frequency
				(this._channels[this.latch] as PSGChannel).frequency &= 0xF;
				(this._channels[this.latch] as PSGChannel).frequency |= (data & 0x3F) << 4;
			}

		} else {
			// fetch channel from the data
			this.latch = (data & 0x60) >> 5;

			if(data & 0x10) {
				// this is volume command
				this._channels[this.latch].volume = data & 0xF;

			} else if(this.latch === 3) {
				// this is a noise command
				this._channels[3].noise = data & 7;

			} else {
				// this is a frequency command
				(this._channels[this.latch] as PSGChannel).frequency &= 0x3F0;
				(this._channels[this.latch] as PSGChannel).frequency |= data & 0xF;
			}
		}
	}
}

// Common interface for a PSG channel and its data
export type PSGChannel = {
	/**
	 * Channel volume. PSG only supports 0-15 as valid volumes. Not 100% quaranteed to be any of these values!
	 */
	volume: number,

	/**
	 * The PSG frequency. Valid range is $000 to $7FF. Not guaranteed to be a valid value.
	 */
	frequency: number,
}

// Common interface for a PSG channel and its data
export type PSG4Channel = {
	/**
	 * Channel volume. PSG only supports 0-15 as valid volumes. Not 100% quaranteed to be any of these values!
	 */
	volume: number,

	/**
	 * The PSG4 noise type. Values 0-7 are supported. Not 100% quaranteed to be any of these values!Not 100% quaranteed to be any of these values!
	 */
	noise: number,
}

// helper enums for PSG commands
export enum PSGCMD {
	// channel equates
	PSG1 = 0x80, PSG2 = 0xA0, PSG3 = 0xC0, PSG4 = 0xE0,

	// command type equates
	VOLUME = 0x10, FREQ = 0x00,

	// noise mode equates
	PERIODIC = 0x00, WHITE = 0x04,

	// noise frequency equates
	N10 = 0x00, N20 = 0x01, N40 = 0x02, TONE3 = 0x03,
}

/*
 * Common interface allowing chips and drivers to co-operate with current FM register values in the actual chip.
 * This does not represent internal chip state, but rather what the expected state would be given the commands given.
 * This is to provide the ability to clone state or use it for storing registers for drivers which do that.
 */
export class FMRegisters {
	private latch!:[ number, number, ];
	private _channels!: [ FMChannel, FMChannel, FM3Channel, FMChannel, FMChannel, FM6Channel ];
	private _regs!: number[];

	/**
	 * The list of channels in the FM chip
	 */
	public get channels(): [ FMChannel, FMChannel, FM3Channel, FMChannel, FMChannel, FM6Channel, ] {
		return this._channels;
	}

	/**
	 * The list of registers in this chip
	 */
	public get registers(): number[] {
		return this._regs;
	}

	constructor() {
		this.reset();
	}

	/**
	 * Reset the chip completely
	 */
	public reset(): void {
		this.latch = [ 0, 0, ];

		// reset registers
		this._regs = Array(0x200);

		// reset various
		this._regs[YMREG.DAC] = 0x80;

		// reset TL
		this._regs[YMREG.ch1 + YMREG.op1 + YMREG.TL] = this._regs[YMREG.ch1 + YMREG.op2 + YMREG.TL] =
		this._regs[YMREG.ch1 + YMREG.op3 + YMREG.TL] = this._regs[YMREG.ch1 + YMREG.op4 + YMREG.TL] =
		this._regs[YMREG.ch2 + YMREG.op1 + YMREG.TL] = this._regs[YMREG.ch2 + YMREG.op2 + YMREG.TL] =
		this._regs[YMREG.ch2 + YMREG.op3 + YMREG.TL] = this._regs[YMREG.ch2 + YMREG.op4 + YMREG.TL] =
		this._regs[YMREG.ch3 + YMREG.op1 + YMREG.TL] = this._regs[YMREG.ch3 + YMREG.op2 + YMREG.TL] =
		this._regs[YMREG.ch3 + YMREG.op3 + YMREG.TL] = this._regs[YMREG.ch3 + YMREG.op4 + YMREG.TL] =
		this._regs[0x100 + YMREG.ch1 + YMREG.op1 + YMREG.TL] = this._regs[0x100 + YMREG.ch1 + YMREG.op2 + YMREG.TL] =
		this._regs[0x100 + YMREG.ch1 + YMREG.op3 + YMREG.TL] = this._regs[0x100 + YMREG.ch1 + YMREG.op4 + YMREG.TL] =
		this._regs[0x100 + YMREG.ch2 + YMREG.op1 + YMREG.TL] = this._regs[0x100 + YMREG.ch2 + YMREG.op2 + YMREG.TL] =
		this._regs[0x100 + YMREG.ch2 + YMREG.op3 + YMREG.TL] = this._regs[0x100 + YMREG.ch2 + YMREG.op4 + YMREG.TL] =
		this._regs[0x100 + YMREG.ch3 + YMREG.op1 + YMREG.TL] = this._regs[0x100 + YMREG.ch3 + YMREG.op2 + YMREG.TL] =
		this._regs[0x100 + YMREG.ch3 + YMREG.op3 + YMREG.TL] = this._regs[0x100 + YMREG.ch3 + YMREG.op4 + YMREG.TL] = 0x7F;

		// reset channels
		this._channels = [
			new FMChannel(this, 0),				// FM1
			new FMChannel(this, 1),				// FM2
			new FM3Channel(this, 2),			// FM3
			new FMChannel(this, 0x100),			// FM4
			new FMChannel(this, 0x101),			// FM5
			new FM6Channel(this, 0x102),		// FM6
		];
	}

	/**
	 * Function to write PSG data so that this object can be updated
	 *
	 * @param data The data to write to PSG
	 */
	public write(port: 0|1|2|3, value: number): void {
		if(port & 1) {
			// write data
			if(this.latch[(port / 2) | 0] < YMREG.DM) {
				if(port !== 1) {
					// ignore part 2
					return;
				}

				// 0x00-0x2F
				this._regs[this.latch[0]] = value;

				if(this.latch[0] === YMREG.Key) {
					// special handling for key
					switch(value & 0xF) {
						case 0: case 1: case 2: case 3: case 4: case 5:
							// set key for channel. Ignore invalid channels
							this._channels[value & 0xF].key = (value & YMKey.OpAll) >> 4;
							break;
					}
				}

			} else {
				// 0x30-0xFF
				this._regs[this.latch[(port / 2) | 0]] = value;
			}

		} else if(port){
			// write latch
			this.latch[(port / 2) | 0] = value;
		}
	}

	/**
	 * Get DAC enable status
	 */
	public get EnDAC(): boolean {
		return (this.registers[YMREG.EnDAC] & 0x80) !== 0;
	}

	/**
	 * Get DAC value
	 */
	public get DAC(): number {
		return this.registers[YMREG.DAC];
	}

	/**
	 * Get Timer enable bits and FM3SM enable bits
	 */
	public get Timers(): number {
		return this.registers[YMREG.TimersCh3];
	}

	/**
	 * Get Timer A frequency
	 */
	public get TimerA(): number {
		return (this.registers[YMREG.TimerALSB] & 3) | (this.registers[YMREG.TimerAMSB] << 2);
	}

	/**
	 * Get Timer B frequency
	 */
	public get TimerB(): number {
		return this.registers[YMREG.TimerB];
	}

	/**
	 * Get LFO bits
	 */
	public get LFO(): number {
		return this.registers[YMREG.LFO];
	}

	/**
	 * Get Test bits
	 */
	public get Test(): [ number, number, ] {
		return [ this.registers[YMREG.Test1],  this.registers[YMREG.Test2], ];
	}
}

export class FMChannel {
	protected parent: FMRegisters;
	protected offset: 0|1|2|0x100|0x101|0x102;
	public key = 0;

	constructor(parent:FMRegisters, offset:0|1|2|0x100|0x101|0x102) {
		this.parent = parent;
		this.offset = offset;
	}

	/**
	 * Get TL of this channel
	 */
	public get TL(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.TL],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.TL],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.TL],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.TL],
		];
	}

	/**
	 * Get Detune + Multiple of this channel
	 */
	public get DM(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.DM],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.DM],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.DM],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.DM],
		];
	}

	/**
	 * Get RateScale + AttackRate of this channel
	 */
	public get RSAR(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.RSAR],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.RSAR],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.RSAR],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.RSAR],
		];
	}

	/**
	 * Get Decay1Rate + AmplitudeModulation of this channel
	 */
	public get D1R(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.D1R],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.D1R],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.D1R],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.D1R],
		];
	}

	/**
	 * Get Decay2Rate of this channel
	 */
	public get D2R(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.D2R],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.D2R],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.D2R],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.D2R],
		];
	}

	/**
	 * Get Decay1Level + ReleaseRate of this channel
	 */
	public get DLRR(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.DLRR],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.DLRR],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.DLRR],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.DLRR],
		];
	}

	/**
	 * Get SSG-EG of this channel
	 */
	public get SSGEG(): [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.op1 + YMREG.SSGEG],
			this.parent.registers[this.offset + YMREG.op2 + YMREG.SSGEG],
			this.parent.registers[this.offset + YMREG.op3 + YMREG.SSGEG],
			this.parent.registers[this.offset + YMREG.op4 + YMREG.SSGEG],
		];
	}

	/**
	 * Get Frequency of this channel
	 */
	public get frequency(): [ number, ] | [ number, number, number, number, ] {
		return [
			this.parent.registers[this.offset + YMREG.FreqLSB] | (this.parent.registers[this.offset + YMREG.FreqMSB] << 8),
		];
	}

	/**
	 * Get Feedback+Algorithm of this channel
	 */
	public get FA(): number {
		return this.parent.registers[this.offset + YMREG.FA];
	}

	/**
	 * Get Panning+LFO of this channel
	 */
	public get PL(): number {
		return this.parent.registers[this.offset + YMREG.PL];
	}
}

export class FM3Channel extends FMChannel {
	/**
	 * Get Frequency of this channel
	 */
	public get frequency(): [ number, number, number, number, ] {
		return [
			this.parent.registers[YMREG.FreqCh3Op1LSB] | (this.parent.registers[YMREG.FreqCh3Op1MSB] << 8),
			this.parent.registers[YMREG.FreqCh3Op2LSB] | (this.parent.registers[YMREG.FreqCh3Op2MSB] << 8),
			this.parent.registers[YMREG.FreqCh3Op3LSB] | (this.parent.registers[YMREG.FreqCh3Op3MSB] << 8),
			this.parent.registers[YMREG.FreqCh3Op4LSB] | (this.parent.registers[YMREG.FreqCh3Op4MSB] << 8),
		];
	}

	/**
	 * Get FM3 special mode bits of this channel
	 *
	 * 0 = normal
	 * 1 = FM3 Special Mode
	 * 2 = CSM enabled
	 */
	public get Mode(): number {
		return this.parent.registers[YMREG.TimersCh3] >> 6;
	}
}

export class FM6Channel extends FMChannel {
	/**
	 * Get DAC enable status
	 */
	public get EnDAC(): boolean {
		return (this.parent.registers[YMREG.EnDAC] & 0x80) !== 0;
	}

	/**
	 * Get DAC value
	 */
	public get DAC(): number {
		return this.parent.registers[YMREG.DAC];
	}
}

// helper enums for YM registers
export enum YMREG {
	// Port 1 only
	Test1 = 0x21,
	LFO = 0x22,
	TimerAMSB = 0x24,
	TimerALSB = 0x25,
	TimerB = 0x26,
	TimersCh3 = 0x27,
	Key = 0x28,
	DAC = 0x2A,
	EnDAC = 0x2B,
	Test2 = 0x2C,

	FreqCh3Op1LSB = 0xA3,			// Frequency LSB FM3 Special Mode Operator 1
	FreqCh3Op1MSB = 0xA7,			// Frequency MSB FM3 Special Mode Operator 1
	FreqCh3Op2LSB = 0xA8,			// Frequency LSB FM3 Special Mode Operator 2
	FreqCh3Op2MSB = 0xAC,			// Frequency MSB FM3 Special Mode Operator 2
	FreqCh3Op3LSB = 0xA9,			// Frequency LSB FM3 Special Mode Operator 3
	FreqCh3Op3MSB = 0xAD,			// Frequency MSB FM3 Special Mode Operator 3
	FreqCh3Op4LSB = 0xAA,			// Frequency LSB FM3 Special Mode Operator 4
	FreqCh3Op4MSB = 0xAE,			// Frequency MSB FM3 Special Mode Operator 4

	// Op register codes
	ch1 = 0x00, ch2 = 0x01, ch3 = 0x02,
	op1 = 0x00, op2 = 0x04, op3 = 0x08, op4 = 0x0C,

	// Port 1 and 2; op registers
	DM = 0x30,				// Detune + Multiple
	TL = 0x40,				// Total Level
	RSAR = 0x50,			// Rate Scale + Attack Rate
	D1R = 0x60,				// Decay 1 Rate + Amplitude Modulation
	D2R = 0x70,				// Decay 2 Rate
	DLRR = 0x80,			// Decay 1 Level + Release Rate
	SSGEG = 0x90,			// Propietary (SSG-EG)

	// Port 1 and 2; other registers
	FreqLSB = 0xA0,			// Frequency LSB
	FreqMSB = 0xA4,			// Frequency MSB
	FA = 0xB0,				// Feedback + Algorithm
	PL = 0xB4,				// Panning + LFO
}

// Equates for LFO (register 0x22)
export enum YMLFO {
	Enable = 0x8,
	F3_98 = 0x00,
	F5_56 = 0x01,
	F6_02 = 0x02,
	F6_37 = 0x03,
	F6_88 = 0x04,
	F9_63 = 0x05,
	F48_1 = 0x06,
	F72_2 = 0x07,
}

// Equates for Key (register 0x28)
export enum YMKey {
	FM1 = 0x0,
	FM2 = 0x1,
	FM3 = 0x2,
	FM4 = 0x4,
	FM5 = 0x5,
	FM6 = 0x6,

	Op1 = 0x10,
	Op2 = 0x20,
	Op3 = 0x40,
	Op4 = 0x80,
	OpAll = Op1 | Op2 | Op3 | Op4,
}

// various helper enums for YM register values
export enum YMHelp {
	// TimerA = 0x24-0x25
	ShiftTimerALSB = 2,
	AndTimerALSB = 0x3,
	AndTimerAMSB = 0xFF,

	// TimerB = 0x26
	AndTimerB = 0xFF,

	// DAC Enable = 0x2B
	DACEnable = 0x80,
	DACDisable = 0x00,

	// Detune + Multiple = 0x3x
	AndDetune = 0x7,
	ShiftDetune = 4,
	AndMultiple = 0xF,
	ShiftMultiple = 0,

	// Total Level = 0x4x
	AndTotalLevel = 0x7F,

	// Rate Scale + Attack Rate = 0x5x
	AndRateScale = 0x3,
	ShiftRateScale = 6,
	AndAttackRate = 0x1F,
	ShiftAttackRate = 0,

	// Decay 1 Rate + Amplitude Modulation = 0x6x
	AndAmpMod = 0x1,
	ShiftAmpMod = 7,
	AndD1R = 0xF,
	ShiftD1R = 0,

	// Decay 1 Rate = 0x7x
	AndD2R = 0x1F,
	ShiftD2R = 0,

	// Decay 1 Level + Release Rate = 0x8x
	AndD1L = 0xF,
	ShiftD1L = 4,
	AndReleaseRate = 0xF,
	ShiftReleaseRate = 0,

	// Propietary (SSG-EG) = 0x9x
	AndSSGEG = 0xF,
	ShiftSSGEG = 0,

	// Feedback + Algorithm = 0xB0+
	AndFeedback = 0x7,
	ShiftFeedback = 4,
	AndAlgorithm = 0xF,
	ShiftAlgorithm = 0,

	// Panning + LFO = 0xB4+
	AndPanning = 0xC0,
	PanNone = 0x00,
	PanRight = 0x40,
	PanLeft = 0x80,
	PanCenter = 0xC0,

	AndFMS = 0x38,
	AndAMS = 0x03,

	// AMS equates
	AMS0 = 0x00,
	AMS1_4 = 0x01,
	AMS5_9 = 0x02,
	AMS11_8 = 0x03,

	// FMS equates
	FMS0 = 0x00,
	FMS3_4 = 0x08,
	FMS6_7 = 0x10,
	FMS10 = 0x18,
	FMS14 = 0x20,
	FMS20 = 0x28,
	FMS40 = 0x30,
	FMS80 = 0x38,
}
