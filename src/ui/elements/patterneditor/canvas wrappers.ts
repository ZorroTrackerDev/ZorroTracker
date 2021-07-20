import { Tab } from "../../misc/tab";
import { theme } from "../../misc/theme";
import { PatternEditor } from "./main";

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
		this.worker.postMessage({ command: "highlight", data: { values: parent.rowHighlights, }, });
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
		super(parent, patternlen, "../elements/patterneditor/rows.worker.js", 35, height);

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
		super(parent, patternlen, "../elements/patterneditor/channels.worker.js", parent.canvasWidth, height);

		// give canvas its class
		this.element.classList.add("patterncanvas");

		// update a few variables to the worker
		this.worker.postMessage({ command: "vars", data: {
			channels, patternlen, dataHeight: parent.dataHeight, getRowNumber: parent.getRowNumber,
		}, });

		// set internal variables to default values
		this.pattern = -1;
		this.active = false;
	}

	/**
	 * Helper function to update channel widths for the canvas
	 */
	public updateChannelWidths(): void {
		// update positional data to the worker
		this.worker.postMessage({ command: "posi", data: {
			right: this.parent.channelPositionsRight, left: this.parent.channelPositionsLeft,
			elements: this.parent.channelElements,
			width: this.parent.renderAreaWidth - 35,
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
	public updateHoriz(parent:PatternEditor): void {
		this.element.style.left = (35 - parent.horizScroll) +"px";
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
	 * Function to invalidate every row of the canvas
	 */
	public invalidateAll(): void {
		this.invalidateRange(0, this.patternlen);
	}

	/**
	 * Invalidate a range of rows in the canvas
	 *
	 * @param start The start of the range to invalidate
	 * @param end The end of the range to invalidate
	 */
	public invalidateRange(start:number, end:number): void {
		// send the invalidate command
		this.worker.postMessage({ command: "invalidate", data: { start, end, }, });
	}

	/**
	 * Function to render part of the pattern if not rendered
	 *
	 * @param start The start of the range of rows to render
	 * @param end The end of the range of rows to render
	 */
	public renderPattern(start:number, end:number): void {
		// set the canvas as not cleared
		this.isClear = false;

		// send the command to render row
		this.worker.postMessage({ command: "renderrange", data: { start, end, active: this.active, }, });
	}
}
