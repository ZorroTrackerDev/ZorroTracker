import { ConfigVersion } from "../api/scripts/config";
import { EmulatorConfig, Emulator } from "../api/scripts/emulator";
import { Driver } from "../api/scripts/driver";
import { RtAudio, RtAudioApi, RtAudioFormat } from "audify";
import { parentPort } from "worker_threads";

const RATE = 53267, SAMPLES = (RATE * 0.025) | 0, GAP = 5;
let volume = 1;
const rtAudio = new RtAudio(process.platform === "win32" ? RtAudioApi.WINDOWS_WASAPI : undefined);

let emulator:Emulator|undefined;
let driver:Driver|undefined;

parentPort?.on("message", (data:{ code:string, data:unknown }) => {
	try {
		switch(data.code) {
			case "volume":
				// function to control volume
				volume = data.data as number;
				break;

			case "emulator":
				/* eslint-disable @typescript-eslint/no-var-requires */
				emulator = new (require((data.data as EmulatorConfig).entry).default)();
				emulator?.init(RATE, data.data as EmulatorConfig);
				break;

			case "driver":
				if(!emulator) {
					throw new Error("Emulator was not specified before calling this function");
				}

				/* eslint-disable @typescript-eslint/no-var-requires */
				driver = new (require("./vgm").default)();
				driver?.init(RATE, {
					version: ConfigVersion.b0, entry: "null", name: "null", uuid: "null",
				}, emulator);
				break;

			case "load":
				if(!driver) {
					throw new Error("Driver was not specified before calling this function");
				}

				openStream();
				break;

			case "close":
				rtAudio.closeStream();
				break;

			case "play":
				driver?.play(data.data as string);

				if(!rtAudio.isStreamOpen()){
					openStream();
				}
				break;

			case "stop":
				driver?.stop();
				break;
		}
	} catch(ex) {
		console.log(ex);
	}
});

function openStream() {
	// AUDIO HANDLER
	rtAudio.openStream({
		deviceId: rtAudio.getDefaultOutputDevice(),
		nChannels: 2,

	}, null, RtAudioFormat.RTAUDIO_SINT16, RATE, SAMPLES /* SAMPLES * GAP of delay */, "ZorroTracker", null, () => {
		// poll YM and SN here
		try {
			rtAudio.write((driver as Driver).buffer(SAMPLES, volume));

		} catch(ex) {
			// panic
			console.log(ex);
			rtAudio.closeStream();
		}
	});

	rtAudio.start();

	// need to buffer ahead of time a little
	for(let i = 0;i < GAP;i ++) {
		try {
			rtAudio.write((driver as Driver).buffer(SAMPLES, volume));

		} catch(ex) {
			// panic
			console.log(ex);
			rtAudio.closeStream();
		}
	}
}