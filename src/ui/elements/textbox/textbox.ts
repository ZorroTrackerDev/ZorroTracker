import { getUniqueID } from "../../../api/dom";

/**
 * The enum bitfield that defines the type of the textbox
 */
export enum TextboxEnum {
	// textbox sizes
	Small = 0x00, Medium = 0x01, Large = 0x02,
}

type TextboxAttributes = {
	/**
	 * Type of the textbox to use.
	 */
	type:TextboxEnum,

	/**
	 * If set, controls the initial textbox text. This can be anything and will show it to the user.
	 */
	initial?: string,

	/**
	 * If set, controls the textbox label text. This shows before the textbox itself, letting the user know what this textbox is for.
	 */
	label?: string,

	/**
	 * If set, controls the width of the textbox label text. This can help to make the labels the same size across an entire UI.
	 */
	labelWidth?: string,

	/**
	 * If set, controls the textbox hint text. This shows when no text is inputted into the textbox. Not user editable.
	 */
	hint?: string,

	/**
	 * If set, controls the maximum number of characters for this textbox
	 */
	length?: number,

	/**
	 * If set, controls the number of lines on this textbox. 1 = multiline disabled.
	 */
	lines?: number,

	/**
	 * If set, controls the width of the textbox. Otherwise, a default will be used.
	 */
	width?: string,

	/**
	 * If set, controls the style of the element. Otherwise, a default will be used.
	 */
	style?: string,

	/**
	 * Function that gives the value of the textbox when its changed, and expects the final value to be returned back.
	 * This function can, for example, remove special characters.
	 *
	 * @param value The input value from the textbox
	 * @param user Boolean indicating whether the user changed the value, or if the system did
	 * @returns The output value to put back into the textbox
	 */
	getValue: (value:string, user:boolean) => string,
}

type TextboxReturn = {
	/**
	 * The textbox element.
	 */
	element: HTMLDivElement,

	/**
	 * The label element that can be controlled by the calling code.
	 */
	label: HTMLDivElement,

	/**
	 * Function to set the textbox value in the UI. This can control the textbox text from the calling code.
	 * `getValue` is called when this is used, so there is no need for special handling here.
	 *
	 * @param value The string to set the element to
	 */
	setValue: (value:string) => void,
}

/**
 * Function to create a textbox that controls a value, inside or outside the code.
 *
 * @param type The type of the textbox to create. There are various standard settings for size
 * @param attributes Various attributes and functions related to the creation of the textbox
 * @returns An object containing the element, the label, and a function to set the value from code into the slider
 */
export function makeTextbox(attributes:TextboxAttributes):TextboxReturn {
	// destructure the attributes object for easier access
	const { type, getValue, hint, style, width, lines, length, initial, label, labelWidth, } = attributes;

	// get an unique ID for the textarea element
	const id = getUniqueID();

	// create a div with class textbox that will be our main element
	const e = document.createElement("div");
	e.classList.add("textbox");

	// add the style if requested
	if(style) {
		e.setAttribute("style", style);
	}

	// prepare the different attributes for this textarea element. This is so that the code looks a little cleaner.
	const tba:string[] = [];

	/* eslint-disable @typescript-eslint/no-unused-expressions */
	lines && tba.push(lines === 1 ? "rows='1' wrap='off'" : "rows='"+ lines +"'");
	length && tba.push("maxlength='"+ length +"'");
	initial && tba.push("value='"+ initial +"'");
	hint && tba.push("placeholder='"+ hint +"'");
	width && tba.push("style='width:"+ width +"'");
	/* eslint-enable @typescript-eslint/no-unused-expressions */

	// set up the innerHTML of the element, containing all the sub-elements we are going to need
	e.innerHTML = /*html*/`
		<label for="${ id }" class="textbox_label" ${ labelWidth === undefined ? "" : "style='width: "+ labelWidth +"'" }>${ label ?? "" }</label>
		<textarea id="${ id }" class="textbox_value" ${ tba.join(" ") }></textarea>
	`;

	// add the size class into the div
	switch(type & 0xFF) {
		case TextboxEnum.Small:	e.classList.add("small"); break;
		case TextboxEnum.Medium:e.classList.add("medium"); break;
		case TextboxEnum.Large:	e.classList.add("large"); break;
	}

	// dump all the nodes we are going to reference later into these variables
	const labelEl = e.children[0] as HTMLDivElement;
	const valueEl = e.children[1] as HTMLTextAreaElement;

	/**
	 * Helper function to submit textbox value
	 */
	const _text = (user:boolean) => {
		valueEl.value = getValue(valueEl.value, user);
	}

	// handle clicking away from the edit box as updating the text content
	valueEl.onblur = () => _text(true);

	// handle special keys in the edit box
	valueEl.onkeydown = function(event:KeyboardEvent) {
		// disable shortcuts while writing to this textarea
		event.stopPropagation();

		switch(event.keyCode) {
			case 13:		// Enter key handler
				event.preventDefault();

				// update text content
				_text(true);
				return false;
		}
	}

	// return the main element, label element, and a function to edit the value
	return {
		element: e, label: labelEl,
		setValue: (value:string) => {
			// set the textbox value, then run the correction function
			valueEl.value = value;
			_text(false);
		},
	}
}