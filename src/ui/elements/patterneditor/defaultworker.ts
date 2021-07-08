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

			// request the font to be loaded
			const font = new FontFace("Roboto Mono", "url(https://fonts.gstatic.com/s/robotomono/v13/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vq_ROW4.woff2)", {
				display: "swap",
			});

			// wait for the font to load
			font.load().then((f) => {
				// add to the global font stack
				(self as unknown as WorkerGlobalScope).fonts.add(f);

				// set context font status
				ctx.font = "10pt '"+ f.family +"'";

				// reload all rows that were requested
				const _f = fontLoaded;
				fontLoaded = null;
				_f?.forEach((f) => renderRow(f[0], f[1]));

			}).catch(console.error);

			break;
		}

		case "vars":
			// initialize some standard variables
			dataHeight = data.dataHeight as number;
			channelCount = data.channels as number;
			patternLen = data.patternlen as number;

			// create the row number function
			getRowNumber = data.getRowNumber ?
				(row:number) => row.toString(16).toUpperCase().padStart(2, "0") :
				(row:number) => row.toString().padStart(3, "0");
			break;

		case "posi":
			channelPositionsLeft = data.left as number[];
			channelPositionsRight = data.right as number[];
			break;

		case "clear":
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			break;

		case "renderrange":
			for(let i = data.start as number;i < (data.end as number);i ++) {
				if(!rendered[i]) {
					renderRow(i, data.active as boolean);
				}
			}
			break;

		case "invalidate":
			for(let i = data.start as number;i < (data.end as number);i ++){
				rendered[i] = false;
			}
			break;

		case "setactive": {
			// update active row
			const ar = activeRow;
			activeRow = data.row as number;

			// invalidate last active row
			if(ar >= 0) {
				renderRow(ar, data.active as boolean);
			}

			// invalidate current active row
			if(activeRow >= 0) {
				console.log("draw", activeRow)
				renderRow(activeRow, data.active as boolean);
			}
			break;
		}
	}
}

// receive messages from PatternCanvas
onmessage = (e) => handleMessage(e.data.command, e.data.data);

/**
 * The row that is currently active
 */
let activeRow = -1;

/**
 * Boolean indicating whether the font is loaded. Any font rendering is disallowed before font is loaded
 */
let fontLoaded:null|[ number, boolean, ][] = [];

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
 * The number of channels currently active
 */
let channelCount = 0;

/**
 * The number of rows in this pattern
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let patternLen = 0;

/**
 * The number of pixels for the height of each data element
 */
let dataHeight = 0;

/**
 * The horizontal offsets for each element in the channel row
 */
const channelElementOffsets = [ 3, 31, 50, 70, 87, ];

/**
 * The colors for each element in the channel row
 */
const channelElementColors = [ "#b7b7b7", "#7e81a5", "#62ab4a", "#b16f6f", "#bba6a1", ];

/**
 * This is the vertical offset of text. This is needed somehow
 */
const textVerticalOffset = 14;

/**
 * This is a list of all the channel x-positions from left. This helps canvases get lined up and with scrolling.
 */
let channelPositionsLeft!:number[];

/**
 * This is a list of all the channel x-positions from right. This helps canvases get lined up.
 */
let channelPositionsRight!:number[];

/**
 * Function to render a single row of graphics
 *
 * @param row The row number to render
 * @param active The active status of this row
 */
function renderRow(row:number, active:boolean) {
	// the top position of this row
	const top = row * dataHeight;

	// draw the background fill color
	ctx.fillStyle = active ? "#262627" : "#1E1E1E";
	ctx.fillRect(0, top, canvas.width, dataHeight);

	// initialize border color
	ctx.fillStyle = "#000";

	// loop for each channel position
	channelPositionsRight.forEach((left) => {
		// draw the border
		ctx.fillRect(left, top, 4, dataHeight);
	});

	// if this row is active, render a border around it
	if(activeRow === row) {
		ctx.strokeStyle = "#666";
		ctx.lineWidth = 2;
		ctx.strokeRect(1, top + 1, canvas.width - 1, dataHeight - 2);
	}

	if(fontLoaded !== null) {
		// font not loaded, instead add to the load queue
		if(fontLoaded.findIndex((d) => d[0] === row) < 0) {
			fontLoaded.push([ row, active, ]);
		}

	} else {
		// font loaded, run normally
		rendered[row] = true;

		// render the pattern index of this row
		ctx.fillStyle = active ? "#949494" : "#686868";
		ctx.fillText(getRowNumber(row), channelPositionsLeft[0] + 3, top + textVerticalOffset);

		// loop for every channel
		for(let c = 0;c < channelCount;c ++) {
			// load the channel position
			const left = channelPositionsLeft[c + 1];

			// render each channel element
			for(let i = 0;i < 5;i ++){
				// some dummy code to generate text for this row
				if(c & 1) {
					let text = "";
					switch(i) {
						case 0: text = "C#6"; break;
						case 1: text = "2F"; break;
						case 2: text = "11"; break;
						case 3: text = "WQ"; break;
						case 4: text = "DD"; break;
					}

					// render the element with text
					ctx.fillStyle = active ? channelElementColors[i] : "#686868";
					ctx.fillText(text, left + channelElementOffsets[i], top + textVerticalOffset);

				} else {
					// render the element with blanks
					ctx.fillStyle = active ? "#616161" : "#404040";
					ctx.fillText(i === 0 ? "---" : "--", left + channelElementOffsets[i], top + textVerticalOffset);
				}
			}
		}
	}
}

