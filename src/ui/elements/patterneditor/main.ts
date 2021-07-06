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

			this.refreshPatternAmount();

			// initialize patterns and update active pattern
			this.refreshPatternsList(true);

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

				// load patterns and update active pattern
				this.refreshPatternsList(delta > 0);
			}

			// add handler for vertical scrolling
			this.scrollwrapper.addEventListener("wheel", (e) => {
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

				//	this.refreshPatternAmount();
					scroll(0);
				}, 25);
			});
		});
	}

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
	 * Helper function to initialize empty channel content for each defined channel
	 */
	private initChannels() {
		// delete any previous children
		this.clearChildren(this.scrollwrapper);

		// handle a single channel
		const doChannel = (name:string) => {
			// do some regex hacking to remove all tabs and newlines. HTML whyyy
			return /*html*/`
				<div class="channelwrapper">
					<div class="channelnamewrapper">
						<label>${ name }</label>
					</div>
					<div class="patternlistwrapper"></div>
				</div>
			`.replace(/[\t|\r|\n]+/g, "");
		};

		// add the index column
		this.scrollwrapper.innerHTML = doChannel("\u200B");

		// run for each channel
		this.scrollwrapper.innerHTML += this.index.channels.map((c) => {
			return doChannel(c.name);
		}).join("");
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
	 * Load the pattern list div element for a specific column
	 *
	 * @param column The column to load from
	 * @returns The pattern list div element that was requested
	 */
	private getPatternListDiv(column:number) {
		// get the column wrapper
		const list = this.scrollwrapper.children[column] as HTMLDivElement;

		// check if this column exists
		if(list) {
			return list.children[1] as HTMLDivElement;
		}
	}

	/**
	 * Helper function that updates the list of pattern lists. This will delete any that is not strictly necessary to fill display.
	 */
	private refreshPatternAmount() {
		// calculate the amount of rows needed to display
		const amount = Math.ceil(((this.scrollHeight / this.dataHeight) + (this.visibleSafeHeight * 2)) / this.index.patternlen);

		// generate each row
		for(let row = 0;row <= amount; row++) {
			// create the container for this row elements
			const store:HTMLDivElement[] = [];
			this.loadedRows.push({ row: -1, elements: store, });

			// create the pattern list element for this
			let div = this.createPatternData();
			this.getPatternListDiv(0)?.appendChild(div);
			store.push(div);

			for(let i = 0;i < this.index.patternlen;i ++) {
				// create the element and give it classes
				const x = document.createElement("div");
				div.appendChild(x);
				x.classList.add("patternrownum");

				// set the number
				x.innerText = this.getRowNumber(i);
			}

			// handle each channel
			for(let c = 0;c < this.index.channels.length;c ++) {
				// create the pattern list element for this
				div = this.createPatternData();
				this.getPatternListDiv(1 + c)?.appendChild(div);
				store.push(div);

				// add the note data
				for(let i = 0;i < this.index.patternlen;i ++) {
					// create the element and give it classes
					const x = document.createElement("div");
					div.appendChild(x);
					x.classList.add("patterndataitem");

					// set the text
					x.innerHTML = /*html*/`
						<div class='note'>---</div>
						<div class='instrument'>—</div>
						<div class='volume'>—</div>
						<div class='command'>—</div>
						<div class='value'>—</div>
					`.replace(/[\t|\r|\n]+/g, "");
				}
			}
		}
	}

	/**
	 * Function to create the wrapper for pattern data
	 *
	 * @param position The position of the row vertically
	 * @returns The newly created element
	 */
	private createPatternData() {
		// create the element and give it classes
		const div = document.createElement("div");
		div.classList.add("patternlist");

		// force offscreen
		div.style.transform = "translateY(-10000px)";
		return div;
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
	 * This is the array that contains all the currently loaded rows
	 */
	private loadedRows: { row: number, elements: HTMLDivElement[], }[] = [];

	/**
	 * Function to load a pattern rown onscreen
	 *
	 * @param row The row index to load
	 * @param active True if this is the active row
	 */
	private loadRow(rd:{ row: number, elements: HTMLDivElement[], }, row:number, active:boolean, direction:boolean) {
		// update row position
		rd.row = row;

		// make sure no invalid row is loaded
		if(row < 0 || row >= this.index.matrixlen) {
			// update transform values
			rd.elements.forEach((e) => {
				e.style.transform = "translateY(-10000px)";
			});
			return;
		}

		// calculate the styles
		const [ opacity, transform, ] = this.getStyles(active, row);

		// update transform and opacity values of each element
		rd.elements.forEach((e) => {
			e.style.transform = transform;
			e.style.opacity = opacity;
		});

		// reset the base position
		const diff = direction ? this.rowRenderPerFrame : -this.rowRenderPerFrame;
		let base = direction ? 0 : this.index.patternlen + diff;

		// helper function to draw a single channel
		const drawSingle = () => {
			// check that the row still matches
			if(rd.row !== row) {
				return;
			}

			// run for every single channel
			let c = 0;
			rd.elements.forEach((e) => {
				// run for every single row withing channel
				for(let i = base;i - base < this.rowRenderPerFrame && i < this.index.patternlen;i ++) {
					const rr = e.children[i] as HTMLDivElement;

					// run for every single element within a channel
					for(let x = 0;x < rr.children.length;x++) {
						let d:string|null = null;

						// generate "random" garbage values
						switch(x) {
							case 0: d = c % 2 === 0 ? (direction ? "C#1" : "D·4") : null; break;
							case 1: d = c % 4 === 0 ? (direction ? "2F" : "AA") : null; break;
							case 2: d = c === 0 || c > 4 ? (direction ? "11" : "00") : null; break;
							case 3: d = c % 3 === 0 ? (direction ? "WQ" : "I1") : null; break;
							case 4: d = c % 3 === 0 ? (direction ? "DD" : "43") : null; break;
						}

						// save the value in the element
						if(d) {
							rr.children[x].classList.add("set");
							(rr.children[x] as HTMLDivElement).innerText = d;

						} else {
							rr.children[x].classList.remove("set");
							(rr.children[x] as HTMLDivElement).innerText = x === 0 ? "---" : "--";
						}
					}
				}

				c++;
			});

			// increment base offset
			base += diff;

			// if more rows to render, loop
			if(base < this.index.patternlen && base >= 0) {
				requestAnimationFrame(drawSingle);
			}
		}

		// initialize the rendering
		requestAnimationFrame(drawSingle);
	}

	/**
	 * How many rows to render per frame
	 */
	private rowRenderPerFrame = 8;

	/**
	 * Helper function to load a standardized styles for pattern lists
	 *
	 * @param active If the row is active or not
	 * @param row The row number
	 * @returns An array of items representing properties
	 */
	private getStyles(active:boolean, row:number) {
		return [
			active ? "100%" : "70%",
			"translateY("+ (((row * this.index.patternlen) - this.scrollPosition) * this.dataHeight) +"px)",
		];
	}

	/**
	 * Helper function to update which patterns should be rendered
	 */
	private refreshPatternsList(direction:boolean) {
		// load the target range
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();

		// calculate the active pattern
		const middle = this.scrollPosition + Math.round(this.scrollHeight / 2 / this.dataHeight);
		const pat = Math.min(this.index.matrixlen - 1, Math.max(0, Math.round((middle - (this.index.patternlen / 1.75)) / this.index.patternlen)));

		// now find each row that is not loaded
		for(let r = rangeMin;r <= rangeMax; r++) {
			const rd = this.loadedRows[(this.loadedRows.length + r) % this.loadedRows.length];

			if(rd.row !== r) {
				// load the row now
				this.loadRow(rd, r, pat === r, direction);

			} else if(r >= 0 && r < this.index.matrixlen){
				// calculate the styles
				const [ opacity, transform, ] = this.getStyles(r === pat, r);

				// update transform and opacity values of each element
				rd.elements.forEach((e) => {
					e.style.transform = transform;
					e.style.opacity = opacity;
				});
			}
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
}
