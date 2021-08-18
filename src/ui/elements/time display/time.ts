import { ZorroEvent, ZorroEventEnum } from "../../../api/events";

export function makeTimeDisplay(): HTMLDivElement {
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

let current: HTMLDivElement;
let mode = 0;

// the text strings for the display
const text = [
	[ "00", ":00", ":000", ],
	[ "000", ":00", "", ],
];

/**
 * Function to load the text in the current mode
 */
function updateText() {
	(current.children[0] as HTMLDivElement).innerText = text[mode][0];
	(current.children[1] as HTMLDivElement).innerText = text[mode][1];
	(current.children[2] as HTMLDivElement).innerText = text[mode][2];
}

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.PlaybackSeconds, async(event, row, secondsPerRow, rowsPerPattern) => {
	{	// mode 0: mmm:ss:iii
		const time = row * secondsPerRow;
		text[0][2] = ":"+ (Math.floor(time * 1000) % 1000).toString(10).padStart(3, "0");
		text[0][1] = ":"+ (Math.floor(time) % 60).toString(10).padStart(2, "0");
		text[0][0] = (Math.floor(time / 60) % 99).toString(10).padStart(2, "0");
	}

	{	// mode 1: pp:rr
		const pattern = Math.floor(row / rowsPerPattern), rown = Math.floor(row % rowsPerPattern);
		text[1][1] = ":"+ pattern.toString(16).toUpperCase().padStart(2, "0");
		text[1][0] = rown.toString(10).padStart(3, "0");
	}

	updateText();
});
