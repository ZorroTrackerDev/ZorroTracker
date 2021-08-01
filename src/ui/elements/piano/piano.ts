import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../../api/events";
import { loadFlag } from "../../../api/files";
import { UIComponent, UIShortcutHandler } from "../../../api/ui";
import { Tab } from "../../misc/tab";

export class Piano implements UIComponent<HTMLDivElement>, UIShortcutHandler {
	/**
	 * Map strings to note numbers. This will allow the Piano to correctly release notes
	 */
	private scmap:{ [key:string]: number, } = {};

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[], e:KeyboardEvent|undefined, state:boolean|undefined):Promise<boolean> {
		// helper function to process an octave of notes
		const octave = (data:string[], octave:number) => {
			// helper function to trigger a single note
			const note = async(note:number) => {
				// get the scmap name for this note
				const name = octave +"-"+ note;

				if(state) {
					// fetch octave info
					const octaveInfo = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;

					// calculate the note
					const n = octaveInfo.C0 + note + ((this.octave + octave) * octaveInfo.size);

					// trigger the note
					await this.triggerNote(n, 1);
					this.scmap[name] = n;

				} else if(this.scmap[name]){
					// release the note and remove scmap reference
					await this.releaseNote(this.scmap[name]);
					delete this.scmap[name];
				}

				return true;
			};

			// read the note and handle it
			switch(data.shift()?.toUpperCase()) {
				case "C":	return note(0);
				case "C#":	return note(1);
				case "D":	return note(2);
				case "D#":	return note(3);
				case "E":	return note(4);
				case "F":	return note(5);
				case "F#":	return note(6);
				case "G":	return note(7);
				case "G#":	return note(8);
				case "A":	return note(9);
				case "A#":	return note(10);
				case "B":	return note(11);
			}

			// note not found
			return false;
		}

		// process the shortcut
		switch(data.shift()?.toLowerCase()) {
			case "toleft":		return this.changePosition(-1);
			case "toright":		return this.changePosition(1);
			case "octavedown":	return this.changeOctave(-1);
			case "octaveup":	return this.changeOctave(1);
			case "smaller":		return this.changeSize(-1);
			case "bigger":		return this.changeSize(1);
			case "octave0":		return octave(data, 0);
			case "octave1":		return octave(data, 1);
			case "octave2":		return octave(data, 2);
		}

		return false;
	}

	public tab!: Tab;
	public element!: HTMLDivElement;
	private position!: number;
	private width!: number;
	private octave!: number;

	// create a new piano instance
	constructor() {
		_piano = this;
	}

	/**
	 * Function to initialize the piano component
	 */
	public init(): HTMLDivElement {
		// create the piano base element
		this.element = document.createElement("div");
		this.element.classList.add("pianowrapper");
		this.element.innerHTML = /*html*/"<div><div></div></div>";

		// special handling for the mouse wheel
		(this.element.children[0] as HTMLDivElement).onwheel = (e) => {
			if(e.deltaY) {
				// there is vertical movement, translate to horizontal
				(e.currentTarget as HTMLDivElement).scrollLeft += e.deltaY * 0.5;
				e.preventDefault();
			}
		};

		// load some flags
		this.width = loadFlag<number>("PIANO_DEFAULT_SIZE") ?? 2;
		this.octave = loadFlag<number>("PIANO_DEFAULT_OCTAVE") ?? 3;
		this.position = loadFlag<number>("PIANO_DEFAULT_POSITION") ?? 0;

		// update position
		this.changePosition(0);

		// return the main element for this piano
		return this.element;
	}

	/**
	 * Helper function to change the position of the piano display
	 *
	 * @param offset The offset to apply to the position
	 */
	public changePosition(offset:number): boolean {
		// update position and cap it between -1 and 1
		this.position = Math.max(-1, Math.min(1, this.position + offset));

		// update the float value
		((this.element.children[0] as HTMLDivElement).children[0] as HTMLDivElement).style.float = [ "left", "", "right", ][this.position + 1];
		return true;
	}

	/**
	 * Helper function to change the size of the piano display
	 *
	 * @param offset The offset to apply to the size
	 */
	public async changeSize(offset:number): Promise<boolean> {
		const { min, max, } = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;

		// update size and cap it between 1 and max octaves
		this.width = Math.max(1, Math.min((max - min + 1), this.width + offset));

		// ensure the octave doesnt go out of range
		await this.changeOctave(0);

		// redraw the piano
		await this.redraw();
		return true;
	}

	/**
	 * Helper function to set the current octave of the piano display
	 *
	 * @param value The new octave
	 * @param update If set to false, do not update the function
	 */
	public setOctave(value:number, update?:boolean): Promise<boolean> {
		this.octave = value;
		return this.changeOctave(0, update);
	}

	/**
	 * Helper function to change the current octave of the piano display
	 *
	 * @param offset The offset to apply to the octave
	 * @param update If set to false, do not update the function
	 */
	public async changeOctave(offset:number, update?:boolean): Promise<boolean> {
		const { min, max, } = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;

		// update octave and cap it between minimum and maximum octave
		this.octave = Math.max(min, Math.min(max - 1, this.octave + offset));

		// tell the outside function about the value
		if(update !== false && this.octaveUpdateFunc) {
			this.octaveUpdateFunc(this.octave);
		}

		// redraw the piano
		await this.redraw();
		return true;
	}

	/**
	 * Function to calculate the range of octaves that the piano should display.
	 *
	 * @returns An array depicting the minimum and maximum octaves to display. For example to only display octave 3, this will return [ 3, 3 ].
	 */
	private async getOctaveRange(): Promise<[ number, number, ]> {
		// just pretend to show an invalid octave range, if no piano would display.
		if(this.width < 2) {
			return [ 1, 0, ];
		}

		// prepare the octave marker
		let oc = this.octave;

		// prepare the width values on the left and rightr
		const lw = Math.floor(this.width / 2), rw = Math.ceil(this.width / 2);

		// fetch the minimum and maximum octaves
		const { min, max, } = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;

		// handle minimum and maximum octave
		if(oc < min + lw) {
			oc = min + lw;

		} else if(oc > max - rw) {
			oc = max - rw + 0.5;

		} else {
			// little trick to center the octave
			oc += 0.5;
		}

		// calculate the total range
		return [
			Math.ceil(oc - lw),
			Math.ceil(oc + rw),
		];
	}

	/**
	 * Helper function to update octave value outside of the piano
	 */
	private octaveUpdateFunc!: ((value:number) => void)|undefined;

	/**
	 * Helper functiom to handle octave update functions. Mainly for the textbox that can change octave too
	 *
	 * @param func The function to run when octave is updated
	 */
	public onOctaveUpdate(func:(value:number) => void): void {
		this.octaveUpdateFunc = func;

		// initialize octave on load
		func(this.octave);
	}

	/**
	 * Helper function to update octave value outside of the piano
	 */
	private rangeUpdateFunc!: (() => Promise<void>)|undefined;

	/**
	 * Helper functiom to handle octave update functions. Mainly for the textbox that can change octave too
	 *
	 * @param func The function to run when octave is updated
	 */
	public onRangeUpdate(func:(min: number, max: number, ) => void): void {
		// generate the range update function
		this.rangeUpdateFunc = async() => {
			const { min, max, } = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;
			func(min, max - 1);
		};

		// run the function once, too
		(this.rangeUpdateFunc as () => Promise<void>)().catch(console.error);
	}

	/**
	 * Helper function to get relative note to start of current octave, mainly for MIDI devices.
	 *
	 * @param offset The note offset from the start of current octave
	 * @returns the translated note
	 */
	public async getRelativeNote(offset:number): Promise<number> {
		const octave = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;
		return ((this.octave + 1) * octave.size) + octave.C0 + offset;
	}

	/**
	 * Redraw the piano keys
	 */
	public async redraw(): Promise<void> {
		// find the wrapper
		const wrap = (this.element.children[0] as HTMLDivElement).children[0] as HTMLDivElement;

		// remove all children
		while(wrap.children.length > 0){
			wrap.removeChild(wrap.children[0]);
		}

		// load note cache data
		const cache = await this.tab.getNotes(this.tab.selectedChannel.info.type);

		// helper function to add a single key to the wrapper
		const key = (note:number, parent:HTMLDivElement) => {
			// create a new div element to store this key
			const e = document.createElement("div");
			e.classList.add("pianokey");

			// give the note attribute to get the note value
			e.setAttribute("note", ""+ note);

			// load the note cache data
			const cn = cache.notes[cache.octave.C0 + note + oc];

			if(cn) {
				// define classes based on sharp param
				switch(cn.sharp) {
					case "center":	e.classList.add("sharp"); break;
					case "left":	e.classList.add("sharp", "sl"); break;
					case "right":	e.classList.add("sharp", "sr"); break;
				}

				// if frequency is not a number, then it must be invalid
				if(typeof cn.frequency !== "number") {
					e.classList.add("invalid");
				}

				// add the inner text to show which note it is
				e.innerHTML = /*html*/`<span>${ cn.name.split("\u2060")[0] }</span>`;

			} else {
				// note is very not valid
				e.classList.add("invalid");
				e.innerHTML = /*html*/"<span>?</span>";
			}

			parent.appendChild(e);
		}

		// calculate which octaves to show
		const [ ocMin, ocMax, ] = await this.getOctaveRange();
		const oc = ocMin * cache.octave.size;

		// repeat for each octave
		for(let x = ocMin, n = 0; x < ocMax; x++){
			// create a new div element to store this octave
			const e = document.createElement("div");
			e.classList.add("pianooctave");

			// user can currently play this ocave
			if(x >= this.octave && x < this.octave + 2) {
				e.classList.add("play");
			}

			// find octave ID
			let o = "invalid";

			for(let y = 11;y >= 0; --y) {
				// check if there is a note cached here
				const c = cache.notes[cache.octave.C0 + n + y + oc];

				if(c) {
					// if yes, this is the new octave, use it! No matter what!
					o = c.name.split("\u2060")[1];
					break;
				}
			}

			// generate some HTML for this element
			e.innerHTML = /*html*/`
				<div></div>
				<label>Octave ${ o }</label>
			`;

			// generate the actual octave elements
			for(let y = 11;y >= 0; --y) {
				key(n++, e.children[0] as HTMLDivElement);
			}

			// append the octave to piano
			wrap.appendChild(e);
		}
	}

	/**
	 * Function to load the piano component
	 */
	public async load(pass:number): Promise<boolean> {
		// component loads in pass 2
		if(pass !== 2) {
			return pass < 2;
		}

		// load the wrapper div
		const wrap = (this.element.children[0] as HTMLDivElement).children[0] as HTMLDivElement;
		let cur:HTMLDivElement|undefined, note = 0;

		// helper function to release the current note
		const release = async(n:number) => {
			if(n > 0) {
				// release note
				await this.releaseNote(n);
			}
		}

		// helper function to handle mouse movement
		const move = async(e:MouseEvent) => {
			if(e.target instanceof HTMLDivElement && (e.target as HTMLDivElement).classList.contains("pianokey")) {
				// this is a piano key
				if(cur === e.target) {
					// if same as the current key, ignore
					return;
				}

				// release the note
				release(note).catch(console.error);

				// calculate velocity
				const rect = e.target.getBoundingClientRect();
				let pos = (e.clientY - rect.top) / rect.height;

				// make the position a bit saner
				pos = (Math.max(0.05, Math.min(0.8, pos)) * (1 / 0.8));

				// calculate the note
				const [ oct, ] = await this.getOctaveRange();
				const octaveInfo = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;

				note = octaveInfo.C0 + (octaveInfo.size * oct) + (parseInt(e.target.getAttribute("note") ?? "0", 10));

				// trigger the note
				await this.triggerNote(note, pos);

				// activate it
				cur = e.target;
			}
		};

		// handle mousedown event
		wrap.onmousedown = async(e) => {
			// create new mouse move event
			wrap.onmousemove = move;

			// helper method to handle when the mouse trackers should be removed
			const up = async() => {
				wrap.onmousemove = null;
				document.onmouseup = null;
				window.onblur = null;

				// release the note
				await release(note);
				note = 0;

				// remove the current element
				cur = undefined;
			}

			// when mouse is raised again, remove tracking events
			document.onmouseup = up;

			// when the window loses focus, remove tracking events
			window.onblur = up;

			// do initial move event
			await move(e);
		}

		// update size
		await this.changeSize(0);

		// redraw the inner elements
		await this.redraw();
		return false;
	}

	public unload(): boolean {
		// piano does not unload
		return false;
	}

	/**
	 * Trigger a note at a certain velocity
	 *
	 * @param note The note ID to play
	 * @param velocity The velocity to play the note with, from 0 to 1.0.
	 */
	public async triggerNote(note:number, velocity:number):Promise<boolean> {
		// check if this note exists
		if(typeof (await this.tab.getNotes(this.tab.selectedChannel.info.type)).notes[note]?.frequency === "number"){
			if(await window.ipc.driver.pianoTrigger(note, velocity, this.tab.selectedChannel.info.id)){
				// add the active class
				await this.modNote("active", "add", note);
				return true;
			}
		}

		return false;
	}

	/**
	 * Release a note
	 *
	 * @param note The note ID to release
	 */
	public async releaseNote(note:number):Promise<boolean> {
		if(await window.ipc.driver.pianoRelease(note)){
			// remove the active class
			await this.modNote("active", "remove", note);
			return true;
		}

		return false;
	}

	/**
	 * Helper function to deal with classes for notes
	 *
	 * @param name The name of the class to affect
	 * @param mode Whether to add or remove the class
	 * @param note The note to check
	 */
	private async modNote(name:string, mode:"add"|"remove", note:number) {
		// calculate which octaves are being displayed
		const [ ocMin, ocMax, ] = await this.getOctaveRange();

		// fetch octave info
		const octaveInfo = (await this.tab.getNotes(this.tab.selectedChannel.info.type)).octave;

		// check if this note is on the piano
		if(note > ocMin * octaveInfo.size && note - octaveInfo.C0 < ocMax * octaveInfo.size) {
			// load the note offset
			const off = note - octaveInfo.C0 - (ocMin * octaveInfo.size);

			// calculate the octave wrapper
			let e = ((this.element.children[0] as HTMLDivElement).children[0] as HTMLDivElement).children[(off / 12) | 0];

			// calculate the final key
			e = (e.children[0] as HTMLDivElement).children[(off % 12) | 0];

			// if element exists, modify it
			e?.classList[mode](name);
		}
	}
}

let _piano: Piano;

/*
 * Store a translation table of MIDI notes -> driver notes. This allows the octave to change without disturbing the MIDI note.
 */
const keys:number[] = Array(128);

/**
 * Helper event listener for the MidiNoteOn event, so that the piano can receive notes from MIDI devices
 */
ZorroEvent.addListener(ZorroEventEnum.MidiNoteOn, async(event:ZorroEventObject, channel:number, note:number, velocity:number) => {
	if(_piano) {
		// get the relative note to trigger
		const rn = await _piano.getRelativeNote(note - 60);

		// attempt to trigger the note
		if(await _piano.triggerNote(rn, velocity)) {
			keys[note] = rn;
		}
	}
});

/**
 * Helper event listener for the MidiNoteOff event, so that the piano can receive notes from MIDI devices
 */
ZorroEvent.addListener(ZorroEventEnum.MidiNoteOff, async(event:ZorroEventObject, channel:number, note:number) => {
	if(_piano) {
		// attempt to release the note
		if(await _piano.releaseNote(keys[note])) {
			keys[note] = 0;
		}
	}
});

/**
 * Helper event listener for the SetActiveChannel event, so that the piano knows to refresh when needed
 */
ZorroEvent.addListener(ZorroEventEnum.SetActiveChannel, async() => {
	if(_piano) {
		await _piano.changeOctave(0);
	}
});
