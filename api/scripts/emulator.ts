import { GenericConfig } from "./config";

export interface EmulatorConfig extends GenericConfig {
	fmvol?: number,
	psgvol?: number,
}

export interface Emulator {
	init:(samplerate:number, config:EmulatorConfig) => void;
	writeYM1:(register:YMREG, value:number) => void;
	writeYM2:(register:YMREG, value:number) => void;
	writePSG:(command:PSGCMD) => void;
	readYM:() => number;
	readPSG:() => number;
	initBuffer:(totalsamples: number) => void;
	runBuffer:(samples: number, volume:number) => number;
	getBuffer:() => Buffer;
}

export enum PSGCMD {
	PSG1 = 0x80,
	PSG2 = 0xA0,
	PSG3 = 0xC0,
	PSG4 = 0xE0,

	VOLUME = 0x10,
	FREQ = 0x00,

	PERIODIC = 0x00,
	WHITE = 0x04,

	N10 = 0x00,
	N20 = 0x01,
	N40 = 0x02,
	TONE3 = 0x03,
}

export enum YMREG {
	// Port 1 only
	LFO = 0x22,
	TimerAMSB = 0x24,
	TimerALSB = 0x25,
	TimerB = 0x26,
	TimersCh3 = 0x27,
	Key = 0x28,
	DAC = 0x2A,
	EnDAC = 0x2B,

	FreqCh3Op1LSB = 0xA3,			// Frequency LSB FM3 Special Mode Operator 1
	FreqCh3Op1MSB = 0xA7,			// Frequency MSB FM3 Special Mode Operator 1
	FreqCh3Op2LSB = 0xA8,			// Frequency LSB FM3 Special Mode Operator 2
	FreqCh3Op2MSB = 0xAC,			// Frequency MSB FM3 Special Mode Operator 2
	FreqCh3Op3LSB = 0xA9,			// Frequency LSB FM3 Special Mode Operator 3
	FreqCh3Op3MSB = 0xAD,			// Frequency MSB FM3 Special Mode Operator 3
	FreqCh3Op4LSB = 0xAA,			// Frequency LSB FM3 Special Mode Operator 4
	FreqCh3Op4MSB = 0xAE,			// Frequency MSB FM3 Special Mode Operator 4

	// op register codes
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

// LFO = 0x22
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

// LFO = 0x28
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

	AMS0 = 0x00,
	AMS1_4 = 0x01,
	AMS5_9 = 0x02,
	AMS11_8 = 0x03,

	FMS0 = 0x00,
	FMS3_4 = 0x08,
	FMS6_7 = 0x10,
	FMS10 = 0x18,
	FMS14 = 0x20,
	FMS20 = 0x28,
	FMS40 = 0x30,
	FMS80 = 0x38,
}