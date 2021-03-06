import { FeatureFlag } from "../../../api/driver";
import { loadFlag } from "../../../api/files";
import { theme } from "../../misc/theme";
import { PatternCanvas, RowsCanvas } from "./canvas wrappers";
import { PatternEditor } from "./main";
import { SingleSelection } from "./selection manager";

/**
 * Helper class to deal with scrolling in the `PatternEditor`. Thgis is to make the main class have less to deal with.
 */
export class PatternEditorScrollManager {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;

		// reset canvases and rows
		this.canvas = [];
		this.rows = [];

		// load the row number generator function
		this.getRowNumber = loadFlag<boolean>("ROW_NUM_IN_HEX") ?? false;

		// load the row number generator function
		this.drawPatternPreview = loadFlag<boolean>("PATTERN_PREVIEW") ?? true;

		// load the row highlights
		this.rowHighlights = [ 256, 256, ];
	}

	/**
	 * Function to initialize this manager instance. This should be called after the parent is initialized.
	 */
	public init():void {
		// add handler for vertical and horizontal scrolling
		this.parent.scrollwrapper.addEventListener("wheel", async(e) => {
			if(e.deltaX) {
				// there is horizontal movement, call the special scroll handler
				await this.parent.selectionManager.moveSingle(Math.round(e.deltaX * 0.03), 0, false);
			}

			if(e.deltaY && !this.parent.tab.blockMovement) {
				// there is vertical movement, call the special scroll handler
				await this.parent.selectionManager.moveSingle(0, Math.round(e.deltaY * 0.03), false);
			}
		}, { passive: false, });

		// update scrollbars
		this.parent.horizontalBar.setMultiplier(5);
		this.parent.verticalBar.setMultiplier(5);

		// create a timeout object. This allows us to defer updating scrolling until the user has reasonably stopped scrolling.
		let timeout:null|NodeJS.Timeout = null;

		// this makes so that when the width changes, not everything will be updated. This saves some cpu time
		let height = this.parent.element.offsetHeight;

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
				if(!this.parent.tab) {
					return;
				}

				// update horizontal scrolling and visible channels
				this.updateScrollerSize();
				await this.horizontalScroll(0, false);

				if(this.updateVisibleChannels()) {
					// if visible channels changed, then we must also re-render
					this.doGraphicsLater();
				}

				// check if height was changed at all
				if(this.parent.element.offsetHeight === height) {
					return;
				}

				// update the scrolling region size
				height = this.parent.element.offsetHeight;

				// call the special scroll handler, mainly to update the current position and to redraw canvases
				await this.verticalScroll(0);
			}, 50);
		});
	}

	/**
	 * Function to load the scroll manager
	 */
	public load(): Promise<boolean> {
		return new Promise((res, rej) => {
			// reset some variables
			this.parent.tab.activeRow = 0;

			requestAnimationFrame(() => {
				// initialize the scrolling region size
				this.updateScrollerSize();

				// update scrollbars
				this.parent.verticalBar.setValues(this.parent.patternLen);

				this.refreshPatternAmount().then(async() => {
					// set all patterns to invalid again to force data reload
					this.canvas.forEach((c) => c.pattern = -1);

					// forcibly apply scrolling effects
					await this.verticalScroll(0);
					await this.horizontalScroll(0, false);

					// no moar passes
					res(false);
				}).catch(rej);
			});
		});
	}

	/**
	 * Function to unload the scroll manager
	 */
	public unload():void {
		// back-up canvases and rows, then reset the arrays
		const c = this.canvas, r = this.rows;
		this.canvas = []; this.rows = [];

		// dispose all workers
		c?.forEach((w) => w.dispose());
		r?.forEach((w) => w.dispose());
	}

	/**
	 * Helper function to ensure the channel is visible.
	 *
	 * @param channel1 The first channel to make visible
	 * @param channel2 The second channel to make visible
	 */
	public async ensureVisibleChannel(channel1:number, channel2:number): Promise<void> {
		// calculate the boundaries of the visibility check
		const left = Math.min(channel1, channel2), right = Math.max(channel1, channel2);
		/* ignore top/bottom for now! :( const bottom = Math.max(row1, row2), top = Math.min(row1, row2);*/

		// get the real area
		const lp = Math.max(0, this.parent.channelInfo[left].left - this.parent.padding.left);
		const rp = Math.min(this.renderAreaWidth, this.parent.channelInfo[right].right + this.parent.padding.left);

		// back-up the old scrolling
		const old = this.horizChannel, opos = this.parent.channelInfo[this.horizChannel].left;

		// check if the horizontal scrolling is too far left
		if(opos > lp) {
			// if so, clamp the position immediately
			this.horizChannel = left;

		// check if the horizontal scrolling is too far right
		} else if(opos + this.scrollWidth - this.parent.padding.right <= rp) {
			// if so, shift channels until fully visible
			let test;
			do {
				this.horizChannel++;
				test = this.parent.channelInfo[this.horizChannel].left;

			} while(test + this.scrollWidth - this.parent.padding.right <= rp);
		}

		if(this.horizChannel !== old) {
			// force-update scrolling related info.
			await this.horizontalScroll(0, true);
		}
	}

	/**
	 * Helper function to scroll to vertical row based on selection
	 *
	 * @param select The selection to use for the basis of scrolling
	 */
	public scrollToSelection(select:SingleSelection): Promise<void> {
		return this.scrollToRow((select.pattern * this.parent.patternLen) + select.row);
	}

	/**
	 * Helper function to scroll to vertical row
	 *
	 * @param row The row to scroll to
	 */
	public scrollToRow(row:number): Promise<void> {
		this.parent.tab.activeRow = row;
		return this.verticalScroll(0);
	}

	/**
	 * The height of the scrolling region
	 */
	private scrollHeight!: number;

	/**
	 * The width of the scrolling region
	 */
	public scrollWidth = 0;

	/**
	 * Helper function for updating scrolling position and capping it
	 *
	 * @param delta The amount to scroll by. It's typical to use 0 to ensure scrolling is correct while not moving intentionally.
	 */
	public async verticalScroll(delta:number): Promise<void> {
		// update the scrolling position based on delta
		this.parent.tab.activeRow = Math.round((delta * 0.03) + this.parent.tab.activeRow);

		// check clamping scrolling position above 0th
		if(this.parent.tab.activeRow <= 0) {
			this.parent.tab.activeRow = 0;

		} else {
			// calculate the maximum scrolling position
			const max = (this.parent.tab.matrix.matrixlen * (this.parent.tab.module?.patternRows ?? 64)) - 1;

			// check clamping scrolling position below last
			if(this.parent.tab.activeRow > max) {
				this.parent.tab.activeRow = max;
			}
		}

		// go to handle scrolling, reloading, drawing, etc
		await this.updatePositionAndGraphics();

		// tell the selection manager to update scrolling
		this.parent.selectionManager.render();

		// update song scrolling
		this.updateSongScroll();
	}

	/**
	 * Function to update the song scrolling position
	 */
	public updateSongScroll(): void {
		// update song highlight
		if(this.parent.tab.songRow < 0) {
			this.parent.songBar.style.top = "-10000px";
			return;
		}

		// load the offset in pixels and update the bar position
		const offset = (this.parent.tab.songRow - this.parent.tab.activeRow) * this.rowHeight;
		this.parent.songBar.style.top = (offset + this.scrollMiddle) +"px";
	}

	/**
	 * This defines horizontal scroll position of channels and canvases
	 */
	public horizScroll = -1;

	/**
	 * This defines which is the leftmost element currently
	 */
	public horizChannel = -1;

	/**
	 * Handle horizontal scrolling for the scroll wrapper
	 *
	 * @param amount The scrolling amount
	 * @param force If the horizontal scrolling is forced regardless of previous scroll. Useful for code that sets the scrolling itself
	 */
	public async horizontalScroll(amount:number, force:boolean): Promise<void> {
		// calculate the new scrolling position
		const p = Math.max(0, Math.min(this.horizChannel + amount, this.maxHorizontalScroll));

		// check if the scrolling was actually allowed to move
		if(force || p !== this.horizChannel) {
			this.horizChannel = p;
			this.horizScroll = this.parent.channelInfo ? this.parent.channelInfo[this.horizChannel].left : 0;

			// tell each canvas to update left offset
			this.canvas.forEach((c) => c.updateHoriz(this));

			// tell the selection manager to update scrolling
			this.parent.selectionManager.render();

			// update every channel header too, to change their translateX values
			for(let i = this.parent.tab.channels.length;i > 0;--i){
				const e = (this.parent.scrollwrapper.children[i] as HTMLDivElement);

				if(e) {
					// only update if it was actually found
					e.style.transform = "translateX(-"+ this.horizScroll +"px)";
				}
			}

			// update the width of the focus bar
			this.updateFocusWidth();

			// update visible channels
			if(this.updateVisibleChannels()) {
				// if changed, also re-render to force channels to show up
				await this.updatePositionAndGraphics();
			}
		}
	}

	/**
	 * Helper function to update the width of the focus bar
	 */
	private updateFocusWidth() {
		// update highlight to be at this location too
		const w = (this.renderAreaWidth - this.horizScroll - this.rowNumBorderWidth) +"px";
		this.parent.songBar.style.maxWidth = this.parent.focusBar.style.maxWidth = w;
	}

	/**
	 * The scrolling offset for the current row
	 */
	public scrollMiddle!:number;

	/**
	 * Function to update scrolling area size into memory
	 */
	private updateScrollerSize() {
		// initialize scrolling size
		const bounds = this.parent.scrollwrapper.getBoundingClientRect();
		this.scrollHeight = bounds.height - this.parent.padding.height;
		this.scrollWidth = bounds.width - 4;

		// calculate the number of rows visible on half screen at once
		this.scrollMiddle = this.parent.padding.top + (Math.floor(this.scrollHeight / this.rowHeight / 2.5) * this.rowHeight);

		// update highlight to be at this location too
		this.parent.focusBar.style.top = this.scrollMiddle +"px";

		// find how far we can scroll before we have issues
		this.findMaxHorizontalScroll();

		// update the width of the focus bar
		this.updateFocusWidth();
	}

	private maxHorizontalScroll = 0;

	/**
	 * Helper function to calculate which channel is the furthest scrolling is allowed
	 */
	private findMaxHorizontalScroll() {
		// if not even wide enough to scroll, result is 0
		if(this.scrollWidth === 0 || this.renderAreaWidth <= this.scrollWidth) {
			this.maxHorizontalScroll = 0;
			return;
		}

		// find out which channel is the last visible channel that allows us to fully see all channels when scrolled
		let ch = 1;

		for(;ch < this.parent.channelInfo.length; ch++) {
			if(this.renderAreaWidth - this.parent.channelInfo[ch].left < this.scrollWidth) {
				break;
			}
		}

		this.maxHorizontalScroll = ch;
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

		// reload graphics
		this.doGraphicsLater();
	}

	/**
	 * The element widths for each element
	 */
	public elementWidths!:number[];

	/**
	 * The element offsets for each element
	 */
	private elementOffsets!:number[];

	/**
	 * Function to update channel element rendering info
	 *
	 * @param channel The channel to handle
	 * @param effects The number of effects the channel has
	 */
	public updateElementRender(channel:number, effects:number): number {
		const data = this.getElementRenderList(channel, effects);
		this.parent.channelInfo[channel].elements = data.elements;
		this.parent.channelInfo[channel].offsets = data.offsets;
		return data.total;
	}

	public getElementRenderList(channel:number, effects:number): { total: number, offsets: number[], elements: number[], effects: number[] } {
		// total number of elements to render
		const len = [ 3, 5, 7, 9, 11, 13, 15, 17, 19, ][effects];
		let pos = 0;

		// the actual data arrays
		const els:number[] = [];
		const off:number[] = [];
		const fx:number[] = [];

		// loop for each element
		for(let i = 0;i < len;i ++) {
			// check if element rendering is enabled
			if(i >= 3) {
				if((this.parent.tab.channels[channel].features & FeatureFlag.EFFECTS) === 0){
					break;
				}

			} else if((this.parent.tab.channels[channel].features & [ FeatureFlag.NOTE, FeatureFlag.INSTRUMENT, FeatureFlag.VOLUME, ][i]) === 0) {
				continue;
			}

			// push the element ID
			els.push(i);

			if(i >= 3 && (i & 1) !== 0) {
				// save the effect position too
				fx.push(pos + (this.elementWidths[i] / 2));
			}

			// calculate the offset
			off.push(pos + this.elementOffsets[i]);
			pos += this.elementWidths[i];
		}

		return { total: pos + 3, offsets: off, elements: els, effects: fx, };
	}

	/**
	 * Helper function to tell the channel size was updated.
	 *
	 * @param channel The channel to change the size for
	 * @param scroll How much to scroll
	 */
	public async changeChannelSize(channel:number): Promise<void> {
		// update worker with data
		this.refreshChannelWidth();

		// scroll to follow cursor and update size
		await this.horizontalScroll(0, false);
		await this.ensureVisibleChannel(channel, channel);

		// invalidate and clear all canvas rows
		await Promise.all(this.canvas.map(async(c) => {
			c.fillVoid();
			await c.invalidateChannels(channel, channel + 1);
		}));

		// re-render all visible rows
		await this.updatePositionAndGraphics();

		// set the project to be dirty
		this.parent.tab.project.dirty();
	}

	/**
	 * Helper function to update channel widths into position buffers
	 */
	public refreshChannelWidth(): void {
		// initialize channel position arrays
		let pos = 0;

		// update every channel header too, to change their translateX values
		for(let i = 0;i < this.parent.tab.channels.length;i++){
			// update channel positions
			this.parent.channelInfo[i].left = pos;
			this.parent.channelInfo[i].width = (this.parent.scrollwrapper.children[i + 1] as HTMLDivElement).offsetWidth;
			pos += this.parent.channelInfo[i].width;
			this.parent.channelInfo[i].right = pos - this.channelBorderWidth;

			// update the worker on this as well
			this.canvas?.forEach((c) => c.updateChannel(i, this.parent.channelInfo[i]));
		}

		// save the total width of the render area
		this.renderAreaWidth = pos + this.parent.padding.left;

		// find how far we can scroll before we have issues
		this.findMaxHorizontalScroll();

		// inform canvases it has maybe changed
		this.canvas.forEach((c) => c.updateRenderInfo());

		// update visible channels
		this.updateVisibleChannels();

		// update the width of the focus bar
		this.updateFocusWidth();
	}

	/**
	 * Whether to draw pattern previews at all
	 */
	private drawPatternPreview!: boolean;

	/**
	 * The row number setting. This will be used to generate function for converting row numbers
	 */
	public getRowNumber!: boolean;

	/**
	 * The number of pixels for the height of each data element
	 */
	public rowHeight = 25;

	/**
	 * The visible channels from left and right
	 */
	private visibleChannels: [ number, number, ] = [ 0, 0, ];

	/**
	 * Helper function to update currently visible channels
	 */
	private updateVisibleChannels() {
		const last = this.visibleChannels;
		this.visibleChannels = [ 0, 0, ];

		// hotfix
		if(!this.parent.channelInfo) {
			return false;
		}

		// find the leftmost channel
		let ch = 0;

		for(;ch < this.parent.channelInfo.length - 1;ch++) {
			// check if this channel is visible
			if(this.parent.channelInfo[ch].right - this.horizScroll >= 0) {
				break;
			}
		}

		this.visibleChannels[0] = ch;

		// find the rightmost channel
		for(;ch < this.parent.channelInfo.length;ch++) {
			// check if this channel is visible
			if(this.parent.channelInfo[ch].left - this.horizScroll >= this.scrollWidth - this.parent.padding.width) {
				// save the new channel
				break;
			}
		}

		this.visibleChannels[1] = ch;

		// return a boolean indicating whether the visibles are still the same
		return this.visibleChannels[0] !== last[0] || this.visibleChannels[1] !== last[1];
	}

	/**
	 * This is the total width of the render area
	 */
	public renderAreaWidth = 0;

	/**
	 * This is the actual width of each canvas in pixels
	 */
	public canvasWidth = 6000;
	/**
	 * Helper function that updates the list of pattern canvases.
	 */
	private async refreshPatternAmount() {
		const patternRows = this.parent.patternLen;

		// calculate the amount of canvases needed to display everything
		const amount = !this.drawPatternPreview ? 1 : 3;

		if((this.canvas?.length - 1) !== amount) {
			// generate each canvas
			for(let c = 0;c < amount; c++) {
				// generate the canvas class itself
				const x = new PatternCanvas(this.rowHeight * patternRows, this.parent, patternRows, this.parent.tab.channels.length);

				// update horizontal scrolling of the canvas
				x.updateHoriz(this);

				// add this canvas to the DOM
				this.parent.scrollwrapper.appendChild(x.element);
				this.canvas.push(x);

				// tell to update canvas widths
				x.updateRenderInfo();

				// force update canvas theme
				await x.reloadTheme();

				// tell the canvases to generate channel data and clear themselves
				this.parent.channelInfo.forEach((c, ix) => x.updateChannel(ix, c));

				// generate the rows as well (we need the same number of row canvases)
				const rows = this.parent.patternLen;
				const y = new RowsCanvas(this.rowHeight * rows, this.parent, rows, this.getRowNumber, c === 0);

				// add this canvas to the DOM
				this.parent.scrollwrapper.appendChild(y.element);
				this.rows.push(y);

				// force update canvas theme
				await y.reloadTheme();

				// reload graphics
				y.render();
			}
		}
	}

	/**
	 * Function to update the pattern editor with the new number of rows per pattern.
	 *
	 * @param rows The number of rows to update to
	 */
	public async setPatternRows(rows:number): Promise<void> {
		// prepare some variables
		const pat = this.parent.activePattern, offs = this.parent.tab.activeRow % this.parent.patternLen;
		const _old = this.parent.patternLen;
		this.parent.patternLen = rows;

		// update the vertical scrollbar
		this.parent.verticalBar.setValues(rows);

		if(this.parent.channelInfo) {
			// update row counts for all canvases
			this.canvas.forEach((c) => c.setRowCount(rows));
			this.rows.forEach((c) => c.setRowCount(rows));

			// reload theme
			await this.parent.reloadTheme(false);
			this.rows.forEach((c) => c.render());

			// scroll to a different row based on the new size
			this.parent.tab.activeRow = (pat * rows) + Math.min(offs, rows - 1);

			// also load the missing rows if bigger
			if(_old < rows) {
				await Promise.all(this.canvas.map((c) => c.dataArea(_old, rows, 0, this.parent.channelInfo.length)));
			}

			// go to handle scrolling, reloading, drawing, etc
			await this.updatePositionAndGraphics();
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
	 * How many rows that can be hidden, but will still make the visible range larger.
	 * This is used so that the user doesn't see the pattern rows drawing.
	 */
	private visibleSafeHeight = 7;

	/**
	 * Handle scrolling. This updates each canvas position, graphics, active canvas, etc
	 */
	private async updatePositionAndGraphics(): Promise<void> {
		// clear any previous timeouts
		if(this.graphicsTimeout) {
			clearTimeout(this.graphicsTimeout);
			this.graphicsTimeout = undefined;
		}

		// backup the number of pattern rows
		const patternRows = this.parent.patternLen;

		if(!this.drawPatternPreview) {
			// draw only a single pattern!!
			if(this.canvas[0].pattern !== this.parent.activePattern) {
				this.canvas[0].pattern = this.parent.activePattern;
				this.canvas[0].active = true;

				// update all data
				await this.canvas[0].dataAll();
			}

			// update canvas y-position
			const offsetTop = ((this.parent.activePattern * patternRows) - this.parent.tab.activeRow);

			// request to render every visible row in this pattern
			this.canvas[0].render(
				// first row to draw
				Math.max(0, -Math.ceil(this.scrollMiddle / this.rowHeight) - this.visibleSafeHeight - offsetTop),
				// last row to draw
				Math.min(patternRows, Math.ceil((this.scrollHeight - this.scrollMiddle) / this.rowHeight) + this.visibleSafeHeight - offsetTop),
				// first channel to draw
				Math.max(0, this.visibleChannels[0]),
				// last channel to draw
				Math.min(this.parent.channelInfo.length, this.visibleChannels[1]));

			// update element position
			this.rows[0].element.style.top = this.canvas[0].element.style.top = ((offsetTop * this.rowHeight) + this.scrollMiddle) +"px";
			return;
		}

		// run for each visible patterns
		const promises = this.canvas.map(async(_, r) => {
			// load some variables beforehand
			const co = (this.canvas.length + r + (this.parent.activePattern % this.canvas.length)) % this.canvas.length;
			const pat = this.parent.activePattern + r - 1;
			const cv = this.canvas[co];

			// calculate canvas y-position
			const offsetTop = ((pat * patternRows) - this.parent.tab.activeRow);
			const top = ((offsetTop * this.rowHeight) + this.scrollMiddle) +"px";

			// invalidate layout if it is not the same pattern as before
			if(cv.pattern !== pat) {
				// update active status too
				cv.active = pat === this.parent.activePattern;

				// update pattern status
				cv.pattern = pat;

				// update all data
				await cv.dataAll();

			} else if((pat === this.parent.activePattern) !== cv.active) {
				// only invalidate if the active pattern does not match
				cv.active = pat === this.parent.activePattern;

				// invalidate every row in pattern
				cv.invalidateAll();
			}

			// check if this pattern is visible
			if(pat >= 0 && pat < this.parent.tab.matrix.matrixlen) {
				// if yes, request to render every visible row in this pattern
				cv.render(
					// first row to draw
					Math.max(0, -Math.ceil(this.scrollMiddle / this.rowHeight) - this.visibleSafeHeight - offsetTop),
					// last row to draw
					Math.min(patternRows, Math.ceil((this.scrollHeight - this.scrollMiddle) / this.rowHeight) + this.visibleSafeHeight - offsetTop),
					// first channel to draw
					Math.max(0, this.visibleChannels[0]),
					// last channel to draw
					Math.min(this.parent.channelInfo.length, this.visibleChannels[1]));


			} else if(!cv.isClear){
				// clear the pattern if neither visible nor cleared
				cv.clear();
			}

			// update canvas position
			cv.element.style.top = top;
		});

		// position all row elements
		for(let r = 0;r < this.rows.length;r ++) {
			const cr = this.rows[(this.rows.length + r - 1) % this.rows.length];

			// calculate target pattern
			const ppos = r - 1 + this.parent.activePattern;

			if(ppos < 0 || ppos >= this.parent.tab.matrix.matrixlen) {
				// hide row if out of bounds
				cr.element.style.top = "-10000px";
				continue;
			}

			// calculate row y-position
			const top = ((((ppos * patternRows) - this.parent.tab.activeRow) * this.rowHeight) + this.scrollMiddle) +"px";

			// update row position
			cr.element.style.top = top;
		}

		// update focus row settings for the current row
		this.updateFocusRowData();

		// wait for the pattern stuff to update!!
		await Promise.all(promises);
	}

	/**
	 * Helper function to inform us that a pattern index was updated, and to make sure that the display is accurate
	 *
	 * @param channel The channel that is affected
	 * @param position The position index that is affected
	 */
	public patternChanged(channel:number, position:number): Promise<void> {
		return this.patternRenderCheck(channel, (pat:PatternCanvas) => pat.pattern === position);
	}

	/**
	 * Helper function to inform us that a pattern index was shifted
	 *
	 * @param channel The channel that is affected
	 * @param position The position that the shift started in
	 */
	public patternShifted(channel:number, position:number): Promise<void> {
		return this.patternRenderCheck(channel, (pat:PatternCanvas) => pat.pattern >= position);
	}

	/**
	 * Helper function to inform us that a pattern index was shifted
	 *
	 * @param channel The channel that is affected
	 * @param position The position that the shift started in
	 */
	private async patternRenderCheck(channel:number, check:(pat:PatternCanvas) => boolean): Promise<void> {
		let render = false;

		// ensure that the pattern is actually visible currently
		for(const c of this.canvas) {
			if(check(c)) {
				// if check succeeds, invalidate the affected channel
				await c.invalidateChannels(channel, channel + 1);
				render = true;
			}
		}

		// if anything was affected, then render a bit later
		if(render) {
			this.doGraphicsLater();
		}
	}

	/**
	 * Function to update some data in a specific place, and to request graphics reload for that place
	 *
	 * @param pattern The matrix pattern the update happened in
	 * @param start The first row to update
	 * @param end The last row to update
	 * @param channel The channel the update happened in
	 */
	public async updateDataRows(pattern:number, start:number, end:number, channel:number): Promise<unknown> {
		// loop through all canvases, finding if any of them contain the requested pattern
		const array = await Promise.all(this.canvas.map(async(c) => {
			if(this.parent.tab.matrix.get(channel, c.pattern) === pattern) {
				// if the matrix pattern matches, update the row
				await c.dataChannel(start, end, channel);
				return true;
			}

			return false;
		}));

		// update the event manager too
		const promise = this.parent.eventData(this.parent.tab.matrix, channel, pattern, start, end);

		// loop through all results, checking if any were changed. If so, then we must also render
		for(const render of array) {
			if(render) {
				// must render, ignore all other results
				this.doGraphicsLater();
				return promise;
			}
		}

		return promise;
	}

	/**
	 * Timeout for graphics rendering. Can be used to track when graphics are trying to update a bit later
	 */
	private graphicsTimeout:NodeJS.Timeout|undefined;

	/**
	 * Helper function to update graphics later and to avoid too many update calls in too short time
	 */
	private doGraphicsLater() {
		this.graphicsTimeout = setTimeout(() => {
			// clear timeout and update graphics
			return this.updatePositionAndGraphics();
		}, 15);
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
		const row = this.parent.tab.activeRow % this.parent.patternLen;
		const hid = (this.parent.tab.recordMode ? 3 : 0) + ((row % this.rowHighlights[0]) === 0 ? 2 : (row % this.rowHighlights[1]) === 0 ? 1 : 0);

		// update background color and blend mode for this row
		this.parent.focusBar.style.backgroundColor = this.focusBarColorNormal[hid];
		// @ts-expect-error This property does exist, but TypeScript doesn't recognize it
		this.parent.focusBar.style.mixBlendMode = this.focusBarBlendNormal[hid];
	}

	/**
	 * The color and blend mode settings for the song bar
	 */
	private songBarColorNormal!: [ string, string, string,  string, string, string, ];
	private songBarBlendNormal!: [ string, string, string,  string, string, string, ];

	/**
	 * Helper function to update focus row details
	 */
	public updateSongRowData(): void {
		// ignore when hidden
		if(this.parent.tab.songRow < 0) {
			return;
		}

		// calculate the current highlight ID
		const row = this.parent.tab.activeRow % this.parent.patternLen;
		const hid = (this.parent.tab.recordMode ? 3 : 0) + ((row % this.rowHighlights[0]) === 0 ? 2 : (row % this.rowHighlights[1]) === 0 ? 1 : 0);

		// update background color and blend mode for this row
		this.parent.songBar.style.backgroundColor = this.songBarColorNormal[hid];
		// @ts-expect-error This property does exist, but TypeScript doesn't recognize it
		this.parent.songBar.style.mixBlendMode = this.songBarBlendNormal[hid];
	}

	/**
	 * The number of pixels the row number border is wide.
	 */
	public rowNumBorderWidth = 0;

	/**
	 * The number of pixels the channel borders are wide.
	 */
	public channelBorderWidth = 0;

	/**
	 * Helper function to inform that the theme was reloaded
	 */
	public async reloadTheme(preload:boolean):Promise<void> {
		// request every canvas to reload theme
		const promises = [ ...this.canvas, ...this.rows, ].map((c) => c.reloadTheme());

		// meanwhile, load some variables
		this.rowHeight = theme?.pattern?.worker?.params?.rowHeight ?? 25;
		this.elementWidths = theme?.pattern?.worker?.widths ?? [];
		this.elementOffsets = theme?.pattern?.worker?.offsets ?? [];

		this.rowNumBorderWidth = theme.pattern?.worker?.rownum?.borderWidth ?? 0;
		this.channelBorderWidth = theme.pattern?.worker?.params?.borderWidth ?? 0;

		// load the tables handling the focus bar colors
		this.focusBarColorNormal = [
			...theme?.pattern?.main?.focus?.color ?? [ "#000", "#000", "#000", ],
			...theme?.pattern?.main?.focus?.recordcolor ?? [ "#000", "#000", "#000", ],
		];

		this.focusBarBlendNormal = [
			...theme?.pattern?.main?.focus?.blend ?? [ "", "", "", ],
			...theme?.pattern?.main?.focus?.recordblend ?? [ "", "", "", ],
		];


		// load the tables handling the song bar colors
		this.songBarColorNormal = [
			...theme?.pattern?.main?.song?.color ?? [ "#000", "#000", "#000", ],
			...theme?.pattern?.main?.song?.recordcolor ?? [ "#000", "#000", "#000", ],
		];

		this.songBarBlendNormal = [
			...theme?.pattern?.main?.song?.blend ?? [ "", "", "", ],
			...theme?.pattern?.main?.song?.recordblend ?? [ "", "", "", ],
		];

		// update elements that use the row height directly
		this.parent.focusBar.style.height = this.rowHeight +"px";
		this.parent.songBar.style.height = this.rowHeight +"px";

		if(!preload) {
			// wait for them to finish
			await Promise.all(promises);

			// reload graphics
			this.doGraphicsLater();

			// reload row graphics
			this.rows.forEach((r) => r.render());
		}
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

		// reload graphics
		this.doGraphicsLater();

		// make sure the focus row gets updated
		this.updateFocusRowData();
	}
}
