import { Channel } from "../../../api/driver";
import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { UIComponent, UIShortcutHandler } from "../../../api/ui";
import { Tab } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { PatternChannelInfo } from "./canvas wrappers";
import { PatternEditorScrollManager } from "./scroll manager";

export class PatternEditor implements UIComponent<HTMLDivElement>, UIShortcutHandler {
	// various standard elements for the pattern editor
	public element!: HTMLDivElement;
	public scrollwrapper!: HTMLDivElement;
	public focusBar!: HTMLDivElement;

	/**
	 * This is the tab that the pattern editor is working in
	 */
	public tab!:Tab;

	/**
	 * The scroll manager instance for this class
	 */
	public scrollManager:PatternEditorScrollManager;

	/**
	 * Initialize this PatternEditor instance
	 *
	 * @param tab The tab that this pattern editor is targeting
	 */
	constructor() {
		_edit = this;
		this.scrollManager = new PatternEditorScrollManager(this);
	}

	/**
	 * Function to initialize the component
	 */
	public init(): Promise<HTMLDivElement> {
		return new Promise((res, rej) => {
			// generate the main element for this editor
			this.element = document.createElement("div");
			this.element.classList.add("patterneditor");
			this.element.tabIndex = 0;

			// add the scrolling wrapper to the list
			this.scrollwrapper = document.createElement("div");
			this.scrollwrapper.classList.add("patterneditorwrap");
			this.element.appendChild(this.scrollwrapper);

			// initialize the misc wrapper element
			const wrap = document.createElement("div");
			wrap.classList.add("patternextras");
			this.element.appendChild(wrap);

			// initialize the focus bar element
			this.focusBar = document.createElement("div");
			this.focusBar.classList.add("focus");
			wrap.appendChild(this.focusBar);

			this.reloadTheme(true).then(() => {
				// return the main element
				res(this.element);

				requestAnimationFrame(() => {
					this.scrollManager.init();
				});
			}).catch(rej);
		});
	}

	/**
	 * Function to load the component
	 */
	public load(pass:number): boolean|Promise<boolean> {
		// component loads in pass 2
		if(pass !== 2) {
			return pass < 2;
		}

		// initialize the channel layout for this editor
		this.initChannels();
		return this.scrollManager.load();
	}

	/**
	 * Function to dispose of this component
	 */
	public unload(): boolean {
		this.scrollManager.unload();
		return false;
	}

	/**
	 * Function to clear all children from an element
	 *
	 * @param element The element to clear
	 */
	private clearChildren(element:Element): void {
		// remove all children
		while(element.children.length > 0){
			element.removeChild(element.children[0]);
		}
	}

	/**
	 * Function to update the mute state of a single channel
	 *
	 * @param channel The channel to update state for
	 * @param state The actual state to update to
	 */
	public updateMute(channel:Channel, state:boolean): void {
		// get index of the channel
		for(let i = this.tab.channels.length;i > 0; --i) {
			if(this.tab.channels[i - 1] === channel) {
				// found the channel, update status
				const chan = this.scrollwrapper.children[i] as HTMLDivElement;
				chan.classList[state ? "add" : "remove"]("muted");
				return;
			}
		}
	}

	/**
	 * Helper function to initialize channel headers and channel positions
	 */
	private initChannels() {
		// delete any previous children
		this.clearChildren(this.scrollwrapper);
		this.channelInfo = [];

		// generating DOM for a single channel
		const doChannel = (name:string) => {
			// do some regex hacking to remove all tabs and newlines. HTML whyyy
			return /*html*/`
				<div class="channelwrapper">
					<div class="channelnamewrapper">
						<label>${ name }</label>
						<div class="channeldragarea">
							<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
								<path fill="#3b1b0f" stroke-width="0" stroke-linejoin="round" stroke-linecap="round"/>
							</svg>
						</div>
					</div>
				</div>
			`.replace(/[\t|\r|\n]+/g, "");
		};

		// create the row index column
		this.scrollwrapper.innerHTML = doChannel("\u200B");

		// handle DOM generation for each channel and save it to scrollwrapper
		this.scrollwrapper.innerHTML += this.tab.channels.map((c) => {
			// generate DOM for a single channel
			return doChannel(c.info.name);
		}).join("");

		// enable resize handlers and init styles
		for(let i = 0;i < this.tab.channels.length; i++){
			// initialize channel info with bogus statistics
			this.channelInfo[i] = { width: 0, left: 0, right: 0, elements: [], offsets: [], };

			const chan = this.scrollwrapper.children[i + 1] as HTMLDivElement;
			const drag = chan.children[0].children[1] as HTMLDivElement;

			let pos = -1, lastsize = -1, left = 0;

			// initialize header size
			this.setChannelHeaderSize(this.tab.channels[i]?.info.effects ?? 0, i, this.tab.channels[i].muted, chan);

			// enable mouse down detection
			drag.onpointerdown = (e) => {
				// lock the pointer in-place so it works as expected
				drag.requestPointerLock();

				// reset the channel header position and mouse position
				left = chan.getBoundingClientRect().x;
				pos = e.x;

				// load the channel commands count for scrolling
				lastsize = this.tab.channels[i]?.info.effects ?? 0;

				// enable mouse button and movement detection
				drag.onmousemove = move;
				drag.onpointerup = up;
			}

			// handler for mouse movement
			const move = (e:MouseEvent) => {
				// fetch channel size
				pos += e.movementX;
				const sz = this.getClosestChannelSize(pos - left);

				if(this.tab.channels[i].info.effects !== sz) {
					// update channel header size
					this.setChannelHeaderSize(sz, i, this.tab.channels[i].muted, chan);

					// update scroll manager
					this.scrollManager.changeChannelSize(i, (sz - lastsize) * 38);
					lastsize = sz;
				}
			}

			// handler for mouse release
			const up = () => {
				// disable pointer lock so we can again move it freely
				document.exitPointerLock();

				// remove event updates
				drag.onpointerup = null;
				drag.onmousemove = null;

				// fix horizontal scrolling just in case
				this.scrollManager.scrollHoriz(0);
			}

			// handler for mouse clicks on the main channel itself
			chan.onclick = async(e) => {
				// check if this was a right click
				if(e.button !== 0) {
					return;
				}

				// fetch the channel to effect
				const ch = this.tab.channels[i];

				if(e.detail > 1) {
					// double click handling
					if(this.tab.isSolo(ch)) {
						// enable all channels
						await this.tab.setMuteAll(false);

					} else {
						// make the channel go solo
						await this.tab.setSolo(ch);
					}

				} else if(e.detail === 1) {
					// single click handling
					await this.tab.setMute(ch, !ch.muted);
				}
			};
		}

		// also refresh channel widths
		requestAnimationFrame(() => this.scrollManager.refreshChannelWidth());
	}

	/**
	 * Function to update the channel header size
	 *
	 * @param width The number of commands this channel has
	 * @param channel The channel to change
	 * @param element The root element for this channel
	 */
	private setChannelHeaderSize(width:number, channel:number, muted:boolean, element:HTMLDivElement) {
		// update commands amount
		this.tab.channels[channel].info.effects = width;
		this.scrollManager.updateElementRender(channel, width);

		// update header element width and classes
		element.style.width = this.channelWidths[width] +"px";

		// @ts-expect-error This works you silly butt
		element.classList = "channelwrapper"+ (muted ? " muted" : "") + (width === 1 ? " dragright" : width === 8 ? " dragleft" : "");

		// update SVG path element
		const path = element.querySelector("path");
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		path && path.setAttribute("d", (theme?.pattern?.main?.header?.resize?.path ?? [])[width === 1 ? 0 : width === 8 ? 2 : 1] ?? "");
	}

	/**
	 * Array of channel width values that are accepted
	 */
	private channelWidths = [ 30, 107, 145, 183, 221, 259, 297, 335, 373, ];

	/**
	 * The amount of leeway before snapping to higher size
	 */
	private widthBias = 5;

	/**
	 * Helper function to get the closest channel commands count for the given channel size
	 *
	 * @param size The size we're checking
	 */
	private getClosestChannelSize(size:number) {
		for(let i = 1;i < this.channelWidths.length;i ++) {
			if(size < this.channelWidths[i] + this.widthBias){
				return i;
			}
		}

		// maximum size
		return this.channelWidths.length - 1;
	}

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[]):Promise<boolean> {
		if(document.querySelector(":focus") === this.element) {
			// has focus, process the shortcut
			switch(data.shift()) {
				case "null": {
					break;
				}
			}
		}

		return false;
	}

	/**
	 * Function to update the record mode of the pattern editor
	 */
	public changeRecordMode(): void {
		// update backdrop color
		this.scrollwrapper.style.backgroundColor = this.backdropColors[this.tab.recordMode ? 1 : 0];

		// tell the scroll manager about it too
		this.scrollManager.changeRecordMode();
	}

	/**
	 * Store pattern size of each pattern
	 */
	public patternLen = 64;

	/**
	 * Pseudo-variable that is the current active pattern
	 */
	public get activePattern(): number {
		return Math.floor(this.scrollManager.currentRow / this.patternLen);
	}

	/**
	 * Function to update the pattern editor with the new number of rows per pattern.
	 *
	 * @param rows The number of rows to update to
	 */
	public setPatternRows(rows:number): Promise<void> {
		this.patternLen = rows;
		return this.scrollManager.setPatternRows(rows);
	}

	/**
	 * Various channel statistics
	 */
	public channelInfo!: PatternChannelInfo[];

	/**
	 * The colors for the backdrop of the scrollWrapper
	 */
	private backdropColors!: [ string, string, ];

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public reloadTheme(preload:boolean):Promise<void> {
		// load the tables for backdrop colors
		this.backdropColors = [
			theme?.pattern?.worker?.params?.backdrop ?? "#000",
			theme?.pattern?.worker?.params?.recordbackdrop ?? "#000",
		];

		// update backdrop color
		this.scrollwrapper.style.backgroundColor = this.backdropColors[this.tab?.recordMode ? 1 : 0];

		// tell the child to reload the theme
		return this.scrollManager.reloadTheme(preload);
	}
}

let _edit:PatternEditor|undefined;

// listen to theme reloading
ZorroEvent.addListener(ZorroEventEnum.LoadTheme, async() => {
	if(_edit) {
		await _edit.reloadTheme(false);
	}
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabRecordMode, async() => {
	if(_edit) {
		_edit.changeRecordMode();
	}
});

// listen to record mode changing
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.TabMute, async(event, tab, channel, state) => {
	if(_edit) {
		_edit.updateMute(channel, state);
	}
});

// listen to number of pattern rows changing
ZorroEvent.addListener(ZorroEventEnum.ProjectPatternRows, async(event, project, module, rows) => {
	if(_edit) {
		await _edit.setPatternRows(rows);
	}
});
