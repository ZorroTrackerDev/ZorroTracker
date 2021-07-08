import { loadFlag } from "../../../api/files";
import { PatternIndex } from "../../../api/matrix";
import { UIElement } from "../../../api/ui";

export class PatternEditor implements UIElement {
	// various standard elements for the pattern editor
	public element!:HTMLElement;
	private scrollwrapper!:HTMLDivElement;

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
		this.index = index;
		this.setLayout();
	}

	/**
	 * Helper function to initialize the layout for the pattern editor
	 */
	private setLayout() {
		// generate the main element for this editor
		this.element = document.createElement("div");
		this.element.classList.add("patterneditor");
		this.element.tabIndex = 0;

		// add the scrolling wrapper to the list
		this.scrollwrapper = document.createElement("div");
		this.element.appendChild(this.scrollwrapper);

		// initialize the channel layout for this editor
		this.initChannels();

		// load the row number generator function
		this.getRowNumber = loadFlag<boolean>("ROW_NUM_IN_HEX") ?
			(row:number) => row.toString(16).toUpperCase().padStart(2, "0") :
			(row:number) => row.toString().padStart(3, "0");

		requestAnimationFrame(() => {
			// initialize the scrolling region size
			this.updateScrollerSize();

			// reload the number of patterns that need to be visible
			this.refreshPatternAmount();

			// helper function for updating scrolling position and capping it
			const scroll = (delta:number) => {
				// update the scrolling position based on delta
				this.scrollPosition = Math.round((delta * 0.03) + this.scrollPosition);

				// find out the number of blank rows to show above and below the patterns (above 0th and below the last patterns)
				const blank = Math.ceil(this.scrollHeight / 50);

				// check clamping scrolling position above 0th
				if(this.scrollPosition <= -blank) {
					this.scrollPosition = -blank;

				} else {
					// calculate the maximum scrolling position
					const max = (this.index.matrixlen * this.index.patternlen) + blank - Math.floor(this.scrollHeight / this.dataHeight);

					// check clamping scrolling position below last
					if(this.scrollPosition > max) {
						this.scrollPosition = max;
					}
				}

				// go to handle scrolling, reloading, drawing, etc
				this.handleScrolling();
			}

			// add handler for vertical and horizontal scrolling
			this.scrollwrapper.addEventListener("wheel", (e) => {
				if(e.deltaX) {
					/*
					 * when moving horizontally, check the direction. For left scrolling, just check scroll position is above 0.
					 * For right scrolling, check that there are more channels to show, and that some channels are still obscured.
					 */
					if(e.deltaX < 0 ? this.horizScroll > 0 : (this.horizScroll < this.channelPositionsLeft.length - 1) &&
						(this.renderAreaWidth - this.channelPositionsLeft[this.horizScroll]) > this.scrollWidth) {

						// update horizontal scrolling variable
						this.horizScroll += e.deltaX < 0 ? -1 : 1;

						// tell each canvas to update left offset
						this.canvas.forEach((c) => c.updateHoriz(this));

						// update every channel header too, to change their translateX values
						for(let i = this.index.channels.length;i >= 0;--i){
							(this.scrollwrapper.children[i] as HTMLDivElement)
								.style.transform = "translateX(-"+ this.channelPositionsLeft[this.horizScroll] +"px)"
						}
					}
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
				timeout = setTimeout(() => {
					timeout = null;

					// update the scrolling region size
					this.updateScrollerSize();

					// remove old canvases so everything can be updated
					this.canvas.forEach((c) => c.element.parentElement?.removeChild(c.element));

					// reload the number of patterns that need to be visible
					this.refreshPatternAmount();

					// call the special scroll handler, mainly to update the current position and to redraw canvases
					scroll(0);
				}, 50);
			});

			// temporary hack: This forces the font to load and draw correctly
			this.handleScrolling();
			this.canvas.forEach((c) => c.clear());

			// initially handle scrolling, reloading, drawing, etc
			setTimeout(() => {
				this.handleScrolling();
			}, 100);
		});
	}

	/**
	 * Function to update scrolling area size into memory
	 */
	private updateScrollerSize() {
		// initialize scrolling size
		const bounds = this.scrollwrapper.getBoundingClientRect();
		this.scrollHeight = bounds.height - 30;
		this.scrollWidth = bounds.width + 5;
	}

	/**
	 * Helper function to convert row numbers to string. This can be different based on flags.json5
	 *
	 * @param row The row number to calculcate
	 * @returns A string representing the row number
	 */
	public getRowNumber!: (row:number) => string;

	/**
	 * The number of pixels for the height of each data element
	 */
	public dataHeight = 19;

	/**
	 * Store the vertical scroll position of channel datas
	 */
	private scrollPosition = 0;

	/**
	 * The height of the scrolling region
	 */
	private scrollHeight!:number;

	/**
	 * The width of the scrolling region
	 */
	private scrollWidth!:number;

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
	 * This defines which horizontal scroll position of channels and canvases
	 */
	public horizScroll = 0;

	/**
	 * This is a list of all the channel x-positions from left. This helps canvases get lined up and with scrolling.
	 */
	public channelPositionsLeft!:number[];

	/**
	 * This is a list of all the channel x-positions from right. This helps canvases get lined up.
	 */
	public channelPositionsRight!:number[];

	/**
	 * This is the total width of the render area
	 */
	public renderAreaWidth!:number;

	/**
	 * Helper function to initialize channel headers and channel positions
	 */
	private initChannels() {
		// delete any previous children
		this.clearChildren(this.scrollwrapper);

		// initialize channel position arrays
		this.channelPositionsLeft = [];
		this.channelPositionsRight = [];
		let pos = 0;

		// generating DOM for a single channel
		const doChannel = (name:string) => {
			// do some regex hacking to remove all tabs and newlines. HTML whyyy
			return /*html*/`
				<div class="channelwrapper">
					<div class="channelnamewrapper">
						<label>${ name }</label>
					</div>
				</div>
			`.replace(/[\t|\r|\n]+/g, "");
		};

		// create the row index column
		this.scrollwrapper.innerHTML = doChannel("\u200B");

		// update channel positions
		this.channelPositionsLeft.push(pos);
		pos += 35;
		this.channelPositionsRight.push(pos - 4);

		// handle DOM generation for each channel and save it to scrollwrapper
		this.scrollwrapper.innerHTML += this.index.channels.map((c) => {
			// generate DOM for a single channel
			const r = doChannel(c.name);

			// update channel positions
			this.channelPositionsLeft.push(pos);
			pos += 111;
			this.channelPositionsRight.push(pos - 4);

			// return DOM data
			return r;
		}).join("");

		// save the total width of the render area
		this.renderAreaWidth = pos;
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
				case "null": break;
			}
		}

		return false;
	}

	/**
	 * Helper function that updates the list of pattern canvases.
	 */
	private refreshPatternAmount() {
		// clear the canvas list
		this.canvas = [];

		// calculate the amount of canvases needed to display everything
		const amount = Math.ceil(((this.scrollHeight / this.dataHeight) + (this.visibleSafeHeight * 2)) / this.index.patternlen);

		// generate each canvas
		for(let c = 0;c <= amount; c++) {
			// generate the canvas class itself
			const x = new PatternCanvas(this.renderAreaWidth, this.dataHeight * this.index.patternlen,
				this.index.patternlen, this.index.channels.length);

			// update horizontal scrolling of the canvas
			x.updateHoriz(this);

			// add this canvas to the DOM
			this.scrollwrapper.appendChild(x.element);
			this.canvas.push(x);
		}
	}

	/**
	 * Container for each loaded canvas
	 */
	private canvas!:PatternCanvas[];

	/**
	 * Handle scrolling. This updates each canvas position, graphics, active canvas, etc
	 */
	private handleScrolling() {
		// load the range of patterns that are visible currently
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();

		// calculate which pattern is currently active
		const middle = this.scrollPosition + Math.round(this.scrollHeight / this.dataHeight / 2);
		const pat = Math.min(this.index.matrixlen - 1, Math.max(0, Math.round((middle - (this.index.patternlen / 1.75)) / this.index.patternlen)));

		// calculate the number of rows visible on screen at once
		const rowsPerScreen = Math.ceil((this.scrollHeight - 30) / this.dataHeight);

		// run for each visible patterns
		for(let r = rangeMin;r <= rangeMax; r++) {
			// load the canvas that represents this pattern
			const cv = this.canvas[(this.canvas.length + r) % this.canvas.length];

			// update canvas y-position
			const offsetTop = ((r * this.index.patternlen) - this.scrollPosition);
			cv.element.style.top = ((offsetTop * this.dataHeight) + 30) +"px";

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
				cv.renderPattern(this, Math.max(0, -offsetTop - this.visibleSafeHeight),
					Math.min(this.index.patternlen, rowsPerScreen + this.visibleSafeHeight - offsetTop));

			} else if(!cv.isClear){
				// clear the pattern if neither visible nor cleared
				cv.clear();
			}
		}
	}

	/**
	 * How many rows that can be hidden, but will still make the visible range larger.
	 * This is used so that the user doesn't see the pattern rows drawing.
	 */
	private visibleSafeHeight = 4;

	/**
	 * Helper function to get the visible range of patterns
	 */
	private getVisibleRange() {
		return [
			// load the start point of the range
			Math.floor((this.scrollPosition - this.visibleSafeHeight) / this.index.patternlen),

			// load the end point of the range
			Math.floor((this.scrollPosition + this.visibleSafeHeight + (this.scrollHeight / this.dataHeight)) / this.index.patternlen),
		];
	}
}

/**
 * Helper class for each pattern canvas
 */
class PatternCanvas {
	// the canvas element itself for this canvas
	public element:HTMLCanvasElement;

	// the 2D context for this canvas
	private ctx:CanvasRenderingContext2D;

	/**
	 * Initialize this PatternCanvas and store some data passed.
	 *
	 * @param width The width of the entire canvas in pixels
	 * @param height The height of the entire canvas in pixels
	 * @param patternlen The number of rows per pattern
	 * @param channels The number of channels in the project
	 */
	constructor(width:number, height:number, patternlen:number, channels:number) {
		// create the main canvas and update its size
		this.element = document.createElement("canvas");
		this.element.width = width;
		this.element.height = height;

		// hide the canvas for now and give its class
		this.element.style.top = "-10000px";
		this.element.classList.add("patterncanvas");

		// store internal variables
		this.channels = channels;
		this.patternlen = patternlen;

		// set internal variables to default values
		this.pattern = -1;
		this.active = false;

		// load the graphics context and pretend it can't be null
		this.ctx = this.element.getContext("2d", { alpha: false, }) as CanvasRenderingContext2D;

		// clear the canvas content and set every row as unrendered
		this.rendered = Array<boolean>(patternlen);
		this.clear();

		// load the font for this canvas ahead of time
		this.ctx.font = "10pt 'Roboto Mono'";
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
	 * The number of channels to render
	 */
	private channels:number;

	/**
	 * Update horizontal scrolling of canvas
	 */
	public updateHoriz(parent:PatternEditor) {
		this.element.style.left = -parent.channelPositionsLeft[parent.horizScroll] +"px";
	}

	/**
	 * Function to fill the canvas with black and invalidate all rows
	 */
	public clear() {
		// check if 2D context is valid
		if(!this.ctx) {
			console.error("failed to capture 2D context for pattern "+ this.pattern);
			return;
		}

		// set the entire canvas to black
		this.ctx.fillStyle = "#000";
		this.ctx.fillRect(0, 0, this.element.width, this.element.height);

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
		for(let i = start;i < end;i ++){
			this.rendered[i] = false;
		}
	}

	/**
	 * This bitfield determines which rows are rendered already, so they can't be re-rendered
	 */
	private rendered:boolean[];

	/**
	 * Function to render part of the pattern if not rendered
	 *
	 * @param parent The parent PatternEditor that is responsible for this canvas
	 * @param start The start of the range of rows to render
	 * @param end The end of the range of rows to render
	 */
	public renderPattern(parent:PatternEditor, start:number, end:number) {
		// check if 2D context is valid
		if(!this.ctx) {
			console.error("failed to capture 2D context for pattern "+ this.pattern);
			return;
		}

		// loop for each row in the range
		for(let r = start;r <= end;r ++) {
			if(!this.rendered[r]) {
				// this row needs to be rendered. Go do that
				this.renderRow(r, parent);
				this.rendered[r] = true;
			}
		}
	}

	/**
	 * The horizontal offsets for each element in the channel row
	 */
	private channelElementOffsets = [ 3, 31, 50, 70, 87, ];

	/**
	 * The colors for each element in the channel row
	 */
	private channelElementColors = [ "#b7b7b7", "#7e81a5", "#62ab4a", "#b16f6f", "#bba6a1", ];

	/**
	 * This is the vertical offset of text. This is needed somehow
	 */
	private textVerticalOffset = 14;

	/**
	 * Function to re-render a single row of graphics
	 *
	 * @param row The row to render
	 * @param parent The parent PatternEditor that is responsible for this canvas
	 */
	private renderRow(row:number, parent:PatternEditor) {
		// set the canvas as not cleared
		this.isClear = false;

		// the top position of this row
		const top = row * parent.dataHeight;

		// draw the background fill color
		this.ctx.fillStyle = this.active ? "#262627" : "#1E1E1E";
		this.ctx.fillRect(0, top, this.element.width, parent.dataHeight);

		// initialize border color
		this.ctx.fillStyle = "#000";

		// loop for each channel position
		parent.channelPositionsRight.forEach((left) => {
			// draw the border
			this.ctx.fillRect(left, top, 4, parent.dataHeight);
		});

		// render the pattern index of this row
		this.ctx.fillStyle = this.active ? "#949494" : "#686868";
		this.ctx.fillText(parent.getRowNumber(row), parent.channelPositionsLeft[0] + 3, top + this.textVerticalOffset);

		// loop for every channel
		for(let c = 0;c < this.channels;c ++) {
			// load the channel position
			const left = parent.channelPositionsLeft[c + 1];

			// render each channel element
			for(let i = 0;i < 5;i ++){
				// some dummy code to generate text for this row
				if(c & 1) {
					let text = "";
					switch(i) {
						case 0: text = "C#6"; break;
						case 1: text = "2F"; break;
						case 2: text = "11"; break;
						case 3: text = "WQ"; break;
						case 4: text = "DD"; break;
					}

					// render the element with text
					this.ctx.fillStyle = this.active ? this.channelElementColors[i] : "#686868";
					this.ctx.fillText(text, left + this.channelElementOffsets[i], top + this.textVerticalOffset);

				} else {
					// render the element with blanks
					this.ctx.fillStyle = this.active ? "#616161" : "#404040";
					this.ctx.fillText(i === 0 ? "---" : "--", left + this.channelElementOffsets[i], top + this.textVerticalOffset);
				}
			}
		}
	}
}
