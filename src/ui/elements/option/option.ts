import { getUniqueID } from "../../../api/dom";

/**
 * The enum bitfield that defines the type of the option field
 */
export enum OptionEnum {
	// option sizes
	Small = 0x00, Medium = 0x01, Large = 0x02,
}

type OptionAttributes = {
	/**
	 * Type of the option list to use.
	 */
	type: OptionEnum,

	/**
	 * If set, controls the option label text. This shows before the option list itself, letting the user know what this option list is for.
	 */
	label?: string,

	/**
	 * If set, controls the width of the option label text. This can help to make the labels the same size across an entire UI.
	 */
	labelWidth?: string,

	/**
	 * If set, controls the width of the option. Otherwise, a default will be used.
	 */
	width?: string,

	/**
	 * If set, controls the style of the option. Otherwise, a default will be used.
	 */
	style?: string,

	/**
	 * Function that gives the value of the option when its changed. This function is used to get informed about the UI change.
	 *
	 * @param value The input value from the textbox
	 * @returns The output value to put back into the textbox
	 */
	getOption?: (value:string) => void,

	/**
	 * The elements that the user can choose from
	 */
	items: { value: string, text: string, }[],
}

type OptionReturn = {
	/**
	 * The option element.
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
	setOption: (value:string) => void,
}

/**
 * Function to create a textbox that controls a value, inside or outside the code.
 *
 * @param type The type of the textbox to create. There are various standard settings for size
 * @param attributes Various attributes and functions related to the creation of the option list
 * @returns An object containing the element, the label, and a function to set the value from code into the slider
 */
export function makeOption(attributes:OptionAttributes):OptionReturn {
	// destructure the attributes object for easier access
	const { getOption, items, type, style, width, label, labelWidth, } = attributes;

	// get an unique ID for the select element
	const id = getUniqueID();

	// create a div with class textbox that will be our main element
	const e = document.createElement("div");
	e.classList.add("option");

	// add the style if requested
	if(style) {
		e.setAttribute("style", style);
	}

	// create each option into html
	let options = "";

	for(const item of items) {
		options += /*html*/`
			<option value="${ item.value }">${ item.text }</option>
		`;
	}

	// set up the innerHTML of the element, containing all the sub-elements we are going to need
	e.innerHTML = /*html*/`
		<label for="${ id }" class="option_label" ${ labelWidth === undefined ? "" : "style='width: "+ labelWidth +"'" }>${ label ?? "" }</label>
		<select id="${ id }" class="option_value" ${ width === undefined ? "" : "style='width:"+ width +"'" }>${ options }</select>
	`;

	// add the size class into the div
	switch(type & 0xFF) {
		case OptionEnum.Small:	e.classList.add("small"); break;
		case OptionEnum.Medium:	e.classList.add("medium"); break;
		case OptionEnum.Large:	e.classList.add("large"); break;
	}

	// dump all the nodes we are going to reference later into these variables
	const labelEl = e.children[0] as HTMLDivElement;
	const valueEl = e.children[1] as HTMLSelectElement;

	if(getOption) {
		// if getOption was defined, then add an event to call that function on selection.
		valueEl.onchange = () => {
			getOption(valueEl.value);
		}
	}

	// return the main element, label element, and a function to edit the option
	return {
		element: e, label: labelEl,
		setOption: (value:string) => {
			// set the option value
			valueEl.value = value;
		},
	}
}
