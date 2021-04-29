import { ConfigVersion } from "../api/scripts/config";
import { EmulatorConfig, Emulator } from "../api/scripts/emulator";
import { Driver } from "../api/scripts/driver";
import { RtAudio, RtAudioApi, RtAudioFormat } from "audify";
import fs from "fs";
import path from "path";
import json5 from "json5";

const RATE = 53267, SAMPLES = (RATE * 0.025) | 0, GAP = 5;
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

	const driver:Driver = new (require("./vgm").default)();
	driver.init(RATE, {
		version: ConfigVersion.b0, entry: "null", name: "null", uuid: "null",
	}, emulator);

	// AUDIO HANDLER
	const rtAudio = new RtAudio(process.platform === "win32" ? RtAudioApi.WINDOWS_WASAPI : undefined);
	rtAudio.openStream({
		deviceId: rtAudio.getDefaultOutputDevice(),
		nChannels: 2,

	}, null, RtAudioFormat.RTAUDIO_SINT16, RATE, SAMPLES /* SAMPLES * GAP of delay */, "ZorroTracker", null, () => {
		// poll YM and SN here
		rtAudio.write(driver.buffer(SAMPLES, volume));
	});

	rtAudio.start();

	for(let i = 0;i < GAP;i ++) {
		rtAudio.write(driver.buffer(SAMPLES, volume));
	}
}

(async() => {
	setVolume(0.75);
	load((await findAll())["jsmd"]);
})().catch(console.log);