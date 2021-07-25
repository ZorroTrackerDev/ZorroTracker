/**
 * Helper type for CSS declarations within the theme
 */
declare type CSSTheme = Record<string, string|number>;
declare type CSSThemeObj = { css: CSSTheme };

declare interface ThemeSettings {
	playbar?: {
		/**
		 * The normal status for buttons that are not activated
		 */
		normal: PlaybarButtonsInfo,
		/**
		 * The hovered status for buttons that are not activated
		 */
		hover: PlaybarButtonsInfo,
		/**
		 * The normal status for buttons that are activated
		 */
		active: PlaybarButtonsInfo,
		/**
		 * The hovered status for buttons that are activated
		 */
		activehover: PlaybarButtonsInfo,
	},
	pattern?: {
		/**
		 * Settings related to the worker
		 */
		worker?: WorkerThemeSettings,
		/**
		 * Settings related to other elements in the pattern editor
		 */
		main?: PatternEditorThemeSettings,
	},
}

/**
 * Helper type for playbar buttons infos
 */
declare interface PlaybarButtonsInfo {
	/**
	 * Declarations for the button wrapper
	 */
	button: CSSThemeObj,
	/**
	 * Declarations for the SVG path element inside the button
	 */
	icon: CSSThemeObj,
}

/**
 * Helper type to handle theme settings related to the pattern editor
 */
declare interface PatternEditorThemeSettings {
	/**
	 * Settings related to the channel headers
	 */
	header?: {
		/**
		 * Settings related to the main element for the channel header
		 */
		main?: CSSThemeObj,
		/**
		 * Settings related to the label element for the channel header
		 */
		label?: CSSThemeObj,
		/**
		 * Settings related to the resize handle of a channel header
		 */
		resize?: {
			/**
			 * The SVG d attribute for the path element of the SVG graphics display
			 */
			path?: [ string, string, string ],
			/**
			 * The CSS styles for the resize handle
			 */
			css: CSSTheme,
			/**
			 * Styles for the child elements inside of a SVG
			 */
			icon: CSSThemeObj,
		},
		/**
		 * Settings related to the resize handle of a channel header when hovered
		 */
		resizehover?: {
			/**
			 * The CSS styles for the resize handle
			 */
			css: CSSTheme,
			/**
			 * Styles for the child elements inside of a SVG
			 */
			icon: CSSThemeObj,
		},
		/**
		 * Settings related to the row header
		 */
		row?: CSSThemeObj,
	},
	/**
	 * Settings related to the focused row
	 */
	focus?: {
		/**
		 * The color of the focused row. This is blended according to blending settings
		 */
		color?: WorkerThemeHighlight,
		/**
		 * The CSS blending mode for the row. This will allow you to create composite colors with little performance hit.
		 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode
		 */
		blend?: WorkerThemeHighlight,
		/**
		 * The color of the focused row. This is blended according to blending settings in record mode
		 */
		recordcolor?: WorkerThemeHighlight,
		/**
		 * The CSS blending mode for the row in record mode. This will allow you to create composite colors with little performance hit.
		 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode
		 */
		recordblend?: WorkerThemeHighlight,
	}
}

type WorkerThemeHighlight = [ string, string, string ];

/**
 * Helper type to handle theme settings related to the pattern editor workers
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

		/**
		 * The color for the backdrop of the pattern editor in display mode
		 */
		backdrop?: string,

		/**
		 * The color for the backdrop of the pattern editor in record mode mode
		 */
		recordbackdrop?: string,

		/**
		 * The color for the border of the pattern editor in display mode
		 */
		border?: string,

		/**
		 * The color for the border of the pattern editor in record mode mode
		 */
		recordborder?: string,
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
	 * The max number of effects
	 */
	fxnum?: number,
	/**
	 * The widths of each possible element
	 */
	widths?: number[],
	/**
	 * The offsets of each possible element
	 */
	offsets?: number[],
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
	/**
	 * The inactive color for text for an element that is set, in record mode
	 */
	recordinactive?: WorkerThemeHighlight,
	/**
	 * The active color for text for an element that is set for different highlights in record mode
	 */
	recordactive?: WorkerThemeHighlight,
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
	/**
	 * The inactive background colors for a row in record mode
	 */
	recordinactivebg?: WorkerThemeHighlight,
	/**
	 * The active background colors for a row in record mode
	 */
	recordactivebg?: WorkerThemeHighlight,
}

/**
 * Helper type for different element settings
 */
declare interface ElementSettings extends SimpleElementSettings {
	/**
	 * The inactive color for text for an element that is not set
	 */
	inactiveblank?: WorkerThemeHighlight,
	/**
	 * The active color for text for an element that is not set for different highlights
	 */
	activeblank?: WorkerThemeHighlight,
	/**
	 * The inactive color for text for an element that is not set, in record mode
	 */
	recordinactiveblank?: WorkerThemeHighlight,
	/**
	 * The active color for text for an element that is not set for different highlights in record mode
	 */
	recordactiveblank?: WorkerThemeHighlight,
}
