
export type ScrollbarReturn = {
	/**
	 * The main element for the scrollbar itself
	 */
	element: HTMLDivElement,

	/**
	 * Helper function to set the scrollbar position
	 *
	 * @param pos Set the new position of the scrollbar. Invalid values will be clamped to the value space
	 */
	setPosition: (pos:number) => void,

	/**
	 * Helper function to set the maximum value the scrollbar can output
	 *
	 * @param value The number of values the scrollbar can produce. This means 0 <-> value
	 */
	setValues: (value:number) => void,

	/**
	 * Helper function to set how much larger the scroller is vs values.
	 * This is a multiplier where 1 = scrollbar is the same height as all values (or ticks)
	 *
	 * @param value The proportion of each value in the scrollbar
	 */
	setMultiplier: (value:number) => void,
};

export interface ScrollbarCornerOptions {
	/**
	 * Any custom classes to attach to this scrollbar
	 */
	class?: string[],

	/**
	 * The top position of the scrollbar
	 */
	top?: string,

	/**
	 * The bottom position of the scrollbar
	 */
	bottom?: string,

	/**
	 * The left position of the scrollbar
	 */
	left?: string,

	/**
	 * The right position of the scrollbar
	 */
	right?: string,

	/**
	 * The width of the scrollbar
	 */
	width?: string,

	/**
	 * The height of the scrollbar
	 */
	height?: string,
}

export interface ScrollbarOptions extends ScrollbarCornerOptions {
	/**
	 * Function that is called whenever the scrollbar gets moved by the user or the value space is updated
	 *
	 * @param pos The new position of the scrollbar.
	 */
	move: (pos:number) => unknown|Promise<unknown>,

	/**
	 * Boolean setting for the whether the scrollbar is vertical or horizontal.
	 */
	vertical: boolean,
}

/**
 * Helper function to create a simple scrollbar element. This can be used via some software glue to control various elements independently.
 *
 * @param options The various options that you can apply to the scrollbar
 * @returns The element to be attached to the DOM along with various functions that can control this scrollbar
 */
export function makeScrollbar(options:ScrollbarOptions): ScrollbarReturn {
	// create the base elements for the bar
	const grip = document.createElement("div");
	const element = document.createElement("div");
	setOptions(element, options, options.vertical ? "vertical" : "horizontal");
	element.appendChild(grip);

	// generate variables
	let value = 0, max = 0, multiplier = 0, grippos = 0;

	// helper function to get the real maximum elements
	const realmax = () => max + multiplier - 1;

	// helper function to updating scrollbar state
	const refresh = () => {
		// calculate some statistics about the scrollbar
		const _pmx = 100 / realmax();

		// update position and height
		grip.style[options.vertical ? "height" : "width"] = _pmx * multiplier +"%";
		grip.style[options.vertical ? "top" : "left"] = _pmx * value +"%";
	}

	// find the nearest value to the supplied percentage
	const findNearestValue = (ps:number) => {
		// get the multiple of any value
		const _pmx = 100 / realmax();

		// return of the actual calculated value
		return Math.round(Math.max(0, Math.min(max - 1, ps / _pmx)));
	}

	// calculate the relative position of a pixel to an element
	const getRelativePos = (pos:number, el:HTMLDivElement) => {
		return pos - el.getBoundingClientRect()[options.vertical ? "top" : "left"];
	}

	// the mouse mvoe handler for the window
	const mousemove = (e:MouseEvent) => {
		// prepare some variables
		const gripoff = grippos + (grip[options.vertical ? "offsetHeight" : "offsetWidth"] / 2);
		const top = getRelativePos(e[options.vertical ? "clientY" : "clientX"], element) - gripoff;
		const scale = element[options.vertical ? "offsetHeight" : "offsetWidth"];

		// get the closest value and update position
		value = findNearestValue((top / scale) * 100);
		refresh();

		// disable event propagation
		e.preventDefault();
		e.stopImmediatePropagation();

		// update anything else that may need this value
		options.move(value);
	}

	// the mouse-up handler for the window
	const mouseup = (e:MouseEvent) => {
		// ignore anything that isn't right click
		if((e.buttons & 1) !== 0) {
			return;
		}
		// disable event handlers
		window.removeEventListener("pointermove", mousemove);
		window.removeEventListener("pointerup", mouseup);

		// disable event propagation
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	// handle mouse being pressed down on the bar
	element.onpointerdown = (e) => {
		// ignore anything that isn't right click
		if(e.button !== 0) {
			return;
		}

		// calculate some variables
		const rpos = getRelativePos(e[options.vertical ? "clientY" : "clientX"], grip);
		const sz = grip[options.vertical ? "offsetHeight" : "offsetWidth"];

		// if the grip position is within the element, try to calculate the offset. Otherwise center it
		if(rpos >= 0 && rpos < sz) {
			grippos = rpos - (sz / 2);

		} else {
			grippos = 0;
		}

		// add event handlers for the entire window
		window.addEventListener("pointerup", mouseup);
		window.addEventListener("pointermove", mousemove);
		mousemove(e);
	}

	return {
		element: element,
		setPosition: (pos) => {
			value = pos;
			refresh();
		},
		setValues: (value) => {
			max = value;
			refresh();
		},
		setMultiplier: (value) => {
			multiplier = value;
			refresh();
		},
	};
}

/**
 * Helper function to create a simple scrollbar corner element. This will make the scrollbars appear connected to each other, if 2 or more are used.
 *
 * @param options The various options that you can apply to the main element
 * @returns The element to be attached to the DOM
 */
export function makeScrollbarCorner(options:ScrollbarCornerOptions): HTMLDivElement {
	// create the element, apply options and return the element
	const element = document.createElement("div");
	setOptions(element, options, "corner");
	return element;
}

function setOptions(element:HTMLDivElement, options:ScrollbarCornerOptions, extraclass:string) {
	// added the requested classes
	element.classList.add("scrollbar", extraclass, ...(options.class ?? []));

	// add various properties to the parent element
	element.style.top = options.top ?? "";
	element.style.left = options.left ?? "";
	element.style.right = options.right ?? "";
	element.style.width = options.width ?? "";
	element.style.height = options.height ?? "";
	element.style.bottom = options.bottom ?? "";
}
