import { loadFlag } from "../../../api/files";
import { PatternIndex } from "../../../api/matrix";
import { UIElement } from "../../../api/ui";

type canvasElement = {
	/**
	 * The current pattern row ID
	 */
	pattern: number,

	/**
	 * The actual element
	 */
	element: HTMLCanvasElement,

	/**
	 * The 2D context of this canvas
	 */
	context: CanvasRenderingContext2D|null,
};

export class PatternEditor implements UIElement {
	// various standard elements for the pattern editor
	public element!:HTMLElement;
	private scrollwrapper!:HTMLDivElement;
	private scrollHeight!:number;

	/**
	 * The pattern index this editor is apart of
	 */
	private index: PatternIndex;

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

		// initialize channels in element
		this.initChannels();

		// load the row numbers flag
		this.getRowNumber = loadFlag<boolean>("ROW_NUM_IN_HEX") ?
			(row:number) => row.toString(16).toUpperCase().padStart(2, "0") :
			(row:number) => row.toString().padStart(3, "0");

		requestAnimationFrame(() => {
			// initialize scrolling height
			this.scrollHeight = this.scrollwrapper.getBoundingClientRect().height - 30;

			// refresh the amount of patterns
			this.refreshPatternAmount();

			// helper function to update the scroll position of the pattern editor
			const scroll = (delta:number) => {
				// change the scrolling position
				this.scrollPosition = Math.round((delta * 0.03) + this.scrollPosition);

				// try to clamp to minimim position
				if(this.scrollPosition <= -16) {
					this.scrollPosition = -16;

				} else {
					// calculate the maximum position
					const max = (this.index.matrixlen * this.index.patternlen) + 16 - Math.floor(this.scrollHeight / this.dataHeight);

					// try to clamp to max position
					if(this.scrollPosition > max) {
						this.scrollPosition = max;
					}
				}

				// internally handle scrolling of elements and redrawing areas
				this.handleScrolling();
			}

			// add handler for vertical scrolling
			this.scrollwrapper.addEventListener("wheel", (e) => {
				if(e.deltaY) {
					// there is vertical movement, translate it into a CSS variable
					scroll(e.deltaY);
				}
			}, { passive: false, });

			this.handleScrolling();

			// initialize canvases
			setTimeout(() => {
				this.handleScrolling();
			}, 100);
		});
	}

	/**
	 * Helper function to convert row numbers to string. This can be different based on flags.json5
	 *
	 * @param row The row number to calculcate
	 * @returns A string representing the row number
	 */
	private getRowNumber!: (row:number) => string;

	/**
	 * The number of pixels for the height of each data element
	 */
	private dataHeight = 19;

	/**
	 * Store the vertical scroll position of channel datas
	 */
	private scrollPosition = 0;

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
	 * This is a list of all the channel x-positions from left. This helps canvases get lined up.
	 */
	private channelPositionsLeft!:number[];

	/**
	 * This is a list of all the channel x-positions from right. This helps canvases get lined up.
	 */
	private channelPositionsRight!:number[];

	/**
	 * This is the total width of the render area
	 */
	private totalWidth!:number;

	/**
	 * Helper function to initialize empty channel content for each defined channel
	 */
	private initChannels() {
		// delete any previous children
		this.clearChildren(this.scrollwrapper);

		this.channelPositionsLeft = [];
		this.channelPositionsRight = [];
		let pos = 0;

		// handle a single channel
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

		// add the index column
		this.scrollwrapper.innerHTML = doChannel("\u200B");

		this.channelPositionsLeft.push(pos);
		pos += 35;
		this.channelPositionsRight.push(pos - 4);

		// run for each channel
		this.scrollwrapper.innerHTML += this.index.channels.map((c) => {
			const r = doChannel(c.name);

			this.channelPositionsLeft.push(pos);
			pos += 111;
			this.channelPositionsRight.push(pos - 4);
			return r;

		}).join("");

		// save the total width of the render area
		this.totalWidth = pos;
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
	 * Helper function that updates the list of pattern lists. This will delete any that is not strictly necessary to fill display.
	 */
	private refreshPatternAmount() {
		this.canvas = [];

		// calculate the amount of rows needed to display
		const amount = 3;				// super cool temporary advanced math operation

		// generate each row
		for(let row = 0;row < amount; row++) {
			// create the element and give it classes
			const x = document.createElement("canvas");
			x.width = this.totalWidth;
			x.height = this.dataHeight * this.index.patternlen;

			x.style.top = "-10000px";
			x.classList.add("patterncanvas");
			this.scrollwrapper.appendChild(x);
			this.canvas.push({ element: x, context: x.getContext("2d"), pattern: -1, });
		}
	}

	/**
	 * Container for each canvas element
	 */
	private canvas!:canvasElement[];

	/**
	 * Handle scrolling by updating positions
	 */
	private handleScrolling() {
		// load the target display
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();

		// calculate the active pattern
		const middle = this.scrollPosition + Math.round(this.scrollHeight / 2 / this.dataHeight);
		const pat = Math.min(this.index.matrixlen - 1,
			Math.max(0, Math.round((middle - (this.index.patternlen / 1.75)) / this.index.patternlen)));

		// run for each visible row
		for(let r = rangeMin;r <= rangeMax; r++) {
			// load the canvas that represents this pattern
			const cv = this.canvas[(this.canvas.length + r) % this.canvas.length];

			// update canvas y-position
			cv.element.style.top = ((((r * this.index.patternlen) - this.scrollPosition) * this.dataHeight) + 30) +"px";

			// fully render because lazy and testing
			this.renderPattern(cv, r, r === pat, r >= 0 && r < this.index.matrixlen);
		}
	}

	/**
	 * How many rows that can be hidden, but will still make the visible range larger.
	 * This is used so that the user doesn't see the pattern list elements loading.
	 */
	private visibleSafeHeight = 6;

	/**
	 * Helper function to get the visible range of patterns
	 */
	private getVisibleRange() {
		// return the visible range of patterns
		return [
			Math.floor((this.scrollPosition - this.visibleSafeHeight) / this.index.patternlen),
			Math.floor((this.scrollPosition + this.visibleSafeHeight + (this.scrollHeight / this.dataHeight)) / this.index.patternlen),
		];
	}

	private renderPattern(cv:canvasElement, row:number, active:boolean, valid:boolean) {
		cv.pattern = row;

		if(!cv.context) {
			console.error("failed to capture 2D context for row "+ row);
			// wtf fail
			return;
		}

		const ctx = cv.context;

		if(!valid) {
			// if outside of bounds, just fill with black
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, cv.element.width, cv.element.height);
			return;
		}

		// draw background
		ctx.fillStyle = active ? "#262627" : "#1E1E1E";
		ctx.fillRect(0, 0, cv.element.width, cv.element.height);

		// draw borders
		ctx.fillStyle = "#000";

		this.channelPositionsRight.forEach((left) => {
			ctx.fillRect(left, 0, 4, cv.element.height);
		});

		// prepare text
		ctx.font = "10pt 'Roboto Mono'";
		ctx.fillStyle = active ? "#949494" : "#686868";

		// draw pattern indices
		for(let r = 0;r < this.index.patternlen;r ++) {
			ctx.fillText(this.getRowNumber(r), this.channelPositionsLeft[0] + 3, 14 + (r * this.dataHeight));
		}

		// draw all other elements
		for(let r = 0;r < this.index.patternlen;r ++) {
			const top = 14 + (r * this.dataHeight);

			for(let c = 0;c < this.index.channels.length;c ++) {
				const left = this.channelPositionsLeft[c + 1];

				for(let i = 0;i < 5;i ++){
					if(c & 1) {
						let text = "";
						switch(i) {
							case 0: text = "C#6"; break;
							case 1: text = "2F"; break;
							case 2: text = "11"; break;
							case 3: text = "WQ"; break;
							case 4: text = "DD"; break;
						}

						ctx.fillStyle = active ? this.channelElementColors[i] : "#686868";
						ctx.fillText(text, left + this.channelElementOffsets[i], top);

					} else {
						ctx.fillStyle = active ? "#616161" : "#404040";
						ctx.fillText(i === 0 ? "---" : "--", left + this.channelElementOffsets[i], top);
					}
				}
			}
		}
	}

	private channelElementOffsets = [ 3, 31, 50, 70, 87, ];
	private channelElementColors = [ "#b7b7b7", "#7e81a5", "#62ab4a", "#b16f6f", "#bba6a1", ];
}
