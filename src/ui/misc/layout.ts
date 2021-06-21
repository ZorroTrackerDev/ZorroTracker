// eslint-disable-next-line require-await
export function removeTransition(): void {
	// load the editor parent element as `body`
	const body = document.getElementById("loading");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load loading layout: parent element loading not found!");
	}

	if(body.children[0]) {
		// remove the special class
		body.children[0].classList.remove("show");

		setTimeout(() => {
			// remove the children and disable loading
			clearChildren(body);
			window.isLoading = false;
		}, 510);
	}
}

/**
 * Create a loading transition
 */
// eslint-disable-next-line require-await
export function loadTransition(): void {
	window.isLoading = true;

	// load the editor parent element as `body`
	const body = document.getElementById("loading");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load loading layout: parent element loading not found!");
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
export async function fadeToLayout(callback:() => Promise<boolean>):Promise<boolean> {
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
			if(!await callback()) {
				return res(false);
			}

			// fade in!
			body.classList.remove("fadeout");

			// wait for finish
			setTimeout(() => {
				res(true);
			}, 510);
		}, 510);
	});
}
