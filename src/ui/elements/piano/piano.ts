import { loadFlag } from "../../../api/files";
import { UIElement } from "../../../api/ui";

export class Piano implements UIElement {
	public static async create() : Promise<Piano> {
		const piano = new Piano();
		piano.width = loadFlag<number>("PIANO_DEFAULT_SIZE") ?? 2;
		piano.octave = loadFlag<number>("PIANO_DEFAULT_OCTAVE") ?? 3;
		piano.position = loadFlag<number>("PIANO_DEFAULT_POSITION") ?? 0;

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
	public async receiveShortcut(data:string[]):Promise<boolean> {
		// helper function to process an octave of notes
		const octave = (data:string[], octave:number) => {
			// helper function to trigger a single note
			const note = (note:number) => {
				const n = 1 + note + octave + (this.octave * this.octaveData.length);

				this.triggerNote(n, 1);
				setTimeout(() => this.releaseNote(n), 100);
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
			case "octave1":		return octave(data, this.octaveData.length);
			case "octave2":		return octave(data, this.octaveData.length * 2);
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
		// update octave and cap it between 0 and 10 - (num of visible octaves)
		this.octave = Math.max(0, Math.min(10 - this.width, this.octave + offset));

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

		// helper function to add a single key to the wrapper
		const key = (o: { note: string, class?: string[], }, note: number) => {
			// create a new div element to store this key
			const e = document.createElement("div");
			e.classList.add("pianokey");

			// give the note attribute to get the note value
			e.setAttribute("note", ""+ note);

			if(o.class) {
				// if a class is defined for this note, add it
				e.classList.add(...(o.class as string[]));
			}

			// add the inner text to show which note it is
			e.innerHTML = /*html*/`<span>${ o.note }</span>`;

			wrap.appendChild(e);
		}

		// repeat for each octave
		for(let x = this.width, n = 0; x > 0; --x){
			// generate an octave
			this.octaveData.forEach((o) => key(o, n++));
		}
	}

	/**
	 * This array defines data for each octave, so that we can easily represent it
	 */
	private readonly octaveData = [
		{ note: "C", },
		{ note: "C#", class: [ "sharp", "sl", ], },
		{ note: "D", },
		{ note: "D#", class: [ "sharp", "sr", ], },
		{ note: "E", },
		{ note: "F", },
		{ note: "F#", class: [ "sharp", "sl", ], },
		{ note: "G", },
		{ note: "G#", class: [ "sharp", ], },
		{ note: "A", },
		{ note: "A#", class: [ "sharp", "sr", ], },
		{ note: "B", },
	];

	/**
	 * Initialize the piano fully
	 */
	public init(): void {
		// load the wrapper div
		const wrap = this.element.children[0] as HTMLDivElement;
		let cur:HTMLDivElement|undefined, note = 0;

		// helper function to release the current note
		const release = () => {
			// remove the current element
			cur = undefined;

			if(note > 0) {
				// release note
				this.releaseNote(note);
				note = 0;
			}
		}

		// helper function to handle mouse movement
		const move = (e:MouseEvent) => {
			if(e.target instanceof HTMLDivElement && (e.target as HTMLDivElement).classList.contains("pianokey")) {
				// this is a piano key
				if(cur === e.target) {
					// if same as the current key, ignore
					return;
				}

				// release the note
				release();

				// activate it
				cur = e.target;

				// calculate velocity
				const rect = cur.getBoundingClientRect();
				let pos = (e.clientY - rect.top) / rect.height;

				// make the position a bit saner
				pos = (Math.max(0.1, Math.min(0.8, pos)) * (1 / 0.8));

				// calculate the note
				note = 1 + (this.octaveData.length * this.octave) + (parseInt(cur.getAttribute("note") ?? "0", 10));

				// trigger the note
				this.triggerNote(note, pos);
			}
		};

		// handle mousedown event
		wrap.onmousedown = (e) => {
			// create new mouse move event
			wrap.onmousemove = move;

			// when mouse is raised again, remove tracking events
			wrap.onmouseup = () => {
				wrap.onmousemove = null;
				wrap.onmouseup = null;

				// release the note
				release();
			};

			// do initial move event
			move(e);
		}
	}

	/**
	 * Trigger a note at a certain velocity
	 *
	 * @param note The note ID to play
	 * @param velocity The velocity to play the note with, from 0 to 1.0.
	 */
	private triggerNote(note: number, velocity: number) {
		console.log("trigger", note, (Math.round(velocity * 1000) / 10) +"%");

		// add the active class
		this.modNote("active", "add", note);
	}

	/**
	 * Release a note
	 *
	 * @param note The note ID to release
	 */
	private releaseNote(note: number) {
		console.log("release", note)

		// remove the active class
		this.modNote("active", "remove", note);
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
		const o = this.octave * this.octaveData.length;

		// check if this note is on the piano
		if(note > o && note - 1 < o + (this.width * this.octaveData.length)) {
			// note is inside, find the html element
			const e = (this.element.children[0] as HTMLDivElement).children[note - 1 - o] as HTMLDivElement|undefined;

			// if element exists, modify it
			e?.classList[mode](name);
		}
	}
}
