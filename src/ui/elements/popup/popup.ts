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

		/**
		 * If defined, this is the default option. This is only executed when another popup is trying to activate.
		 * If no button has default action, the next popup will be rejected.
		 */
		default?: true,
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
		try {
			// check if there is an already active popup
			if(activePopup) {
				// find the default button
				const buttons = (activePopup.children[0] as HTMLDivElement).children[1] as HTMLDivElement;
				let click = false;

				for(let i = 0;i < buttons.childElementCount;i ++) {
					if(buttons.children[i] instanceof HTMLButtonElement) {
						// if this child is a button, check if it has the right attribute
						if(buttons.children[i].hasAttribute("default")) {

							// pretend this button was clicked
							(buttons.children[i] as HTMLButtonElement).click();
							click = true;
							break;
						}
					}
				}

				// if no default button was found, reject
				if(!click) {
					prompt();
					return rej();
				}
			}

			// find the popup div
			const popup = document.getElementById("popup");

			if(!popup) {
				// if not found, reject!!
				return rej(null);
			}

			// disable shortcuts and misc functions
			window.isLoading = true;

			// create the container div
			const element = document.createElement("div");
			element.classList.add("popupmain");
			popup.appendChild(element);
			activePopup = element;

			// create the inner elements
			element.innerHTML = /*html*/`
				<div class="confirmationdialog ${ settings.size } ${ settings.color ?? "" }">
					<div>${ settings.html }</div>
					<div></div>
				</div>
			`;

			// grab the elements here
			const wrapper = element.children[0] as HTMLDivElement;
			const buttons = wrapper.children[1] as HTMLDivElement;

			// helper function to accept a button press
			const accept = (ret:unknown) => {
				// remove the show class and wait 340ms before accepting
				element.classList.remove("show");
				activePopup = null;

				setTimeout(() => {
					// resolve dis
					res(ret);

					// enable shortcuts and misc functions
					window.isLoading = activePopup !== null;

					// remove this from the popup as well
					popup.removeChild(element);
				}, 460)
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

				// if default, append default attribute
				if(b.default) {
					be.toggleAttribute("default", true);
				}
			});

			// give the show class at next frame
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					element.classList.add("show");
				});
			});
		} catch(ex) { rej(ex); }
	});
}

let activePopup:HTMLDivElement|null = null;
let _prompted:NodeJS.Timeout|null = null;

/**
 * Helper function to highlight the currently active popup
 */
function prompt() {
	// if any active popup exists and not being prompted atm, then give prompt class
	if(activePopup && !_prompted) {
		// if any active popup exists and not being prompted atm, then give prompt class
		activePopup.classList.add("prompt");

		_prompted = setTimeout(() => {
			// after some time, remoe the prompt class and timeout
			_prompted = null;
			activePopup?.classList.remove("prompt");

		}, 160);
	}
}

/**
 * Function to create a helpful filename object. This will correctly show even long filenames.
 *
 * @param filename The name of the file to create
 * @param suffix Any suffix string to append to filename
 * @returns The HTML representing this object
 */
export function createFilename(filename:string, suffix:string): string {
	return /*html*/`<span class="filename">&quot;<span>${ filename }</span>&quot;${ suffix }</span>`;
}
