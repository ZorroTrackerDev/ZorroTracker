import { ChannelType, NoteReturnType } from "../../../api/driver";
import { loadFlag } from "../../../api/files";
import { Note, OctaveSize } from "../../../api/notes";
import { UIElement } from "../../../api/ui";

export class Piano implements UIElement {
	/**
	 * Cache note lists here
	 */
	private static notesCache:{ [key: number]: NoteReturnType } = {};

	public static async create() : Promise<Piano> {
		const piano = new Piano();
		piano.width = loadFlag<number>("PIANO_DEFAULT_SIZE") ?? 2;
		piano.octave = loadFlag<number>("PIANO_DEFAULT_OCTAVE") ?? 3;
		piano.position = loadFlag<number>("PIANO_DEFAULT_POSITION") ?? 0;

		// remember to cache FM notes
		if(!this.notesCache[ChannelType.YM7101PSG]) {
			this.notesCache[ChannelType.YM7101PSG] = await window.ipc.driver.getNotes(ChannelType.YM7101PSG);
		}

		// update position
		piano.changePosition(0);

		// redraw the inner elements based on size
		piano.redraw();

		// finish initializing the piano
		piano.init();

		// return the piano
		return piano;
	}

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
				const n = Note.C0 + note + octave + (this.octave * OctaveSize);

				// trigger or release note based on keyboard state
				if(state) {
					await this.triggerNote(n, 1);

				} else {
					await this.releaseNote(n);
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
			case "octave1":		return octave(data, OctaveSize);
			case "octave2":		return octave(data, OctaveSize * 2);
		}

		return false;
	}

	public element!: HTMLDivElement;
	private position!: number;
	private width!: number;
	private octave!: number;

	// create a new piano instance
	constructor() {
		// create the piano base element
		this.element = document.createElement("div");
		this.element.classList.add("pianowrapper");
		this.element.innerHTML = /*html*/"<div></div>";
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
		(this.element.children[0] as HTMLDivElement).style.float = [ "left", "", "right", ][this.position + 1];
		return true;
	}

	/**
	 * Helper function to change the size of the piano display
	 *
	 * @param offset The offset to apply to the size
	 */
	public changeSize(offset:number): boolean {
		// update position and cap it between 0 and 5
		this.width = Math.max(0, Math.min(5, this.width + offset));

		// ensure the octave doesnt go out of range
		this.changeOctave(0);

		// redraw the piano
		this.redraw();
		return true;
	}

	/**
	 * Helper function to change the size of the piano display
	 *
	 * @param offset The offset to apply to the size
	 */
	public changeOctave(offset:number): boolean {
		// update octave and cap it between -3 and 10 - (num of visible octaves)
		this.octave = Math.max(-3, Math.min(10 - this.width, this.octave + offset));

		// redraw the piano
		this.redraw();
		return true;
	}

	/**
	 * Redraw the piano keys
	 */
	public redraw(): void {
		// find the wrapper
		const wrap = this.element.children[0] as HTMLDivElement;

		// remove all children
		while(wrap.children.length > 0){
			wrap.removeChild(wrap.children[0]);
		}

		const oc = this.octave * OctaveSize;

		// helper function to add a single key to the wrapper
		const key = (note:number, parent:HTMLDivElement) => {
			// create a new div element to store this key
			const e = document.createElement("div");
			e.classList.add("pianokey");

			// give the note attribute to get the note value
			e.setAttribute("note", ""+ note);

			// load the note cache data
			const cache = Piano.notesCache[ChannelType.YM7101PSG][Note.C0 + note + oc];

			if(cache) {
				// define classes based on sharp param
				switch(cache.sharp) {
					case "center":	e.classList.add("sharp"); break;
					case "left":	e.classList.add("sharp", "sl"); break;
					case "right":	e.classList.add("sharp", "sr"); break;
				}

				// if frequency is not a number, then it must be invalid
				if(typeof cache.frequency !== "number") {
					e.classList.add("invalid");
				}

				// add the inner text to show which note it is
				e.innerHTML = /*html*/`<span>${ cache.name.split("\u2060")[0] }</span>`;

			} else {
				// note is very not valid
				e.classList.add("invalid");
				e.innerHTML = /*html*/"<span>?</span>";
			}

			parent.appendChild(e);
		}

		// repeat for each octave
		for(let x = this.width, n = 0; x > 0; --x){
			// create a new div element to store this octave
			const e = document.createElement("div");
			e.classList.add("pianooctave");

			// find octave ID
			let o = "invalid";

			for(let y = 11;y >= 0; --y) {
				// check if there is a note cached here
				const c = Piano.notesCache[ChannelType.YM7101PSG][Note.C0 + n + y + oc];

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
	 * Initialize the piano fully
	 */
	public init(): void {
		// load the wrapper div
		const wrap = this.element.children[0] as HTMLDivElement;
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
				pos = (Math.max(0.05, Math.min(0.9, pos)) * (1 / 0.9));

				// calculate the note
				note = Note.C0 + (OctaveSize * this.octave) + (parseInt(e.target.getAttribute("note") ?? "0", 10));

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

			// when mouse is raised again, remove tracking events
			document.onmouseup = async() => {
				wrap.onmousemove = null;
				document.onmouseup = null;

				// release the note
				await release(note);
				note = 0;

				// remove the current element
				cur = undefined;
			};

			// do initial move event
			await move(e);
		}
	}

	/**
	 * Trigger a note at a certain velocity
	 *
	 * @param note The note ID to play
	 * @param velocity The velocity to play the note with, from 0 to 1.0.
	 */
	private async triggerNote(note:number, velocity:number) {
		// check if this note exists
		if(typeof Piano.notesCache[ChannelType.YM7101PSG][note]?.frequency === "number"){
			if(await window.ipc.driver.pianoTrigger(note, velocity, 8)){
				// add the active class
				this.modNote("active", "add", note);
			}
		}
	}

	/**
	 * Release a note
	 *
	 * @param note The note ID to release
	 */
	private async releaseNote(note:number) {
		// check if this note exists
		if(typeof Piano.notesCache[ChannelType.YM7101PSG][note]?.frequency === "number"){
			if(await window.ipc.driver.pianoRelease(note)){
				// remove the active class
				this.modNote("active", "remove", note);
			}
		}
	}

	/**
	 * Helper function to deal with classes for notes
	 *
	 * @param name The name of the class to affect
	 * @param mode Whether to add or remove the class
	 * @param note The note to check
	 */
	private modNote(name:string, mode:"add"|"remove", note:number) {
		// calculate octave
		const o = this.octave * OctaveSize;

		// check if this note is on the piano
		if(note > o && note - Note.C0 < o + (this.width * OctaveSize)) {
			// load the note offset
			const off = note - Note.C0 - o;

			// calculate the octave wrapper
			let e = (this.element.children[0] as HTMLDivElement).children[(off / 12) | 0];

			// calculate the final key
			e = (e.children[0] as HTMLDivElement).children[(off % 12) | 0];

			// if element exists, modify it
			e?.classList[mode](name);
		}
	}
}
