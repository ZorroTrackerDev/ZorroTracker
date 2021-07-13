declare interface ThemeSettings {
	pattern?: {
		/**
		 * Settings related to the worker
		 */
		worker?: WorkerThemeSettings,
	},
}

type WorkerThemeHighlight = [ string, string, string ];

/**
 * Helper type to handle theme settings
 */
declare interface WorkerThemeSettings {
	/**
	 * Miscellaneous parameters that are used for ZorroTracker
	 */
	params?: {
		/**
		 * The height of each pattern row in pixels
		 */
		rowHeight?: number,
	},
	font?: {
		/**
		 * The source of this font. This can be a web URL or a local file
		 */
		source?: string,
		/**
		 * The name of the font. This can be an arbitary string
		 */
		name?: string,
		/**
		 * CSS size of the font. This can be for example in pt, px, etc.
		 */
		size?: string,
		/**
		 * The vertical offset for text rendering in pixels
		 */
		top?: number,
	},
	/**
	 * The fallback values for various things. These will be used it some other property is missing
	 */
	fallback?: {
		/**
		 * The CSS color of the backdrop fallback
		 */
		backdrop?: string,
		/**
		 * The CSS color of the text fallback
		 */
		text?: string,

		/**
		 * The color of a cleared pattern
		 */
		clear?: string,
	},
	/**
	 * Settings for each row background
	 */
	background?: SimpleElementSettings,
	/**
	 * Settings for row number column
	 */
	rownum?: RowNumElementSettings,
	/**
	 * Settings for the note elements for each row
	 */
	note?: ElementSettings,
	/**
	 * Settings for the instrument elements for each row
	 */
	instrument?: ElementSettings,
	/**
	 * Settings for the volume elements for each row
	 */
	volume?: ElementSettings,
	/**
	 * Settings for the effect elements for each row
	 */
	effect?: ElementSettings,
	/**
	 * Settings for the effect value elements for each row
	 */
	value?: ElementSettings,
	/**
	 * The left position(s) for drawing every effect and value
	 */
	effectleft?: number[],
}

/**
 * Some simple element settings more widely shared
 */
declare interface SimpleElementSettings {
	/**
	 * The inactive color for text for an element that is set
	 */
	inactive?: WorkerThemeHighlight,
	/**
	 * The active color for text for an element that is set for different highlights
	 */
	active?: WorkerThemeHighlight,
}

/**
 * Some simple element settings more widely shared
 */
declare interface RowNumElementSettings extends SimpleElementSettings {
	/**
	 * The inactive background colors for a row
	 */
	inactivebg?: WorkerThemeHighlight,
	/**
	 * The active background colors for a row
	 */
	activebg?: WorkerThemeHighlight,
}

/**
 * Helper type for different element settings
 */
declare interface ElementSettings extends SimpleElementSettings {
	/**
	 * The left position(s) for drawing this symbol.
	 */
	left?: number,
	/**
	 * The inactive color for text for an element that is not set
	 */
	inactiveblank?: WorkerThemeHighlight,
	/**
	 * The active color for text for an element that is not set for different highlights
	 */
	activeblank?: WorkerThemeHighlight,
}