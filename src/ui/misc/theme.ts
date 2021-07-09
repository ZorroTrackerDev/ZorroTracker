import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { loadFiles } from "../../api/files";
import { ThemeConfig } from "../../api/theme";
import path from "path";

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
	_cfg = config;

	// load the theme files into an array
	const data = loadFiles([ config.entry, ], config.files) as ThemeSettings[];

	// if nothing was loaded, abort
	if(data.length === 0){
		return;
	}

	// TODO: figure out how to merge it all
	theme = data[0];

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
