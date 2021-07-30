import { UIComponent, UIShortcutHandler } from "../../../api/ui";
import { Tab } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { makeScrollbar, makeScrollbarCorner, ScrollbarReturn } from "../scrollbar/scrollbar";
import { PatternChannelInfo } from "./canvas wrappers";
import { PatternEditorEventManager } from "./event manager";
import { PatternEditorScrollManager } from "./scroll manager";
import { PatternEditorSelectionManager } from "./selection manager";
import { PatternEditorShortcuts } from "./shortcut handler";

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

			// initialize the scrollbars
			this.verticalBar = makeScrollbar({
				top: "28px", bottom: "12px", right: "0px", width: "12px", class: [ "patternscroll", ], vertical: true, move: (row) => {
					if(this.selectionManager.single) {
						// update the row of the single selection
						this.selectionManager.single.row = row;
						this.selectionManager.moveSingle(0, 0.00001, false);
					}
				},
			});
			this.horizontalBar = makeScrollbar({
				height: "12px", bottom: "0px", right: "12px", left: "0px", class: [ "patternscroll", ], vertical: false, move: () => 0,
			});
			this.element.appendChild(this.verticalBar.element);
			this.element.appendChild(this.horizontalBar.element);
			this.element.appendChild(makeScrollbarCorner({
				height: "12px", bottom: "0px", width: "12px", right: "0px", class: [ "patternscroll", ],
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
		this.selectionManager.load();
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
	 * Various channel statistics
	 */
	public channelInfo!: PatternChannelInfo[];

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public reloadTheme(preload:boolean):Promise<void> {
		// tell the child to reload the theme
		this.eventManager.reloadTheme();
		this.selectionManager.reloadTheme();
		return this.scrollManager.reloadTheme(preload);
	}
}
