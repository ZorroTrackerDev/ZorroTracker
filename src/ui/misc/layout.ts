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
	NoProjects = "noproject",		// this is the layout for when no editor is open at this moment
	ProjectInfo = "projectinfo",	// project information editor and module chooser
	Editor = "editor",				// the standard editor layout
}

/**
 * Function to load a layout of a specific type
 *
 * @param type Type of the layout to load
 * @returns A promise for the completion of the load
 */
export async function loadLayout(type:LayoutType):Promise<unknown> {
	// load the editor parent element as `body`
	const body = document.getElementById("main_content");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load layout "+ type +": parent element main_content not found!");
	}

	console.info("load layout "+ type);

	// huge switch case for the layout type
	switch(type) {
		case LayoutType.Editor: return editorLayout(body);
	}

	throw new Error("Unable to load layout "+ type +": Not defined!");
}

export async function editorLayout(body:HTMLDivElement):Promise<void> {

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
