import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { loadFiles } from "../../api/files";
import { ThemeConfig } from "../../api/theme";
import path from "path";
import fs from "fs";

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
	const data = loadFiles([ config.entry, ], config.files) as ThemeSettings[];
	const svg = loadFiles([ config.entry, ], config.svg) as { [key: string]: string }[];

	// if nothing was loaded, abort
	if(data.length === 0 || svg.length === 0){
		return;
	}

	// copy config
	_cfg = config;

	// load SVG mappings
	_svg = {};

	// run for each SVG file in config
	for(const s of svg) {
		// run for each key in the SVG file
		for(const key of Object.keys(s)) {
			// copy all keys
			_svg[key] = path.join(config.entry, s[key]).replace(/\\/g, "/");
		}
	}

	// TODO: figure out how to merge it all
	theme = data[0];

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
 * Function to load a SVG file based on its ID
 *
 * @param id The ID of the SVG to try to load
 * @returns The SVG data received or empty string if failed
 */
export function loadSVG(id:string): string|"" {
	// load file address and check if valid
	const file = _svg[id];

	if(!file) {
		return "";
	}

	try {
		// read the file and return contents.
		return fs.readFileSync(file).toString() ?? "";

	} catch(ex) {
		// uh oh, failed, just return empty
		return "";
	}
}
