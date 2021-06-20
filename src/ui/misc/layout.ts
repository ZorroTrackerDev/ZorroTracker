import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../api/events";
import { closePopups, confirmationDialog, createFilename, PopupColors, PopupSizes } from "../elements/popup/popup";
import { Project } from "./project";

/**
 * Event listener and handler for program exit, making ABSOLUTELY SURE that the user saves their progress!!!
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.Exit, async(event:ZorroEventObject) => {
	// ask if the user wants to save, and if user cancels, then cancel the exit event too.
	if(!await askSavePopup()) {
		event.cancel();
	}
});

/**
 * Function for asking the user whether to save, not save or cancel, when project is dirty.
 *
 * @returns Boolean indicating whether or not user pressed the `cancel` button. `false` if the user did.
 */
export async function askSavePopup():Promise<boolean> {
	if(Project.current && Project.current.isDirty()) {
		try {
			// ask the user what to do
			switch(await confirmationDialog({
				color: PopupColors.Normal,
				size: PopupSizes.Small,
				html: /*html*/`
					<h2>Do you want to save your changes to ${ createFilename(Project.current.getFilename(), "?") }</h2>
					<p>Your changes <u>will</u> be lost if you don't save them.</p>
				`, buttons: [
					{ result: 0, float: "left", color: PopupColors.Caution, html: "Don't save", },
					{ result: 2, float: "right", color: PopupColors.Info, html: "Save", },
					{ result: 1, float: "right", color: PopupColors.Normal, html: "Cancel", },
				],
			}) as number) {
				case 2:						// ask the user to save.
					// If there is a save-as dialog and user cancels, or save fails, pretend the cancel button was pressed.
					return Project.current.save(false);

				case 0: return true;		// literally do nothing
				default: return false;		// indicate as cancelling
			}

		// on error cancel
		} catch(err) {
			return false;
		}

	} else {
		// see if we can close the active popups
		return closePopups();
	}
}

/**
 * Types of different standard layouts
 */
export enum LayoutType {
	Loading = "load",				// loading bar animation, also handles the animation that fades out/in the new layout
	NoLoading = "noload",			// remove the loading animation
}

// eslint-disable-next-line require-await
async function removeTransition() {
	// load the editor parent element as `body`
	const body = document.getElementById("loading");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load layout "+ LayoutType.Loading +": parent element loading not found!");
	}

	// remove the special class
	body.children[0].classList.remove("show");

	setTimeout(() => {
		clearChildren(body);
		window.isLoading = false;
	}, 510);
	return;
}

/**
 * Create a loading transition
 */
// eslint-disable-next-line require-await
async function loadTransition() {
	window.isLoading = true;
	// load the editor parent element as `body`
	const body = document.getElementById("loading");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load layout "+ LayoutType.Loading +": parent element loading not found!");
	}

	// clear all the children
	clearChildren(body);

	// create a new container
	const contain = document.createElement("div");
	contain.id = "regular_loader";
	body.appendChild(contain);

	// create the loader element
	const loader = document.createElement("div");
	contain.appendChild(loader);

	// create the individual elements
	for(let i = 12;i > 0; --i) {
		const e = document.createElement("div");
		loader.appendChild(e);
	}

	// enable the opacity animation next frame
	requestAnimationFrame(() => {
		contain.classList.add("show");
	});
}

/**
 * Function to clear all children from an element
 *
 * @param element The element to clear
 */
export function clearChildren(element:Element): void {
	// remove a,ll children
	while(element.children.length > 0){
		element.removeChild(element.children[0]);
	}
}

/**
 * Fade out the current layout, and fade in the new layout
 *
 * @param type The type of layout to load next
 */
// eslint-disable-next-line require-await
export async function fadeToLayout(callback:() => Promise<void>):Promise<void> {
	return new Promise((res) => {
		// load the editor parent element as `body`
		const body = document.getElementById("main_content");

		// check if it was found and is a div
		if(!body || !(body instanceof HTMLDivElement)){
			throw new Error("Unable to load layout: parent element main_content not found!");
		}

		// fade out!
		body.classList.add("fadeout");

		// wait for finish
		setTimeout(async() => {
			// load the new layout
			await callback();

			// fade in!
			body.classList.remove("fadeout");

			// wait for finish
			setTimeout(() => {
				res();
			}, 510);
		}, 510);
	});
}

/**
 * Function to load a layout of a specific type
 *
 * @param type Type of the layout to load
 * @returns A promise for the completion of the load
 */
export function loadLayout(type:LayoutType):Promise<unknown> {
	// load the editor parent element as `body`
	const body = document.getElementById("main_content");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load layout "+ type +": parent element main_content not found!");
	}

	console.info("load layout "+ type);

	// huge switch case for the layout type
	switch(type) {
		case LayoutType.Loading: return loadTransition();
		case LayoutType.NoLoading: return removeTransition();
	}

	throw new Error("Unable to load layout "+ type +": Not defined!");
}

