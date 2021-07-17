import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
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
		b.onmousedown = data.click;

		// set the tooltip
		b.title = data.tooltip;
	}

	// reload graphics
	reloadTheme().catch(console.error);
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

		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
	{
		tooltip: "Start playback",
		click: (e:MouseEvent) => {

		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
	{
		tooltip: "Repeat pattern",
		click: (e:MouseEvent) => {

		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
	{
		tooltip: "Record mode",
		click: (e:MouseEvent) => {

		},
		theme: async(e:HTMLButtonElement, index:number) => {
			e.innerHTML = await loadSVG(svgfile[index]);
		},
	},
];
