import { ZorroEvent, ZorroEventEnum, ZorroSenderTypes } from "../../api/events";
import { loadFlag } from "../../api/files";

export class MIDI {
	public static current:MIDI|null = null;

	/**
	 * Function to initialize the MIDI interface and listen to MIDI devices.
	 *
	 * @returns A boolean indicating whether MIDI is enabled
	 */
	public static init():boolean {
		// check if MIDI is enabled
		if(!loadFlag<boolean>("MIDI_ENABLE")) {
			return false;
		}

		// create events
		MIDI.eventNoteOn = ZorroEvent.createEvent(ZorroEventEnum.MidiNoteOn);
		MIDI.eventNoteOff = ZorroEvent.createEvent(ZorroEventEnum.MidiNoteOff);

		// start polling whether MIDI devices are connected every 1 second
		MIDI.poll();
		return true;
	}

	private static eventNoteOn: ZorroSenderTypes[ZorroEventEnum.MidiNoteOn];
	private static eventNoteOff: ZorroSenderTypes[ZorroEventEnum.MidiNoteOff];

	/**
	 * Function to start polling connected MIDI devices to allow listening to events.
	 */
	private static poll() {
		// start inspecting whether MIDI devices are connected every second
		const it = setInterval(async() => {
			const e = document.getElementById("midi") as HTMLDivElement;

			// get the first valid MIDI device
			const access = await navigator.requestMIDIAccess();
			const target = access.inputs.entries().next().value as [ string, WebMidi.MIDIInput ];

			// if nothing is found, just exit
			if(!target) {
				e.innerText = "not found";
				return null;
			}

			// found device, create instance and cancel the interval
			MIDI.current = new MIDI(target[1]);
			clearInterval(it);

			e.innerText = target[1].name ?? "unknown";

		}, 1*1000);
	}

	/**
	 * The current MIDI input device
	 */
	private device: WebMidi.MIDIInput;

	/**
	 * Helper function to create a new MIDI device object
	 *
	 * @param device The MIDIInput instance for this device
	 */
	constructor(device:WebMidi.MIDIInput) {
		this.device = device;

		// check for device state changes
		device.onstatechange = () => {
			if(device.state === "disconnected"){
				// release all active notes
				this.activeNotes.forEach((note) => this.noteEvent(false, -1, note, 0));

				// if devices becomes disconnected, poll for any more MIDI devices
				MIDI.current = null;
				MIDI.poll();
			}
		};

		// handle device messages
		device.onmidimessage = async(e) => {
			// handle the message type
			switch(e.data[0] & 0xF0) {
				case 0x80:		// note off
					await this.noteEvent(false, e.data[0] & 0x0F, e.data[1], e.data[2]);
					break;

				case 0x90:		// note on
					await this.noteEvent(e.data[2] > 0, e.data[0] & 0x0F, e.data[1], e.data[2]);
					break;
			}
		};
	}

	private activeNotes:number[] = [];

	/**
	 * Helper function to transmit a system message for playing a MIDI note.
	 *
	 * @param keyon Whether this is a key on even or key off event.
	 * @param channel The target channel for this message
	 * @param note The note number to play
	 * @param velocity The velocity of the note
	 */
	private async noteEvent(keyon:boolean, channel:number, note:number, velocity:number) {
		// translate velocity into 0..1 range
		const tv = velocity / 127.0;

		// finally call the event dispatcher for this note
		await (keyon ? MIDI.eventNoteOn : MIDI.eventNoteOff)(channel, note, tv);

		if(keyon) {
			// add to active notes
			if(!this.activeNotes.includes(note)) {
				this.activeNotes.push(note);
			}

		} else {
			// remove from active notes
			const ix = this.activeNotes.indexOf(note);

			if(ix >= 0) {
				this.activeNotes.splice(ix, 1);
			}
		}
	}
}
