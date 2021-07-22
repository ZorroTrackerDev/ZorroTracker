import { loadSVG } from "../../misc/theme";

/**
 * The enum bitfield that defines the type of the slider
 */
export enum SliderEnum {
	// slider directions
	Vertical = 0x100, Horizontal = 0x000,

	// slider sizes
	Small = 0x00, Medium = 0x01, Large = 0x02,

	// various value buttons
	PlusMinus = 0x1000,
}

type SliderFunctions = {
	/**
	 * Function that gives the value of the slider when its changed, and expects the final value to be returned back.
	 * This function can, for example, limit the slider to a set of specific steps.
	 *
	 * @param value The input value from the slider
	 * @returns The output value to put back into the slider
	 */
	getValue: (value:number) => number,

	/**
	 * Function that handles when the value is given an offset.
	 * This offset can be controlled by various things, such as arrow keys on the editor field.
	 *
	 * @param value The current slider value
	 * @param offset The offset to apply to the slider value. This can be transformed depending on the use-case.
	 * @returns The value to apply for the slider. `getValue` is called first to confirm the value.
	 */
	getValueOffset: (value:number, offset:number) => number,

	/**
	 * Convert slider value into string, to display in the edit box.
	 *
	 * @param value The current slider value
	 * @returns The string containing the converted value
	 */
	toText: (value:number) => string,

	/**
	 * Convert string into a slider value. This function is called when the user uses the editor field (on enter or focus lost).
	 *
	 * @param value The string in the editor field
	 * @returns The correct slider value (from 0.0 to 1.0), or null if the value could not be converted. In this case, the last value is reused.
	 */
	fromText: (value:string) => number|null,
}

type SliderReturn = {
	/**
	 * The slider element.
	 */
	element: HTMLDivElement,

	/**
	 * The label element that should be controlled by the calling code.
	 */
	label: HTMLDivElement,

	/**
	 * Function to set the slider value in the UI. This can control the slider from the calling code.
	 * `getValue` and `toText` are called when this is used, so there is no need for special handling here.
	 *
	 * @param value The value, from 0.0 to 1.0 to set the slider to.
	 */
	setValue: (value:number) => void,
}

/**
 * Function to create a slider that controls a value, inside or outside the code. This also has an editable field where the user can input text.
 * The slider has a range of 0.0 to 1.0.
 *
 * @param type The type of the slider to create. There are various standard settings for size and direction
 * @param functions List of different functions that are used by the slider to update values and pass information between the UI and code
 * @returns An object containing the element, the label, and a function to set the value from code into the slider
 */
export function makeSlider(type:SliderEnum, functions:SliderFunctions):SliderReturn {
	// destructure the functions object for easier access
	const { getValue, getValueOffset, toText, fromText, } = functions;

	// create a div with class slider that will be our main element
	const e = document.createElement("div");
	e.classList.add("slider");

	// set up the innerHTML of the element, containing all the sub-elements we are going to need
	e.innerHTML = /*html*/`
		<div class="slider_text">
			<div class="slider_icon"></div>
			<textarea class="slider_value" rows="1" wrap="off"></textarea>
		</div>
		<div class="slider_bar">
			<div>
				<button></button>
			</div>
		</div>
	`;

	// add the size class into the div
	switch(type & 0xFF) {
		case SliderEnum.Small:	e.classList.add("slider_small"); break;
		case SliderEnum.Medium:	e.classList.add("slider_medium"); break;
		case SliderEnum.Large:	e.classList.add("slider_large"); break;
	}

	// add the direction class into the div
	switch(type & 0xF00) {
		case SliderEnum.Vertical:	e.classList.add("slider_vertical"); break;
		case SliderEnum.Horizontal:	e.classList.add("slider_horizontal"); break;
	}

	// dump all the nodes we are going to reference later into these variables
	const barNode = e.children[1] as HTMLElement;
	const ballNode = barNode.children[0] as HTMLElement;
	const textNode = (e.children[0] as Element).children[1] as HTMLTextAreaElement;
	const labelNode = (e.children[0] as Element).children[0] as HTMLDivElement;

	// we use a timeout to handle committing text. The timeout can be cancelled too, so we store it here
	let timeout:NodeJS.Timeout|null = null;

	// stores the last value the slider held. Used when the user input is rejected.
	let lastValue = 0;

	/**
	 * Function to set the UI text and slider position.
	 *
	 * @param value The slider position from 0.0 to 1.0, before calling `getValue`
	 */
	const _set = (value:number) => {
		// convert the position according to caller, and save as the last valid value
		const position = getValue(value);
		lastValue = position;

		// convert the value into string for styling
		const offs = (position * 100) +"%";

		// add the position to left or top position depending on the slider direction
		switch(type & 0xF00) {
			case SliderEnum.Vertical:	ballNode.style.top = offs; break;
			case SliderEnum.Horizontal:	ballNode.style.left = offs; break;
		}

		// convert the value into text as well
		textNode.value = toText(position);
	}

	/**
	 * Function to set the UI with the new value via text, or arrow keys.
	 * This updates the slider and adds an animation, if requested.
	 *
	 * @param value The value to update with, or null if an invalid value was found
	 * @param transition Whether to cause the UI to do a transition for the slider position.
	 */
	const _edit = (value:number|null, transition:boolean) => {
		// store the current selection and text length for later
		const start = textNode.selectionStart, end = textNode.selectionEnd, len = textNode.value.length;

		if(value !== null){
			// if there was a previous timeout, remove it
			if(timeout){
				clearTimeout(timeout);
			}

			if(transition) {
				// if transitions were enabled, add the transition, and disable it after 300ms
				ballNode.classList.add("animate");
				timeout = setTimeout(() => ballNode.classList.remove("animate"), 300);

			} else {
				// remove the animation if it was enabled
				ballNode.classList.remove("animate");
			}

			// update the UI with the new value
			_set(value);

		} else {
			// invalid value, update with the last stored value (restore UI state)
			_set(lastValue);
		}

		if(start === len && end === len){
			// the caret was on the last character of the textbox, select it again
			textNode.selectionStart = textNode.value.length;
			textNode.selectionEnd = textNode.value.length;

		} else {
			// else just copy the selection over
			textNode.selectionStart = start;
			textNode.selectionEnd = end;
		}
	}

	/**
	 * Helper function to convert the text box text into a value, then handling updating the UI
	 */
	const _text = () => _edit(fromText(textNode.value), true);

	/**
	 * Function to handle the special arrow key stuff. This allows the user to change the value by different amounts, depending on the calling code.
	 *
	 * @param up Whether up arrow was pressed. False = down arrow.
	 */
	const arrow = (up:boolean) => {
		// find the location of the dot (if it exists)
		const dot = textNode.value.indexOf(".");

		// if we have started selection *after* the dot... If it existed.
		const low = dot && textNode.selectionStart > dot;

		// calculate the requested difference from the calling code. +-1 = before dot, +-0.1 = after dot.
		const diff = ((up ? 1 : -1) * (low ? 0.1 : 1));

		// ask for the offset from caller, and then handle updating the UI
		_edit(getValueOffset(lastValue, diff), false);
	}

	// handle clicking away from the edit box as updating the text content
	textNode.onblur = _text;

	// handle special keys in the edit box
	textNode.onkeydown = function(event:KeyboardEvent) {
		// disable shortcuts while writing to this textarea
		event.stopPropagation();

		switch(event.keyCode) {
			case 13:		// Enter key handler
				event.preventDefault();

				// update text content
				_text();
				return false;

			case 38:		// Arrow up handler
				event.preventDefault();

				// handle special arrow event
				arrow(true);
				return false;

			case 40:		// Arrow down handler
				event.preventDefault();

				// handle special arrow event
				arrow(false);
				return false;
		}
	}

	// when user moves the mouse, track it to update the slider position and values
	const mousemove = (event:MouseEvent) => {
		// prepare the bar bound object
		const rect = barNode.getBoundingClientRect();
		let position = 0;

		// handle the position correctly depending on direction
		switch(type & 0xF00) {
			case SliderEnum.Vertical:	position = (event.clientY - rect.top) / rect.height; break;
			case SliderEnum.Horizontal:	position = (event.clientX - rect.left) / rect.width; break;
		}

		// cap position into 0.0 ... 1.0 range
		position = Math.max(0, Math.min(1, position));

		// update UI and caller with the proposed value
		_set(position);
	}

	// when the user stops holding the mouse button, remove the mousemove and mouseup events
	const mouseup = () => {
		document.onmousemove = null;
		document.onmouseup = null;
	}

	// when a mouse button is pressed on the bar, fire up this event
	barNode.onmousedown = function(event) {
		event.preventDefault();

		// add mouse move and mouse up events to the document to track slider position
		document.onmousemove = mousemove;
		document.onmouseup = mouseup;

		// if the user only clicks, this makes sure the change is applied already
		mousemove(event);
	}

	// return the main element, label element, and a function to edit the value
	return { element: e, label: labelNode, setValue: _set, };
}

type SimpleSliderReturn = {
	/**
	 * The slider element.
	 */
	element: HTMLDivElement,

	/**
	 * The label element that should be controlled by the calling code.
	 */
	label: HTMLDivElement,

	/**
	 * Function to set the slider value in the UI. This can control the slider from the calling code.
	 * `getValue` and `toText` are called when this is used, so there is no need for special handling here.
	 *
	 * @param value The value as a string or a number, in units of multiplier
	 * @param initial The value to use as the initial default value, if conversion fails
	 */
	setValue:(value:string, initial:number) => void,
};

/**
 * Function to create a simple slider that maps value from `1.0` to `1.0*multiplier`. This differs from the normal slider function by
 * handling the values for you, only requiring you to save the value yourself. You can still set the value but it is not necessary preferred.
 *
 * @param type The type of the slider to create. There are various standard settings for size and direction
 * @param multiplier The multiplier of the value to use. This defines the scale of the slider in your code
 * @param steps The number of possible steps to use
 * @param digits The number of digits in the output value
 * @param suffix The string or value to add to the end of the text field. This is also used when parsing input text
 * @param post The function that is called when the value is updated. This lets you save the value in the slider
 * @returns And object containing the element, the label, and a function to set the value from code into the slider.
 */
export function simpleSlider(type:SliderEnum, multiplier:number, steps:number, digits:number, suffix:string, post:(value:number) => void):
	SimpleSliderReturn {
	/**
	 * function to handle limiting the input in steps
	 *
	 * @param v The input value
	 * @returns The output value, after stepping is done
	 */
	const limit = (v:number) => {
		return Math.round(Math.max(0, Math.min(1, v)) * steps) / steps;
	}

	/**
	 * Convert string to value, also stepping it correctly
	 *
	 * @param value Input string value to be converted
	 * @returns The converted value or null, if conversion failed
	 */
	const convert = (value:string) => {
		// parse input as a float
		let v:number|null = parseFloat(value);

		// check for null and divide by the multiplier
		v = isNaN(v) ? null : v / multiplier;

		if(v !== null) {
			// limit the value and apply steps
			v = limit(v);
		}

		// return value
		return v;
	}

	// create the slider with the proper functions, and get the return value
	const ret = makeSlider(type, {
		toText: (value) => {
			// convert the value into a decimal with `digits` number of digits
			return (value * multiplier).toFixed(digits) + suffix;
		},
		fromText: (value:string) => {
			// get the volume string, removing possible suffix
			const volume = value.substring(0, value.length - (value.endsWith(suffix) ? suffix.length : 0));

			// go to convert the value
			return convert(volume);
		},
		getValue: (value:number) => {
			// limit the value input
			const v = limit(value);

			// tell the caller about this change
			post(v * multiplier);
			return v;
		},
		getValueOffset: (value:number, offset:number) => {
			// add the offset correctly to value
			return value + (offset / multiplier);
		},
	});

	// return the values but make a special setValue function, to help converting strings to values.
	return { element: ret.element, label: ret.label, setValue: (value: string|number, initial:number) => {
		ret.setValue(convert(value ? value.toString() : "") ?? initial);
	}, };
}

/**
 * Create the standard volume slider for the UI.
 *
 * @param type Type of the slider to create
 * @returns Returns the finished element
 */
export async function volumeSlider(type:SliderEnum):Promise<Element> {
	// create a simple slider element with range from 0 to 200%.
	const { element, setValue, label, } = simpleSlider(type, 200, 2000, 1, "%", (volume:number) => {
		// update the volume on backend and cookies
		window.ipc.audio?.volume(volume / 100);
		window.ipc.cookie.set("main_volume", volume +"");

		// get the appropriate class for the volume
		if(volume > 120) {
			// @ts-expect-error as it turns out, this is completely valid. But TypeScript won't like this anyway
			label.classList = "volume_loud";

		} else if(volume > 80){
			// @ts-expect-error as it turns out, this is completely valid. But TypeScript won't like this anyway
			label.classList = "volume_3";

		} else if(volume > 40){
			// @ts-expect-error as it turns out, this is completely valid. But TypeScript won't like this anyway
			label.classList = "volume_2";

		} else if(volume > 0){
			// @ts-expect-error as it turns out, this is completely valid. But TypeScript won't like this anyway
			label.classList = "volume_1";

		} else {
			// @ts-expect-error as it turns out, this is completely valid. But TypeScript won't like this anyway
			label.classList = "volume_mute";
		}
	});

	// apply the default SVG object to the label
	label.innerHTML = /*html*/`
		<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" version="1.1">
			<path fill="none" stroke="white" stroke-width="8" stroke-linejoin="round" d="
				M 50 10
				V 90

				L 25 65
				H 5
				V 35
				H 25
				L 50 10

				Z"/>
			<path fill="none" stroke="white" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
			<path fill="none" stroke="white" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
			<path fill="none" stroke="white" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
		</svg>
	`;

	// give the label an ID and default width
	label.id = "main_volume_slider";
	label.style.width = "1.3em";

	// update the volume from cookies or default value
	const cookie = await window.ipc.cookie.get("main_volume") ?? "";
	setValue(cookie, 0.25);

	// return the slider element
	return element;
}

/**
 * Function to create a value, inside or outside the code. This also has an editable field where the user can input text.
 * The calling code controls the range of the value.
 *
 * @param type The type of the value to create. There are various standard settings for size and direction
 * @param functions List of different functions that are used by the value for updates and to pass information between the UI and code
 * @returns An object containing the element, the label, and a function to set the value from code
 */
export async function makeValue(type:SliderEnum, functions:SliderFunctions, settings:number):Promise<SliderReturn> {
	// destructure the functions object for easier access
	const { getValue, getValueOffset, toText, fromText, } = functions;

	// create a div with class slider that will be our main element
	const e = document.createElement("div");
	e.classList.add("slider", "value");

	// set up the innerHTML of the element, containing all the sub-elements we are going to need
	e.innerHTML = /*html*/`
		<div class="slider_text">
			<div class="slider_icon"></div>
			<div class="slider_buttons"></div>
			<textarea class="slider_value" rows="1" wrap="off"></textarea>
		</div>
	`;

	// add the size class into the div
	switch(type & 0xFF) {
		case SliderEnum.Small:	e.classList.add("slider_small"); break;
		case SliderEnum.Medium:	e.classList.add("slider_medium"); break;
		case SliderEnum.Large:	e.classList.add("slider_large"); break;
	}

	// add the direction class into the div
	switch(type & 0xF00) {
		case SliderEnum.Vertical:	e.classList.add("slider_vertical"); break;
		case SliderEnum.Horizontal:	e.classList.add("slider_horizontal"); break;
	}

	// dump all the nodes we are going to reference later into these variables
	const buttonNode = (e.children[0] as Element).children[1] as HTMLDivElement;
	const textNode = (e.children[0] as Element).children[2] as HTMLTextAreaElement;
	const labelNode = (e.children[0] as Element).children[0] as HTMLDivElement;

	// helper function to add a simple button with SVG
	const addButton = async (graphic:string, tooltip:string, click:(e:MouseEvent) => unknown) => {
		// create a new div with a loaded SVG as the graphic
		const b = document.createElement("div");
		b.innerHTML = await loadSVG(graphic);

		// enable the tooltip for this button
		b.title = tooltip;

		// set the button onclick handler
		b.onmouseup = click;

		// finally, add this to the button list
		buttonNode.appendChild(b);
	}

	// add the various buttons
	switch(type & 0xF000) {
		case SliderEnum.PlusMinus: {
			// initialize amounts for the buttons
			const amounts = [ [ 1, 4, 2, ], [ 1, 16, 4, ], [ 1, 64, 8, ], ][settings];

			// create the standard + button
			await addButton("slider.button.+", "increase value", (e) => {
				_edit(getValueOffset(lastValue, amounts[e.button]));
				e.preventDefault();
				return false;
			});

			// create the standard - button
			await addButton("slider.button.-", "Decrease value", (e) => {
				_edit(getValueOffset(lastValue, -amounts[e.button]));
				e.preventDefault();
				return false;
			});
			break;
		}
	}

	// stores the last value held. Used when the user input is rejected.
	let lastValue = 0;

	/**
	 * Function to set the UI text.
	 *
	 * @param value The value before calling `getValue`
	 */
	const _set = (value:number) => {
		// convert the position according to caller, and save as the last valid value
		const position = getValue(value);
		lastValue = position;

		// convert the value into text as well
		textNode.value = toText(position);
	}

	/**
	 * Function to set the UI with the new value via text, or arrow keys.
	 *
	 * @param value The value to update with, or null if an invalid value was found
	 */
	const _edit = (value:number|null) => {
		// store the current selection and text length for later
		const start = textNode.selectionStart, end = textNode.selectionEnd, len = textNode.value.length;

		if(value !== null){
			// update the UI with the new value
			_set(value);

		} else {
			// invalid value, update with the last stored value (restore UI state)
			_set(lastValue);
		}

		if(start === len && end === len){
			// the caret was on the last character of the textbox, select it again
			textNode.selectionStart = textNode.value.length;
			textNode.selectionEnd = textNode.value.length;

		} else {
			// else just copy the selection over
			textNode.selectionStart = start;
			textNode.selectionEnd = end;
		}
	}

	/**
	 * Helper function to convert the text box text into a value, then handling updating the UI
	 */
	const _text = () => _edit(fromText(textNode.value));

	/**
	 * Function to handle the special arrow key stuff. This allows the user to change the value by different amounts, depending on the calling code.
	 *
	 * @param up Whether up arrow was pressed. False = down arrow.
	 */
	const arrow = (up:boolean) => _edit(getValueOffset(lastValue, up ? 1 : -1));

	// handle clicking away from the edit box as updating the text content
	textNode.onblur = _text;

	// handle special keys in the edit box
	textNode.onkeydown = function(event:KeyboardEvent) {
		// disable shortcuts while writing to this textarea
		event.stopPropagation();

		switch(event.keyCode) {
			case 13:		// Enter key handler
				event.preventDefault();

				// update text content
				_text();
				return false;

			case 38:		// Arrow up handler
				event.preventDefault();

				// handle special arrow event
				arrow(true);
				return false;

			case 40:		// Arrow down handler
				event.preventDefault();

				// handle special arrow event
				arrow(false);
				return false;
		}
	}

	// return the main element, label element, and a function to edit the value
	return { element: e, label: labelNode, setValue: (value:number) => {
		// update last value assuming its correct
		lastValue = value;

		// convert the value into text as well
		textNode.value = toText(value);
	}, };
}

type SimpleValueReturn = {
	/**
	 * The value element.
	 */
	element: HTMLDivElement,

	/**
	 * The label element that should be controlled by the calling code.
	 */
	label: HTMLDivElement,

	/**
	 * Function to set the value in the UI. This can control the value from the calling code.
	 * `getValue` and `toText` are called when this is used, so there is no need for special handling here.
	 *
	 * @param value The value as a string or a number
	 * @param initial The value to use as the initial default value, if conversion fails
	 */
	setValue:(value:string, initial:number) => void,

	/**
	 * Function to set the range of accepted values for the value.
	 *
	 * @param min The minimum acceptable value. Can be positive or negative. Must be less than `max`
	 * @param max The maximum acceptable value. Can be positive or negative. Must be more than `min`
	 */
	setRange:(min:number, max:number) => void,
};

/**
 * Function to create a simple value input box that maps value from `from` to `to`. This code will handle everything else for you.
 *
 * @param type The type of the slider to create. There are various standard settings for size and direction
 * @param suffix The string or value to add to the end of the text field. This is also used when parsing input text
 * @param post The function that is called when the value is updated. This lets you save the value in the slider
 * @returns And object containing the element, the label, and a function to set the value from code into the slider.
 */
export async function simpleValue(type:SliderEnum, suffix:string, settings:number, post:(value:number) => void): Promise<SimpleValueReturn> {
	// pre-defined min and max ranges
	let _min = 0, _max = 1;

	/**
	 * function to handle limiting the input in steps
	 *
	 * @param v The input value
	 * @returns The output value, after stepping is done
	 */
	const limit = (v:number) => {
		return Math.round(Math.max(_min, Math.min(_max, v)));
	}

	/**
	 * Convert string to value, also stepping it correctly
	 *
	 * @param value Input string value to be converted
	 * @returns The converted value or null, if conversion failed
	 */
	const convert = (value:string) => {
		// parse input as a float
		let v:number|null = parseFloat(value);

		// check for null and divide by the multiplier
		v = isNaN(v) ? null : v;

		if(v !== null) {
			// limit the value and apply steps
			v = limit(v);
		}

		// return value
		return v;
	}

	// create the slider with the proper functions, and get the return value
	const ret = await makeValue(type, {
		toText: (value) => {
			// convert the value into a decimal with `digits` number of digits
			return Math.round(value) + suffix;
		},
		fromText: (value:string) => {
			// get the volume string, removing possible suffix
			const volume = value.substring(0, value.length - (value.endsWith(suffix) ? suffix.length : 0));

			// go to convert the value
			return convert(volume);
		},
		getValue: (value:number) => {
			// limit the value input
			const v = limit(value);

			// tell the caller about this change
			post(v);
			return v;
		},
		getValueOffset: (value:number, offset:number) => {
			// add the offset correctly to value
			return value + offset;
		},
	}, settings);

	// return the values but make a special setValue function, to help converting strings to values.
	return { element: ret.element, label: ret.label, setValue: (value: string|number, initial:number) => {
		ret.setValue(convert(value ? value.toString() : "") ?? initial);

	}, setRange: (min:number, max:number) => {
		// update the min/max values
		_min = min; _max = max;
	}, };
}
