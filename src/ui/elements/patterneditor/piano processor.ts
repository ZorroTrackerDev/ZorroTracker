import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { loadFlag } from "../../../api/files";
import { Note } from "../../../api/notes";
import { PlayMode } from "../../misc/tab";
import { PatternEditor } from "./main";

// create events
const eventNoteOn = ZorroEvent.createEvent(ZorroEventEnum.PianoNoteOn);
const eventNoteOff = ZorroEvent.createEvent(ZorroEventEnum.PianoNoteOff);

type QueueItem = { mode: boolean, note: number, freq: number, volume: number, velocity: number, };

export class PianoProcessor {
	private parent:PatternEditor;

	/**
	 * The note queue. `mode = true` -> trigger, `mode = false` -> release
	 */
	private queue: QueueItem[] = [];

	constructor(parent:PatternEditor) {
		this.parent = parent;

		this.reptDelay = loadFlag<number>("PIANO_REPEAT_DELAY") ?? 800;
		this.reptWait = loadFlag<number>("PIANO_REPEAT_WAIT") ?? 300;
	}

	/**
	 * Repeat delay parameters
	 */
	private reptDelay: number;
	private reptWait: number;

	/**
	 * Trigger a note at a certain velocity
	 *
	 * @param note The note ID to trigger
	 * @param velocity The velocity to trigger the note with, from 0 to 1.0.
	 * @returns boolean indicatin whether the note was triggered
	 */
	public triggerNote(note:number, velocity:number):boolean {
		// check if this note exists
		const cache = this.parent.tab.notesCache[this.parent.tab.selectedChannel.type];
		const freq = cache?.notes[note]?.frequency;

		if(typeof freq === "number"){
			// save the data to the queue finally
			this.queue.push({ mode: true, freq, note, velocity, volume: Math.round(velocity * cache.maxvolume), });
			setTimeout(() => this.runQueue().catch(console.error), 0);
			return true;
		}

		return false;
	}

	/**
	 * Release a note
	 *
	 * @param note The note ID to release
	 * @param velocity The velocity to release the note with, from 0 to 1.0.
	 * @returns boolean indicatin whether the note was released
	 */
	public releaseNote(note:number, velocity:number): boolean {
		// check if this note exists
		const cache = this.parent.tab.notesCache[this.parent.tab.selectedChannel.type];
		const freq = cache?.notes[note]?.frequency;

		// save the data to the queue finally
		this.queue.push({ mode: false, freq: freq ?? 0, note, velocity, volume: Math.round(velocity * cache.maxvolume), });
		setTimeout(() => this.runQueue().catch(console.error), 0);
		return true;
	}

	/**
	 * Currently active note on the chip. This only matters in record mode
	 */
	private activeNote = 0;

	/**
	 * If true, currently processing piano notes
	 */
	private processing = false;

	/**
	 * Helper function to run the piano queue
	 */
	private async runQueue() {
		if(this.processing) {
			return;
		}

		this.processing = true;

		// while there is stuff in the queue, pop the first item from start off
		while(this.queue.length > 0) {
			const { mode, freq, note, volume, velocity, } = this.queue.shift() as QueueItem;

			if(!mode) {
				// reset the active note if released
				if(this.activeNote === note) {
					this.activeNote = 0;
					this.disableRepeat();
				}

				// check if we can release this note
				if(!isNaN(freq)) {
					// can release on piano
					await eventNoteOff(this.parent.tab.selectedChannelId, note, velocity);
				}

			} else {
				let polyphony = true;

				// if in record mode, check whether to place this note
				if(this.parent.tab.recordMode){
					if(this.parent.shortcuts.getCurrentElementId() !== 0 || !this.parent.shortcuts.editorHasFocus()) {
						// do not allow notes to be played if element ID is not 0
						continue;
					}

					// check if the pattern cell is valid
					const info = this.parent.shortcuts.getCurrentPatternCell();

					if(!info) {
						continue;
					}

					// save the note
					info[2].note = note;
					info[1].edited = true;

					// if enabled, also updates the note velocity
					if(this.parent.tab.recordVelocity) {
						info[2].volume = volume;
					}

					// if the instrument is different, also change that
					if(note >= Note.First && this.parent.shortcuts.getLastInstrument() !== this.parent.tab.selectedInstrument) {
						info[2].instrument = this.parent.tab.selectedInstrument;
					}

					if(this.activeNote) {
						// note is active, release it quickly
						await eventNoteOff(this.parent.tab.selectedChannelId, this.activeNote, 0);
						this.disableRepeat();
					}

					// set new active note
					this.activeNote = note;

					// reload this row
					await this.parent.shortcuts.updateCurrentRow(info[0]);

					// apply step
					await this.parent.selectionManager.applyStep();

					// project is dirty now
					this.parent.tab.project.dirty();

					// enable key repeat
					this.enableRepeat(note, volume);
					polyphony = false;

				} else {
					// if not in record mode then try to disable repeat anyway!!!
					this.disableRepeat();

					if(this.parent.tab.playMode !== PlayMode.Stopped) {
						// special note handling when playing to disable polyphony
						if(this.activeNote) {
							// note is active, release it quickly
							await eventNoteOff(this.parent.tab.selectedChannelId, this.activeNote, 0);
							this.disableRepeat();
						}

						// set new active note
						this.activeNote = note;
						polyphony = false;
					}
				}

				if(!isNaN(freq)) {
					// can play on piano
					await eventNoteOn(this.parent.tab.selectedChannelId, note, velocity, polyphony);
				}
			}
		}

		this.processing = false;
	}

	/**
	 * The timeout for key repeat on the piano on record mode
	 */
	private repeatTimeout: undefined|NodeJS.Timeout;

	/**
	 * Function to execute a note repeat on record mode
	 */
	private async noteRepeat(note:number, volume:number) {
		if(this.parent.tab.recordMode && this.parent.shortcuts.editorHasFocus()) {
			// put the note in again
			if(this.parent.shortcuts.getCurrentElementId() !== 0) {
				// do not allow notes to be played if element ID is not 0
				return this.disableRepeat();
			}

			// check if the pattern cell is valid
			const info = this.parent.shortcuts.getCurrentPatternCell();

			if(!info) {
				return this.disableRepeat();
			}

			// save the note
			info[2].note = note;
			info[1].edited = true;

			// if enabled, also updates the note velocity
			if(this.parent.tab.recordVelocity) {
				info[2].volume = volume;
			}

			// if the instrument is different, also change that
			if(note >= Note.First && this.parent.shortcuts.getLastInstrument() !== this.parent.tab.selectedInstrument) {
				info[2].instrument = this.parent.tab.selectedInstrument;
			}

			// reload this row
			await this.parent.shortcuts.updateCurrentRow(info[0]);

			// apply step
			await this.parent.selectionManager.applyStep();

			// project is dirty now
			this.parent.tab.project.dirty();

			// set a new timeout if not canceled
			if(this.repeatTimeout && this.activeNote === note) {
				this.repeatTimeout = setTimeout(() => this.noteRepeat(note, volume).catch(console.error), this.reptWait);
			}
		}
	}

	/**
	 * Helper function to disable the key repeat
	 */
	private disableRepeat() {
		if(this.repeatTimeout) {
			clearTimeout(this.repeatTimeout);
			this.repeatTimeout = undefined;
		}
	}

	/**
	 * Function to execute a note repeat on record mode
	 */
	private enableRepeat(note:number, volume:number) {
		if(this.parent.tab.recordMode) {
			this.repeatTimeout = setTimeout(() => this.noteRepeat(note, volume).catch(console.error), this.reptDelay);
		}
	}
}
