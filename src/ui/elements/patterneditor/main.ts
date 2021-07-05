import { PatternIndex } from "../../../api/matrix";
import { UIElement } from "../../../api/ui";

export class PatternEditor implements UIElement {
	// various standard elements for the pattern editor
	public element!:HTMLElement;
	private scrollwrapper!:HTMLDivElement;

	/**
	 * The pattern index this editor is responding to
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

		// initialize rows
		this.loadRows();

		// add handler for vertical scrolling
		this.scrollwrapper.onwheel = (e) => {
			if(e.deltaY) {
				// there is vertical movement, translate it into a CSS variable
				e.preventDefault();

				// change the scrolling position
				this.scrollPosition = Math.round((e.deltaY * 0.03) + this.scrollPosition);
				this.scrollPosition = Math.max(-16, Math.min(this.scrollPosition, 32));

				document.documentElement.style.setProperty("--patterneditor-y", this.scrollPosition +"");
			}
		};
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
		div.classList.add("patternlist", "active");

		// store its position in an attribute
		div.setAttribute("plr", ""+ position);

		// handle its position
		div.style.transform = "translateY(calc("+ this.dataHeight +"px * ("+ (position * 64) +" - var(--patterneditor-y))))";
		return div;
	}

	private dataHeight = 19;

	/**
	 * Function to load more pattern rows onscreen
	 */
	private loadRows() {
		// create the pattern list element for this
		let div = this.createPatternData(0);
		this.getPatternListDiv(0)?.appendChild(div);

		for(let i = 0;i < 64;i ++) {
			// create the element and give it classes
			const x = document.createElement("div");
			div.appendChild(x);
			x.classList.add("patternrownum");

			// set the number
			x.innerText = i.toString().padStart(3, "0");
		}

		// handle each channel
		for(let c = 0;c < this.index.channels.length;c ++) {
			// create the pattern list element for this
			div = this.createPatternData(0);
			this.getPatternListDiv(1 + c)?.appendChild(div);

			// add the note data
			for(let i = 0;i < 64;i ++) {
				// create the element and give it classes
				const x = document.createElement("div");
				div.appendChild(x);
				x.classList.add("patterndataitem");

				// set the text
				x.innerHTML = /*html*/`
					<div class='note ${  c % 2 === 0 ? "set" : "" }' >${ c % 2 === 0 ? "C#"+ Math.round(Math.random() * 9) : "---" }</div>
					<div class='idk ${ c === 0 ||c > 4 ? "set" : "" }'>${ c === 0 || c > 4 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "–" }</div>
					<div class='volume ${ c % 4 === 0 ? "set" : "" }'>${ c % 4 === 0 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "–" }</div>
					<div class='command ${ c % 3 === 0 ? "set" : "" }'>${ c % 3 === 0 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "—" }</div>
					<div class='value ${ c % 3 === 0 ? "set" : "" }'>${ c % 3 === 0 ? Math.round(Math.random() * 255).toString(16).toUpperCase().padStart(2, "0") : "—" }</div>
				`.replace(/[\t|\r|\n]+/g, "");

			}
		}
	}
}
