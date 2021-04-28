import { ConfigVersion, EmulatorConfig, Emulator, YMREG, PSGCMD, YMKey, YMHelp } from "../api/scripts/emulator";
import { RtAudio, RtAudioApi, RtAudioFormat } from "audify";
import fs from "fs";
import path from "path";
import json5 from "json5";

const RATE = 53267, SAMPLES = (RATE * 0.025) | 0;
const emus = path.join(__dirname, "..", "scripts", "chips");
let volume = 1;

// function to control volume
export const setVolume = (vol:number):void => {
	volume = vol;
}

// function to find all emulators
export const findAll = async():Promise<{ [key:string]: EmulatorConfig }> => {
	const ret:{ [key:string]: EmulatorConfig } = {};

	for(const dir of await fs.promises.readdir(path.join(__dirname, "..", "scripts", "chips"))) {
		// check if this is a valid chip
		try {
			const obj = json5.parse(await fs.promises.readFile(
				path.join(emus, dir, "config.json5"), "utf8")) as EmulatorConfig;

			// this is the only valid version
			if(obj.version !== ConfigVersion.b0){
				continue;
			}

			// check all fields are valid
			if(!obj.name || !obj.entry || !obj.uuid) {
				continue;
			}

			// check file exists and update entry to absolute file
			await fs.promises.access(obj.entry = path.join(emus, dir, obj.entry));

			// append it to results
			ret[obj.uuid] = obj;

		} catch (ex) {console.log(ex)}
	}

	return ret;
}

// load the emulator into memory
export const load = (config:EmulatorConfig):void => {
	/* eslint-disable @typescript-eslint/no-var-requires */
	const emulator:Emulator = new (require(config.entry).default)();
	emulator.init(RATE, config);

	emulator.writePSG(PSGCMD.PSG4 | PSGCMD.WHITE | PSGCMD.N40);
	emulator.writePSG(PSGCMD.PSG4 | PSGCMD.VOLUME | 0);

	emulator.writePSG(PSGCMD.PSG1 | PSGCMD.VOLUME | 5);
	emulator.writePSG(PSGCMD.PSG1 | PSGCMD.FREQ | 2);
	emulator.writePSG(0x20);

	emulator.writeYM1(YMREG.LFO, 0);
	emulator.writeYM1(YMREG.TimersCh3, 0);
	emulator.writeYM1(YMREG.Key, YMKey.FM1);
	emulator.writeYM1(YMREG.Key, YMKey.FM2);
	emulator.writeYM1(YMREG.Key, YMKey.FM3);
	emulator.writeYM1(YMREG.Key, YMKey.FM4);
	emulator.writeYM1(YMREG.Key, YMKey.FM5);
	emulator.writeYM1(YMREG.Key, YMKey.FM6);
	emulator.writeYM1(YMREG.DAC, YMHelp.DACDisable);

	emulator.writeYM1(YMREG.ch1 | YMREG.DM | YMREG.op1, 0x62);
	emulator.writeYM1(YMREG.ch1 | YMREG.DM | YMREG.op2, 0x44);
	emulator.writeYM1(YMREG.ch1 | YMREG.DM | YMREG.op3, 0x40);
	emulator.writeYM1(YMREG.ch1 | YMREG.DM | YMREG.op4, 0x32);

	emulator.writeYM1(YMREG.ch1 | YMREG.RSAR | YMREG.op1, 0x12);
	emulator.writeYM1(YMREG.ch1 | YMREG.RSAR | YMREG.op2, 0x12);
	emulator.writeYM1(YMREG.ch1 | YMREG.RSAR | YMREG.op3, 0x12);
	emulator.writeYM1(YMREG.ch1 | YMREG.RSAR | YMREG.op4, 0x1C);

	emulator.writeYM1(YMREG.ch1 | YMREG.D1R | YMREG.op1, 0x0B);
	emulator.writeYM1(YMREG.ch1 | YMREG.D1R | YMREG.op2, 0x02);
	emulator.writeYM1(YMREG.ch1 | YMREG.D1R | YMREG.op3, 0x0A);
	emulator.writeYM1(YMREG.ch1 | YMREG.D1R | YMREG.op4, 0x01);

	emulator.writeYM1(YMREG.ch1 | YMREG.D2R | YMREG.op1, 0x08);
	emulator.writeYM1(YMREG.ch1 | YMREG.D2R | YMREG.op2, 0x04);
	emulator.writeYM1(YMREG.ch1 | YMREG.D2R | YMREG.op3, 0x0B);
	emulator.writeYM1(YMREG.ch1 | YMREG.D2R | YMREG.op4, 0x06);

	emulator.writeYM1(YMREG.ch1 | YMREG.DLRR | YMREG.op1, 0x08);
	emulator.writeYM1(YMREG.ch1 | YMREG.DLRR | YMREG.op2, 0x08);
	emulator.writeYM1(YMREG.ch1 | YMREG.DLRR | YMREG.op3, 0x08);
	emulator.writeYM1(YMREG.ch1 | YMREG.DLRR | YMREG.op4, 0x08);

	emulator.writeYM1(YMREG.ch1 | YMREG.SSGEG | YMREG.op1, 0);
	emulator.writeYM1(YMREG.ch1 | YMREG.SSGEG | YMREG.op2, 0);
	emulator.writeYM1(YMREG.ch1 | YMREG.SSGEG | YMREG.op3, 0);
	emulator.writeYM1(YMREG.ch1 | YMREG.SSGEG | YMREG.op4, 0);

	emulator.writeYM1(YMREG.ch1 | YMREG.TL | YMREG.op1, 0x2A);
	emulator.writeYM1(YMREG.ch1 | YMREG.TL | YMREG.op2, 0x2B);
	emulator.writeYM1(YMREG.ch1 | YMREG.TL | YMREG.op3, 0x1A);
	emulator.writeYM1(YMREG.ch1 | YMREG.TL | YMREG.op4, 0x00);

	const f = 0x12D3;
	emulator.writeYM1(YMREG.ch1 | YMREG.FreqMSB, f & 0xFF);
	emulator.writeYM1(YMREG.ch1 | YMREG.FreqLSB, f >> 8);
	emulator.writeYM1(YMREG.ch1 | YMREG.FA, 0x3);
	emulator.writeYM1(YMREG.ch1 | YMREG.PL, YMHelp.PanCenter);

	setInterval(() => {
		emulator.writeYM1(YMREG.Key, YMKey.FM1);
		setTimeout(() => emulator.writeYM1(YMREG.Key, YMKey.FM1 | YMKey.OpAll), 60);
	}, 1000);

	// AUDIO HANDLER
	const rtAudio = new RtAudio(process.platform === "win32" ? RtAudioApi.WINDOWS_WASAPI : undefined);
	rtAudio.openStream({
		deviceId: rtAudio.getDefaultOutputDevice(),
		nChannels: 2,

	}, null, RtAudioFormat.RTAUDIO_SINT16, RATE, SAMPLES /* ~25ms */, "ZorroTracker emulation", null, () => {
		// poll YM and SN here
		rtAudio.write(emulator.buffer(SAMPLES, volume));
	});

	rtAudio.start();
	rtAudio.write(emulator.buffer(SAMPLES, volume));
	rtAudio.write(emulator.buffer(SAMPLES, volume));
}
