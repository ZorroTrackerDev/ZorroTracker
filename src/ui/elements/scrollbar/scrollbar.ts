import { loadSVG } from "../../misc/theme";

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

	/**
	 * Function to update the theme on the scrollbar. Must be handled by the caller.
	 *
	 * @param size The new size of the scrollbar
	 */
	reloadTheme: (size:number) => Promise<void>,
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
	 * The size of the scrollbar in pixels. This will directly affect height/width
	 */
	size?: number,
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

	/**
	 * How many numbers the direction buttons will change
	 */
	buttonValues: number,

	/**
	 * The SVG file for the buttons
	 */
	buttonSVG: string,

	/**
	 * The SVG file for the grip element
	 */
	gripSVG: string,
}

/**
 * Helper function to create a simple scrollbar element. This can be used via some software glue to control various elements independently.
 *
 * @param options The various options that you can apply to the scrollbar
 * @returns The element to be attached to the DOM along with various functions that can control this scrollbar
 */
export async function makeScrollbar(options:ScrollbarOptions): Promise<ScrollbarReturn> {
	// load the size property as variable
	let sz = options.size ?? 0;

	/**
	 * Helper function to reload the theme
	 */
	const reloadTheme = async(size:number) => {
		sz = size;

		// set the main element sizes
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		options.vertical && (element.style.width = sz +"px");
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		!options.vertical && (element.style.height = sz +"px");

		// set the wrap sizes
		wrap.style[options.vertical ? "top" : "left"] = sz +"px";
		wrap.style[options.vertical ? "bottom" : "right"] = sz +"px";

		// load the grip texture
		grip.innerHTML = await loadSVG(options.gripSVG);

		// initialize button icon
		const bsvg = await loadSVG(options.buttonSVG);

		// update the buttons
		button.forEach((b) => {
			b.innerHTML = bsvg;

			// handle button size
			b.style.width = sz +"px";
			b.style.height = sz +"px";
		});
	};

	// create the base elements for the bar
	const wrap = document.createElement("div");
	wrap.classList.add("gripwrap");
	const grip = document.createElement("div");
	grip.classList.add("grip");
	const element = document.createElement("div");
	const button = [ document.createElement("div"), document.createElement("div"), ];

	// initialize the main element properties
	setOptions(element, options, options.vertical ? "vertical" : "horizontal", options.vertical, !options.vertical);

	// initialize buttons
	await Promise.all(button.map((b, ix) => {
		// add the class
		b.classList.add("scrollbarbutton");

		// add the click listener
		b.onclick = (e) => {
			if(e.button === 0) {
				// change the value by some amount
				value = Math.max(0, Math.min(max - 1, value + (ix === 0 ? -options.buttonValues : options.buttonValues)));

				// reload position
				refresh();

				// update anything else that may need this value
				options.move(value);
			}
		}
	}));

	// update button styles to position them
	button[0].style[options.vertical ? "top" : "left"] = "0px";
	button[1].style[options.vertical ? "bottom" : "right"] = "0px";
	button[0].style.transform = "rotate("+ (options.vertical ? 0 : -90) +"deg)";
	button[1].style.transform = "rotate("+ (options.vertical ? 180 : 90) +"deg)";

	// load the theme
	await reloadTheme(sz);

	// append child elements
	wrap.appendChild(grip);
	element.appendChild(wrap);
	button.forEach((b) => element.appendChild(b));

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
		const top = getRelativePos(e[options.vertical ? "clientY" : "clientX"], wrap) - gripoff;
		const scale = wrap[options.vertical ? "offsetHeight" : "offsetWidth"];

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
	wrap.onpointerdown = (e) => {
		// ignore anything that isn't right click
		if(e.button !== 0) {
			return;
		}

		// also ignore if this is not the event target
		if(e.currentTarget !== e.target) {
			return;
		}

		// calculate some variables
		const rpos = getRelativePos(e[options.vertical ? "clientY" : "clientX"], grip);
		const sz = grip[options.vertical ? "offsetHeight" : "offsetWidth"];

		// if the grip position is within the wrapper, try to calculate the offset. Otherwise center it
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
		element,
		reloadTheme,
		setPosition: (pos) => {
			// set the value to the argument and re-render
			value = pos;
			refresh();
		},
		setValues: (value) => {
			// set the maximum possible value to the argument and re-render
			max = value;
			refresh();
		},
		setMultiplier: (value) => {
			// set the grip multiplier to the argument and re-render
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
	setOptions(element, options, "corner", true, true);
	return element;
}

/**
 * Helper function to initialize some properties in the scrollbar element
 *
 * @param element The element to apply styles and classes to
 * @param options The various options to apply
 * @param extraclass Any extra classes to be appended to the element
 * @param width Whether to use the `size` property to control width of the element
 * @param height Whether to use the `size` property to control height of the element
 */
function setOptions(element:HTMLDivElement, options:ScrollbarCornerOptions, extraclass:string, width:boolean, height:boolean) {
	// added the requested classes
	element.classList.add("scrollbar", extraclass, ...(options.class ?? []));

	// add various properties to the parent element
	element.style.top = options.top ?? "";
	element.style.left = options.left ?? "";
	element.style.right = options.right ?? "";
	element.style.bottom = options.bottom ?? "";

	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	width && (element.style.width = (options.size ?? 0) +"px");
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	height && (element.style.height = (options.size ?? 0) +"px");
}
