import { ZorroEvent, ZorroEventEnum } from "../../../api/events";
import { PatternEditor } from "./main";

// create events
const eventNoteOn = ZorroEvent.createEvent(ZorroEventEnum.PianoNoteOn);
const eventNoteOff = ZorroEvent.createEvent(ZorroEventEnum.PianoNoteOff);

type QueueItem = { mode: boolean, note: number, freq: number, velocity: number, };

export class PianoProcessor {
	private parent:PatternEditor;

	/**
	 * The note queue. `mode = true` -> trigger, `mode = false` -> release
	 */
	private queue: QueueItem[] = [];

	constructor(parent:PatternEditor) {
		this.parent = parent;
	}

	/**
	 * Trigger a note at a certain velocity
	 *
	 * @param note The note ID to trigger
	 * @param velocity The velocity to trigger the note with, from 0 to 1.0.
	 * @returns boolean indicatin whether the note was triggered
	 */
	public triggerNote(note:number, velocity:number):boolean {
		// check if this note exists
		const freq = this.parent.tab.notesCache[this.parent.tab.selectedChannel.type]?.notes[note]?.frequency;

		if(typeof freq === "number"){
			// save the data to the queue finally
			this.queue.push({ mode: true, freq, note, velocity, });
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
		const freq = this.parent.tab.notesCache[this.parent.tab.selectedChannel.type]?.notes[note]?.frequency;

		if(typeof freq === "number"){
			// save the data to the queue finally
			this.queue.push({ mode: false, freq, note, velocity, });
			setTimeout(() => this.runQueue().catch(console.error), 0);
			return true;
		}

		return false;
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
			const { mode, note, freq, velocity, } = this.queue.shift() as QueueItem;

			if(!mode) {
				// reset the active note if released
				if(this.activeNote === note) {
					this.activeNote = 0;
				}

				// check if we can release this note
				if(!isNaN(freq)) {
					// can release on piano
					await eventNoteOff(this.parent.tab.selectedChannelId, note, velocity);
					this.activeNote = 0;
				}

			} else {
				if(this.parent.tab.recordMode) {
					// if in record mode, check whether to place this note
					if(this.parent.tab.recordMode){
						if(this.parent.shortcuts.getCurrentElementId() !== 0) {
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
							info[2].volume = Math.round(velocity * 0x7F);
						}

						if(this.activeNote) {
							// note is active, release it quickly
							await eventNoteOff(this.parent.tab.selectedChannelId, this.activeNote, 0);
						}

						// set new active note
						this.activeNote = isNaN(freq) ? 0 : note;

						// reload this row
						await this.parent.shortcuts.updateCurrentRow(info[0]);

						// apply step
						await this.parent.selectionManager.applyStep();

						// project is dirty now
					}
				}

				if(!isNaN(freq)) {
					// can play on piano
					await eventNoteOn(this.parent.tab.selectedChannelId, note, velocity);
				}
			}
		}

		this.processing = false;
	}
}
