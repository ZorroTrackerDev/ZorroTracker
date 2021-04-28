import { YM2612 } from "./ym2612";
import { SN76489 } from "./sn76489";
import { RtAudio, RtAudioApi, RtAudioFormat, RtAudioStreamFlags } from "audify";

const FM = new YM2612();
const PSG = new SN76489();

// init PSG
PSG.init(3579545, 44100);
PSG.config(0xf, 0, 0, 9, 16);
PSG.write(0xE4);
PSG.write(0xF0);

PSG.write(0x95);
PSG.write(0x82);
PSG.write(0x20);

// AUDIO HANDLER
const rtAudio = new RtAudio(process.platform === "win32" ? RtAudioApi.WINDOWS_WASAPI : undefined);
rtAudio.openStream({
	deviceId: rtAudio.getDefaultOutputDevice(),
	nChannels: 2,

}, null, RtAudioFormat.RTAUDIO_SINT16, 44100, 1200 /* 25ms */, "ZorroTracker emulation", null, () => {
	// poll YM and SN here
	rtAudio.write(PSG.update(1200));
});

rtAudio.start();
rtAudio.write(PSG.update(1200));
rtAudio.write(PSG.update(1200));