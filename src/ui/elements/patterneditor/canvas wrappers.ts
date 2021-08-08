import { NoteReturnType } from "../../../api/driver";
import { PatternData } from "../../../api/matrix";
import { Note } from "../../../api/notes";
import { Tab } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { PatternEditor } from "./main";
import { PatternEditorScrollManager } from "./scroll manager";

/**
 * Some helper functions that apply to all types of canvases
 */
class EditorCanvasBase {
	// the canvas element itself for this canvas
	public element!:HTMLCanvasElement;

	// the parent of this element
	public parent!:PatternEditor;

	// the worker for this canvas
	public worker!:Worker;

	/**
	 * The length of the pattern this is showing
	 */
	protected patternlen:number;

	/**
	 * Initialize this PatternCanvas and store some data passed.
	 *
	 * @param parent The parent `PatternEditor` instance that is in control of this canvas
	 * @param patternlen The number of rows per pattern
	 * @param worker The URL for the worker script to initialize.
	 * @param width The width of the entire canvas in pixels
	 * @param height The height of the entire canvas in pixels
	 */
	constructor(parent:PatternEditor, patternlen:number, worker:string, width:number, height:number) {
		// store internal variables
		this.patternlen = patternlen;
		this.parent = parent;

		// create the main canvas and update its size
		this.element = document.createElement("canvas");
		this.element.width = width;
		this.element.height = height;

		// set canvas offscreen
		this.element.style.top = "-10000px";

		// initialize the offscreen canvas worker
		this.worker = new Worker(worker);
		const offscreen = this.element.transferControlToOffscreen();
		this.worker.postMessage({ command: "init", data: { canvas: offscreen, }, }, [ offscreen, ]);

		// update highlight data to the worker
		this.updateHighlights();
	}

	/**
	 * Clear all the resources this PatternCanvas uses
	 */
	public dispose(): void {
		// remove the canvas from DOM
		this.element.parentElement?.removeChild(this.element);

		// tell the worker to close
		this.worker.terminate();
	}

	/**
	 * Helper function to update row highlights
	 */
	public updateHighlights(): void {
		this.worker.postMessage({ command: "highlight", data: { values: this.parent.scrollManager.rowHighlights, }, });
	}

	/**
	 * Helper function to tell the worker to reload the theme
	 */
	public reloadTheme(): Promise<void> {
		return new Promise((res, rej) => {
			// tell the worker to reload the theme
			this.worker.postMessage({ command: "theme", data: theme?.pattern?.worker ?? {}, });

			// handle incoming messages
			const msg = (e:MessageEvent) => {
				if(e.data === "theme") {
					// right message, resolve
					res();
					this.worker.removeEventListener("message", msg);
				}
			};

			// listen to messages
			this.worker.addEventListener("message", msg);

			// if worker does not respond in 1 second, bail
			setTimeout(() => {
				this.worker.removeEventListener("message", msg);
				rej("Did not get a response from worker");
			}, 1000);
		});
	}

	/**
	 * Helper function to update the record status of canvas
	 */
	public setRecord() {
		// tell the worker to update record state
		this.worker.postMessage({ command: "record", data: { status: Tab.active?.recordMode ?? false, }, });
	}

	/**
	 * Helper function to update the record status of canvas
	 */
	public setRowCount(patternlen:number) {
		// tell the worker to update record state
		this.worker.postMessage({ command: "setrowcount", data: { patternlen: this.patternlen = patternlen, }, });
	}
}

export class RowsCanvas extends EditorCanvasBase {
	/**
	 * Initialize this RowsCanvas and store some data passed.
	 *
	 * @param height The height of the entire canvas in pixels
	 * @param parent The parent `PatternEditor` instance that is in control of this canvas
	 * @param patternlen The number of rows per pattern
	 * @param rowFormat Boolean indicating whether to use hex or dec numbers for rows
	 * @param active Boolean to indicate whether this is the active style canvas or the inactive one
	 */
	constructor(height:number, parent:PatternEditor, patternlen:number, rowFormat:boolean, active:boolean) {
		super(parent, patternlen, "../elements/patterneditor/rows.worker.js", parent.padding.left, height);

		// give canvas its class
		this.element.classList.add("rowscanvas");

		// update a few variables to the worker
		this.worker.postMessage({ command: "vars", data: { rowFormat, active, patternlen, }, });
	}

	/**
	 * Function to render the rows into canvas
	 */
	public render(): void {
		// send the command to render row
		this.worker.postMessage({ command: "render", data: { }, });
	}
}

export type PatternChannelInfo = {
	/**
	 * The width of the channel data
	 */
	width: number,

	/**
	 * The left-position of this channel in the host canvas
	 */
	left: number,

	/**
	 * The right-position of this channel in the host canvas
	 */
	right: number,

	/**
	 * The array of elements to render
	 */
	elements: number[],

	/**
	 * The offsets of elements to render
	 */
	offsets: number[],
}

/**
 * Helper class for each pattern canvas
 */
export class PatternCanvas extends EditorCanvasBase {
	/**
	 * Initialize this PatternCanvas and store some data passed.
	 *
	 * @param height The height of the entire canvas in pixels
	 * @param parent The parent `PatternEditor` instance that is in control of this canvas
	 * @param patternlen The number of rows per pattern
	 * @param channels The number of channels in the project
	 */
	constructor(height:number, parent:PatternEditor, patternlen:number, channels:number) {
		super(parent, patternlen, "../elements/patterneditor/channels.worker.js", parent.scrollManager.canvasWidth, height);

		// give canvas its class
		this.element.classList.add("patterncanvas");

		// store channel count
		this.channels = channels;

		// update a few variables to the worker
		this.worker.postMessage({ command: "vars", data: {
			channels, patternlen, dataHeight: parent.scrollManager.rowHeight, getRowNumber: parent.scrollManager.getRowNumber,
		}, });

		// set internal variables to default values
		this.pattern = -1;
		this.active = false;
	}

	/**
	 * Helper function to update some rendering info
	 */
	public updateRenderInfo(): void {
		// update positional data to the worker
		this.worker.postMessage({ command: "renderinfo", data: {
			width: this.parent.scrollManager.renderAreaWidth - this.parent.padding.left,
		}, });
	}

	/**
	 * The current pattern that this canvas is showing
	 */
	public pattern:number;

	/**
	 * Whether this is the active canvas
	 */
	public active:boolean;

	/**
	 * Whether this canvas is fully cleared (black)
	 */
	public isClear!:boolean;

	/**
	 * Update horizontal scrolling of canvas
	 */
	public updateHoriz(parent:PatternEditorScrollManager): void {
		this.element.style.left = (this.parent.padding.left - parent.horizScroll) +"px";
	}

	/**
	 * Function to fill the canvas with black and invalidate all rows
	 */
	public clear(): void {
		// send the clear command
		this.worker.postMessage({ command: "clear", data: {}, });

		// set as cleared and invalidate the entire canvas
		this.isClear = true;
		this.invalidateAll();
	}

	/**
	 * Helper command to fill the void left after channel data. This is useful for resizing channels
	 */
	public fillVoid(): void {
		this.worker.postMessage({ command: "fillvoid", data: {}, });
	}

	/**
	 * The channel count of this pattern
	 */
	private channels: number;

	/**
	 * Function to tell the worker its safe to init the channel canvases
	 *
	 * @param channel The channel to update now
	 * @param info Channel information to update with
	 */
	public updateChannel(channel:number, info:PatternChannelInfo): void {
		this.worker.postMessage({ command: "updatech", data: {
			channel, ...info,
		}, });
	}

	/**
	 * Function to invalidate every row of the canvas
	 */
	public invalidateAll(): void {
		this.invalidateRows(0, this.patternlen);
	}

	/**
	 * Invalidate a range of rows in the canvas
	 *
	 * @param start The start of the range of rows to invalidate
	 * @param end The end of the range of rows to invalidate
	 */
	public invalidateRows(start:number, end:number): void {
		// send the invalidate command1
		this.worker.postMessage({ command: "invalidate", data: { start, end, left: 0, right: this.channels, }, });
	}

	/**
	 * Invalidate a range of channels in the canvas
	 *
	 * @param left The start of the range of channels to invalidate
	 * @param right The end of the range of channels to invalidate
	 */
	public invalidateChannels(left:number, right:number): Promise<void> {
		// invalidate every row in channels
		return this.dataArea(0, this.patternlen, left, right);
	}

	/**
	 * Invalidate an area of the canvas
	 *
	 * @param start The start of the range of rows to invalidate
	 * @param end The end of the range of rows to invalidate
	 * @param left The start of the range of channels to invalidate
	 * @param right The end of the range of channels to invalidate
	 */
	public invalidateArea(start:number, end:number, left:number, right:number): void {
		// send the invalidate command
		this.worker.postMessage({ command: "invalidate", data: { start, end, left, right, }, });
	}

	/**
	 * Function to render part of the pattern if not rendered
	 *
	 * @param start The start of the range of rows to render
	 * @param end The end of the range of rows to render
	 * @param left The start of the range of channels to render
	 * @param right The end of the range of channels to render
	 */
	public render(start:number, end:number, left:number, right:number): void {
		// set the canvas as not cleared
		this.isClear = false;

		// send the command to render row
		this.worker.postMessage({ command: "renderrange", data: { start, end, active: this.active, left, right, }, });
	}

	/**
	 * Function to update pattern data at the entire pattern
	 */
	public dataAll(): Promise<void> {
		return this.dataArea(0, this.patternlen, 0, this.channels);
	}

	/**
	 * Function to update pattern data in an area
	 *
	 * @param start The start of the range of rows to update
	 * @param end The end of the range of rows to update
	 * @param left The start of the range of channels to update
	 * @param right The end of the range of channels to update
	 */
	public async dataArea(start:number, end:number, left:number, right:number): Promise<void> {
		for(let c = left;c < right;c ++) {
			await this.dataChannel(start, end, c);
		}
	}

	/**
	 * Function to update all pattern data in a single channel
	 *
	 * @param channel The channel to update
	 */
	public dataChannelFull(channel:number): Promise<void> {
		return this.dataChannel(0, this.patternlen, channel);
	}

	/**
	 * Helper function to fetch the data parameters
	 */
	private async fetchDataParams(channel:number, pattern:number): Promise<[ PatternData, NoteReturnType ]|null> {
		// load the pattern info
		const rp = this.parent.tab.matrix.get(channel, pattern);

		if(typeof rp !== "number") {
			return null;
		}

		const pd = this.parent.tab.matrix.patterns[channel][rp];

		if(!pd) {
			return null;
		}

		// find the note stuffs
		const nd = await this.parent.tab.getNotes(this.parent.tab.channels[channel].type);

		if(!nd) {
			return null;
		}

		return [ pd, nd, ];
	}

	/**
	 * Function to update pattern data in a single channel
	 *
	 * @param start The start of the range of rows to update
	 * @param end The end of the range of rows to update
	 * @param channel The channel to update
	 */
	public async dataChannel(start:number, end:number, channel:number): Promise<void> {
		const rows:WorkerData[] = [];

		// load the input params
		const res = await this.fetchDataParams(channel, this.pattern);

		if(!res) {
			return;
		}

		// loop for all rows to update
		for(let r = start; r < end; r++) {
			rows.push(this.getData(res[0], res[1], r, channel));
		}

		// send the command to update data
		this.worker.postMessage({ command: "patterndata", data: rows, });
	}

	/**
	 * Function to update pattern data in a single channel
	 *
	 * @param row The row to update
	 * @param channel The channel to update
	 */
	public async dataRow(row:number, channel:number): Promise<void> {
		// load the input params
		const res = await this.fetchDataParams(channel, this.pattern);

		if(!res) {
			return;
		}

		// send the command to update data
		this.worker.postMessage({ command: "patterndata", data: [ this.getData(res[0], res[1], row, channel), ], });
	}

	/**
	 * Function to load pattern data for a specific row
	 *
	 * @param row The row to update
	 * @param channel The channel to update
	 * @returns ready-converted data
	 */
	private getData(pd:PatternData, nd:NoteReturnType, row:number, channel:number): WorkerData {
		const res:(string|undefined)[] = [];
		const cell = pd.cells[row];

		// valid pattern found, fill the array now
		res.push(this.convertNote(nd, cell.note as Note));
		res.push(cell.instrument === null ? undefined : this.getHex(cell.instrument));
		res.push(cell.volume === null ? undefined : this.getHex(cell.volume));

		// load every effect
		for(let i = 0;i < this.parent.maxEffects; i++) {
			res.push(i & 1 ? undefined : "XY");
			res.push(i & 1 ? undefined : this.getHex(cell.effects[i]?.value ?? 0));
		}

		return [ channel, row, res, ]
	}

	/**
	 * Helper function to convert any value to 2-character hex code
	 */
	private getHex(data:number) {
		let str = data.toString(16).toUpperCase();

		if(str.length === 1) {
			str = "0"+ str;

		} else if(str.length > 2) {
			str = str.substring(0, 2);
		}

		return str;
	}

	/**
	 * Helper function to convert a note value to string
	 */
	private convertNote(nd:NoteReturnType, note:Note) {
		// special case: null note
		if(note === Note.Null) {
			return undefined;
		}

		// invalid note name
		if(!nd.notes[note] || !nd.notes[note].name) {
			return undefined;
		}

		// construct name and make sure its correctly aligned to 2 characters
		let name = nd.notes[note].name;
		const octave = nd.notes[note].octave;

		if(typeof octave === "number") {
			// append octave
			if(name.length === 1) {
				name += "-";

			} else if(name.length > 2) {
				name = name.substring(0, 2);
			}

			name += Math.abs(octave);

			// special handling for negative octaves
			if(octave < 0) {
				name = "\u200B"+ name;
			}

		} else if(name.length > 3) {
			// clip the length off at 3
			name = name.substring(0, 3);
		}

		// finally got octave name
		return name;
	}
}

type WorkerData = [ number, number, (string|undefined)[] ];
