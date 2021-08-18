import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { UIComponent } from "../../../api/ui";
import { startPlayback, stopPlayback } from "../../misc/playback";
import { PlayMode, Tab } from "../../misc/tab";
import { loadSVG } from "../../misc/theme";

export class PlayBar implements UIComponent<HTMLDivElement> {
	public element!: HTMLDivElement;
	public tab!:Tab;

	constructor() {
		target = this;
	}

	/**
	 * Function to initialize the piano component
	 */
	public init(): HTMLDivElement {
		// create the wrapper element
		this.element = document.createElement("div");
		this.element.classList.add("playbuttonsbar");

		// loop for every button
		for(const data of this.buttonData) {
			// create the button element
			const b = document.createElement("button");
			b.classList.add("playbuttonsbar");
			this.element.appendChild(b);

			// append the onclick listener
			b.onmouseup = data.click;

			// set the tooltip
			b.title = data.tooltip;
		}

		return this.element;
	}

	/**
	 * Function to dispose of this component
	 */
	public unload(): boolean {
		return false;
	}

	/**
	 * Function to load the component
	 */
	public async load(pass:number): Promise<boolean> {
		// component loads in pass 0
		if(pass !== 0) {
			return false;
		}

		// reload graphics
		await this.reloadTheme();

		// set stopped button to be active
		this.setActive(0, true);

		return false;
	}

	/**
	 * Helper function to reload the theme
	 */
	public reloadTheme(): Promise<void[]> {
		// run the theme function and return the promises as an array
		return Promise.all(this.buttonData.map((d, i) => d.theme(this, target?.element.children[i] as HTMLButtonElement, i)));
	}

	/**
	 * The SVG file ID's for each button
	 */
	private svgfile = [ "buttonbar.stop", "buttonbar.play", "buttonbar.repeat", "buttonbar.record", ];

	/**
	 * The data for each button
	 */
	private buttonData = [
		{
			tooltip: "Stop playback",
			click: async(e:MouseEvent) => {
				// change playback mode to stopped
				if(e.button === 0 && Tab.active && Tab.active.playMode !== PlayMode.Stopped) {
					Tab.active.playMode = PlayMode.Stopped;
					await stopPlayback();
				}
			},
			theme: async(p:PlayBar, e:HTMLButtonElement, index:number) => {
				// load the icon for this element
				e.innerHTML = await loadSVG(p.svgfile[index]);
			},
		},
		{
			tooltip: "Start playback at current pattern.\nCTRL+Click = Start from current row.",
			click: async(e:MouseEvent) => {
				// change playback mode to play all
				if(e.button === 0 && Tab.active && Tab.active.playMode !== PlayMode.PlayAll) {
					const row = Tab.active.activeRow, cr = e.ctrlKey ? row : row - (row % (Tab.active.module?.patternRows ?? 1));

					if(await startPlayback(cr, false, false)) {
						Tab.active.playMode = PlayMode.PlayAll;
					}
				}
			},
			theme: async(p:PlayBar, e:HTMLButtonElement, index:number) => {
				e.innerHTML = await loadSVG(p.svgfile[index]);
			},
		},
		{
			tooltip: "Repeat playback of the current pattern.\nCTRL+Click = Start from current row.",
			click: async(e:MouseEvent) => {
				// change playback mode to play pattern
				if(e.button === 0 && Tab.active && Tab.active.playMode !== PlayMode.PlayPattern) {
					const row = Tab.active.activeRow, cr = e.ctrlKey ? row : row - (row % (Tab.active.module?.patternRows ?? 1));

					if(await startPlayback(cr, true, false)) {
						Tab.active.playMode = PlayMode.PlayPattern;
					}
				}
			},
			theme: async(p:PlayBar, e:HTMLButtonElement, index:number) => {
				e.innerHTML = await loadSVG(p.svgfile[index]);
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
			theme: async(p:PlayBar, e:HTMLButtonElement, index:number) => {
				e.innerHTML = await loadSVG(p.svgfile[index]);
			},
		},
	];

	/**
	 * Function to update the active status of a single button
	 *
	 * @param position The position of the button to update
	 * @param active The active status of the button
	 */
	public setActive(position:number, active:boolean): void {
		// update the status of the `active` class
		this.element.children[position].classList[active ? "add" : "remove"]("active");
	}
}

let target: PlayBar|undefined;

// listen to theme reloading
ZorroEvent.addListener(ZorroEventEnum.LoadTheme, async() => {
	if(target) {
		// update the theme and await for promises
		await target.reloadTheme();
	}
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabRecordMode, async(event, tab, mode) => {
	target?.setActive(3, mode);
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabPlayMode, async(event, tab, mode) => {
	target?.setActive(0, mode === PlayMode.Stopped);
	target?.setActive(1, mode === PlayMode.PlayAll);
	target?.setActive(2, mode === PlayMode.PlayPattern);
});
