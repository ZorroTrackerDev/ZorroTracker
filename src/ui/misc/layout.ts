import { UIShortcutHandler } from "../../api/ui";
import { PatternIndexEditor } from "../elements/matrixeditor/main";
import { volumeSlider, SliderEnum } from "../elements/slider/slider";
import { Project } from "./project";
import { addShortcutReceiver } from "./shortcuts";

export class _Temp implements UIShortcutHandler {
	public patternIndex:PatternIndexEditor|undefined;

	// eslint-disable-next-line require-await
	public async receiveShortcut(data: string[]): Promise<boolean> {
		switch(data.shift()) {
			case "patternindex":
				return this.patternIndex?.receiveShortcut(data) ?? false;
		}

		return false;
	}
}

export const _temp = new _Temp();

/**
 * Types of different standard layouts
 */
export enum LayoutType {
	Loading = "load",				// loading bar animation, also handles the animation that fades out/in the new layout
	NoLoading = "noload",			// remove the loading animation
	NoProjects = "noproject",		// this is the layout for when no editor is open at this moment
	ProjectInfo = "projectinfo",	// project information editor and module chooser
	Editor = "editor",				// the standard editor layout
}

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
	}, 510);
	return;
}

/**
 * Create a loading transition
 */
async function loadTransition() {
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
function clearChildren(element:Element) {
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
export async function fadeToLayout(type:LayoutType):Promise<void> {
	return new Promise((res) => {
		// load the editor parent element as `body`
		const body = document.getElementById("main_content");

		// check if it was found and is a div
		if(!body || !(body instanceof HTMLDivElement)){
			throw new Error("Unable to load layout "+ type +": parent element main_content not found!");
		}

		// fade out!
		body.classList.add("fadeout");

		// wait for finish
		setTimeout(async() => {
			// load the new layout
			await loadLayout(type);

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
		case LayoutType.Editor: return editorLayout(body);
		case LayoutType.NoProjects: return noProjectLayout(body);
	}

	throw new Error("Unable to load layout "+ type +": Not defined!");
}

/**
 * Function to load a new page with no project
 *
 * @param body The destination element for the layout
 */
async function noProjectLayout(body:HTMLDivElement):Promise<void> {
	clearChildren(body);

	// create a new container
	const contain = document.createElement("div");
	contain.id = "noproject";
	body.appendChild(contain);

	// create the no project text
	const text = document.createElement("div");
	text.innerText = "No Project Opened";
	contain.appendChild(text);

	// create open text
	const sho = document.createElement("div");
	sho.innerText = "Open a Project";
	contain.appendChild(sho);

	// create new text
	const crt = document.createElement("div");
	crt.innerText = "Create a Project";
	contain.appendChild(crt);

	// add the onclick handler
	sho.onclick = () => {
		window.preload.shortcut([ "ui.open", ]);
	};

	// add the onclick handler
	crt.onclick = () => {
		Project.loadProjectInfo("temp.ztm").catch(console.error);
	};
}

export async function editorLayout(body:HTMLDivElement):Promise<void> {
	clearChildren(body);
	/**
	 * -------------------------------------
	 * pattern index     | settings
	 * -------------------------------------
	 * pattern edit
	 * -------------------------------------
	 */

	const _top = document.createElement("div");
	_top.id = "editor_top";
	body.appendChild(_top);

	// initialize a new project. TODO: Driver-dependant behavior
	const p = await Project.createProject("temp.zip");

	if(!p) {
		throw new Error("Failed to initialize Project");
	}

	Project.current = p;

	_top.appendChild((_temp.patternIndex = new PatternIndexEditor(Project.current.index)).element);
	addShortcutReceiver("layout", (data) => _temp.receiveShortcut(data));

	const _bot = document.createElement("div");
	_bot.id = "editor_bottom";
	body.appendChild(_bot);

	const getspace = () => {
		const space = document.createElement("div");
		space.style.width = "20px";
		space.style.display = "inline-block";
		return space;
	}

	const btn = (text:string, event:string) => {
		const b = document.createElement("label");
		b.innerHTML = /*html*/`
			<input type="checkbox" onchange="${event}" />
			${text}
		`;
		return b;
	};

	_top.appendChild(getspace());
	_top.appendChild(await volumeSlider(SliderEnum.Horizontal | SliderEnum.Medium));

	_top.appendChild(document.createElement("br"));
	_top.appendChild(getspace());
	_top.appendChild(btn("FM1", "window.ipc.chip.muteFM(0, this.checked)"));
	_top.appendChild(btn("FM2", "window.ipc.chip.muteFM(1, this.checked)"));
	_top.appendChild(btn("FM3", "window.ipc.chip.muteFM(2, this.checked)"));
	_top.appendChild(btn("FM4", "window.ipc.chip.muteFM(3, this.checked)"));
	_top.appendChild(btn("FM5", "window.ipc.chip.muteFM(4, this.checked)"));
	_top.appendChild(btn("FM6", "window.ipc.chip.muteFM(5, this.checked)"));
	_top.appendChild(btn("DAC", "window.ipc.chip.muteFM(6, this.checked)"));

	_top.appendChild(document.createElement("br"));
	_top.appendChild(getspace());
	_top.appendChild(btn("PSG1", "window.ipc.chip.mutePSG(0, this.checked)"));
	_top.appendChild(btn("PSG2", "window.ipc.chip.mutePSG(1, this.checked)"));
	_top.appendChild(btn("PSG3", "window.ipc.chip.mutePSG(2, this.checked)"));
	_top.appendChild(btn("PSG4", "window.ipc.chip.mutePSG(3, this.checked)"));
}

