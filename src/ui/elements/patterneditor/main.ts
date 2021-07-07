import { loadFlag } from "../../../api/files";
import { PatternIndex } from "../../../api/matrix";
import { UIElement } from "../../../api/ui";

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
				const blank = Math.ceil(this.scrollHeight / 50);

				// try to clamp to minimim position
				if(this.scrollPosition <= -blank) {
					this.scrollPosition = -blank;

				} else {
					// calculate the maximum position
					const max = (this.index.matrixlen * this.index.patternlen) + blank - Math.floor(this.scrollHeight / this.dataHeight);

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
				if(e.deltaX) {
					// there is horizontal movement, translate to a CSS variable
					this.horizScroll = e.deltaX < 0 ?
						Math.min(this.channelPositionsLeft.length - 1, this.horizScroll + 1) :
						Math.max(0, this.horizScroll - 1);

					// update canvas scrolling
					this.canvas.forEach((c) => c.updateHoriz(this));

					// update each channel header too
					for(let i = this.index.channels.length;i >= 0;--i){
						(this.scrollwrapper.children[i] as HTMLDivElement)
							.style.transform = "translateX(-"+ this.channelPositionsLeft[this.horizScroll] +"px)"
					}
				}

				if(e.deltaY) {
					// there is vertical movement, translate it into a CSS variable
					scroll(e.deltaY);
				}
			}, { passive: false, });

			let timeout:null|NodeJS.Timeout = null;

			// when window resizes, make sure to change scroll position as well
			window.addEventListener("resize", () => {
				// if previous timeout was defined, clear it
				if(timeout) {
					clearTimeout(timeout);
				}

				// create a new timeout for updating scrolling and pattern amounts
				timeout = setTimeout(() => {
					// uådate scrolling height
					this.scrollHeight = this.scrollwrapper.getBoundingClientRect().height - 30;

					// remove old canvases
					this.canvas.forEach((c) => c.element.parentElement?.removeChild(c.element));

					// refresh the amount of patterns
					this.refreshPatternAmount();

					// reload
					this.handleScrolling();
				}, 25);
			});

			// initialize canvas
			this.handleScrolling();
			this.canvas.forEach((c) => c.clear());

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
	public channelPositionsLeft!:number[];

	/**
	 * This is a list of all the channel x-positions from right. This helps canvases get lined up.
	 */
	public channelPositionsRight!:number[];

	/**
	 * This defines which horizontal scroll position is going to be read
	 */
	public horizScroll = 0;

	/**
	 * This is the total width of the render area
	 */
	public totalWidth!:number;

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
		const amount = Math.ceil(((this.scrollHeight / this.dataHeight) + (this.visibleSafeHeight * 2)) / this.index.patternlen);

		// generate each row
		for(let row = 0;row <= amount; row++) {
			// create a new canvas
			const x = new PatternCanvas(this.totalWidth, this.dataHeight * this.index.patternlen, this.index.patternlen, this.index.channels.length);
			this.scrollwrapper.appendChild(x.element);
			this.canvas.push(x);

			// update horizontal scrolling
			x.updateHoriz(this);
		}
	}

	/**
	 * Container for each canvas element
	 */
	private canvas!:PatternCanvas[];

	/**
	 * Handle scrolling by updating positions
	 */
	private handleScrolling() {
		// load the target display
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();

		// calculate the active pattern
		const middle = this.scrollPosition + Math.round(this.scrollHeight / this.dataHeight / 2);
		const pat = Math.min(this.index.matrixlen - 1, Math.max(0, Math.round((middle - (this.index.patternlen / 1.75)) / this.index.patternlen)));

		// calculate the number of rows on screen at once
		const rowsPerScreen = Math.ceil((this.scrollHeight - 30) / this.dataHeight);

		// run for each visible row
		for(let r = rangeMin;r <= rangeMax; r++) {
			// load the canvas that represents this pattern
			const cv = this.canvas[(this.canvas.length + r) % this.canvas.length];

			// update canvas y-position
			const offsetTop = ((r * this.index.patternlen) - this.scrollPosition);
			cv.element.style.top = ((offsetTop * this.dataHeight) + 30) +"px";

			// invalidate layout if it is not the same row or active status don't match
			if(cv.pattern !== r || (r === pat) !== cv.active) {
				cv.active = r === pat;
				cv.pattern = r;
				cv.clear();
			}

			// check if this is visible
			if(r >= 0 && r < this.index.matrixlen) {
				cv.renderPattern(this,
					Math.max(0, -offsetTop - this.visibleSafeHeight),
						Math.min(this.index.patternlen, rowsPerScreen + this.visibleSafeHeight - offsetTop));
			}
		}
	}

	/**
	 * How many rows that can be hidden, but will still make the visible range larger.
	 * This is used so that the user doesn't see the pattern list elements loading.
	 */
	private visibleSafeHeight = 3;

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
}

class PatternCanvas {
	public element:HTMLCanvasElement;
	public pattern:number;
	public active:boolean;
	private patternlen:number;
	private channels:number;

	constructor(width:number, height:number, patternlen:number, channels:number) {
		// create the element and give it classes
		this.element = document.createElement("canvas");
		this.element.width = width;
		this.element.height = height;

		this.element.style.top = "-10000px";
		this.element.classList.add("patterncanvas");

		this.pattern = -1;
		this.channels = channels;
		this.patternlen = patternlen;
		this.active = false;

		this.rendered = Array<boolean>(patternlen);
		this.clear();
	}

	/**
	 * Update horizontal scrolling of canvas
	 */
	public updateHoriz(parent:PatternEditor) {
		this.element.style.left = -parent.channelPositionsLeft[parent.horizScroll] +"px";
	}

	private rendered:boolean[];

	public clear() {
		// get the 2D context and check if valid
		const ctx = this.element.getContext("2d");

		if(!ctx) {
			// wtf fail
			console.error("failed to capture 2D context for pattern "+ this.pattern);
			return;
		}

		// just clear the entire deal
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, this.element.width, this.element.height);

		for(let i = 0;i < this.patternlen;i ++){
			this.rendered[i] = false;
		}
	}

	public renderPattern(parent:PatternEditor, start:number, end:number) {
		// get the 2D context and check if valid
		const ctx = this.element.getContext("2d");

		if(!ctx) {
			// wtf fail
			console.error("failed to capture 2D context for pattern "+ this.pattern);
			return;
		}

		// prepare text
		ctx.font = "10pt 'Roboto Mono'";

		for(let r = start;r <= end;r ++) {
			if(!this.rendered[r]) {
				this.renderRow(r, ctx, parent);
				this.rendered[r] = true;
			}
		}
	}

	private channelElementOffsets = [ 3, 31, 50, 70, 87, ];
	private channelElementColors = [ "#b7b7b7", "#7e81a5", "#62ab4a", "#b16f6f", "#bba6a1", ];

	private renderRow(row:number, ctx:CanvasRenderingContext2D, parent:PatternEditor) {
		const top = 14 + (row * parent.dataHeight);

		// draw background
		ctx.fillStyle = this.active ? "#262627" : "#1E1E1E";
		ctx.fillRect(0, top - 14, this.element.width, parent.dataHeight);

		// draw borders
		ctx.fillStyle = "#000";

		parent.channelPositionsRight.forEach((left) => {
			ctx.fillRect(left, top - 14, 4, parent.dataHeight);
		});

		// render pattern index
		ctx.fillStyle = this.active ? "#949494" : "#686868";
		ctx.fillText(parent.getRowNumber(row), parent.channelPositionsLeft[0] + 3, top);

		// render all other text
		for(let c = 0;c < this.channels;c ++) {
			const left = parent.channelPositionsLeft[c + 1];

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

					ctx.fillStyle = this.active ? this.channelElementColors[i] : "#686868";
					ctx.fillText(text, left + this.channelElementOffsets[i], top);

				} else {
					ctx.fillStyle = this.active ? "#616161" : "#404040";
					ctx.fillText(i === 0 ? "---" : "--", left + this.channelElementOffsets[i], top);
				}
			}
		}
	}
}
