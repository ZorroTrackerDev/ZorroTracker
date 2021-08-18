import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { PlayMode, Tab } from "../../misc/tab";

export function makeTimeDisplay(getTab:() => Tab): HTMLDivElement {
	currentTab = getTab;

	// generate the base element
	current = document.createElement("div");
	current.classList.add("timedisplay");
	mode = 0;

	// load the default HTML
	current.innerHTML = /*html*/`
		<span class="big">00</span><span class="big">:00</span><span class="small">:000</span>
	`;

	// handle clicking on the timer
	current.onclick = (e) => {
		if(e.button === 0) {
			mode = (mode + 1) % 2;
			updateText();
		}
	}

	return current;
}

let currentTab: () => Tab;
let current: HTMLDivElement;
let mode = 0;

/**
 * Function to load the text in the current mode
 */
function updateText() {
	if(!current || !currentTab) {
		return;
	}

	// load the text and place it on the DOM
	const text = loadMode();
	(current.children[0] as HTMLDivElement).innerText = text[0];
	(current.children[1] as HTMLDivElement).innerText = text[1];
	(current.children[2] as HTMLDivElement).innerText = text[2];
}

/**
 * Function to load the text for the current mode
 */
function loadMode(): [ string, string, string, ] {
	// load the tab and ignore if failed
	const tab = currentTab();

	if(!tab) {
		return [ "00", ":00", ":000", ];
	}

	// load the row to target and process the mode
	const row = tab.songRow < 0 || tab.playMode === PlayMode.Stopped || tab.follow ? tab.activeRow : tab.songRow;

	switch(mode) {
		case 0: {	// mode 0: mmm:ss:iii
			const time = row * tab.secondsPerTick * (tab.module?.ticksPerRow ?? 1);

			return [
				(Math.floor(time / 60) % 99).toString(10).padStart(2, "0"),
				":"+ (Math.floor(time) % 60).toString(10).padStart(2, "0"),
				":"+ (Math.floor(time * 1000) % 1000).toString(10).padStart(3, "0"),
			];
		}

		case 1: {	// mode 1: pp:rr
			const rpp = tab.module?.patternRows ?? 2;
			const pattern = Math.floor(row / rpp), rown = Math.floor(row % rpp);

			return [
				rown.toString(10).padStart(3, "0"),
				":"+ pattern.toString(16).toUpperCase().padStart(2, "0"),
				"",
			];
		}
	}

	return [ "", "", "", ];
}

// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.PlaybackSeconds, async() => { updateText(); });
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixResize, async() => { updateText(); });
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.ProjectPatternRows, async() => { updateText(); });
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.SelectModule, async() => { updateText(); });

