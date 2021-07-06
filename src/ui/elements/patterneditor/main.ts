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

		// initialize patterns and update active pattern
		this.refreshPatternsList();
		this.setActivePattern();

		// helper function to update the scroll position of the pattern editor
		const scroll = (delta:number) => {
			// change the scrolling position
			this.scrollPosition = Math.round((delta * 0.03) + this.scrollPosition);

			// try to clamp to minimim position
			if(this.scrollPosition <= -16) {
				this.scrollPosition = -16;

			} else {
				// calculate the maximum position
				const rect = this.scrollwrapper.getBoundingClientRect();
				const max = (this.index.matrixlen * this.index.patternlen) + 16 - Math.floor(rect.height / this.dataHeight);

				// try to clamp to max position
				if(this.scrollPosition > max) {
					this.scrollPosition = max;
				}
			}

			// save position
			document.documentElement.style.setProperty("--patterneditor-y", this.scrollPosition +"");

			// load patterns and update active pattern
			setTimeout(() => {
				this.refreshPatternsList();
				this.setActivePattern();
			}, 1);
		}

		// add handler for vertical scrolling
		this.scrollwrapper.addEventListener("wheel", (e) => {
			if(e.deltaY) {
				// there is vertical movement, translate it into a CSS variable
				scroll(e.deltaY);
			}
		}, { passive: true, });

		// when window resizes, make sure to change scroll position as well
		window.addEventListener("resize", () => {
			scroll(0);
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
		this.scrollwrapper.innerHTML += this.index.channels.map((c) => doChannel(c.name)).join("");
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
	 * Function to create the wrapper for pattern data
	 *
	 * @param position The position of the row vertically
	 * @returns The newly created element
	 */
	private createPatternData(position:number) {
		// create the element and give it classes
		const div = document.createElement("div");
		div.classList.add("patternlist");

		// store its position in an attribute
		div.setAttribute("plr", ""+ position);

		// handle its position
		div.style.transform = "translateY(calc("+ this.dataHeight +"px * ("+ (position * this.index.patternlen) +" - var(--patterneditor-y))))";
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
	private loadedRows: { [key: string]: HTMLDivElement[] } = {};

	/**
	 * Function to load a pattern rown onscreen
	 *
	 * @param row The row index to load
	 */
	private loadRow(row:number) {
		// make sure no invalid row is loaded
		if(row < 0 || row >= this.index.matrixlen) {
			return;
		}

		// create the container for this row elements
		const store:HTMLDivElement[] = [];
		this.loadedRows[row] = store;

		// create the pattern list element for this
		let div = this.createPatternData(row);
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
			div = this.createPatternData(row);
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
					<div class='note ${  c % 2 === 0 ? "set" : "" }' >${ c % 2 === 0 ? "C#"+ Math.round(Math.random() * 9) : "---" }</div>
					<div class='volume ${ c % 4 === 0 ? "set" : "" }'>${ c % 4 === 0 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "—" }</div>
					<div class='instrument ${ c === 0 ||c > 4 ? "set" : "" }'>${ c === 0 || c > 4 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "—" }</div>
					<div class='command ${ c % 3 === 0 ? "set" : "" }'>${ c % 3 === 0 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "—" }</div>
					<div class='value ${ c % 3 === 0 ? "set" : "" }'>${ c % 3 === 0 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "—" }</div>
				`.replace(/[\t|\r|\n]+/g, "");
			}
		}
	}

	/**
	 * Helper function to update which patterns should be rendered
	 */
	private refreshPatternsList() {
		// load the target range
		const [ rangeMin, rangeMax, ] = this.getVisibleRange();

		// unload elements that are not in range
		for(const key of Object.keys(this.loadedRows)) {
			const k = parseInt(key, 10);

			// check if the key is in range
			if(k < rangeMin || k > rangeMax) {
				// if yes, remove all the elements
				this.loadedRows[key].forEach((e) => e.parentElement?.removeChild(e));

				// and the key
				delete this.loadedRows[key];
			}
		}

		// now find each row that is not loaded
		for(let r = rangeMin;r <= rangeMax; r++) {
			if(!this.loadedRows[r]) {
				// load the row now
				this.loadRow(r);
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
		// get the wrapper bounding rectangle
		const rect = this.scrollwrapper.getBoundingClientRect();

		// return the visible range of patterns
		return [
			Math.floor((this.scrollPosition - this.visibleSafeHeight) / this.index.patternlen),
			Math.floor((this.scrollPosition + this.visibleSafeHeight + ((rect.height - 30) / this.dataHeight)) / this.index.patternlen),
		];
	}

	/**
	 * Helper function to set the currently active pattern
	 */
	private setActivePattern() {
		// get the wrapper bounding rectangle
		const rect = this.scrollwrapper.getBoundingClientRect();

		// calculate the effective position at the middle of the screen
		const middle = this.scrollPosition + Math.round(rect.height / 2 / this.dataHeight);

		// check which pattern is at this location
		const pat = Math.min(this.index.matrixlen - 1, Math.max(0, Math.round((middle - (this.index.patternlen / 1.75)) / this.index.patternlen)));

		// update the active status of all patterns
		for(const key of Object.keys(this.loadedRows)) {
			// get the method to call
			const method = key === pat.toString() ? "add" : "remove";

			// update every single element with this class
			this.loadedRows[key].forEach((e) => e.classList[method]("active"));
		}
	}
}
