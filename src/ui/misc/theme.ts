import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { loadFiles } from "../../api/files";
import { ThemeConfig } from "../../api/theme";

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
