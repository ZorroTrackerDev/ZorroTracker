import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { loadFiles } from "../../api/files";
import { ThemeConfig } from "../../api/theme";
import path from "path";
import { promises as fsp } from "fs";

/**
 * The event dispatcher for LoadTheme event
 */
const update = ZorroEvent.createEvent(ZorroEventEnum.LoadTheme);

/**
 * The current theme as an object
 */
export let theme:ThemeSettings;

/**
 * Function to load a theme based on a `ThemeConfig` object
 *
 * @param config The `ThemeConfig` object to use for loading
 */
export function loadTheme(config:ThemeConfig):void {
	// load the theme files into an array
	const th = loadFiles([ config.entry, ], [ "theme.json5", ])[0] as ThemeSettings;
	const svg = loadFiles([ config.entry, ], config.svg) as { [key: string]: string }[];

	// if nothing was loaded, abort
	if(!th || svg.length === 0){
		return;
	}

	// copy theme object over last theme
	theme = th;

	// copy config
	_cfg = config;

	// load SVG mappings
	_svg = {};
	_svgcache = {};

	// run for each SVG file in config
	for(const s of svg) {
		// run for each key in the SVG file
		for(const key of Object.keys(s)) {
			// copy all keys
			_svg[key] = path.join(config.entry, s[key]).replace(/\\/g, "/");
		}
	}

	// generate CSS stylesheet for this theme
	generateCSS();

	// file all relative paths
	fixItems<string>(_folder, (u) => u.replace("%folder%", path.join(config.entry).replace(/\\/g, "/")));

	// inform theme is loaded
	update().catch(console.error);
}

/**
 * Stored config for the theme
 */
let _cfg:ThemeConfig;

/**
 * Function to reload the current theme
 */
export function reloadTheme(): void {
	loadTheme(_cfg);
}

/**
 * Function for fixing item data, such as text replacement
 *
 * @param items The list of items to modify
 * @param fn The function for converting items data
 */
function fixItems<T>(items:string[], fn:(item:T) => T) {
	// run for every single item
	items.forEach((i) => {
		try {
			// get the item indexes by splitting the string
			const a = i.split(".");
			let head:{ [key: string]: unknown, } = theme as { [key: string]: unknown, };

			// run for every index in the array
			for(let i = 0;i < a.length;i ++) {
				if(typeof head === "object" && head[a[i]]) {
					if(i < a.length - 1) {
						// if index in head exists, add it as our new head
						head = head[a[i]] as { [key: string]: unknown, };

					} else {
						try {
							// this is the last item, handle it now
							head[a[i]] = fn(head[a[i]] as T);

						} catch(ex) {
							/* ignore */
						}
					}
				}
			}
		} catch(ex) {
			/* ignore */
		}
	});
}

/**
 * All the %folder% conversion points
 */
const _folder = [
	"pattern.worker.font.source",
];

/**
 * store SVG files based on their ID's
 */
let _svg:{ [key: string]: string, };

/**
 * cached SVG files for faster access
 */
let _svgcache:{ [key: string]: string, };

/**
 * Function to load a SVG file based on its ID
 *
 * @param id The ID of the SVG to try to load
 * @returns The SVG data received or empty string if failed
 */
export async function loadSVG(id:string): Promise<string|""> {
	// load file address and check if valid
	const file = _svg[id];

	if(!file) {
		return "";
	}

	// check if the SVG file is cached
	if(_svgcache[id]) {
		return _svgcache[id];
	}

	try {
		// read and cache file contents
		const data = (await fsp.readFile(file)).toString();
		_svgcache[id] = data;

		// read the file and return contents.
		return data ?? "";

	} catch(ex) {
		// uh oh, failed, just return empty
		return "";
	}
}

/**
 * Function to traverse the input `path` in the input `object`. This will hopefully return the requested object
 *
 * @param path The path to traverse for this object
 * @param object The object itself to inspect
 * @returns The final object or `undefined` if failed to find it
 */
function applyPath(path:string, object:unknown): undefined|Record<string, unknown> {
	// check if the input object is an actual object
	if(!object || typeof object !== "object") {
		return;
	}

	// copy the object for tree traversal
	let obj = object as Record<string, unknown>;

	// traverse through all of the path
	for(const p of path.split(".")) {
		// apply the child object
		obj = obj[p] as Record<string, unknown>;

		// check if the input object is an actual object
		if(!obj || typeof obj !== "object") {
			return;
		}
	}

	return obj;
}

let css: HTMLStyleElement|undefined;

/**
 * Helper function to generate the CSS stylesheet for this theme
 */
function generateCSS() {
	if(!css) {
		// initialize the CSS stylesheet
		css = document.createElement("style");
		css.type = "text/css";
		css.classList.add("theme");
		document.getElementsByTagName("head")[0]?.appendChild(css);
	}

	// save the CSS text
	css.innerHTML = cssPath.map((d) => pathToCSS(d, "", theme as Record<string, undefined>)).join("\n");
}

/**
 * Helper function to convert CSS path to a CSS stylesheet part
 *
 * @param data The data element we should traverse
 * @param element The element address we are currently at
 * @param path The path address we are currently at
 */
type CSSPathHelp = { path: string, child?: CSSPathHelp[], element: string, };

function pathToCSS(data:CSSPathHelp, element:string, object:Record<string, unknown>): string {
	const e = element + data.element;

	// prepare variables
	const obj = applyPath(data.path, object);
	let str = "";

	// check if object child exists
	if(obj) {
		// check if CSS is defined
		if(obj["css"]) {
			str = convertToCSS(obj["css"] as CSSTheme, e);
		}

		// apeend child data to string
		if(data.child) {
			str += data.child.map((d) => pathToCSS(d, e, obj)).join("\n");
		}
	}

	return str;
}

/**
 * Helper function to convert an object to a CSS theme
 *
 * @param data The CSS data to convert
 * @param element The path to the element we're applying this theme to
 * @returns The converted CSS code
 */
function convertToCSS(data:CSSTheme, element:string): string {
	const entries = Object.entries(data).map(([ key, value, ]) => `${ key }:${ value }`);
	return entries.length === 0 ? "" : element +"{"+ entries.join(";") +"}";
}

// children of the playbar types
const _playbarChild = [
	{
		element: "",
		path: "button",
	},
	{
		element: ">svg>*",
		path: "icon",
	},
];

// children of the channel wrappers
const _channelwrapperChild = [
	{
		element: ">.channelnamewrapper>label",
		path: "label",
	},
];

/**
 * The tree containing all SVG stylesheet generation targets
 */
const cssPath = [
	{
		element: ".playbuttonsbar>button",
		path: "playbar",
		child: [
			{
				element: "",
				path: "normal",
				child: _playbarChild,
			},
			{
				element: ":hover",
				path: "hover",
				child: _playbarChild,
			},
			{
				element: ".active",
				path: "active",
				child: _playbarChild,
			},
			{
				element: ".active:hover",
				path: "activehover",
				child: _playbarChild,
			},
		],
	},
	{
		element: ".patterneditorwrap>.channelwrapper",
		path: "pattern.main.header",
		child: [
			{
				element: "",
				path: "main",
				child: _channelwrapperChild,
			},
			{
				element: ":hover",
				path: "mainhover",
				child: _channelwrapperChild,
			},
			{
				element: ".muted",
				path: "muted",
				child: _channelwrapperChild,
			},
			{
				element: ".muted:hover",
				path: "mutedhover",
				child: _channelwrapperChild,
			},
			{
				element: ":first-child",
				path: "row",
			},
			{
				element: ">.channelnamewrapper>.channeldragarea",
				path: "resize",
				child: [
					{
						element: ">svg>*",
						path: "icon",
					},
				],
			},
			{
				element: ">.channelnamewrapper>.channeldragarea:hover",
				path: "resizehover",
				child: [
					{
						element: ">svg>*",
						path: "icon",
					},
				],
			},
		],
	},
	{
		element: ".patternextras",
		path: "pattern.extras",
		child: [
			{
				element: ">.focus",
				path: "focus",
			},
			{
				element: ">.cursor",
				path: "cursor",
				child: [
					{
						element: ".hold",
						path: "hold",
					},
				],
			},
			{
				element: ">.multiselection",
				path: "multi",
			},
			{
				element: ">.singleselection",
				path: "single",
			},
		],
	},
	{
		element: ".scrollbar.patternscroll",
		path: "pattern.extras.scrollbar",
		child: [
			{
				element: ">.scrollbarbutton",
				path: "buttons",
				child: [
					{
						element: "",
						path: "normal",
					},
					{
						element: ":hover",
						path: "hover",
					},
					{
						element: ":active",
						path: "active",
					},
				],
			},
			{
				element: ">.scrollbarbutton",
				path: "buttonicons",
				child: [
					{
						element: ">svg>*",
						path: "normal",
					},
					{
						element: ":hover>svg>*",
						path: "hover",
					},
					{
						element: ":active>svg>*",
						path: "active",
					},
				],
			},
			{
				element: ">.gripwrap",
				path: "bar",
				child: [
					{
						element: "",
						path: "normal",
					},
					{
						element: ":hover",
						path: "hover",
					},
					{
						element: ":active",
						path: "active",
					},
				],
			},
			{
				element: ".corner",
				path: "corner",
			},
			{
				element: ">.gripwrap",
				path: "grip",
				child: [
					{
						element: ">.grip",
						path: "normal",
					},
					{
						element: ":hover>.grip",
						path: "hover",
					},
					{
						element: ":active>.grip",
						path: "active",
					},
				],
			},
			{
				element: ">.gripwrap",
				path: "gripicon",
				child: [
					{
						element: ">.grip>svg>*",
						path: "normal",
					},
					{
						element: ":hover>.grip>svg>*",
						path: "hover",
					},
					{
						element: ":active>.grip>svg>*",
						path: "active",
					},
				],
			},
		],
	},
];
