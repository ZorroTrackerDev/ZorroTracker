import { WindowType } from "../../defs/windowtype";
import { Module, Project, ProjectConfig } from "../misc/project";
import { loadDefaultToolbar, setTitle } from "../elements/toolbar/toolbar";
import { SettingsTypes } from "../../api/files";
import { addShortcutReceiver } from "../misc/shortcuts";
import { clearChildren, fadeToLayout, loadTransition, removeTransition } from "../misc/layout";
import { makeTextbox, TextboxEnum } from "../elements/textbox/textbox";
import { makeOption, OptionEnum } from "../elements/option/option";
import { ModuleSelect } from "../elements/moduleselect/main";
import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../api/events";
import { ipcRenderer } from "electron";
import { ipcEnum } from "../../system/ipc/ipc enum";

/**
 * So.. In order for Jest testing to work, we need to load stuff as modules. However, browsers really don't like CommonJS modules
 * Also, Electron does not work with ES2015 modules. Also, trying to use mix of both is apparently borked to hell. Here we have an
 * amazing solution: Just pretend "exports" exists. Yeah. This will be filled with garbage, probably. But this fixes the issue
 * where browsers don't support CommonJS modules. As it turns out, this single line will fix the issues we're having. I hate this.
 */
window.exports = {};

// set window type
window.type = WindowType.ProjectInfo;

// @ts-expect-error - the remaining functions will be defined by all.ts
window.preload = {};

/* ipc communication */
import "../../system/ipc/html";
import "../../system/ipc/html sub";

// handler for project init
ipcRenderer.on(ipcEnum.ProjectInit, (event, config:ProjectConfig, modules:Module[]) => {
	// create the loading animation
	loadTransition();

	// load the project data
	Project.loadInternal(config, modules);

	// load the project layout
	fadeToLayout(projectInfoLayout).then(() => {
		// remove the loading animation
		removeTransition();

	}).catch(console.error);
});

window.ipc.ui.path().then(() => {
	// create the loading animation
	loadTransition();

	/* load shortcuts handler file */
	import("../misc/shortcuts").then((module) => {
		module.loadDefaultShortcuts(SettingsTypes.globalShortcuts);

		// add default UI shortcuts handler
		// eslint-disable-next-line require-await
		addShortcutReceiver("ui", async(data) => {
			switch(data.shift()) {
				/* shortcut for opening chrome dev tools */
				case "opendevtools":
					window.ipc.ui.devTools();
					return true;

				/* shortcut for inspect element */
				case "inspectelement":
					window.ipc.ui.inspectElement();
					return true;

				/* shortcut for fullscreen */
				case "fullscreen":
					window.ipc.ui.maximize();
					return true;

				/* shortcut for closing a window */
				case "close":
					window.ipc.ui.close();
					return true;

				/* shortcut for zooming in the window */
				case "zoomin":
					window.ipc.ui.zoomIn();
					return true;

				/* shortcut for zooming out the window */
				case "zoomout":
					window.ipc.ui.zoomOut();
					return true;
			}

			// shortcut was not handled
			return false;
		});

		// load all.ts asynchronously. This will setup our environment better than we can do here
		import("./all").then(() => {
			/* load the menu */
			loadDefaultToolbar(false);
			setTitle("Project settings");

			// request for project info
			ipcRenderer.send(ipcEnum.ProjectInit, window.type);

		}).catch(console.error);
	}).catch(console.error);
}).catch(console.error);

/**
 * Helper event listener for the SelectModule event, so that the selection can be updated
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.SelectModule, async(event:ZorroEventObject, project:Project|undefined, module:Module|undefined) => {
	selectEditFunc(project, module);
});

// helper function to update selection because yes
const selectEditFunc = (project?:Project, module?:Module) => {
	if(_selectEdit) {
		_selectEdit.forEach((fn) => fn(project, module));
	}
}

const _selectEdit: ((project?:Project, module?:Module) => void)[] = [];

// load the layout for this window
async function projectInfoLayout():Promise<true> {
	// load the editor parent element as `body`
	const body = document.getElementById("main_content");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load project info layout: parent element main_content not found!");
	}

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

				// send request to update config
				ipcRenderer.send(ipcEnum.ProjectSetName, Project.current.config.name);
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

	// update textboxes
	selectEditFunc();

	return true;
}
