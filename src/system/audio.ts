import { ConfigVersion } from "../api/scripts/config";
import { ChipConfig, Chip } from "../api/scripts/chip";
import { Driver } from "../api/scripts/driver";
import { RtAudio, RtAudioApi, RtAudioFormat } from "audify";
import { parentPort } from "worker_threads";
import path from "path";

// the output sample rate of the program. TODO: Not hardcode.
const RATE = 53267;

// the output sample duration in milliseconds (eg how long to emulate chips before pushing the audio buffer). TODO: Not hardcode.
const SAMPLEDURATION = 0.025;

// how many samples to emulate before pushing to audio buffer. TODO: Not hardcode.
const SAMPLES = (RATE * SAMPLEDURATION) | 0;

// how big of a gap to leave between audio buffering and playing. This is multiplied by SAMPLEDURATION. TODO: Not hardcode.
const GAP = 5;

// initialize rtAudio backend. Note that on Windows, we force WASAPI because the default option sucks.
const rtAudio = new RtAudio(process.platform === "win32" ? RtAudioApi.WINDOWS_WASAPI : undefined);

// holds the chip we are using for audio emulation
let chip:Chip|undefined;

// holds the driver we are using for audio emulation
let driver:Driver|undefined;

// handle messages from the parent thread
parentPort?.on("message", (data:{ code:string, data:unknown }) => {
	try {
		switch(data.code) {

			/**
			 * Set the current volume.
			 *
			 * data: Volume as percentage from 0% to 100% (0.0 to 1.0)
			 */
			case "volume":
				chip?.setVolume(data.data as number);
				break;

			/**
			 * Set the chip to use.
			 *
			 * data: ChipConfig to use for loading and initializing the chip.
			 */
			case "chip":
				/* eslint-disable @typescript-eslint/no-var-requires */
				chip = new (require(path.join((data.data as ChipConfig).entry)).default)();
				chip?.init(RATE, data.data as ChipConfig);
				break;

			/**
			 * Set the driver to use.
			 *
			 * data: DriverConfig to use for loading and initializing the driver.
			 */
			case "driver":
				if(!chip) {
					throw new Error("Chip is invalid");
				}

				/* eslint-disable @typescript-eslint/no-var-requires */
				driver = new (require("./vgm").default)();
				driver?.init(RATE, {
					version: ConfigVersion.b0, entry: "null", name: "null", uuid: "null", date: "null", credits: [],
				}, chip);
				break;

			/**
			 * Initialize the audio driver and start streaming.
			 *
			 * data: Irrelevant
			 */
			case "load":
				openStream();
				break;

			/**
			 * Close the audio stream and stop buffering.
			 *
			 * data: Irrelevant
			 */
			case "close":
				rtAudio.closeStream();
				break;

			/**
			 * Start playing some audio and initialize stream if stopped.
			 *
			 * data: Irrelevant
			 */
			case "play":
				driver?.play(data.data as string);

				if(!rtAudio.isStreamOpen()){
					openStream();
				}
				break;

			/**
			 * Stop playing any audio.
			 *
			 * data: Irrelevant
			 */
			case "stop":
				driver?.stop();
				break;
		}
	} catch(ex) {
		console.log(ex);
	}
});

/**
 * Function to handle opening a new output stream and buffering audio.
 */
function openStream() {
	if(!chip) {
		throw new Error("Chip is invalid!");
	}

	if(!driver) {
		throw new Error("Driver is invalid!");
	}

	// open 2-channel audio stream, 16-bit little endian, named ZorroTracker.
	rtAudio.openStream({
		deviceId: rtAudio.getDefaultOutputDevice(),
		nChannels: 2,

	}, null, RtAudioFormat.RTAUDIO_SINT16, RATE, SAMPLES /* SAMPLES * GAP of delay */, "ZorroTracker", null, () => {
		try {
			// automagically buffer audio when the previous audio is finished playing.
			rtAudio.write(stream(SAMPLES));

		} catch(ex) {
			// panic on error and close the stream.
			console.log(ex);
			rtAudio.closeStream();
		}
	});

	// start streaming the audio
	rtAudio.start();

	// buffer ahead a little bit of audio so that we can avoid any sudden lagspikes affecting quality.
	for(let i = 0;i < GAP;i ++) {
		try {
			rtAudio.write(stream(SAMPLES));

		} catch(ex) {
			// panic on error and close the stream.
			console.log(ex);
			rtAudio.closeStream();
		}
	}
}

/**
 * Helper function to create a stream of samples and handle chip <-> driver interaction.
 *
 * @param samples The number of samples to stream the audio for
 * @returns The audio stream as a Buffer
 */
function stream(samples:number) {
	// initialize the buffer to use
	(chip as Chip).initBuffer(samples);

	let left = samples;

	// helper function to advance the chip emulation
	const advance = (numSamples:number) => {
		left = samples - (chip as Chip).runBuffer(numSamples);
		return left;
	};

	// buffer the audio with the driver
	(driver as Driver).buffer(samples, advance);

	if(left > 0){
		// if the driver did not buffer everything, silently do it for the driver
		advance(left);
	}

	// finally return the new buffer
	return (chip as Chip).getBuffer();
}