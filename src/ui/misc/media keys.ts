import { loadFlag } from "../../api/files";
import { PlayMode, Tab } from "./tab";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import path from "path";
import fs from "fs";

// the blob url for the icon to be used
let iconData:string;

// the audio element the user is controlling
let element:HTMLAudioElement;

/**
 * Function to enable media key functionality on the hardware keyboard(s)
 */
export async function enableMediaKeys(): Promise<void> {
	if(loadFlag<boolean>("MEDIA_KEYS")) {
		// generate the blob URL for this image
		const blob = new Blob([ (await fs.promises.readFile(path.join(__dirname, "..", "..", "icon.png"))).buffer, ], { type: "image/png", });
		iconData = URL.createObjectURL(blob);

		// set the metadata for this session
		await updateMetadata();

		// add handle for the play button
		navigator.mediaSession.setActionHandler("play", () => {
			console.log("play")
			if(Tab.active){
				// play fake audio
				element.play().catch(console.error);
				Tab.active.playMode = PlayMode.PlayAll;
			}
		});

		// add handle for the pause button
		navigator.mediaSession.setActionHandler("pause", () => {
			console.log("pause")
			if(Tab.active){
				// pause fake audio
				element.pause();
				Tab.active.playMode = PlayMode.Stopped;
			}
		});

		// add handle for the stop button
		navigator.mediaSession.setActionHandler("stop", () => {
			if(Tab.active){
				Tab.active.playMode = PlayMode.Stopped;
			}

			// forcibly set the audio to pause instead of quit
			setTimeout(() => {
				element.play().catch(console.error);
				element.pause();
			}, 5);
		});

		/*
		 * Other events we can use too
		 * navigator.mediaSession.setActionHandler("seekbackward", function() { });
		 * navigator.mediaSession.setActionHandler("seekforward", function() { });
		 * navigator.mediaSession.setActionHandler("seekto", function() { });
		 * navigator.mediaSession.setActionHandler("previoustrack", function() { });
		 * navigator.mediaSession.setActionHandler("nexttrack", function() { });
		 * navigator.mediaSession.setActionHandler("skipad", function() { });
		 */

		// generate a fake audio interface that allows media keys to work
		element = document.createElement("audio");
		document.body.appendChild(element);
		// make it so that its not user visible
		element.style.position = "absolute";
		element.style.width = "0px";

		// create an empty audio buffer to use for the audio element
		element.src = "https://raw.githubusercontent.com/anars/blank-audio/master/10-seconds-of-silence.mp3";
		element.loop = true;

		// play fake audio
		await element.play();
		element.pause();
	}
}

/**
 * Helper function to update media metadata based on the current state
 */
// eslint-disable-next-line require-await
async function updateMetadata() {
	if(element) {
		// set metadata based on the project
		navigator.mediaSession.metadata = new MediaMetadata({
			title: Tab.active?.project.modules[Tab.active.project.activeModuleIndex]?.name,
			artist: Tab.active?.project.modules[Tab.active.project.activeModuleIndex]?.author,
			album: Tab.active?.project.config.name,
			artwork: [
				{
					src: iconData,
				},
			],
		});
	}
}

// when a new project is opened, update metadata
ZorroEvent.addListener(ZorroEventEnum.ProjectOpen, updateMetadata);
