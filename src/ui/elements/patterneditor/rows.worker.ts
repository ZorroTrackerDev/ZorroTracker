/*
 * note: here is a little dirty way to make the worker not complain about duplicate declarations;
 * These will be in separate threads so it doesn't matter!
 */
/* eslint-disable no-inner-declarations */
{
	let canvas:OffscreenCanvas;
	let ctx:OffscreenCanvasRenderingContext2D;

	// handler for received mesages from PatternCanvas instance
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handleMessage = (command:string, data:{ [key:string]: unknown }) => {
		switch(command) {
			case "init": {
				// initialize the canvas and 2D contexts
				canvas = data.canvas as OffscreenCanvas;
				const _ctx = canvas.getContext("2d");

				// did we get a context?
				if(!_ctx) {
					console.error("Where is my context!!!");
					return;
				}

				// save the context
				ctx = _ctx;
				break;
			}

			case "vars":
				// initialize some standard variables
				patternLen = data.patternlen as number;
				active = data.active as boolean;

				// create the row number function
				getRowNumber = data.rowFormat ?
					(row:number) => row.toString(16).toUpperCase().padStart(2, "0") :
					(row:number) => row.toString().padStart(3, "0");
				break;

			case "highlight":
				highlights = data.values as [ number, number ];
				break;

			case "theme":
				setTheme(data as unknown as WorkerThemeSettings);
				break;

			case "clear":
				ctx.fillStyle = "#000";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				break;

			case "render":
				render();
				break;

			case "record":
				record = data.status as boolean;
				render();
				break;
		}
	}

	/**
	 * The record status of this canvas
	 */
	let record = false;

	/**
	 * Load theme settings
	 *
	 * @param theme The theme to load
	 */
	function setTheme(theme:WorkerThemeSettings|undefined){
		// prepare some values
		const fallbackRow = theme?.fallback?.backdrop ?? "#000000";
		const fallback3Row = [ fallbackRow, fallbackRow, fallbackRow, ];
		const fallbackText = theme?.fallback?.text ?? "#FF00FF";
		const fallback3Text = [ fallbackText, fallbackText, fallbackText, ];

		// load some default values
		textVerticalOffset = theme?.font?.top ?? 0;
		rowHeight = theme?.params?.rowHeight ?? 0;

		borderColor = [
			theme?.params?.border ?? fallbackRow,
			theme?.params?.recordborder ?? fallbackRow,
		];

		backdropColors = [
			...((active ? theme?.rownum?.activebg : theme?.rownum?.inactivebg) ?? fallback3Row),
			...((active ? theme?.rownum?.recordactivebg : theme?.rownum?.recordinactivebg) ?? fallback3Row),
		];

		rowNumColors = [
			...((active ? theme?.rownum?.active : theme?.rownum?.inactive) ?? fallback3Text),
			...((active ? theme?.rownum?.recordactive : theme?.rownum?.recordinactive) ?? fallback3Text),
		];

		// request the font to be loaded
		const font = new FontFace(theme?.font?.name ?? "Font", theme?.font?.source ?? "url()", {
			display: "swap",
		});

		// wait for the font to load
		font.load().then((f) => {
			// add to the global font stack
			(self as unknown as WorkerGlobalScope).fonts.add(f);

			// set context font status
			ctx.font = theme?.font?.size +" '"+ f.family +"'";

			// invalidate every row
			for(let i = 0;i < rendered.length;i ++){
				rendered[i] = false;
			}

			// tell we are done loading the theme
			postMessage("theme");

			// if redrawing is required, do it now
			if(fontWait === true) {
				render();
			}

			fontWait = null;

		}).catch(console.error);
	}

	// receive messages from PatternCanvas
	onmessage = (e) => handleMessage(e.data.command, e.data.data);

	/**
	 * Boolean indicating whether the font is loaded. Any font rendering is disallowed before font is loaded
	 */
	let fontWait:null|boolean = false;

	/**
	 * This bitfield determines which rows are rendered already, so they can't be re-rendered
	 */
	const rendered:boolean[] = [];

	/**
	 * Helper function to convert row numbers to string. This can be different based on flags.json5
	 *
	 * @param row The row number to calculcate
	 * @returns A string representing the row number
	 */
	let getRowNumber:(row:number) => string;

	/**
	 * The row highlight numbers for this pattern
	 */
	let highlights:[ number, number ];

	/**
	 * The number of rows in this pattern
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let patternLen = 0;

	/**
	 * The number of pixels for the height of each data element
	 */
	let rowHeight = 0;

	/**
	 * Status indicating whether this is the active row list or not
	 */
	let active = false;

	/**
	 * Function to render all rows at once
	 *
	 * @param active The active status of this row
	 */
	function render() {
		if(fontWait !== null) {
			fontWait = true;

		} else {
			// store the record offset
			const rc = (record ? 3 : 0);

			// background fill the entire canvas with base color first
			ctx.fillStyle = backdropColors[rc];
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// fill the border in too
			ctx.fillStyle = borderColor[record ? 1 : 0];
			ctx.fillRect(31, 0, 4, canvas.height);

			for(let row = 0;row < patternLen;row ++) {
				// the top position of this row
				const top = row * rowHeight;

				// get the highlight ID
				const hid = rc + ((row % highlights[0]) === 0 ? 2 : (row % highlights[1]) === 0 ? 1 : 0);

				if(hid !== 0) {
					// render the highlight color over this
					ctx.fillStyle = backdropColors[hid];
					ctx.fillRect(0, top, 31, rowHeight);
				}

				// render the pattern index of this row
				ctx.fillStyle = rowNumColors[hid];
				ctx.fillText(getRowNumber(row), 3, top + textVerticalOffset);
			}
		}
	}

	/**
	 * The color that is displayed on a cleared pattern
	 */
	let borderColor: [ string, string, ];

	/**
	 * The list of backdrop colors depending on which highlight is active (or none at all)
	 */
	let backdropColors:string[] = [];

	/**
	 * The list of row number colors depending on which highlight is active (or none at all)
	 */
	let rowNumColors:string[] = [];

	/**
	 * This is the vertical offset of text. This is needed somehow
	 */
	let textVerticalOffset = 0;
}
