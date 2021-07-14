import { GenericConfig } from "./config";

// theme configuration file format
export interface ThemeConfig extends GenericConfig {
	/**
	 * The input config files for all the theme settings
	 */
	files: string[],
	/**
	 * The input SVG files for all the theme settings
	 */
	svg: string[],
}
