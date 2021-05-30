/**
 * The enum bitfield that defines the type of the button
 */
export enum ButtonEnum {
	// button sizes
	Small = 0x00, Medium = 0x01, Large = 0x02,
}

type ButtonAttributes = {
	/**
	 * Type of the button to use.
	 */
	type: ButtonEnum,

	/**
	 * If set, controls the style of the option. Otherwise, a default will be used.
	 */
	style?: string,

	/**
	 * The inner HTML of the element, whether it be text of SVG.
	 */
	html: string,
}

type ButtonReturn = {
	/**
	 * The button element.
	 */
	element: HTMLButtonElement,
}

/**
 * Function to create a button that controls a value, inside or outside the code.
 *
 * @param attributes Various attributes and functions related to the creation of the button
 * @returns An object containing the element and a click function
 */
export function makeButton(attributes:ButtonAttributes, handler:(event:MouseEvent) => unknown):ButtonReturn {
	// destructure the attributes object for easier access
	const { html, type, style, } = attributes;

	// create a div with class textbox that will be our main element
	const e = document.createElement("button");
	e.classList.add("button");
	e.innerHTML = html;

	// add the style if requested
	if(style) {
		e.setAttribute("style", style);
	}

	// add the size class into the button
	switch(type & 0xF) {
		case ButtonEnum.Small:	e.classList.add("small"); break;
		case ButtonEnum.Medium:	e.classList.add("medium"); break;
		case ButtonEnum.Large:	e.classList.add("large"); break;
	}

	// add the onclick handler
	e.onclick = handler;

	// return the data
	return { element: e, };
}