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
			rowHeight = data.dataHeight as number;
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
	}
}

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
	clearColor = theme?.fallback?.clear ?? fallbackRow;

	backdropColors = [];
	backdropColors.push(...(theme?.rowbg?.active ?? fallback3Row), ...(theme?.rowbg?.inactive ?? fallback3Row));

	rowNumColors = [];
	rowNumColors.push(...(theme?.rownum?.active ?? fallback3Text), ...(theme?.rownum?.inactive ?? fallback3Text));

	// reset element arrays
	unsetColors = [];
	channelElementColors = [];
	channelElementOffsets = [];

	// load element data
	for(const data of [ theme?.note, theme?.instrument, theme?.volume, ]) {
		// load each array with values
		channelElementOffsets.push(data?.left ?? 0);
		unsetColors.push([ ...(data?.activeblank ?? fallback3Text), ...(data?.inactiveblank ?? fallback3Text), ]);
		channelElementColors.push([ ...(data?.active ?? fallback3Text), ...(data?.inactive ?? fallback3Text), ]);
	}

	// load effect elements data
	let p = 0;

	for(const position of theme?.effectleft ?? []) {
		// load each array with values
		const data = theme ? theme[p & 1 ? "value" : "effect"] : undefined;
		unsetColors.push([ ...(data?.activeblank ?? fallback3Text), ...(data?.inactiveblank ?? fallback3Text), ]);
		channelElementColors.push([ ...(data?.active ?? fallback3Text), ...(data?.inactive ?? fallback3Text), ]);

		channelElementOffsets.push(position);
		p++;
	}

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

		// reload all rows that were requested
		const _f = fontLoaded;
		fontLoaded = null;
		_f?.forEach((f) => renderRow(f[0], f[1]));
	}).catch(console.error);
}

// receive messages from PatternCanvas
onmessage = (e) => handleMessage(e.data.command, e.data.data);

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
 * The row highlight numbers for this pattern
 */
let highlights:[ number, number ];

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
let rowHeight = 0;

/**
 * This is a list of all the channel x-positions from left. This helps canvases get lined up and with scrolling.
 */
let channelPositionsLeft:number[];

/**
 * This is a list of all the channel x-positions from right. This helps canvases get lined up.
 */
let channelPositionsRight:number[];

/**
 * Function to render a single row of graphics
 *
 * @param row The row number to render
 * @param active The active status of this row
 */
function renderRow(row:number, active:boolean) {
	// the top position of this row
	const top = row * rowHeight;

	// get the highlight ID
	const hid = (active ? 0 : 3) + ((row % highlights[0]) === 0 ? 2 : (row % highlights[1]) === 0 ? 1 : 0);

	// draw the background fill color
	ctx.fillStyle = backdropColors[hid];
	ctx.fillRect(0, top, canvas.width, rowHeight);

	// initialize border color
	ctx.fillStyle = clearColor;

	// loop for each channel position
	channelPositionsRight.forEach((left) => {
		// draw the border
		ctx.fillRect(left, top, 4, rowHeight);
	});

	if(fontLoaded !== null) {
		// font not loaded, instead add to the load queue
		if(fontLoaded.findIndex((d) => d[0] === row) < 0) {
			fontLoaded.push([ row, active, ]);
		}

	} else {
		// font loaded, run normally
		rendered[row] = true;

		// render the pattern index of this row
		ctx.fillStyle = rowNumColors[hid];
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
					ctx.fillStyle = channelElementColors[i][hid];
					ctx.fillText(text, left + channelElementOffsets[i], top + textVerticalOffset);

				} else {
					// render the element with blanks
					ctx.fillStyle = unsetColors[i][hid];
					ctx.fillText(i === 0 ? "---" : "--", left + channelElementOffsets[i], top + textVerticalOffset);
				}
			}
		}
	}
}

/**
 * The color that is displayed on a cleared pattern
 */
let clearColor:string;

/**
 * The list of backdrop colors depending on which highlight is active (or none at all)
 */
let backdropColors:string[] = [];

/**
 * The list of row number colors depending on which highlight is active (or none at all)
 */
let rowNumColors:string[] = [];

/**
 * The list of unset dash colors for each element in the channel row depending on which highlight is active (or none at all)
 */
let unsetColors:string[][] = [];

/**
 * The horizontal offsets for each element in the channel row
 */
let channelElementOffsets:number[] = [];

/**
 * The colors for each element in the channel row depending on which highlight is active (or none at all)
 */
let channelElementColors:string[][] = [];

/**
 * This is the vertical offset of text. This is needed somehow
 */
let textVerticalOffset = 0;

