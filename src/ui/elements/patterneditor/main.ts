import { UIComponent, UIShortcutHandler } from "../../../api/ui";
import { Tab } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { makeScrollbar, makeScrollbarCorner, ScrollbarReturn } from "../scrollbar/scrollbar";
import { PatternChannelInfo } from "./canvas wrappers";
import { PatternEditorEventManager } from "./event manager";
import { PatternEditorScrollManager } from "./scroll manager";
import { PatternEditorSelectionManager } from "./selection manager";
import { PatternEditorShortcuts } from "./shortcut handler";

/**
 * Helper type that stores the amount of "padding" on each side of the `PatternEditor`.
 * This space is obscured by other elements and thus can not be used to draw the pattern graphics.
 * This is to allow the size to change without having to hardcode these restrictions into code.
 */
export type PatternEditorSidePadding = {
	/**
	 * The amount of padding from the top of the `PatternEditor`
	 */
	top: number,

	/**
	 * The amount of padding from the bottom of the `PatternEditor`
	 */
	bottom: number,

	/**
	 * The amount of padding vertically from both sides of the `PatternEditor`
	 */
	height: number,

	/**
	 * The amount of padding from the left of the `PatternEditor`
	 */
	left: number,

	/**
	 * The amount of padding from the right of the `PatternEditor`
	 */
	right: number,

	/**
	 * The amount of padding horizontally from both sides of the `PatternEditor`
	 */
	width: number,
}

export class PatternEditor implements UIComponent<HTMLDivElement>, UIShortcutHandler {
	// various standard elements for the pattern editor
	public element!: HTMLDivElement;
	public scrollwrapper!: HTMLDivElement;
	public focusBar!: HTMLDivElement;
	public singleSelection!: HTMLDivElement;
	public multiSelection!: HTMLDivElement;
	public cursor!: HTMLDivElement;

	/**
	 * The scrollbars for this element
	 */
	public horizontalBar!: ScrollbarReturn;
	public verticalBar!: ScrollbarReturn;

	/**
	 * This is the tab that the pattern editor is working in
	 */
	public tab!: Tab;

	/**
	 * The scroll manager instance for this class
	 */
	public scrollManager: PatternEditorScrollManager;

	/**
	 * The selection manager instance for this class
	 */
	public selectionManager: PatternEditorSelectionManager;

	/**
	 * The event manager instance for this class
	 */
	public eventManager: PatternEditorEventManager;

	/**
	 * The shortcuts manager for this class
	 */
	public shortcuts: PatternEditorShortcuts;

	/**
	 * Initialize this PatternEditor instance
	 *
	 * @param tab The tab that this pattern editor is targeting
	 */
	constructor() {
		// initialize managers
		this.shortcuts = new PatternEditorShortcuts(this);
		this.eventManager = new PatternEditorEventManager(this);
		this.scrollManager = new PatternEditorScrollManager(this);
		this.selectionManager = new PatternEditorSelectionManager(this);

		// initialize bounds
		this.padding = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, };
	}

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	public receiveShortcut(data:string[]):Promise<boolean> {
		return this.shortcuts.receiveShortcut(data);
	}

	/**
	 * Function to initialize the component
	 */
	public init(): Promise<HTMLDivElement> {
		return new Promise((res, rej) => {
			// load the button size
			const size = theme?.pattern?.extras?.scrollbar?.size ?? 0;

			// initialize the scrollbars
			const bar = [
				makeScrollbar({
					size, top: "0px", bottom: size +"px", right: "0px", class: [ "patternscroll", ], vertical: true,
					buttonValues: 4, buttonSVG: "scrollbar.button.patternedit", gripSVG: "scrollbar.grip.patternedit", move: async(row) => {
						if(this.selectionManager.single) {
							// update the row of the single selection
							this.selectionManager.single.row = row;
							await this.selectionManager.moveSingle(0, 0.00001, true);
						}
					},
				}),
				makeScrollbar({
					size, bottom: "0px", right: size +"px", left: "0px", class: [ "patternscroll", ], vertical: false,
					buttonValues: 4, buttonSVG: "scrollbar.button.patternedit", gripSVG: "scrollbar.grip.patternedit", move: async(elm) => {
						await this.selectionManager.setSingleElement(elm);
					},
				}),
			];

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

			// initialize the cursor element
			this.cursor = document.createElement("div");
			this.cursor.classList.add("cursor");
			wrap.appendChild(this.cursor);

			// initialize the single selection element
			this.singleSelection = document.createElement("div");
			this.singleSelection.classList.add("singleselection");
			wrap.appendChild(this.singleSelection);

			// initialize the multi selection element
			this.multiSelection = document.createElement("div");
			this.multiSelection.classList.add("multiselection");
			wrap.appendChild(this.multiSelection);

			// await all the scrollbars initializing
			Promise.all(bar).then((bardat) => {
				this.verticalBar = bardat[0];
				this.horizontalBar = bardat[1];

				// append the scrollbars to DOM too
				this.element.appendChild(this.verticalBar.element);
				this.element.appendChild(this.horizontalBar.element);
				this.element.appendChild(makeScrollbarCorner({
					size: 12, bottom: "0px", right: "0px", class: [ "patternscroll", ],
				}));

				// initialize the theme
				this.reloadTheme(true).then(() => {
					// return the main element
					res(this.element);

					requestAnimationFrame(() => {
						// initialize children
						this.scrollManager.init();
						this.selectionManager.init();
					});
				}).catch(rej);
			}).catch(rej);
		});
	}

	/**
	 * Function to load the component
	 */
	public async load(pass:number): Promise<boolean> {
		// component loads in pass 2
		if(pass !== 2) {
			return pass < 2;
		}

		// initialize the channel layout for this editor
		this.initChannels();
		await this.selectionManager.load();
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
						<div class="channelvu"></div>
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
			const drag = chan.children[0].children[2] as HTMLDivElement;

			let pos = -1, left = 0;

			// initialize header size
			this.setChannelHeaderSize(this.tab.channels[i]?.info.effects ?? 0, i, this.tab.channels[i].muted, chan);

			// enable mouse down detection
			drag.onpointerdown = (e) => {
				// lock the pointer in-place so it works as expected
				drag.requestPointerLock();

				// reset the channel header position and mouse position
				left = chan.getBoundingClientRect().x;
				pos = e.x;

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
					this.scrollManager.changeChannelSize(i);

					// tell the selection manager to update selection
					this.selectionManager.handleChannelResize();
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
				this.scrollManager.horizontalScroll(0, false);
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

		requestAnimationFrame(() => {
			// refresh channel widths
			this.scrollManager.refreshChannelWidth();

			// update padding amount
			this.updatePaddingAmount();
		});
	}

	/**
	 * Function to update the channel header size
	 *
	 * @param effects The number of effects this channel has
	 * @param channel The channel to change
	 * @param element The root element for this channel
	 */
	private setChannelHeaderSize(effects:number, channel:number, muted:boolean, element:HTMLDivElement) {
		// update effects amount
		this.tab.channels[channel].info.effects = effects;
		const width = this.scrollManager.updateElementRender(channel, effects);

		// update header element width and classes
		element.style.width = width +"px";

		// @ts-expect-error This works you silly butt
		element.classList = "channelwrapper"+ (muted ? " muted" : "") + (effects === 1 ? " dragright" : effects === 8 ? " dragleft" : "");

		// update SVG path element
		const path = element.querySelector("path");
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		path && path.setAttribute("d", (theme?.pattern?.main?.header?.resize?.path ?? [])[effects === 1 ? 0 : effects === 8 ? 2 : 1] ?? "");
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
	 * Store pattern size of each pattern
	 */
	public patternLen = 64;

	/**
	 * Pseudo-variable that is the current active pattern
	 */
	public get activePattern(): number {
		return Math.floor(this.scrollManager.scrolledRow / this.patternLen);
	}

	/**
	 * Various channel statistics
	 */
	public channelInfo!: PatternChannelInfo[];

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public reloadTheme(preload:boolean):Promise<void[]> {
		const size = theme?.pattern?.extras?.scrollbar?.size ?? 0;

		// update scrollbars
		const promises = [ this.verticalBar.reloadTheme(size), this.horizontalBar.reloadTheme(size), ];
		this.verticalBar.element.style.bottom = size +"px";
		this.horizontalBar.element.style.right = size +"px";

		// update padding amount later
		requestAnimationFrame(() => this.updatePaddingAmount());

		// tell the child to reload the theme
		this.eventManager.reloadTheme();
		this.selectionManager.reloadTheme();
		promises.push(this.scrollManager.reloadTheme(preload));

		// return the promise that waits all promises
		return Promise.all(promises);
	}

	/**
	 * The amount of pixels at each edge of the `PatternEditor` that are obscured
	 */
	public padding: PatternEditorSidePadding;

	/**
	 * Helper function to update the padding amount
	 */
	public updatePaddingAmount(): void {
		// prepare the positions here
		const rc = this.scrollwrapper.children[0] as HTMLDivElement;

		// bitfield for what was updated
		let update = 0;

		// load the top and left padding via the row num header
		const top = rc?.offsetHeight ?? 0;
		const left = rc?.offsetWidth ?? 0;

		if(this.padding.top !== top) {
			this.padding.top = top;
			update |= 1;
		}

		if(this.padding.left !== left) {
			this.padding.left = left;
			update |= 4;
		}

		// load the bottom and right padding via the scrollbars
		const bottom = this.verticalBar?.element.offsetWidth ?? 0;
		const right = this.horizontalBar?.element.offsetHeight ?? 0;

		if(this.padding.right !== right) {
			this.padding.right = right;
			update |= 8;
		}

		if(this.padding.bottom !== bottom) {
			this.padding.bottom = bottom;
			update |= 2;
		}

		// update the width and height properties too
		this.padding.height = this.padding.top + this.padding.bottom;
		this.padding.width = this.padding.left + this.padding.right;

		// check if the left position was updated
		if((update & 4) !== 0){
			this.scrollManager.refreshChannelWidth();
		}
	}
}
