// eslint-disable-next-line max-len
import { ChannelType, Driver, DriverChannel, DriverConfig, FeatureFlag, NoteData, NoteReturnType, OctaveInfo, DefChanIds } from "../../../../api/driver";
import { Chip, PSGCMD, YMKey, YMREG } from "../../../../api/chip";
import { DefaultOctave, DefaultOctaveSharp, Note, OctaveSize } from "../../../../api/notes";

export default class implements Driver {
	private chip: Chip|undefined;
	private NoteFM: NoteReturnType;
	private NotePSG: NoteReturnType;
	private NoteDAC: NoteReturnType;

	constructor() {
		// process PSG notes
		this.NotePSG = this.noteGen({ min: -4, max: 8, C0: Note.C0, size: 12, }, 0xF, (note: number) => {
			const xo = (OctaveSize * 7) + Note.C0 + 12;

			if(note < Note.C0 + 9 + 12) {
				// negative octaves and C0-A1
				return undefined;

			} else if(note >= xo) {
				// nB-1
				return [ 0xB, 0xA, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, ][note - xo];
			}

			// positive octaves
			const ftable = this.frequencies[note - Note.C0 + (OctaveSize * 1)];
			return !ftable ? undefined : Math.min(0x3FF, Math.round(3579545 / (32 * ftable)) - 1);
		});

		// process FM notes
		this.NoteFM = this.noteGen({ min: -4, max: 8, C0: Note.C0, size: 12, }, 0x7F, (note: number) => {
			if(note < Note.C0) {
				// negative octaves
				const ftable = this.frequencies[note - Note.C0 + (OctaveSize * 4)];
				return Math.round((144 * ftable * 2**20 / 7670454) / 2 ** (4 - 1));

			} else if(note >= Note.C0 + (OctaveSize * 8)) {
				// invalid octaves
				return undefined;
			}

			// positive octaves
			const ftable = this.frequencies[(OctaveSize * 4) + ((note - Note.First) % OctaveSize)];
			return ((((note - Note.C0) / OctaveSize) | 0) * 0x800) | Math.round((144 * ftable * 2**20 / 7670454) / 2 ** (4 - 1));
		});

		// process DAC notes
		this.NoteDAC = this.noteGen({ min: -4, max: 8, C0: Note.C0, size: 12, }, 0, () => {
			return undefined;
		});
	}

	/**
	 * The list of frequencies to recreate
	 */
	private frequencies = [
		16.35, 17.32, 18.35, 19.45, 20.60, 21.83, 23.12, 24.50, 25.96, 27.50, 29.14, 30.87,
		32.70, 34.65, 36.71, 38.89, 41.20, 43.65, 46.25, 49.00, 51.91, 55.00, 58.27, 61.74,
		65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00, 103.83, 110.00, 116.54, 123.47,
		130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185.00, 196.00, 207.65, 220.00, 233.08, 246.94,

		261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88,

		523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99, 830.61, 880.00, 932.33, 987.77,
		1046.50, 1108.73, 1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98, 1661.22, 1760.00, 1864.66, 1975.53,
		2093.00, 2217.46, 2349.32, 2489.02, 2637.02, 2793.83, 2959.96, 3135.96, 3322.44, 3520.00, 3729.31, 3951.07,
		4186.01, 4434.92, 4698.63, 4978.03, 5274.04, 5587.65, 5919.91, 6271.93, 6644.88, 7040.00, 7458.62, 7902.13,
	];

	/**
	 * Function to get the frequency table based on channel type
	 *
	 * @param octave The discrete data for octaves
	 * @param maxvolume MAximum volume level
	 * @param type The channel type to inspect
	 * @returns The table containing note info
	 */
	private noteGen(octave:OctaveInfo, maxvolume:number, func:(note: number) => number|undefined): NoteReturnType {
		// prepare some variables
		const ret = Array<NoteData>(256);

		// prepare some values
		ret[0] = { frequency: NaN, name: "", octave: null, sharp: "", };
		ret[1] = { frequency: NaN, name: "===", octave: null, sharp: "", };
		ret[2] = { frequency: NaN, name: "———", octave: null, sharp: "", };

		// filler
		ret[3] = { frequency: undefined, name: "NUL", octave: null, sharp: "", };

		// function defined, start filling the table
		for(let n = Note.First;n < Note.Last; n++) {
			// load frequency
			const freq = func(n);

			// calculate the offset inside of an octave
			const op = (n - Note.First) % OctaveSize;

			// replace the note data with this
			ret[n] = {
				name: DefaultOctave[op],
				octave: (Math.floor((n - Note.C0) / OctaveSize)),
				sharp: DefaultOctaveSharp[op],
				frequency: isNaN(freq) ? undefined : freq,
			};
		}

		return {
			octave: octave,
			maxvolume,
			notes: ret,
		};
	}


	public init(samplerate:number, config:DriverConfig|null, chip:Chip):void {
		this.chip = chip;
	}

	public reset():void {

	}

	public play():void {

	}

	public stop():void {

	}

	public buffer(initSamples: number, advance:(samples:number) => number):void {
		if(!this.chip) {
			throw new Error("chip is null");
		}
	}

	public getChannels(): DriverChannel[] {
		/* eslint-disable max-len */
		return [
			{ name: "FM1",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM1,		features: FeatureFlag.ALL, },
			{ name: "FM2",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM2,		features: FeatureFlag.ALL, },
			{ name: "TMRA", type: ChannelType.TimerA,    id: DefChanIds.YM2612TIMERA,	features: FeatureFlag.FREQ | FeatureFlag.EFFECTS | FeatureFlag.NOVU, },
			{ name: "OP1",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM3OP1,	features: FeatureFlag.ALL, },
			{ name: "OP2",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM3OP2,	features: FeatureFlag.ALL, },
			{ name: "OP3",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM3OP3,	features: FeatureFlag.ALL, },
			{ name: "OP4",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM3OP4,	features: FeatureFlag.ALL, },
			{ name: "FM4",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM4,		features: FeatureFlag.ALL, },
			{ name: "FM5",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM5,		features: FeatureFlag.ALL, },
		//	{ name: "FM6",  type: ChannelType.YM2612FM,  id: DefChanIds.YM2612FM6,		features: FeatureFlag.ALL, },
			{ name: "PCM1", type: ChannelType.YM2612DAC, id: DefChanIds.YM2612PCM1,		features: FeatureFlag.ALL, },
			{ name: "PCM2", type: ChannelType.YM2612DAC, id: DefChanIds.YM2612PCM2,		features: FeatureFlag.ALL, },
			{ name: "PCM3", type: ChannelType.YM2612DAC, id: DefChanIds.YM2612PCM3,		features: FeatureFlag.ALL, },
			{ name: "PCM4", type: ChannelType.YM2612DAC, id: DefChanIds.YM2612PCM4,		features: FeatureFlag.ALL, },
			{ name: "PSG1", type: ChannelType.YM7101PSG, id: DefChanIds.YM7101PSG1,		features: FeatureFlag.ALL, },
			{ name: "PSG2", type: ChannelType.YM7101PSG, id: DefChanIds.YM7101PSG2,		features: FeatureFlag.ALL, },
			{ name: "PSG3", type: ChannelType.YM7101PSG, id: DefChanIds.YM7101PSG3,		features: FeatureFlag.ALL, },
			{ name: "PSG4", type: ChannelType.YM7101PSG, id: DefChanIds.YM7101PSG4,		features: FeatureFlag.ALL, },
		];
		/* eslint-enable max-len */
	}

	/**
	 * Function to fetch target channel by its ID.
	 *
	 * @param id The channel ID to fetch
	 */
	private fetchChannel(id:number): DriverChannel {
		return this.getChannels().find((c) => c.id === id);
	}

	/**
	 * The mute states of all channels
	 */
	private muted = 0;

	/**
	 * Function to mute or unmute a channel based on its ID
	 *
	 * @param id The ID of the channel to affect
	 * @param state Boolean indicating whether to mute or unmute
	 * @returns whether the action was executed
	 */
	public muteChannel(id:number, state:boolean): boolean {
		// handle the internal mute state
		if(state) {
			this.muted |= 1 << id;

		} else {
			this.muted &= 0xFFFF - (1 << id);
		}

		if(id <= DefChanIds.YM2612FM6) {
			// FM
			this.chip.muteYM(id, state);
			return true;

		} else if(id <= DefChanIds.YM7101PSG4) {
			// PSG
			this.chip.mutePSG(id - DefChanIds.YM7101PSG1, state);
			return true;

		} else if(id <= DefChanIds.YM2612PCM2) {
			// DAC
			return false;
		}

		return false;
	}

	public enableChannel():boolean {
		return true;
	}

	public disableChannel():boolean {
		return true;
	}

	/**
	 * Function to get the frequency table based on channel type
	 *
	 * @param type The channel type to inspect
	 * @returns The table containing note info
	 */
	public notes(type:ChannelType): NoteReturnType {
		switch(type) {
			case ChannelType.YM2612FM:	return this.NoteFM;
			case ChannelType.YM7101PSG:	return this.NotePSG;
			case ChannelType.YM2612DAC:	return this.NoteDAC;
			case ChannelType.TimerA:	return this.NoteDAC;
		}

		return undefined;
	}
	/**
	 * Helper function to write a YM register to port 0.
	 *
	 * @param register The register base to write to.
	 * @param value The value to write to the register.
	 */
	private writeYM1(register:YMREG, value:number) {
		this.chip.writeYM(0, register);
		this.chip.writeYM(1, value);
	}

	/**
	 * Helper function to write a YM register to port 2.
	 *
	 * @param register The register base to write to.
	 * @param value The value to write to the register.
	 */
	private writeYM2(register:YMREG, value:number) {
		this.chip.writeYM(2, register);
		this.chip.writeYM(3, value);
	}

	/**
	 * Helper function to write a YM register based on the channel.
	 *
	 * @param channel The channel offset (0-2, 4-6) to write to
	 * @param register The register base to write to.
	 * @param value The value to write to the register.
	 */
	private writeYMch(channel:number, register:YMREG, value:number) {
		this.chip.writeYM(channel & 4 ? 2 : 0, register + (channel & 3));
		this.chip.writeYM(channel & 4 ? 3 : 1, value);
	}

	/**
	 * Helper function to load an FM voice
	 *
	 * @param channel The channel offset (0-2, 4-6) to load to
	 * @param frequency The frequency to load
	 */
	private loadFMFrequency(channel:number, frequency:number) {
		this.writeYMch(channel, YMREG.FreqMSB, frequency >> 8);
		this.writeYMch(channel, YMREG.FreqLSB, frequency & 0xFF);
	}

	/**
	 * Helper function to load an FM voice
	 *
	 * @param channel The channel offset (0-2, 4-6) to load to
	 */
	private loadFMVoice(channel:number) {
		this.writeYMch(channel, YMREG.DM | YMREG.op1, 0x62);
		this.writeYMch(channel, YMREG.DM | YMREG.op2, 0x44);
		this.writeYMch(channel, YMREG.DM | YMREG.op3, 0x40);
		this.writeYMch(channel, YMREG.DM | YMREG.op4, 0x31);

		this.writeYMch(channel, YMREG.RSAR | YMREG.op1, 0x1F);
		this.writeYMch(channel, YMREG.RSAR | YMREG.op2, 0x1F);
		this.writeYMch(channel, YMREG.RSAR | YMREG.op3, 0x1F);
		this.writeYMch(channel, YMREG.RSAR | YMREG.op4, 0x1C);

		this.writeYMch(channel, YMREG.D1R | YMREG.op1, 0x08);
		this.writeYMch(channel, YMREG.D1R | YMREG.op2, 0x04);
		this.writeYMch(channel, YMREG.D1R | YMREG.op3, 0x0B);
		this.writeYMch(channel, YMREG.D1R | YMREG.op4, 0x06);

		this.writeYMch(channel, YMREG.D2R | YMREG.op1, 0x0B);
		this.writeYMch(channel, YMREG.D2R | YMREG.op2, 0x02);
		this.writeYMch(channel, YMREG.D2R | YMREG.op3, 0x0A);
		this.writeYMch(channel, YMREG.D2R | YMREG.op4, 0x01);

		this.writeYMch(channel, YMREG.DLRR | YMREG.op1, 0x1F);
		this.writeYMch(channel, YMREG.DLRR | YMREG.op2, 0x1F);
		this.writeYMch(channel, YMREG.DLRR | YMREG.op3, 0x1F);
		this.writeYMch(channel, YMREG.DLRR | YMREG.op4, 0x1F);

		this.writeYMch(channel, YMREG.SSGEG | YMREG.op1, 0x00);
		this.writeYMch(channel, YMREG.SSGEG | YMREG.op2, 0x00);
		this.writeYMch(channel, YMREG.SSGEG | YMREG.op3, 0x00);
		this.writeYMch(channel, YMREG.SSGEG | YMREG.op4, 0x00);

		this.writeYMch(channel, YMREG.TL | YMREG.op1, 0x2A);
		this.writeYMch(channel, YMREG.TL | YMREG.op2, 0x2B);
		this.writeYMch(channel, YMREG.TL | YMREG.op3, 0x1A);
		this.writeYMch(channel, YMREG.TL | YMREG.op4, 0x00);

		this.writeYMch(channel, YMREG.FA, 0x03);
		this.writeYMch(channel, YMREG.PL, 0xC0);
	}

	/**
	 * Trigger a note via the piano. The channel is a mere suggestion for the driver to know how to handle this.
	 *
	 * @param note The ID of the note to trigger
	 * @param velocity A value between 0 and 1, representing the velocity of the note. 0 = mute
	 * @param channel The ID of the channel to trigger the note on
	 * @returns Whether the note was triggered
	 */
	public pianoTrigger(note:number, velocity:number, channel:number): boolean {
		// check if note is already playing
		if(typeof this.getPianoCh(note) === "number") {
			return true;
		}

		// fetch the channel object
		const ch = this.fetchChannel(channel);

		switch(ch.type) {
			case ChannelType.YM2612FM: {
				// check if trying to play on op1-op3
				if(channel > DefChanIds.YM2612FM6) {
					return false;
				}

				// pretend this is PSG
				const data = this.NoteFM.notes[note];

				// check for invalid notes
				if(typeof data?.frequency !== "number") {
					return false;
				}

				// find new channel for polyphony, ignoring certain channels
				const cc = this.findFreeChannel(channel, [], [
					DefChanIds.YM2612FM1, DefChanIds.YM2612FM2, DefChanIds.YM2612FM3,
					DefChanIds.YM2612FM4, DefChanIds.YM2612FM5, DefChanIds.YM2612FM6,
				]);

				// find new channel for polyphony. If failed, jump out
				if(typeof cc !== "number") {
					return false;
				}

				// enable note
				this.pianoNotes[cc] = note;

				// load voice
				const cx = this.hwid[cc];
				this.loadFMVoice(cx);

				// disable key
				this.writeYM1(YMREG.Key, cx);

				// enable FM frequency
				this.loadFMFrequency(cx, data.frequency);

				// enable FM volume
				this.writeYMch(cx, YMREG.TL | YMREG.op4, 0x3F - Math.floor(velocity * 0x3F));

				// enable key
				this.writeYM1(YMREG.Key, cx | YMKey.OpAll);
				break;
			}

			case ChannelType.YM7101PSG: {
				// pretend this is PSG
				const data = this.NotePSG.notes[note];

				// check for invalid notes
				if(typeof data?.frequency !== "number") {
					return false;
				}

				// find new channel for polyphony, ignoring certain channels
				const cc = this.findFreeChannel(channel, [ DefChanIds.YM7101PSG4, ],
					[ DefChanIds.YM7101PSG1, DefChanIds.YM7101PSG2, DefChanIds.YM7101PSG3, ]);

				// find new channel for polyphony. If failed, jump out
				if(typeof cc !== "number") {
					return false;
				}

				// enable note
				this.pianoNotes[cc] = note;

				// enable PSG frequency (special PSG4: set frequency to PSG3)
				if(cc === 9) {
					this.chip.writePSG(PSGCMD.FREQ | PSGCMD.PSG4 | PSGCMD.WHITE | PSGCMD.TONE3);
					this.chip.writePSG(PSGCMD.FREQ | this.hwid[DefChanIds.YM7101PSG3] | (data.frequency & 0xF));

				} else {
					this.chip.writePSG(PSGCMD.FREQ | this.hwid[cc] | (data.frequency & 0xF));
				}

				this.chip.writePSG((data.frequency & 0x3F0) >> 4);

				// enable PSG volume
				this.chip.writePSG(PSGCMD.VOLUME | this.hwid[cc] | this.PSGVol[Math.floor(velocity * (this.PSGVol.length - 1))]);
				break;
			}
		}

		return true;
	}

	/**
	 * Mapping table between channel ID and hardware-based ID
	 */
	private hwid = [
		YMREG.ch1, YMREG.ch2, YMREG.ch3,
		YMREG.ch1 | 4, YMREG.ch2 | 4, YMREG.ch3 | 4,
		PSGCMD.PSG1, PSGCMD.PSG2, PSGCMD.PSG3, PSGCMD.PSG4,
		0, 0,
	];

	/**
	 * PSG volume LUT
	 */
	private PSGVol = [ 0xE, 0xD, 0xC, 0xB, 0xA, 9, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0, ];

	/**
	 * Release a note via the piano.
	 *
	 * @param note The ID of the note to release
	 * @returns Whether the note was release
	 */
	public pianoRelease(note:number): boolean {
		// find a channel that is playing this note
		let channel = this.getPianoCh(note);

		while(channel !== undefined) {
			// remove channel note
			delete this.pianoNotes[channel];

			// fetch the channel object
			const ch = this.fetchChannel(channel);

			// release note on channel
			switch(ch.type) {
				case ChannelType.YM2612FM:
					// release note
					this.writeYM1(YMREG.Key, this.hwid[channel]);
					break;

				case ChannelType.YM7101PSG:
					// release note
					this.chip.writePSG(PSGCMD.VOLUME | this.hwid[channel] | 0xF);
					break;
			}

			// fetch next channel
			channel = this.getPianoCh(note);
		}

		// found nothing
		return true;
	}

	/**
	 * Mapping piano notes to active channel. This helps easily release notes
	 */
	private pianoNotes:{ [key:number]: number } = {};

	/**
	 * Find the channel that is playing a note
	 *
	 * @param note The note to check
	 */
	private getPianoCh(note:number) {
		// scan for this note
		for(const channel of Object.keys(this.pianoNotes)) {
			if(this.pianoNotes[channel] === note) {
				// found the note
				return parseInt(channel, 10);
			}
		}

		return undefined;
	}

	/**
	 * Function to enable polyphony for channels.
	 *
	 * @param chan The current channel
	 * @param ignore Channels that will not try to enable polyphony
	 * @param channels Channels to check for polyphony
	 * @returns Either `undefined` if failed, or channel number if success
	 */
	private findFreeChannel(chan:number, ignore:number[], channels:number[]) {
		// check if channel is busy
		if(!this.pianoNotes[chan] && (this.muted & (1 << chan)) === 0) {
			return chan;
		}

		// check if channel has no polyphony
		if(ignore.includes(chan)) {
			return undefined;
		}

		// find new channel for polyphony
		for(const c of channels) {
			if(!this.pianoNotes[c] && (this.muted & (1 << c)) === 0) {
				// this channel is free
				return c;
			}
		}

		return undefined;
	}
}
