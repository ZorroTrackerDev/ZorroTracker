export class PatternEditor {
	public element:HTMLElement;
	public elchans:HTMLElement;
	public elrows:HTMLElement;

	constructor() {
		this.element = document.createElement("div");
		this.element.classList.add("patterneditor");

		this.elchans = document.createElement("div");
		this.elchans.classList.add("patterneditor_channels");
		this.element.appendChild(this.elchans);

		this.elrows = document.createElement("div");
		this.elrows.classList.add("patterneditor_rows");
		this.element.appendChild(this.elrows);

		this.setChannels([ "FM1", "FM2", "FM3", "FM4", "FM5", "FM6", "DAC", "PSG1", "PSG2", "PSG3", "PSG4", ]);

		for(let i = 0;i < 20;i ++){
			const x = document.createElement("div");
			this.elrows.appendChild(x);

			for(let s = 0;s < this.elchans.children.length;s ++) {
				const y = document.createElement("div");
				y.classList.add("patterneditor_pattern");

				if(s){
					y.innerText = ((Math.random() * 256) | 0).toString(16).toUpperCase();

				} else {
					y.innerText = i.toString(16).toUpperCase();
				}

				if(y.innerText.length === 1){
					y.innerText = "0"+ y.innerText;
				}
				x.appendChild(y);
			}
		}

		this.select(10, 5);
	}

	private setChannels(list:string[]) {
		// helper function to add a new element with text
		const _add = (text:string) => {
			const z = document.createElement("div");
			z.innerText = text;
			this.elchans.appendChild(z);
		}

		// add each channel into the mix
		_add("​");
		list.forEach(_add);
	}

	private static SELECT_CLASS = "selected";

	private clearSelect() {
		// remove class from all rows
		for(const row of this.element.children){
			row.classList.remove(PatternEditor.SELECT_CLASS);

			// remove class from all elements
			for(const e of row.children){
				e.classList.remove(PatternEditor.SELECT_CLASS);
			}
		}
	}

	public select(row:number, channel:number):boolean {
		// clear any previous selections
		this.clearSelect();

		// check if this row exists
		if(this.elrows.children.length >= row) {
			const erow = this.elrows.children[row];

			// check if the channel exists
			if(erow.children.length > channel) {
				const echan = erow.children[channel + 1];

				// apply special styles
				erow.classList.add(PatternEditor.SELECT_CLASS);
				echan.classList.add(PatternEditor.SELECT_CLASS);
				return true;
			}
		}

		// unable to select
		return false;
	}
}