import { RtAudio, RtAudioApi, RtAudioFormat } from "audify";
import { parentPort } from "worker_threads";
import path from "path";
import { Chip, ChipConfig } from "../../../../api/chip";
import { Driver, DriverConfig } from "../../../../api/driver";
import { PlaybackManager } from "./playback manager";
import { ipcEnum } from "../../../../system/ipc/ipc enum";

// eslint-disable-next-line camelcase
declare const __non_webpack_require__: NodeRequire;

// the output sample rate of the program. TODO: Not hardcode.
let outputRate = 44100;

// the output sample duration in milliseconds (eg how long to emulate chips before pushing the audio buffer). TODO: Not hardcode.
let bufferLen = 0.015;

// how big of a gap to leave between audio buffering and playing. This is multiplied by SAMPLEDURATION. TODO: Not hardcode.
let bufferGap = 3;

let streamName = "ZorroTracker";

// initialize rtAudio backend. Note that on Windows, we force WASAPI because the default option sucks.
let rtAudio:RtAudio;

// holds the chip we are using for audio emulation
let chip:Chip|undefined;

// holds the driver we are using for audio emulation
let driver:Driver|undefined;

// holds the volume for the chip because programming™
let volume = 0;

// handle messages from the parent thread
parentPort?.on("message", (data:{ token?:number, code:string, data:unknown, fn?:string }) => {
	try {
		switch(data.code) {
			/**
			 * Set the current configuration for this instance
			 *
			 * data: An object with pre-defined keys that may or may not be present
			 */
			case "config": {
				const d = data.data as Record<string, unknown>;

				// get the rtAudio API
				let api = RtAudioApi.UNSPECIFIED;
				let apistr = "undefined", apios = "unknown";

				switch(process.platform) {
					case "win32":		// windows-based api's
						apios = "windows";
						apistr = (d.windows as string|null)?.toUpperCase();

						switch(apistr) {
							case "DIRECTSOUND": api = RtAudioApi.WINDOWS_DS; break;
							case "WASAPI": api = RtAudioApi.WINDOWS_WASAPI; break;
							case "ASIO": api = RtAudioApi.WINDOWS_ASIO; break;
							default: apistr = "unknown"; break;
						}
						break;

					case "linux":		// linux-based api's
						apios = "linux";
						apistr = (d.linux as string|null)?.toUpperCase();

						switch(apistr) {
							case "PULSE": api = RtAudioApi.LINUX_PULSE; break;
							case "ALSA": api = RtAudioApi.LINUX_ALSA; break;
							case "JACK": api = RtAudioApi.UNIX_JACK; break;
							case "OSS": api = RtAudioApi.LINUX_OSS; break;
							default: apistr = "unknown"; break;
						}
						break;

					case "darwin":		// macos-based api's
						apios = "macos";
						apistr = (d.macos as string|null)?.toUpperCase();

						switch(apistr) {
							case "CORE": api = RtAudioApi.MACOSX_CORE; break;
							default: apistr = "unknown"; break;
						}
						break;
				}

				// log this
				parentPort?.postMessage({ code: "log", data: [ "audio-config-api", apios, apistr, ], });

				// initialize rtAudio instance
				rtAudio = new RtAudio(api);

				// update constants
				/* eslint-disable @typescript-eslint/no-unused-expressions */
				d.samplerate && (outputRate = d.samplerate as number);
				d.buffersize && (bufferLen = d.buffersize as number / 1000);
				d.buffergap && (bufferGap = d.buffergap as number);
				d.name && (streamName = d.name as string);
				/* eslint-enable @typescript-eslint/no-unused-expressions */
				break;
			}

			/**
			 * Set the current volume.
			 *
			 * data: Volume as percentage from 0% to 200% (0.0 to 2.0)
			 */
			case "volume":
				volume = data.data as number === 0 ? 0 : ((3.1623e-3 * Math.exp(data.data as number / 2 * 5.757)) * 2);
				chip?.setVolume(volume);
				break;

			/**
			 * Set the chip to use.
			 *
			 * data: ChipConfig to use for loading and initializing the chip.
			 */
			case "chip":
				parentPort?.postMessage({ code: "log", data: [
					"audio-chip", (data.data as ChipConfig).name, (data.data as ChipConfig).entry,
				], });

				/* eslint-disable @typescript-eslint/no-var-requires */
				chip = new (__non_webpack_require__(path.join((data.data as ChipConfig).entry)).default)();
				chip?.init(outputRate, data.data as ChipConfig);
				chip?.setVolume(volume);
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
				driver = new (__non_webpack_require__((data.data as DriverConfig).entry).default)();
				driver?.init(outputRate, data.data as DriverConfig, chip);

				// let the caller know we finished
				parentPort?.postMessage({ token: data.token, code: "driver", });

				// log it too
				parentPort?.postMessage({ code: "log", data: [
					"audio-driver", (data.data as DriverConfig).name, (data.data as DriverConfig).entry,
				], });
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
				if(rtAudio?.isStreamOpen()){
					// reset the chip just in case
					chip?.reset();

					// clear the output queue and close the stream down
					rtAudio.clearOutputQueue();
					rtAudio.closeStream();
				}
				break;

			/**
			 * Start playing some audio and initialize stream if stopped.
			 *
			 * data: Irrelevant
			 */
			case "play":
				driver?.play(data.data as string);
				parentPort?.postMessage({ code: "log", data: [ "audio-play", data.data, ], });

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
				parentPort?.postMessage({ code: "log", data: [ "audio-stop", ], });
				driver?.stop();
				break;

			/**
			 * Clean up and exit the instance
			 *
			 * data: Irrelevant
			 */
			case "quit":
				driver?.stop();
				rtAudio.closeStream();
				parentPort?.postMessage({ token: data.token, code: "quit", data: null, });
				break;

			/**
			 * Start module playback
			 *
			 * data: Various config and info options for the playback
			 */
			case "module-play":	// pattern, repeat, rate, ticksPerRow, length
				if(driver) {
					// load the play manager
					const arr = data.data as { row:number, patternlen:number, repeat:boolean, rate:number, ticksPerRow:number, length:number, };

					// eslint-disable-next-line max-len
					playManager = new PlaybackManager(arr.row, arr.patternlen, arr.repeat, arr.rate, arr.ticksPerRow, arr.length, processAsyncMessage);

					// initialize the driver and manager
					driver.playback = playManager.getAPI();
					playManager.loadDataRow();

					// tell the driver to start playback
					driver.reset();
					driver.play();
				}

				// let the parent know we're ready
				parentPort?.postMessage({ token: data.token, code: data.code, data: driver !== undefined, });
				break;

			/**
			 * Stop module playback
			 *
			 * data: Irrelevant
			 */
			case "module-stop":
				playManager = undefined;

				if(driver) {
					driver.playback = undefined;

					// tell the driver to stop playback
					driver.stop();
				}

				// let the parent know we're ready
				parentPort?.postMessage({ token: data.token, code: data.code, data: driver !== undefined, });
				break;

			/**
			 * Communicate with the driver emulator
			 *
			 * data: Array with the properties
			 */
			case "cd":
				// handler driver function call
				switch((data.fn) as string) {
					case "getChannels":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn, data: driver?.getChannels() ?? [],
						});
						break;

					case "muteChannel":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn, data: driver?.muteChannel(...(data.data as [number, boolean])) ?? false,
						});
						break;

					case "enableChannel":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn, data: driver?.enableChannel(...(data.data as [number])) ?? false,
						});
						break;

					case "disableChannel":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn, data: driver?.disableChannel(...(data.data as [number])) ?? false,
						});
						break;

					case "notes":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn,
							data: driver?.notes(...(data.data as [number])) ?? { octave: { min: 0, max: 0, }, notes: [], },
						});
						break;

					case "pianoTrigger":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn,
							data: driver?.pianoTrigger(...(data.data as [ number, number, number, number, boolean ])) ?? false,
						});
						break;

					case "pianoRelease":
						parentPort?.postMessage({
							token: data.token, code: "cd", fn: data.fn,
							data: driver?.pianoRelease(...(data.data as [number])) ?? false,
						});
						break;
				}
				break;

			/**
			 * Response to an async function handler
			 *
			 * data: Depends on the function
			 */
			case "async-ui":
				// check that the async function exists
				if(asyncFuncs[data.token] && asyncFuncs[data.token].code === data.fn) {
					// store the function and delete the function
					const cb = asyncFuncs[data.token].callback;
					delete asyncFuncs[data.token];

					// call the actual function with the result
					cb(data.data);

				} else {
					// the async function was not found. oops!
					throw new Error("Async function with token "+ data.token +" and code "+ data.fn +" was received when it was not expected.");
				}
				break;
		}
	} catch(ex) {
		console.error(ex);
		parentPort?.postMessage({ code: "error", data: [ ex, ], });
	}
});

// helper object that helps the chip process playback
let playManager: undefined|PlaybackManager;

function processAsyncMessage(code:ipcEnum, data:unknown, callback:(result:unknown) => void): void {
	// if parent port is somehow null, we need to handle this gracefully... ish
	if(!parentPort) {
		return callback(undefined);
	}

	// generate a token
	const token = Math.random();

	// save the async function to later get the result
	asyncFuncs[token] = { code, callback, };

	// send the message to the port
	parentPort.postMessage({ code: "async-ui", token: token, fn: code, data: data, });
}

const asyncFuncs: { [key:number]: { code: string, callback: (result:unknown) => void, }, } = {};

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

	}, null, RtAudioFormat.RTAUDIO_SINT32, outputRate, (outputRate * bufferLen) | 0, streamName, null, () => {
		try {
			// automagically buffer audio when the previous audio is finished playing.
			rtAudio.write(stream((outputRate * bufferLen) | 0));

		} catch(ex) {
			// panic on error and close the stream.
			console.error(ex);
			parentPort?.postMessage({ code: "error", data: [ ex, ], });
			rtAudio.closeStream();
		}
	});

	// start streaming the audio
	rtAudio.start();
	parentPort?.postMessage({ code: "log", data: [ "rtAudio", streamName, "@", outputRate, "hz", bufferLen * 1000, "ms", bufferGap, "buffers", ], });

	// buffer ahead a little bit of audio so that we can avoid any sudden lagspikes affecting quality.
	for(let i = 0;i < bufferGap;i ++) {
		try {
			rtAudio.write(stream((outputRate * bufferLen) | 0));

		} catch(ex) {
			// panic on error and close the stream.
			console.error(ex);
			parentPort?.postMessage({ code: "error", data: [ ex, ], });
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
