declare interface ThemeSettings {
	pattern?: {
		/**
		 * Settings related to the worker
		 */
		worker?: WorkerThemeSettings,
	},
}

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
	rowbg?: {
		/**
		 * The background color for inactive rows
		 */
		inactive?: string,
		/**
		 * The background color for active rows in different highlights
		 */
		active?: [ string, string, string, ],
	},
	/**
	 * Settings for each row background
	 */
	rownum?: {
		/**
		 * The background color for inactive row number
		 */
		inactive?: string,
		/**
		 * The background color for active row numbers in different highlights
		 */
		active?: [ string, string, string, ],
	},
	/**
	 * Settings for the note elements for each row
	 */
	note?: ElementSettings<number>,
	/**
	 * Settings for the instrument elements for each row
	 */
	instrument?: ElementSettings<number>,
	/**
	 * Settings for the volume elements for each row
	 */
	volume?: ElementSettings<number>,
	/**
	 * Settings for the effect elements for each row
	 */
	effect?: ElementSettings<number[]>,
	/**
	 * Settings for the effect value elements for each row
	 */
	value?: ElementSettings<number[]>,
}

/**
 * Helper type for different element settings
 */
declare interface ElementSettings<T> {
	/**
	 * The left position(s) for drawing this symbol.
	 */
	left?: T,
	/**
	 * The inactive color for text for an element that is set
	 */
	inactive?: string,
	/**
	 * The inactive color for text for an element that is not set
	 */
	inactiveblank?: string,
	/**
	 * The active color for text for an element that is set for different highlights
	 */
	active?: [ string, string, string, ],
	/**
	 * The active color for text for an element that is not set for different highlights
	 */
	activeblank?: [ string, string, string, ],
}
