import { ButtonEnum, makeButton } from "../button/button";

export enum PopupColors {
	Normal = "",				// normal button/layout theme
	Info = "info",				// information screens
	Warning = "warning",		// warning screens
	Error = "error", 			// error screens
	Caution = "error",			// caution screens
}

export enum PopupSizes {
	Small = "sz-small",			// small popups with little text
	Medium = "sz-medium",		// medium popups with more text
	Large = "sz-large",			// large popups for a tooon of text
}

export type ConfirmationParams = {
	/**
	 * The actual inner content of the confirmation box
	 */
	html: string,

	/**
	 * The popup color style
	 */
	color?: PopupColors,

	/**
	 * Size of the popup
	 */
	size: PopupSizes,

	/**
	 * The list of confirmation buttons
	 */
	buttons: {
		/**
		 * The button text or HTML
		 */
		html: string,

		/**
		 * The button color style
		 */
		color?: PopupColors,

		/**
		 * The return value if the button is pressed
		 */
		result: unknown,

		/**
		 * Which side to align the buttons to. If not defined, will default to center.
		 */
		float?: "left"|"right",
	}[],
};

/**
 * Function to load a confirmation dialog onto the screen, and to return the button value.
 * Until a button is pressed, the function WILL NOT return.
 *
 * @param settings The settings to apply to this confirmation dialog
 * @returns The value defined by the button that gets pressed
 */
export function confirmationDialog(settings:ConfirmationParams): Promise<unknown> {
	return new Promise((res, rej) => {
		// find the popup div
		const popup = document.getElementById("popup");

		if(!popup) {
			// if not found, reject!!
			return rej(null);
		}

		// create the container div
		const element = document.createElement("div");
		element.classList.add("popupmain");
		popup.appendChild(element);

		// create the inner elements
		element.innerHTML = /*html*/`
			<div class="confirmationdialog ${ settings.size } ${ settings.color ?? "" }">
				<div>${ settings.html }</div>
				<div></div>
			</div>
		`;

		// grab the elements here
		const wrapper = element.children[0] as HTMLDivElement
		const buttons = wrapper.children[1] as HTMLDivElement;

		// helper function to accept a button press
		const accept = (ret:unknown) => {
			// remove the show class and wait 340ms before accepting
			element.classList.remove("show");

			setTimeout(() => {
				// resolve dis
				res(ret);

				// remove this from the popup as well
				popup.removeChild(element);
			}, 340)
		};

		// render every one of them
		settings.buttons.forEach((b) => {
			// generate the new button with html
			const be = makeButton({
				type: ButtonEnum.Medium,
				html: b.html,
				style: b.float ? "float:"+ b.float : undefined,
			}, (e) => {
				if(e.button === 0){
					// listener is clicked, fire off
					accept(b.result);
				}
			}).element;

			// add to the buttons list
			buttons.appendChild(be);

			// add the color class
			if(b.color) {
				be.classList.add(b.color);
			}
		});

		// give the show class at next frame
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				element.classList.add("show");
			});
		});
	});
}