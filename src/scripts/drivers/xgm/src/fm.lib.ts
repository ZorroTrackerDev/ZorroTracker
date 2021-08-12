import { Chip, YMREG } from "../../../../api/chip";
import { NoteData } from "../../../../api/driver";

/**
 * Helper function to mute every FM channel
 *
 * @param chip The YM2612 chip to write registers to.
 */
export function muteAllYMChannels(chip:Chip): void {
	for(let ch = 0;ch < 6; ch++) {
		writeYMch(chip, ch, YMREG.TL | YMREG.op1, 0x7F);
		writeYMch(chip, ch, YMREG.TL | YMREG.op2, 0x7F);
		writeYMch(chip, ch, YMREG.TL | YMREG.op3, 0x7F);
		writeYMch(chip, ch, YMREG.TL | YMREG.op4, 0x7F);
	}
}

/**
 * Helper function to write a YM register to port 0.
 *
 * @param chip The YM2612 chip to write registers to.
 * @param register The register base to write to.
 * @param value The value to write to the register.
 */
export function writeYM1(chip:Chip, register:YMREG, value:number): void {
	chip.writeYM(0, register);
	chip.writeYM(1, value);
}

/**
 * Helper function to write a YM register to port 2.
 *
 * @param chip The YM2612 chip to write registers to.
 * @param register The register base to write to.
 * @param value The value to write to the register.
 */
export function writeYM2(chip:Chip, register:YMREG, value:number): void {
	chip.writeYM(2, register);
	chip.writeYM(3, value);
}

/**
 * Helper function to write a YM register based on the channel.
 *
 * @param chip The YM2612 chip to write registers to.
 * @param channel The channel offset (0-2, 4-6) to write to
 * @param register The register base to write to.
 * @param value The value to write to the register.
 */
export function writeYMch(chip:Chip, channel:number, register:YMREG, value:number): void {
	chip.writeYM(channel & 4 ? 2 : 0, register + (channel & 3));
	chip.writeYM(channel & 4 ? 3 : 1, value);
}

/**
 * Helper function to update FM channel volume
 *
 * @param chip The YM2612 chip to write registers to.
 * @param channel The channel offset (0-2, 4-6) to load to
 * @param instrument The instrument number to use
 * @param volume The channel volume
 */
export function updateFMchVolume(chip:Chip, channel:number, instrument:number, volume:number): void {
	let voice = voices[instrument];

	// if invalid voice, quit
	if(!voice) {
		voice = invalidVoice;
	}

	// load the volume
	const slots = slotOps[voice[1] & 7];

	// send YM writes for the register
	writeYMch(chip, channel, YMREG.TL | YMREG.op1, Math.min(0x7F, ((slots & 8) ? volume : 0) + voice[26]));
	writeYMch(chip, channel, YMREG.TL | YMREG.op2, Math.min(0x7F, ((slots & 4) ? volume : 0) + voice[27]));
	writeYMch(chip, channel, YMREG.TL | YMREG.op3, Math.min(0x7F, ((slots & 2) ? volume : 0) + voice[28]));
	writeYMch(chip, channel, YMREG.TL | YMREG.op4, Math.min(0x7F, ((slots & 1) ? volume : 0) + voice[29]));
}

const slotOps = [
	//1234
	0b0001,				// algorithm 0
	0b0001,				// algorithm 1
	0b0001,				// algorithm 2
	0b0001,				// algorithm 3
	0b0101,				// algorithm 4
	0b0111,				// algorithm 5
	0b0111,				// algorithm 6
	0b1111,				// algorithm 7
]

/**
 * Helper function to play an FM note
 *
 * @param chip The YM2612 chip to write registers to.
 * @param channel The channel offset (0-2, 4-6) to load to
 * @param data The note data to load
 */
export function loadFMNote(chip:Chip, channel:number, data:NoteData|null): void {
	// check for invalid notes
	if(typeof data?.frequency !== "number") {
		return;
	}

	// apply the frequency
	loadFMFrequency(chip, channel, data.frequency);
}

/**
 * Helper function to load an FM voice
 *
 * @param chip The YM2612 chip to write registers to.
 * @param channel The channel offset (0-2, 4-6) to load to
 * @param frequency The frequency to load
 */
export function loadFMFrequency(chip:Chip, channel:number, frequency:number): void {
	writeYMch(chip, channel, YMREG.FreqMSB, frequency >> 8);
	writeYMch(chip, channel, YMREG.FreqLSB, frequency & 0xFF);
}

/**
 * Helper function to load an FM voice
 *
 * @param chip The YM2612 chip to write registers to.
 * @param channel The channel offset (0-2, 4-6) to load to
 * @param instrument The instrument number to load
 * @param volume The channel volume
 */
export function loadFMVoice(chip:Chip, channel:number, instrument:number, volume:number): void {
	let voice = voices[instrument];

	// if invalid voice, quit
	if(!voice) {
		voice = invalidVoice;
	}

	let i = 0;
	writeYMch(chip, channel, YMREG.PL, voice[i++]);
	writeYMch(chip, channel, YMREG.FA, voice[i++]);

	writeYMch(chip, channel, YMREG.DM | YMREG.op1, voice[i++]);
	writeYMch(chip, channel, YMREG.DM | YMREG.op2, voice[i++]);
	writeYMch(chip, channel, YMREG.DM | YMREG.op3, voice[i++]);
	writeYMch(chip, channel, YMREG.DM | YMREG.op4, voice[i++]);

	writeYMch(chip, channel, YMREG.RSAR | YMREG.op1, voice[i++]);
	writeYMch(chip, channel, YMREG.RSAR | YMREG.op2, voice[i++]);
	writeYMch(chip, channel, YMREG.RSAR | YMREG.op3, voice[i++]);
	writeYMch(chip, channel, YMREG.RSAR | YMREG.op4, voice[i++]);

	writeYMch(chip, channel, YMREG.D1R | YMREG.op1, voice[i++]);
	writeYMch(chip, channel, YMREG.D1R | YMREG.op2, voice[i++]);
	writeYMch(chip, channel, YMREG.D1R | YMREG.op3, voice[i++]);
	writeYMch(chip, channel, YMREG.D1R | YMREG.op4, voice[i++]);

	writeYMch(chip, channel, YMREG.D2R | YMREG.op1, voice[i++]);
	writeYMch(chip, channel, YMREG.D2R | YMREG.op2, voice[i++]);
	writeYMch(chip, channel, YMREG.D2R | YMREG.op3, voice[i++]);
	writeYMch(chip, channel, YMREG.D2R | YMREG.op4, voice[i++]);

	writeYMch(chip, channel, YMREG.DLRR | YMREG.op1, voice[i++]);
	writeYMch(chip, channel, YMREG.DLRR | YMREG.op2, voice[i++]);
	writeYMch(chip, channel, YMREG.DLRR | YMREG.op3, voice[i++]);
	writeYMch(chip, channel, YMREG.DLRR | YMREG.op4, voice[i++]);

	writeYMch(chip, channel, YMREG.SSGEG | YMREG.op1, voice[i++]);
	writeYMch(chip, channel, YMREG.SSGEG | YMREG.op2, voice[i++]);
	writeYMch(chip, channel, YMREG.SSGEG | YMREG.op3, voice[i++]);
	writeYMch(chip, channel, YMREG.SSGEG | YMREG.op4, voice[i++]);
	updateFMchVolume(chip, channel, instrument, volume);
}


/**
 * Temporary array of supported voices
 */
const voices = [
	/* eslint-disable max-len */
	/* n/o     PAN   F/A       Detune/Multiple      Rate Scale/Attack Rate        Decay 1 Rate             Decay 2 Rate       Decay Level/Release Rate          SSG-EG                Total Level       */
	/* 00 */[ 0xC0, 0x3A,  0x01, 0x31, 0x07, 0x71,  0x8E, 0x8D, 0x8E, 0x53,  0x0E, 0x0E, 0x0E, 0x03,  0x00, 0x00, 0x00, 0x07,  0x1F, 0x1F, 0x1F, 0x0F,  0x00, 0x00, 0x00, 0x00,  0x18, 0x27, 0x28, 0x00, ],
	/* 01 */[ 0xC0, 0x04,  0x71, 0x31, 0x41, 0x31,  0x12, 0x12, 0x12, 0x12,  0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00,  0x0F, 0x0F, 0x0F, 0x0F,  0x00, 0x00, 0x00, 0x00,  0x23, 0x23, 0x00, 0x00, ],
	/* 02 */[ 0xC0, 0x14,  0x75, 0x35, 0x72, 0x32,  0x9F, 0x9F, 0x9F, 0x9F,  0x05, 0x00, 0x05, 0x0A,  0x05, 0x07, 0x05, 0x05,  0x2F, 0x0F, 0xFF, 0x2F,  0x00, 0x00, 0x00, 0x00,  0x1E, 0x14, 0x00, 0x00, ],
	/* 03 */[ 0xC0, 0x3D,  0x01, 0x01, 0x01, 0x02,  0x12, 0x1F, 0x1F, 0x14,  0x07, 0x02, 0x02, 0x0A,  0x05, 0x05, 0x05, 0x05,  0x2F, 0x2F, 0x2F, 0xAF,  0x00, 0x00, 0x00, 0x00,  0x1C, 0x02, 0x00, 0x00, ],
	/* 04 */[ 0xC0, 0x3A,  0x70, 0x30, 0x76, 0x71,  0x1F, 0x1F, 0x95, 0x1F,  0x0E, 0x05, 0x0F, 0x0C,  0x07, 0x06, 0x06, 0x07,  0x2F, 0x1F, 0x4F, 0x5F,  0x00, 0x00, 0x00, 0x00,  0x21, 0x28, 0x12, 0x00, ],
	/* 05 */[ 0xC0, 0x28,  0x71, 0x30, 0x00, 0x01,  0x1F, 0x1D, 0x1F, 0x1F,  0x13, 0x06, 0x13, 0x05,  0x03, 0x02, 0x03, 0x05,  0x4F, 0x2F, 0x4F, 0x3F,  0x00, 0x00, 0x00, 0x00,  0x0E, 0x1E, 0x14, 0x00, ],
	/* 06 */[ 0xC0, 0x3E,  0x38, 0x7A, 0x01, 0x34,  0x59, 0x5F, 0xD9, 0x9C,  0x0F, 0x0F, 0x04, 0x0A,  0x02, 0x05, 0x02, 0x05,  0xAF, 0x66, 0xAF, 0x66,  0x00, 0x00, 0x00, 0x00,  0x28, 0x23, 0x00, 0x00, ],
	/* 07 */[ 0xC0, 0x39,  0x32, 0x72, 0x31, 0x71,  0x1F, 0x1F, 0x1F, 0x1F,  0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00,  0x0F, 0x0F, 0x0F, 0x0F,  0x00, 0x00, 0x00, 0x00,  0x1B, 0x28, 0x32, 0x00, ],
	/* 08 */[ 0xC0, 0x07,  0x34, 0x32, 0x74, 0x71,  0x1F, 0x1F, 0x1F, 0x1F,  0x0A, 0x05, 0x0A, 0x03,  0x00, 0x00, 0x00, 0x00,  0x3F, 0x2F, 0x3F, 0x2F,  0x00, 0x00, 0x00, 0x00,  0x0A, 0x00, 0x0A, 0x00, ],
	/* eslint-enable max-len */
];

// eslint-disable-next-line max-len
const invalidVoice = [ 0x00, 0x00,  0x00, 0x00, 0x00, 0x00,  0xFF, 0xFF, 0xFF, 0xFF,  0xFF, 0xFF, 0xFF, 0xFF,  0xFF, 0xFF, 0xFF, 0xFF,  0xFF, 0xFF, 0xFF, 0xFF,  0x00, 0x00, 0x00, 0x00,  0x7F, 0x7F, 0x7F, 0x7F, ];
