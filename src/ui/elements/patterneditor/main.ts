import { Channel } from "../../../api/driver";
import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { loadFlag } from "../../../api/files";
import { UIComponent, UIShortcutHandler } from "../../../api/ui";
import { Tab } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { PatternCanvas, RowsCanvas } from "./canvas wrappers";

export class PatternEditor implements UIComponent<HTMLDivElement>, UIShortcutHandler {
	// various standard elements for the pattern editor
	public element!: HTMLDivElement;
	private scrollwrapper!: HTMLDivElement;
	private focusBar!: HTMLDivElement;

	/**
	 * This is the tab that the pattern editor is working in
	 */
	public tab!:Tab;

	/**
	 * Initialize this PatternEditor instance
	 *
	 * @param tab The tab that this pattern editor is targeting
	 */
	constructor() {
		_edit = this;
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

			// load the theme before doing anything else
			this.canvas = [];
			this.rows = [];

			// load the row number generator function
			this.getRowNumber = loadFlag<boolean>("ROW_NUM_IN_HEX") ?? false;

			// load the row number generator function
			this.drawPatternPreview = loadFlag<boolean>("PATTERN_PREVIEW") ?? true;

			// load the row highlights
			this.rowHighlights = [ 256, 256, ];

			// add handler for vertical and horizontal scrolling
			this.scrollwrapper.addEventListener("wheel", (e) => {
				if(e.deltaX) {
					this.scrollHoriz(e.deltaX);
				}

				if(e.deltaY) {
					// there is vertical movement, call the special scroll handler
					this.scroll(e.deltaY);
				}
			}, { passive: false, });

			this.reloadTheme(true).then(() => {
				// return the main element
				res(this.element);

				requestAnimationFrame(() => {
					// create a timeout object. This allows us to defer updating scrolling until the user has reasonably stopped scrolling.
					let timeout:null|NodeJS.Timeout = null;

					// this makes so that when the width changes, not everything will be updated. This saves some cpu time
					let height = this.element.offsetHeight;

					// when window resizes, make sure to change scroll position as well
					window.addEventListener("resize", () => {
						// if there was a previous timeout, clear it
						if(timeout) {
							clearTimeout(timeout);
						}

						// create a new timeout in 50ms, to update scrolling size, reload canvases, and to call the scroll handler
						timeout = setTimeout(async() => {
							timeout = null;

							// ignore this all if tab was not loaded
							if(!this.tab) {
								return;
							}

							// update scrolling size
							this.updateScrollerSize();
							this.scrollHoriz(0);

							// check if height was changed at all
							if(this.element.offsetHeight === height) {
								return;
							}

							// update the scrolling region size
							height = this.element.offsetHeight;

							// reload the number of patterns that need to be visible
							await this.refreshPatternAmount(false);

							// call the special scroll handler, mainly to update the current position and to redraw canvases
							this.scroll(0);
						}, 50);
					});
				});
			}).catch(rej);
		});
	}

	// helper function for updating scrolling position and capping it
	private scroll(delta:number) {
		// update the scrolling position based on delta
		this.currentRow = Math.round((delta * 0.03) + this.currentRow);

		// check clamping scrolling position above 0th
		if(this.currentRow <= 0) {
			this.currentRow = 0;

		} else {
			// calculate the maximum scrolling position
			const max = (this.tab.matrix.matrixlen * (this.tab.module?.patternRows ?? 64)) - 1;

			// check clamping scrolling position below last
			if(this.currentRow > max) {
				this.currentRow = max;
			}
		}

		// go to handle scrolling, reloading, drawing, etc
		this.handleScrolling();
	}

	/**
	 * Function to load the component
	 */
	public load(pass:number): boolean|Promise<boolean> {
		// component loads in pass 2
		if(pass !== 2) {
			return pass < 2;
		}

		return new Promise((res, rej) => {
			// reset some variables
			this.currentRow = 0;

			// initialize the channel layout for this editor
			this.initChannels();

			requestAnimationFrame(() => {
				// initialize the scrolling region size
				this.updateScrollerSize();

				this.refreshPatternAmount(true).then(() => {
					// forcibly apply scrolling effects
					this.scroll(0);

					// no moar passes
					res(false);
				}).catch(rej);
			});
		});
	}

	/**
	 * Function to dispose of this component
	 */
	public unload(): boolean {
		// back-up canvases and rows, then reset the arrays
		const c = this.canvas, r = this.rows;
		this.canvas = []; this.rows = [];

		// dispose all workers
		c?.forEach((w) => w.dispose());
		r?.forEach((w) => w.dispose());
		return false;
	}

	/**
	 * This defines which horizontal scroll position of channels and canvases
	 */
	public horizScroll = 0;

	/**
	 * Handle horizontal scrolling for the scroll wrapper
	 *
	 * @param amount The scrolling amount
	 */
	private scrollHoriz(amount:number) {
		// calculate the new scrolling position
		const p = Math.max(0, Math.min(this.horizScroll + amount, this.renderAreaWidth - this.scrollWidth));

		// check if the scrolling was actually allowed to move
		if(p !== this.horizScroll) {
			this.horizScroll = p;

			// tell each canvas to update left offset
			this.canvas.forEach((c) => c.updateHoriz(this));

			// update every channel header too, to change their translateX values
			for(let i = this.tab.channels.length;i > 0;--i){
				(this.scrollwrapper.children[i] as HTMLDivElement)
					.style.transform = "translateX(-"+ this.horizScroll +"px)";
			}
		}
	}

	/**
	 * The scrolling offset for the current row
	 */
	private scrollMiddle!:number;

	/**
	 * Function to update scrolling area size into memory
	 */
	private updateScrollerSize() {
		// initialize scrolling size
		const bounds = this.scrollwrapper.getBoundingClientRect();
		this.scrollHeight = bounds.height - 30;
		this.scrollWidth = bounds.width + 5;

		// calculate the number of rows visible on half screen at once
		this.scrollMiddle = 30 + (Math.floor(this.scrollHeight / this.dataHeight / 2.5) * this.dataHeight);

		// update highlight to be at this location too
		this.focusBar.style.top = this.scrollMiddle +"px";
	}

	/**
	 * The row highlight numbers for this pattern editor
	 */
	public rowHighlights!: [ number, number ];

	/**
	 * Function to update the row highlights
	 *
	 * @param id The highlight ID to change
	 * @param rows The number to set it to
	 */
	public changeHighlight(id:number, rows:number): void {
		this.rowHighlights[id] = rows;

		// update focus row settings for the current row
		this.updateFocusRowData();

		// tell canvases to update highlights
		this.canvas.forEach((c) => c.updateHighlights());
		this.rows.forEach((c) => c.updateHighlights());

		// force canvases to redraw
		this.canvas.forEach((c) => c.invalidateAll());
		this.rows.forEach((c) => c.render());
		this.handleScrolling();
	}

	/**
	 * Whether to draw pattern previews at all
	 */
	private drawPatternPreview!: boolean;

	/**
	 * The row number setting. This will be used to generata function for converting row numbers
	 */
	public getRowNumber!: boolean;

	/**
	 * The number of pixels for the height of each data element
	 */
	public dataHeight = 25;

	/**
	 * Store the vertical scroll position of channel datas
	 */
	private currentRow = 0;

	/**
	 * The height of the scrolling region
	 */
	private scrollHeight!: number;

	/**
	 * The width of the scrolling region
	 */
	private scrollWidth!: number;

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
		this.channelElements = [];

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
		for(let i = this.tab.channels.length;i > 0; --i){
			const chan = this.scrollwrapper.children[i] as HTMLDivElement;
			const drag = chan.children[0].children[1] as HTMLDivElement;

			let pos = -1, lastsize = -1, left = 0;

			// initialize header size
			this.setChannelHeaderSize(this.tab.channels[i - 1]?.info.effects ?? 0, i - 1, this.tab.channels[i - 1].muted, chan);

			// enable mouse down detection
			drag.onpointerdown = (e) => {
				// lock the pointer in-place so it works as expected
				drag.requestPointerLock();

				// reset the channel header position and mouse position
				left = chan.getBoundingClientRect().x;
				pos = e.x;

				// load the channel commands count for scrolling
				lastsize = this.tab.channels[i - 1]?.info.effects ?? 0;

				// enable mouse button and movement detection
				drag.onmousemove = move;
				drag.onpointerup = up;
			}

			// handler for mouse movement
			const move = (e:MouseEvent) => {
				// fetch channel size
				pos += e.movementX;
				const sz = this.getClosestChannelSize(pos - left);

				if(this.tab.channels[i - 1].info.effects !== sz) {
					// update channel header size
					this.setChannelHeaderSize(sz, i - 1, this.tab.channels[i - 1].muted, chan);

					// update worker with data
					this.refreshChannelWidth();

					// scroll to follow cursor and update size
					this.scrollHoriz((sz - lastsize) * 38);
					lastsize = sz;

					// invalidate and clear all canvas rows
					this.canvas.forEach((c) => {
						c.invalidateAll();
						c.fillVoid();
					});

					// re-render all visible rows
					this.handleScrolling();
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
				this.scrollHoriz(0);
			}

			// handler for mouse clicks on the main channel itself
			chan.onclick = async(e) => {
				// check if this was a right click
				if(e.button !== 0) {
					return;
				}

				// fetch the channel to effect
				const ch = this.tab.channels[i - 1];

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
		requestAnimationFrame(() => this.refreshChannelWidth());
	}

	/**
	 * The amount of elements per channel for each channel
	 */
	public channelElements!:number[];

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
		this.channelElements[channel] = [ 3, 5, 7, 9, 11, 13, 15, 17, 19, ][width];

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
	 * This is a list of all the channel x-positions from left. This helps canvases get lined up and with scrolling.
	 */
	public channelPositionsLeft!: number[];

	/**
	 * This is a list of all the channel x-positions from right. This helps canvases get lined up.
	 */
	public channelPositionsRight!: number[];

	/**
	 * This is the total width of the render area
	 */
	public renderAreaWidth!: number;

	/**
	 * This is the actual width of each canvas in pixels
	 */
	public canvasWidth = 6000;

	/**
	 * Helper function to update channel widths into position buffers
	 */
	private refreshChannelWidth() {
		// initialize channel position arrays
		this.channelPositionsLeft = [];
		this.channelPositionsRight = [];
		let pos = 0;

		// update every channel header too, to change their translateX values
		for(let i = 1;i <= this.tab.channels.length;i++){
			// update channel positions
			this.channelPositionsLeft.push(pos);
			pos += (this.scrollwrapper.children[i] as HTMLDivElement).offsetWidth;
			this.channelPositionsRight.push(pos - 4);
		}

		// save the total width of the render area
		this.renderAreaWidth = pos + 35;

		// update highlight to be at this location too
		this.focusBar.style.maxWidth = (this.renderAreaWidth - 4) +"px";

		// inform canvases it has maybe changed
		this.canvas.forEach((c) => c.updateChannelWidths());
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

	private derp = false;

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[], e:KeyboardEvent|undefined, state:boolean|undefined):Promise<boolean> {
		if(document.querySelector(":focus") === this.element) {
			// has focus, process the shortcut
			switch(data.shift()) {
				case "null": {
					if(this.derp) {
						return false;
					}

					this.derp = true;
					this.currentRow = 0;

					const i = setInterval(() => {
						this.handleScrolling();
						this.currentRow ++;

						if(this.currentRow >= this.tab.matrix.matrixlen * (this.tab.module?.patternRows ?? 64)) {
							this.derp = false;
							clearInterval(i);
						}
					}, 32);
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
		// update canvas record state
		this.rows.forEach((c) => c.setRecord());

		this.canvas.forEach((c) => {
			// set record status and reset the clear status. This makes sure the background is rendered
			c.setRecord();
			c.fillVoid();
			c.isClear = false;
		});

		// update backdrop color
		this.scrollwrapper.style.backgroundColor = this.backdropColors[this.tab.recordMode ? 1 : 0];

		// reload graphics
		this.handleScrolling();

		// make sure the focus row gets updated
		this.updateFocusRowData();
	}

	/**
	 * Store pattern size of each pattern
	 */
	private patternLen = 64;

	/**
	 * Pseudo-variable that is the current active pattern
	 */
	private get activePattern() {
		return Math.floor(this.currentRow / this.patternLen);
	}

	/**
	 * Function to update the pattern editor with the new number of rows per pattern.
	 *
	 * @param rows The number of rows to update to
	 */
	public async setPatternRows(rows:number): Promise<void> {
		// prepare some variables
		const pat = this.activePattern, offs = this.currentRow % this.patternLen;
		this.patternLen = rows;

		// reload the number of patterns that need to be visible
		await this.refreshPatternAmount(true);

		// scroll to a different row based on the new size
		this.currentRow = (pat * rows) + Math.min(offs, rows - 1);

		// go to handle scrolling, reloading, drawing, etc
		this.handleScrolling();
	}

	/**
	 * Helper function that updates the list of pattern canvases.
	 *
	 * @param force If set, the update is forced regardless if amounts match
	 */
	private async refreshPatternAmount(force:boolean) {
		const patternRows = this.patternLen;

		// calculate the amount of canvases needed to display everything
		const amount = !this.drawPatternPreview ? 0 :
			Math.ceil(((this.scrollHeight / this.dataHeight) + (this.visibleSafeHeight * 2)) / patternRows);

		if(force || (this.canvas?.length - 1) !== amount) {
			// remove old canvases so everything can be updated
			this.unload();

			// generate each canvas
			for(let c = 0;c <= amount; c++) {
				// generate the canvas class itself
				const x = new PatternCanvas(this.dataHeight * patternRows, this, patternRows, this.tab.channels.length);

				// update horizontal scrolling of the canvas
				x.updateHoriz(this);

				// add this canvas to the DOM
				this.scrollwrapper.appendChild(x.element);
				this.canvas.push(x);

				// tell to update canvas widths
				x.updateChannelWidths();

				// force update canvas theme
				await x.reloadTheme();

				// clear the canvas void
				x.fillVoid();

				// generate the rows as well (we need the same number of row canvases)
				const rows = this.patternLen;
				const y = new RowsCanvas(this.dataHeight * rows, this, rows, this.getRowNumber, c === 0);

				// add this canvas to the DOM
				this.scrollwrapper.appendChild(y.element);
				this.rows.push(y);

				// force update canvas theme
				await y.reloadTheme();

				// reload graphics
				y.render();
			}
		}
	}

	/**
	 * Container for each loaded canvas
	 */
	private canvas!: PatternCanvas[];

	/**
	 * Container for each loaded canvas
	 */
	private rows!: RowsCanvas[];

	/**
	 * Handle scrolling. This updates each canvas position, graphics, active canvas, etc
	 */
	private handleScrolling() {
		// load the range of patterns that are visible currently
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();
		const patternRows = this.patternLen;

		// calculate which pattern is currently active
		const pat = Math.max(0, Math.min(this.tab.matrix.matrixlen - 1, this.activePattern));

		if(!this.drawPatternPreview) {
			// draw only a single pattern!!
			if(this.canvas[0].pattern !== pat) {
				this.canvas[0].pattern = pat;
				this.canvas[0].active = true;

				// invalidate every row in pattern
				this.canvas[0].invalidateAll();
			}

			// update canvas y-position
			const offsetTop = ((pat * patternRows) - this.currentRow);

			// request to render every visible row in this pattern
			this.canvas[0].renderPattern(Math.max(0, -Math.ceil(this.scrollMiddle / this.dataHeight) - this.visibleSafeHeight - offsetTop),
				Math.min(patternRows, Math.ceil((this.scrollHeight - this.scrollMiddle) / this.dataHeight) + this.visibleSafeHeight - offsetTop));

			// update element position
			this.rows[0].element.style.top = this.canvas[0].element.style.top = ((offsetTop * this.dataHeight) + this.scrollMiddle) +"px";
			return;
		}

		// position all row elements
		const rowoff = Math.ceil(((this.scrollMiddle / this.dataHeight) -
			(this.currentRow % patternRows)) / patternRows);

		for(let r = 0;r < this.rows.length;r ++) {
			const cr = this.rows[(this.rows.length + r - rowoff) % this.rows.length];

			// calculate target pattern
			const ppos = r - rowoff + pat;

			if(ppos < 0 || ppos >= this.tab.matrix.matrixlen) {
				// hide row if out of bounds
				cr.element.style.top = "-10000px";
				continue;
			}

			// calculate row y-position
			const top = ((((ppos * patternRows) - this.currentRow) * this.dataHeight) + this.scrollMiddle) +"px";

			// update row position
			cr.element.style.top = top;
		}

		// run for each visible patterns
		for(let r = rangeMin;r <= rangeMax; r++) {
			// load the canvas that represents this pattern
			const cv = this.canvas[(this.canvas.length + r) % this.canvas.length];

			// calculate canvas y-position
			const offsetTop = ((r * patternRows) - this.currentRow);
			const top = ((offsetTop * this.dataHeight) + this.scrollMiddle) +"px";

			// invalidate layout if it is not the same pattern or active status doesn't match
			if(cv.pattern !== r || (r === pat) !== cv.active) {
				// update pattern status
				cv.active = r === pat;
				cv.pattern = r;

				// invalidate every row in pattern
				cv.invalidateAll();
			}


			// check if this pattern is visible
			if(r >= 0 && r < this.tab.matrix.matrixlen) {
				// if yes, request to render every visible row in this pattern
				cv.renderPattern(Math.max(0, -Math.ceil(this.scrollMiddle / this.dataHeight) - this.visibleSafeHeight - offsetTop),
					Math.min(patternRows, Math.ceil((this.scrollHeight - this.scrollMiddle) / this.dataHeight) + this.visibleSafeHeight - offsetTop));


			} else if(!cv.isClear){
				// clear the pattern if neither visible nor cleared
				cv.clear();
			}

			// update canvas position
			cv.element.style.top = top;
		}

		// update focus row settings for the current row
		this.updateFocusRowData();
	}

	/**
	 * How many rows that can be hidden, but will still make the visible range larger.
	 * This is used so that the user doesn't see the pattern rows drawing.
	 */
	private visibleSafeHeight = 7;

	/**
	 * Helper function to get the visible range of patterns
	 */
	private getVisibleRange() {
		const scroll = this.scrollHeight / this.dataHeight / 2;

		return [
			// load the start point of the range
			Math.floor((this.currentRow - this.visibleSafeHeight - scroll) / this.patternLen),

			// load the end point of the range
			Math.floor((this.currentRow + this.visibleSafeHeight + scroll) / this.patternLen),
		];
	}

	/**
	 * The colors for the backdrop of the scrollWrapper
	 */
	private backdropColors!: [ string, string, ];

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public async reloadTheme(preload:boolean):Promise<void> {
		// request every canvas to reload theme
		const promises = [ ...this.canvas, ...this.rows, ].map((c) => c.reloadTheme());

		// meanwhile, load some variables
		this.dataHeight = theme?.pattern?.worker?.params?.rowHeight ?? 25;

		// load the tables for backdrop colors
		this.backdropColors = [
			theme?.pattern?.worker?.params?.backdrop ?? "#000",
			theme?.pattern?.worker?.params?.recordbackdrop ?? "#000",
		];

		// update backdrop color
		this.scrollwrapper.style.backgroundColor = this.backdropColors[this.tab?.recordMode ? 1 : 0];

		// load the tables handling the focus bar colors
		this.focusBarColorNormal = [
			...theme?.pattern?.main?.focus?.color ?? [ "#000", "#000", "#000", ],
			...theme?.pattern?.main?.focus?.recordcolor ?? [ "#000", "#000", "#000", ],
		];

		this.focusBarBlendNormal = [
			...theme?.pattern?.main?.focus?.blend ?? [ "", "", "", ],
			...theme?.pattern?.main?.focus?.recordblend ?? [ "", "", "", ],
		];

		// update elements that use the row height directly
		this.focusBar.style.height = this.dataHeight +"px";

		if(!preload) {
			// wait for them to finish
			await Promise.all(promises);

			// handle scrolling
			this.handleScrolling();

			// reload row graphics
			this.rows.forEach((r) => r.render());
		}
	}

	/**
	 * The color and blend mode settings for the focus bar
	 */
	private focusBarColorNormal!: [ string, string, string,  string, string, string, ];
	private focusBarBlendNormal!: [ string, string, string,  string, string, string, ];

	/**
	 * Helper function to update focus row details
	 */
	private updateFocusRowData() {
		// calculate the current highlight ID
		const row = this.currentRow % this.patternLen;
		const hid = (this.tab.recordMode ? 3 : 0) + ((row % this.rowHighlights[0]) === 0 ? 2 : (row % this.rowHighlights[1]) === 0 ? 1 : 0);

		// update background color and blend mode for this row
		this.focusBar.style.backgroundColor = this.focusBarColorNormal[hid];
		// @ts-expect-error This property does exist, but TypeScript doesn't recognize it
		this.focusBar.style.mixBlendMode = this.focusBarBlendNormal[hid];
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
