import { GenericConfig } from "./config";

// theme configuration file format
export interface ThemeConfig extends GenericConfig {
	/**
	 * The input files for all the theme settings
	 */
	files: string[],
}
