import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { PlayMode, Tab } from "../../misc/tab";
import { loadSVG } from "../../misc/theme";

/**
 * Generate the buttons bar and return the HTML for it
 *
 * @returns HTML element to append to the DOM
 */
export function createBar(): HTMLDivElement {
	// create the wrapper element
	target = document.createElement("div");
	target.classList.add("playbuttonsbar");

	// loop for every button
	for(const data of buttonData) {
		// create the button element
		const b = document.createElement("button");
		b.classList.add("playbuttonsbar");
		target.appendChild(b);

		// append the onclick listener
		b.onmouseup = data.click;

		// set the tooltip
		b.title = data.tooltip;
	}

	// reload graphics
	reloadTheme().catch(console.error);

	// set stopped button to be active
	setActive(0, true);
	return target;
}

let target: HTMLDivElement|undefined;

// listen to theme reloading
ZorroEvent.addListener(ZorroEventEnum.LoadTheme, async() => {
	if(target) {
		// update the theme and await for promises
		await reloadTheme();
	}
});

/**
 * Helper function to reload the theme
 */
function reloadTheme(): Promise<void[]> {
	// run the theme function and return the promises as an array
	return Promise.all(buttonData.map((d, i) => d.theme(target?.children[i] as HTMLButtonElement, i)));
}

/**
 * The SVG file ID's for each button
 */
const svgfile = [ "buttonbar.stop", "buttonbar.play", "buttonbar.repeat", "buttonbar.record", ];

/**
 * The data for each button
 */
const buttonData = [
	{
		tooltip: "Stop playback",
		click: (e:MouseEvent) => {
			// change playback mode to stopped
			if(e.button === 0 && Tab.active) {
				Tab.active.playMode = PlayMode.Stopped;
			}
		},
		theme: async(e:HTMLButtonElement, index:number) => {
			// load the icon for this element
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
	{
		tooltip: "Start playback",
		click: (e:MouseEvent) => {
			// change playback mode to play all
			if(e.button === 0 && Tab.active) {
				Tab.active.playMode = PlayMode.PlayAll;
			}
		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
	{
		tooltip: "Repeat pattern",
		click: (e:MouseEvent) => {
			// change playback mode to play pattern
			if(e.button === 0 && Tab.active) {
				Tab.active.playMode = PlayMode.PlayPattern;
			}
		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
	{
		tooltip: "Record mode",
		click: (e:MouseEvent) => {
			// flip record mode flag
			if(e.button === 0 && Tab.active) {
				Tab.active.recordMode = !Tab.active.recordMode;
			}
		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
];

/**
 * Function to update the active status of a single button
 *
 * @param position The position of the button to update
 * @param active The active status of the button
 */
function setActive(position:number, active:boolean) {
	// update the status of the `active` class
	target?.children[position].classList[active ? "add" : "remove"]("active");
}

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabRecordMode, async(event, tab, mode) => {
	setActive(3, mode);
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabPlayMode, async(event, tab, mode) => {
	setActive(0, mode === PlayMode.Stopped);
	setActive(1, mode === PlayMode.PlayAll);
	setActive(2, mode === PlayMode.PlayPattern);
});
