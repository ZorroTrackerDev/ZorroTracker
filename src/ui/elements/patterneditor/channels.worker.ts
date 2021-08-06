type ChannelCanvasInfo = {
	/**
	 * The canvas that the channel is rendering on
	 */
	canvas: OffscreenCanvas,

	/**
	 * The rendering context for that canvas
	 */
	ctx: OffscreenCanvasRenderingContext2D,

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
};

/*
 * note: here is a little dirty way to make the worker not complain about duplicate declarations;
 * These will be in separate threads so it doesn't matter!
 */
/* eslint-disable no-inner-declarations */
{
	let canvas: OffscreenCanvas;
	let mainctx: OffscreenCanvasRenderingContext2D;

	// the channel canvases and contexts
	const channels: ChannelCanvasInfo[] = [];

	/*
	 * the actual pattern data for this canvas. Format: pattern[channel][row][element]
	 */
	const pattern:(string|undefined)[][][] = [];

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
					(self as unknown as DedicatedWorkerGlobalScope).close();
					return;
				}

				// save the context
				mainctx = _ctx;
				break;
			}

			case "vars":
				// initialize some standard variables
				channelCount = data.channels as number;
				patternLen = data.patternlen as number;

				// generate the rendered array
				for(let c = 0;c < channelCount;c ++) {
					rendered[c] = [];
					pattern.push(new Array(256));

					for(let r = 0;r < patternLen;r ++) {
						// set every cell to false, meaning it needs to render
						rendered[c][r] = false;
					}
				}
				break;

			case "renderinfo":
				renderWidth = data.width as number;
				break;

			case "highlight":
				highlights = data.values as [ number, number ];
				break;

			case "theme":
				setTheme(data as unknown as WorkerThemeSettings);
				break;

			case "setrowcount":
				// update internal variables
				fontLoaded = [];
				patternLen = data.patternlen as number;
				canvas.height = patternLen * rowHeight;

				// update each channel canvases too
				channels.forEach((c) => {
					c.canvas.height = patternLen * rowHeight;
					c.ctx = c.canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
					c.ctx.font = fontinfo;
				});

				// update the invalidated area
				invalidateArea(0, patternLen, 0, channelCount);
				break;

			case "updatech": {
				const i = data.channel as number;

				// check if channel was not initialized or if the width is different
				if(!channels[i] || channels[i].width !== data.width) {
					// create the canvas and find its context
					let c:OffscreenCanvas;

					if(!channels[i]) {
						// generate a fully new canvas
						c = new OffscreenCanvas(data.width as number, patternLen * rowHeight);

					} else {
						// forcibly resize it
						c = channels[i].canvas;
						c.width = data.width as number;
					}

					const _ctx = c.getContext("2d");

					// did we get a context?
					if(!_ctx) {
						console.error("Where is my context for ch"+ i +"!!!");
						(self as unknown as DedicatedWorkerGlobalScope).close();
						return;
					}

					// clear the channel canvas with backdrop and update font
					_ctx.fillStyle = clearColor[record ? 1 : 0];
					_ctx.fillRect(0, 0, c.width, c.height);
					_ctx.font = fontinfo;

					// save the canvas info object
					channels[i] = {
						canvas: c,
						ctx: _ctx,
						width: data.width as number,
						left: data.left as number,
						right: data.right as number,
						elements: data.elements as number[],
						offsets: data.offsets as number[],
					};

					// invalidate everything
					invalidateArea(0, patternLen, i, i + 1);
				} else {
					// only certain properties need updating
					channels[i] = {
						canvas: channels[i].canvas,
						ctx: channels[i].ctx,
						width: data.width as number,
						left: data.left as number,
						right: data.right as number,
						elements: data.elements as number[],
						offsets: data.offsets as number[],
					};

					// need to stamp again
					stamp(i);
				}
				break;
			}

			case "clear":
				channels.forEach((c, ix) => {
					c.ctx.fillStyle = clearColor[record ? 1 : 0];
					c.ctx.fillRect(0, 0, c.canvas.width, c.canvas.height);
					stamp(ix);
				});
				break;

			case "fillvoid":
				mainctx.fillStyle = clearColor[record ? 1 : 0];
				mainctx.fillRect(renderWidth, 0, canvas.width - renderWidth, canvas.height);
				break;

			case "renderrange":
				// loop for all channels on the canvas
				for(let c = data.left as number;c < (data.right as number);c ++) {
					let render = false;

					// loop for all rows in the channel
					for(let i = data.start as number;i < (data.end as number);i ++) {
						// check if this was already rendered correctly
						if(!rendered[c][i]) {
							// if not, render and indicate stamping is needed
							renderRow(i, c, data.active as boolean);
							render = true;
						}
					}

					// if this channel was rendered, stamp it as well
					if(render) {
						stamp(c);
					}
				}
				break;

			case "invalidate":
				invalidateArea(data.start as number, data.end as number, data.left as number, data.right as number);
				break;

			case "record":
				record = data.status as boolean;
				invalidateArea(0, patternLen, 0, channelCount);
				break;

			case "patterndata":
				for(const d of data as unknown as [ number, number, (string|undefined)[] ][]) {
					// load each data item into pattern and invalidate
					pattern[d[0]][d[1]] = d[2];
					rendered[d[0]][d[1]] = false;
				}
				break;
		}
	}

	/**
	 * Function to invalidate an area at once
	 */
	function invalidateArea(start:number, end:number, left:number, right:number) {
		// loop for all channels on the canvas
		for(let c = left;c < right;c ++) {
			// loop for all the defined rows
			for(let i = start;i < end;i ++){
				rendered[c][i] = false;
			}
		}
	}

	// the width of the render area of this canvas
	let renderWidth = 0;

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
		borderWidth = theme?.params?.borderWidth ?? 0;

		clearColor = [
			theme?.params?.backdrop ?? fallbackRow,
			theme?.params?.recordbackdrop ?? fallbackRow,
		];

		borderColor = [
			theme?.params?.border ?? fallbackRow,
			theme?.params?.recordborder ?? fallbackRow,
		];

		backdropColors = [
			...(theme?.background?.active ?? fallback3Row),
			...(theme?.background?.inactive ?? fallback3Row),
			...(theme?.background?.recordactive ?? fallback3Row),
			...(theme?.background?.recordinactive ?? fallback3Row),
		];

		// reset element arrays
		unsetColors = [];
		channelElementColors = [];

		// load element data
		for(const data of [ theme?.note, theme?.instrument, theme?.volume, ]) {
			// load each array with values
			unsetColors.push([
				...(data?.activeblank ?? fallback3Text),
				...(data?.inactiveblank ?? fallback3Text),
				...(data?.recordactiveblank ?? fallback3Text),
				...(data?.recordinactiveblank ?? fallback3Text),
			]);

			channelElementColors.push([
				...(data?.active ?? fallback3Text),
				...(data?.inactive ?? fallback3Text),
				...(data?.recordactive ?? fallback3Text),
				...(data?.recordinactive ?? fallback3Text),
			]);
		}

		// load effect elements data
		for(let p = 0;p < ((theme?.fxnum ?? 0) * 2);p ++) {
			// load each array with values
			const data = theme ? theme[p & 1 ? "value" : "effect"] : undefined;

			unsetColors.push([
				...(data?.activeblank ?? fallback3Text),
				...(data?.inactiveblank ?? fallback3Text),
				...(data?.recordactiveblank ?? fallback3Text),
				...(data?.recordinactiveblank ?? fallback3Text),
			]);

			channelElementColors.push([
				...(data?.active ?? fallback3Text),
				...(data?.inactive ?? fallback3Text),
				...(data?.recordactive ?? fallback3Text),
				...(data?.recordinactive ?? fallback3Text),
			]);
		}

		// request the font to be loaded
		const font = new FontFace(theme?.font?.name ?? "Font", theme?.font?.source ?? "url()", {
			display: "swap",
		});

		// wait for the font to load
		font.load().then((f) => {
			// add to the global font stack
			(self as unknown as WorkerGlobalScope).fonts.add(f);

			// update the font text
			fontinfo = theme?.font?.size +" '"+ f.family +"'";

			// tell we are done loading the theme
			postMessage("theme");

			// reload all rows that were requested
			const _f = fontLoaded;
			fontLoaded = null;
			_f?.forEach((f) => renderRow(f[0], f[1], f[2]));
		}).catch(console.error);
	}

	// the font info data
	let fontinfo = "";

	// receive messages from PatternCanvas
	onmessage = (e) => handleMessage(e.data.command, e.data.data);

	/**
	 * Function to stamp the canvas graphics onto the main canvas
	 *
	 * @param channel The channel ID to stamp on the canvas
	 */
	function stamp(channel:number) {
		// simply draw the canvas graphic on top of the main canvas
		mainctx.drawImage(channels[channel].canvas, channels[channel].left, 0);
	}

	/**
	 * Boolean indicating whether the font is loaded. Any font rendering is disallowed before font is loaded
	 */
	let fontLoaded:null|[ number, number, boolean, ][] = [];

	/**
	 * This bitfield determines which rows are rendered already, so they can't be re-rendered
	 */
	const rendered:boolean[][] = [];

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
	 * The number of pixels for the width of the rightmost border of each channel
	 */
	let borderWidth = 0;

	/**
	 * Function to render a single row of graphics
	 *
	 * @param row The row number to render
	 * @param active The active status of this row
	 */
	function renderRow(row:number, channel:number, active:boolean) {
		// the top position of this row
		const top = row * rowHeight;

		// get the highlight ID
		const hid = (record ? 6 : 0) + (active ? 0 : 3) + ((row % highlights[0]) === 0 ? 2 : (row % highlights[1]) === 0 ? 1 : 0);

		// load the channel data and return if undefined. TODO: Check if this can cause issues
		const cd = channels[channel];
		if(!cd){
			return;
		}

		// grab the appropriate context
		const ctx = cd.ctx;

		// draw the background fill color
		ctx.fillStyle = backdropColors[hid];
		ctx.fillRect(0, top, cd.width, rowHeight);

		// initialize border color
		ctx.fillStyle = borderColor[record ? 1 : 0];

		// draw the border
		ctx.fillRect(cd.width - borderWidth, top, borderWidth, rowHeight);

		if(fontLoaded !== null) {
			// font not loaded, instead add to the load queue
			if(fontLoaded.findIndex((d) => d[0] === row) < 0) {
				fontLoaded.push([ row, channel, active, ]);
			}

		} else {
			// font loaded, run normally
			rendered[channel][row] = true;

			// render each channel element
			for(let i = 0;i < cd.elements.length;i ++){
				const e = cd.elements[i];

				// some dummy code to generate text for this row
				if(pattern[channel][row] && pattern[channel][row][e]) {
					// render the element with text
					ctx.fillStyle = channelElementColors[e][hid];
					ctx.fillText(pattern[channel][row][e] as string, cd.offsets[i], top + textVerticalOffset);

				} else {
					// render the element with blanks
					ctx.fillStyle = unsetColors[e][hid];
					ctx.fillText(i === 0 ? "---" : "--", cd.offsets[i], top + textVerticalOffset);
				}
			}
		}
	}

	/**
	 * The color that is displayed on a cleared pattern
	 */
	let clearColor: [ string, string, ];

	/**
	 * The color that is displayed at the borders of channels
	 */
	let borderColor: [ string, string, ];

	/**
	 * The list of backdrop colors depending on which highlight is active (or none at all)
	 */
	let backdropColors:string[] = [];

	/**
	 * The list of unset dash colors for each element in the channel row depending on which highlight is active (or none at all)
	 */
	let unsetColors:string[][] = [];

	/**
	 * The colors for each element in the channel row depending on which highlight is active (or none at all)
	 */
	let channelElementColors:string[][] = [];

	/**
	 * This is the vertical offset of text. This is needed somehow
	 */
	let textVerticalOffset = 0;
}
