

/**
 * The enum bitfield that defines the type of the checkbox
 */
export enum CheckboxEnum {
	// slider sizes
	Small = 0x00, Medium = 0x01, Large = 0x02,
}

/**
 * Function that gives the value of the checkbox when its changed.
 *
 * @param value The input value from the checkbox
 */
type CheckboxFunctions = (value:boolean) => void;

export type CheckboxReturn = {
	/**
	 * The checkbox element.
	 */
	element: HTMLDivElement,

	/**
	 * The label element that should be controlled by the calling code.
	 */
	label: HTMLLabelElement,

	/**
	 * Function to set the checkbox value in the UI
	 *
	 * @param value Boolean indicating if the checkbox is checked or not
	 */
	setValue: (value:boolean) => void,
}

/**
 * Function to create a slider that controls a value, inside or outside the code. This also has an editable field where the user can input text.
 * The slider has a range of 0.0 to 1.0.
 *
 * @param type The type of the checkbox to create. There are various standard settings for size and direction
 * @param getValue The function is that is called when the checkbox updates state
 * @returns An object containing the element, the label, and a function to set the value from code into the slider
 */
export function makeCheckbox(type:CheckboxEnum, getValue:CheckboxFunctions):CheckboxReturn {
	// create a div with class checkbox that will be our main element
	const e = document.createElement("div");
	e.classList.add("checkbox");

	// set up the innerHTML of the element, containing all the sub-elements we are going to need
	e.innerHTML = /*html*/`
		<label class="checkbox_label"></label>
		<div class="checkbox_check">
			<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
				<path stroke="#e0e0e0" fill="none" stroke-linejoin="round" stroke-linecap="round" d="
					M 70 35
					L 48 75
					L 25 60
				" />
			</svg>
		</div>
	`;

	// add the size class into the div
	switch(type & 0xFF) {
		case CheckboxEnum.Small:	e.classList.add("checkbox_small"); break;
		case CheckboxEnum.Medium:	e.classList.add("checkbox_medium"); break;
		case CheckboxEnum.Large:	e.classList.add("checkbox_large"); break;
	}

	// get the checkbox node
	const checkNode = e.children[1] as HTMLDivElement;

	// handle user clicking on the checkbox
	checkNode.onmouseup = (e) => {
		if(e.button === 0) {
			// update the checked class and the UI
			getValue(checkNode.classList.toggle("checked"));
		}
	}

	// return the object representing this checkbox
	return {
		element: e,
		label: e.children[0] as HTMLLabelElement,
		setValue: (value:boolean) => {
			checkNode.classList[value ? "add" : "remove"]("checked");
		},
	}
}
