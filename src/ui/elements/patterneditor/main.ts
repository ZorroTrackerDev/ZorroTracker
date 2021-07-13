import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { loadFlag } from "../../../api/files";
import { PatternIndex } from "../../../api/matrix";
import { UIElement } from "../../../api/ui";
import { theme } from "../../misc/theme";

export class PatternEditor implements UIElement {
	// various standard elements for the pattern editor
	public element!: HTMLElement;
	private scrollwrapper!: HTMLDivElement;
	private highlight!: HTMLDivElement;

	/**
	 * The pattern index this editor is apart of
	 */
	private index: PatternIndex;

	/**
	 * Initialize this PatternEditor instance
	 *
	 * @param index The Matrix this PatternEditor is targeting
	 */
	constructor(index:PatternIndex) {
		_edit = this;
		this.index = index;
		this.setLayout().catch(console.error);
	}

	/**
	 * Helper function to initialize the layout for the pattern editor
	 */
	private async setLayout() {
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

		// initialize the highlight element
		this.highlight = document.createElement("div");
		this.highlight.classList.add("highlight");
		wrap.appendChild(this.highlight);

		// load the theme before doing anything else
		this.canvas = [];
		await this.reloadTheme(true);

		// initialize the channel layout for this editor
		this.initChannels();

		// load the row number generator function
		this.getRowNumber = loadFlag<boolean>("ROW_NUM_IN_HEX") ?? false;

		// load the row number generator function
		this.drawPatternPreview = loadFlag<boolean>("PATTERN_PREVIEW") ?? true;

		// load the row highlights
		this.rowHighlights = [
			loadFlag<number>("HIGHLIGHT_B_DEFAULT") ?? 16,
			loadFlag<number>("HIGHLIGHT_A_DEFAULT") ?? 4,
		];

		requestAnimationFrame(async() => {
			// initialize the scrolling region size
			this.updateScrollerSize();

			// reload the number of patterns that need to be visible
			await this.refreshPatternAmount();

			// helper function for updating scrolling position and capping it
			const scroll = (delta:number) => {
				// update the scrolling position based on delta
				this.currentRow = Math.round((delta * 0.03) + this.currentRow);

				// check clamping scrolling position above 0th
				if(this.currentRow <= 0) {
					this.currentRow = 0;

				} else {
					// calculate the maximum scrolling position
					const max = (this.index.matrixlen * this.index.patternlen) - 1;

					// check clamping scrolling position below last
					if(this.currentRow > max) {
						this.currentRow = max;
					}
				}

				// go to handle scrolling, reloading, drawing, etc
				this.handleScrolling();
			}

			// add handler for vertical and horizontal scrolling
			this.scrollwrapper.addEventListener("wheel", (e) => {
				if(e.deltaX) {
					this.scrollHoriz(e.deltaX);
				}

				if(e.deltaY) {
					// there is vertical movement, call the special scroll handler
					scroll(e.deltaY);
				}
			}, { passive: false, });

			// create a timeout object. This allows us to defer updating scrolling until the user has reasonably stopped scrolling.
			let timeout:null|NodeJS.Timeout = null;

			// when window resizes, make sure to change scroll position as well
			window.addEventListener("resize", () => {
				// if there was a previous timeout, clear it
				if(timeout) {
					clearTimeout(timeout);
				}

				// create a new timeout in 50ms, to update scrolling size, reload canvases, and to call the scroll handler
				timeout = setTimeout(async() => {
					timeout = null;

					// update the scrolling region size
					this.updateScrollerSize();

					// reload the number of patterns that need to be visible
					await this.refreshPatternAmount();

					// call the special scroll handler, mainly to update the current position and to redraw canvases
					scroll(0);
				}, 50);
			});

			// initially handle scrolling, reloading, drawing, etc
			this.handleScrolling();
		});
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
			for(let i = this.index.channels.length;i >= 0;--i){
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
		this.highlight.style.top = this.scrollMiddle +"px";
	}

	/**
	 * The row highlight numbers for this pattern editor
	 */
	public rowHighlights!:[ number, number ];

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
	public dataHeight = 19;

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
						<div class="channeldragarea"></div>
					</div>
				</div>
			`.replace(/[\t|\r|\n]+/g, "");
		};

		// create the row index column
		this.scrollwrapper.innerHTML = doChannel("\u200B");

		// handle DOM generation for each channel and save it to scrollwrapper
		this.scrollwrapper.innerHTML += this.index.channels.map((c) => {
			// generate DOM for a single channel
			return doChannel(c.name);
		}).join("");

		// enable resize handlers and init styles
		for(let i = this.index.channels.length;i > 0; --i){
			const chan = this.scrollwrapper.children[i] as HTMLDivElement;
			const drag = chan.children[0].children[1] as HTMLDivElement;
			let pointer = -1;

			// initialize header size
			this.setChannelHeaderSize(this.index.channels[i - 1]?.commands ?? 0, i - 1, chan);

			// enable mouse down detection
			drag.onpointerdown = (e) => {
				drag.setPointerCapture(pointer = e.pointerId);
				drag.onpointermove = move;

				// enable mouse up detection
				drag.onpointerup = up;
				window.addEventListener("mouseup", up);
			}

			// handler for mouse movement
			const move = (e:MouseEvent) => {
				// fetch channel size
				const sz = this.getClosestChannelSize(e.x - chan.getBoundingClientRect().x);

				if(this.index.channels[i - 1].commands !== sz) {
					// update channel header
					this.setChannelHeaderSize(sz, i - 1, chan);

					// update worker with data
					this.refreshChannelWidth();

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
			const up = (e:MouseEvent|PointerEvent) => {
				// @ts-expect-error
				drag.releasePointerCapture(e.pointerId ?? pointer);
				window.removeEventListener("mouseup", up);
				document.body.setAttribute("style", "");

				// fix horizontal scrolling
				this.scrollHoriz(0);
			}
		}

		// also refresh channel widths
		this.refreshChannelWidth();
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
	private setChannelHeaderSize(width:number, channel:number, element:HTMLDivElement) {
		// update commands amount
		this.index.channels[channel].commands = width;
		this.channelElements[channel] = [ 3, 5, 7, 9, 11, 13, 15, 17, 19, ][width];

		// update header element width and classes
		element.style.width = this.channelWidths[width] +"px";

		// @ts-expect-error This works you silly butt
		element.classList = "channelwrapper"+ (width === 1 ? " dragright" : width === 8 ? " dragleft" : "");
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
		for(let i = 0;i <= this.index.channels.length;i++){
			// update channel positions
			this.channelPositionsLeft.push(pos);
			pos += (this.scrollwrapper.children[i] as HTMLDivElement).offsetWidth;
			this.channelPositionsRight.push(pos - 4);
		}

		// save the total width of the render area
		this.renderAreaWidth = pos;

		// update highlight to be at this location too
		this.highlight.style.maxWidth = (this.renderAreaWidth - 4) +"px";

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

						if(this.currentRow >= this.index.matrixlen * this.index.patternlen) {
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

	private derp = false;

	/**
	 * Helper function that updates the list of pattern canvases.
	 */
	private async refreshPatternAmount() {
		// calculate the amount of canvases needed to display everything
		const amount = !this.drawPatternPreview ? 0 :
			Math.ceil(((this.scrollHeight / this.dataHeight) + (this.visibleSafeHeight * 2)) / this.index.patternlen);

		if((this.canvas?.length - 1) !== amount) {
			// remove old canvases so everything can be updated
			this.canvas?.forEach((c) => c.dispose());

			// clear the canvas list
			this.canvas = [];

			// generate each canvas
			for(let c = 0;c <= amount; c++) {
				// generate the canvas class itself
				const x = new PatternCanvas(this.renderAreaWidth, this.dataHeight * this.index.patternlen, this,
					this.index.patternlen, this.index.channels.length);

				// update horizontal scrolling of the canvas
				x.updateHoriz(this);

				// add this canvas to the DOM
				this.scrollwrapper.appendChild(x.element);
				this.canvas.push(x);

				// tell to update canvas widths
				x.updateChannelWidths();

				// force update canvas theme
				await x.reloadTheme();
			}
		}
	}

	/**
	 * Container for each loaded canvas
	 */
	private canvas!: PatternCanvas[];

	/**
	 * Handle scrolling. This updates each canvas position, graphics, active canvas, etc
	 */
	private handleScrolling() {
		// load the range of patterns that are visible currently
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();

		// calculate which pattern is currently active
		const pat = Math.max(0, Math.min(this.index.matrixlen - 1, Math.floor(this.currentRow / this.index.patternlen)));

		if(!this.drawPatternPreview) {
			// draw only a single pattern!!
			if(this.canvas[0].pattern !== pat) {
				this.canvas[0].pattern = pat;
				this.canvas[0].active = true;

				// invalidate every row in pattern
				this.canvas[0].invalidateAll();
			}

			// update canvas y-position
			const offsetTop = ((pat * this.index.patternlen) - this.currentRow);

			// request to render every visible row in this pattern
			this.canvas[0].renderPattern(Math.max(0, -Math.ceil(this.scrollMiddle / this.dataHeight) - this.visibleSafeHeight - offsetTop),
				Math.min(this.index.patternlen,
					Math.ceil((this.scrollHeight - this.scrollMiddle) / this.dataHeight) + this.visibleSafeHeight - offsetTop));

			// update element position
			this.canvas[0].element.style.top = ((offsetTop * this.dataHeight) + this.scrollMiddle) +"px";
			return;
		}

		// run for each visible patterns
		for(let r = rangeMin;r <= rangeMax; r++) {
			// load the canvas that represents this pattern
			const cv = this.canvas[(this.canvas.length + r) % this.canvas.length];

			// update canvas y-position
			const offsetTop = ((r * this.index.patternlen) - this.currentRow);

			// invalidate layout if it is not the same pattern or active status doesn't match
			if(cv.pattern !== r || (r === pat) !== cv.active) {
				// update pattern status
				cv.active = r === pat;
				cv.pattern = r;

				// invalidate every row in pattern
				cv.invalidateAll();
			}

			// check if this pattern is visible
			if(r >= 0 && r < this.index.matrixlen) {
				// if yes, request to render every visible row in this pattern
				cv.renderPattern(Math.max(0, -Math.ceil(this.scrollMiddle / this.dataHeight) - this.visibleSafeHeight - offsetTop),
					Math.min(this.index.patternlen,
						Math.ceil((this.scrollHeight - this.scrollMiddle) / this.dataHeight) + this.visibleSafeHeight - offsetTop));

			} else if(!cv.isClear){
				// clear the pattern if neither visible nor cleared
				cv.clear();
			}

			// update element position
			cv.element.style.top = ((offsetTop * this.dataHeight) + this.scrollMiddle) +"px";
		}
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
			Math.floor((this.currentRow - this.visibleSafeHeight - scroll) / this.index.patternlen),

			// load the end point of the range
			Math.floor((this.currentRow + this.visibleSafeHeight + scroll) / this.index.patternlen),
		];
	}

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public async reloadTheme(preload:boolean):Promise<void> {
		// request every canvas to reload theme
		const promises = this.canvas.map((c) => c.reloadTheme());

		if(!preload) {
			// wait for them to finish
			await Promise.all(promises);

			// handle scrolling
			this.handleScrolling();
		}
	}
}

/**
 * Helper class for each pattern canvas
 */
class PatternCanvas {
	// the canvas element itself for this canvas
	public element:HTMLCanvasElement;

	// the parent of this element
	public parent:PatternEditor;

	// the worker for this canvas
	public worker:Worker;

	/**
	 * Initialize this PatternCanvas and store some data passed.
	 *
	 * @param width The width of the entire canvas in pixels
	 * @param height The height of the entire canvas in pixels
	 * @param patternlen The number of rows per pattern
	 * @param channels The number of channels in the project
	 */
	constructor(width:number, height:number, parent:PatternEditor, patternlen:number, channels:number) {
		// create the main canvas and update its size
		this.element = document.createElement("canvas");
		this.element.width = parent.canvasWidth;
		this.element.height = height;

		// hide the canvas for now and give its class
		this.element.style.top = "-10000px";
		this.element.classList.add("patterncanvas");

		// initialize the offscreen canvas worker
		this.worker = new Worker("../elements/patterneditor/default.worker.js");
		const offscreen = this.element.transferControlToOffscreen();
		this.worker.postMessage({ command: "init", data: { width, height, canvas: offscreen, }, }, [ offscreen, ]);

		// store internal variables
		this.patternlen = patternlen;
		this.parent = parent;

		// update a few variables to the worker
		this.worker.postMessage({ command: "vars", data: {
			channels, patternlen, dataHeight: parent.dataHeight, getRowNumber: parent.getRowNumber,
		}, });

		// update highlight data to the worker
		this.worker.postMessage({ command: "highlight", data: { values: parent.rowHighlights, }, });

		// set internal variables to default values
		this.pattern = -1;
		this.active = false;

		// clear the canvas content
		this.clear();
	}

	/**
	 * Clear all the resources this PatternCanvas uses
	 */
	public dispose() {
		// remove the canvas from DOM
		this.element.parentElement?.removeChild(this.element);

		// tell the worker to close
		this.worker.terminate();
	}

	/**
	 * Helper function to update channel widths for the canvas
	 */
	public updateChannelWidths() {
		// update positional data to the worker
		this.worker.postMessage({ command: "posi", data: {
			right: this.parent.channelPositionsRight, left: this.parent.channelPositionsLeft,
			elements: this.parent.channelElements,
			width: this.parent.renderAreaWidth,
		}, });
	}

	/**
	 * The current pattern that this canvas is showing
	 */
	public pattern:number;

	/**
	 * Whether this is the active canvas
	 */
	public active:boolean;

	/**
	 * Whether this canvas is fully cleared (black)
	 */
	public isClear!:boolean;

	/**
	 * The length of the pattern this is showing
	 */
	private patternlen:number;

	/**
	 * Update horizontal scrolling of canvas
	 */
	public updateHoriz(parent:PatternEditor) {
		this.element.style.left = -parent.horizScroll +"px";
	}

	/**
	 * Helper command to fill the void left after channel data. This is useful for resizing channels
	 */
	public fillVoid() {
		this.worker.postMessage({ command: "fillvoid", data: {}, });
	}

	/**
	 * Function to fill the canvas with black and invalidate all rows
	 */
	public clear() {
		// send the clear command
		this.worker.postMessage({ command: "clear", data: {}, });

		// set as cleared and invalidate the entire canvas
		this.isClear = true;
		this.invalidateAll();
	}

	/**
	 * Function to invalidate every row of the canvas
	 */
	public invalidateAll() {
		this.invalidateRange(0, this.patternlen);
	}

	/**
	 * Invalidate a range of rows in the canvas
	 *
	 * @param start The start of the range to invalidate
	 * @param end The end of the range to invalidate
	 */
	public invalidateRange(start:number, end:number) {
		// send the invalidate command
		this.worker.postMessage({ command: "invalidate", data: { start, end, }, });
	}

	/**
	 * Function to render part of the pattern if not rendered
	 *
	 * @param start The start of the range of rows to render
	 * @param end The end of the range of rows to render
	 */
	public renderPattern(start:number, end:number) {
		// set the canvas as not cleared
		this.isClear = false;

		// send the command to render row
		this.worker.postMessage({ command: "renderrange", data: { start, end, active: this.active, }, });
	}

	/**
	 * Helper function to tell the worker to reload the theme
	 */
	public reloadTheme(): Promise<void> {
		// tell the worker tro reload the theme
		this.worker.postMessage({ command: "theme", data: theme?.pattern?.worker ?? {}, });

		return new Promise((res, rej) => {
			// handle incoming messages
			const msg = (e:MessageEvent) => {
				if(e.data === "theme") {
					// right message, resolve
					res();
					this.worker.removeEventListener("message", msg);
				}
			};

			// listen to messages
			this.worker.addEventListener("message", msg);

			// if worker does not respond in 1 second, bail
			setTimeout(() => {
				this.worker.removeEventListener("message", msg);
				rej("Did not get a response from worker");
			}, 1000);
		});
	}
}

let _edit:PatternEditor|undefined;

// listen to theme reloading
ZorroEvent.addListener(ZorroEventEnum.LoadTheme, async() => {
	if(_edit) {
		await _edit.reloadTheme(false);
	}
});
