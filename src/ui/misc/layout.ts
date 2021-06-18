import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../api/events";
import { Undo } from "../../api/undo";
import { ButtonEnum, makeButton } from "../elements/button/button";
import { PatternIndexEditor } from "../elements/matrixeditor/main";
import { ModuleSelect } from "../elements/moduleselect/main";
import { makeOption, OptionEnum } from "../elements/option/option";
import { confirmationDialog, createFilename, PopupColors, PopupSizes } from "../elements/popup/popup";
import { volumeSlider, SliderEnum } from "../elements/slider/slider";
import { makeTextbox, TextboxEnum } from "../elements/textbox/textbox";
import { Project, Module } from "./project";
import { addShortcutReceiver } from "./shortcuts";

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
	}

	// no need to save, do nothing
	return true;
}


// handler for receiving shortcuts
let patternIndex:PatternIndexEditor|undefined;

// note, this is here just because in testing it might not actually exist!
if(addShortcutReceiver) {
	addShortcutReceiver("layout", async(data) => {
		switch(data.shift()) {
			case "patternindex":
				return patternIndex?.receiveShortcut(data) ?? false;

				case "open":
					switch(data.shift()) {
						case "projectinfo":
							// open loading animation
							await loadLayout(LayoutType.Loading);
							Undo.clear();

							// save project as current
							await fadeToLayout(LayoutType.ProjectInfo);
							await loadLayout(LayoutType.NoLoading);
							return true;
					}
		}

		return false;
	});
}

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
		window.isLoading = false;
	}, 510);
	return;
}

/**
 * Create a loading transition
 */
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
		case LayoutType.ProjectInfo: return projectInfoLayout(body);
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
	text.innerText = "No project opened";
	contain.appendChild(text);

	// create open text
	const sho = document.createElement("div");
	sho.innerText = "Open a project";
	contain.appendChild(sho);

	// create new text
	const crt = document.createElement("div");
	crt.innerText = "New project";
	contain.appendChild(crt);

	// add the onclick handler
	sho.onclick = () => {
		window.preload.shortcut([ "ui.open", ]);
	};

	// add the onclick handler
	crt.onclick = () => {
		window.preload.shortcut([ "ui.new", ]);
	};
}

// helper function to update selection because yes
const selectEditFunc = (project?:Project, module?:Module) => {
	if(_selectEdit) {
		_selectEdit.forEach((fn) => fn(project, module));
	}
}

let _selectEdit: ((project?:Project, module?:Module) => void)[] = [];

/**
 * Helper event listener for the SelectModule event, so that the selection can be updated
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.SelectModule, async(event:ZorroEventObject, project:Project|undefined, module:Module|undefined) => {
	selectEditFunc(project, module);
});

async function projectInfoLayout(body:HTMLDivElement):Promise<void> {
	clearChildren(body);

	// create a new container
	const contain = document.createElement("div");
	contain.id = "projectinfo";
	body.appendChild(contain);

	// load the project name textbox
	const name = makeTextbox({
		type: TextboxEnum.Large, label: "Project name", lines: 1, length: 100, hint: "For example: \"My new mixtape\"",
		style: "width: fit-content; margin: 0 auto; margin-bottom: 40px;", width: "50vw",
		getValue: (value:string, user:boolean) => {
			// set the project name
			if(user && Project.current) {
				Project.current.config.name = value;
			}

			return value;
		},
	});

	name.setValue(Project.current?.config.name ?? "<invalid>");
	contain.appendChild(name.element);

	// create a line
	const line0 = document.createElement("div");
	line0.classList.add("line");
	contain.appendChild(line0);

	// load the driver selection option
	const drivers = await window.ipc.driver.findAll();

	const driver = makeOption({
		type: OptionEnum.Medium, label: "Project sound driver", width: "200px", style: "display: inline-flex; margin-right: 20px;", items:
		Object.entries(drivers).map(item => { return { text: item[1].name, value: item[1].uuid, } }),
	});

	line0.appendChild(driver.element);

	// add the module selector
	contain.appendChild(new ModuleSelect(Project.current as Project).element);

	// add the module editor
	const line1 = document.createElement("div");
	line1.classList.add("module");
	contain.appendChild(line1);

	// load the module name textbox
	const mname = makeTextbox({
		type: TextboxEnum.Medium, label: "Module name", lines: 1, length: 100, hint: "For example: \"Fox in a box\"",
		style: "",
		getValue: (value:string, user:boolean) => {
			// set the project name
			if(user && Project.current && Project.current.activeModuleIndex >= 0) {
				Project.current.modules[Project.current.activeModuleIndex].name = value;
				Project.current.changeModule();
			}

			return value;
		},
	});

	// function for updating the value
	_selectEdit.push((p, m) => mname.setValue(m?.name ?? ""));
	line1.appendChild(mname.element);

	// load the module author textbox
	const mauth = makeTextbox({
		type: TextboxEnum.Medium, label: "Authors", lines: 1, length: 100, hint: "For example: \"Rosy, Nicole and Elise\"",
		style: "",
		getValue: (value:string, user:boolean) => {
			// set the project name
			if(user && Project.current && Project.current.activeModuleIndex >= 0) {
				Project.current.modules[Project.current.activeModuleIndex].author = value;
				Project.current.changeModule();
			}

			return value;
		},
	});

	// function for updating the value
	_selectEdit.push((p, m) => mauth.setValue(m?.author ?? ""));
	line1.appendChild(mauth.element);

	// load the module author textbox
	const mnum = makeTextbox({
		type: TextboxEnum.Medium, label: "Index", lines: 1, length: 2, hint: "For example: 8F",
		style: "flex: 0 0; min-width: 105px; max-width: 105px;",
		getValue: (value:string, user:boolean) => {
			// convert value
			const v = parseInt(value, 16);

			// check if its valid
			if(isNaN(v) || v < 0 || v > 0xFF){
				return "00";
			}

			// set the project name
			if(user && Project.current && Project.current.activeModuleIndex >= 0) {
				// update value
				Project.current.modules[Project.current.activeModuleIndex].index = v;
				Project.current.changeModule();
			}

			// convert correctly to string
			return v.toByte();
		},
	});

	// function for updating the value
	_selectEdit.push((p, m) => mnum.setValue(m?.index.toByte() ?? "00"));
	line1.appendChild(mnum.element);

	// create a line
	const line2 = document.createElement("div");
	line2.classList.add("line");
	line2.style.width = "100%";
	line2.style.marginTop = "15px";
	contain.appendChild(line2);

	// load the editor button
	line2.appendChild(makeButton({
		type: ButtonEnum.Large, html: "Edit module", style: "float: right;",
	}, async(e) => {
		// if right clicked, go to the editor
		if(e.button === 0 && Project.current && Project.current.activeModuleIndex >= 0){
			// open loading animation
			await loadLayout(LayoutType.Loading);
			Undo.clear();

			// save project as current
			await fadeToLayout(LayoutType.Editor);
			await loadLayout(LayoutType.NoLoading);

			// clear functions
			_selectEdit = [];
		}
	}).element);

	// load the cancel button
	line2.appendChild(makeButton({
		type: ButtonEnum.Large, html: "Exit", style: "float: left;",
	}, async(e) => {
		// if right clicked, go to the editor
		if(e.button === 0){
			// open loading animation
			await loadLayout(LayoutType.Loading);
			Undo.clear();

			// save project as current
			await fadeToLayout(LayoutType.NoProjects);
			await loadLayout(LayoutType.NoLoading);

			// clear functions
			_selectEdit = [];
		}
	}).element);

	// update textboxes
	selectEditFunc();
}

export async function editorLayout(body:HTMLDivElement):Promise<void> {
	if(!Project.current) {
		throw new Error("Failed to load editorLayout: No project loaded.");
	}

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

	_top.appendChild((patternIndex = new PatternIndexEditor(Project.current.index)).element);

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

