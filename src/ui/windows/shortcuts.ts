import { WindowType } from "../../defs/windowtype";
import { Module, Project, ProjectConfig } from "../misc/project";
import { loadDefaultToolbar, setTitle } from "../elements/toolbar/toolbar";
import { loadSettingsFiles, SettingsTypes } from "../../api/files";
import { addShortcutReceiver, makeShortcutString, processShortcuts } from "../misc/shortcuts";
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
window.type = WindowType.Shortcuts;

// @ts-expect-error - the remaining functions will be defined by all.ts
window.preload = {};

/* ipc communication */
import "../../system/ipc/html";
import "../../system/ipc/html sub";

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
			}

			// shortcut was not handled
			return false;
		});

		// load all.ts asynchronously. This will setup our environment better than we can do here
		import("./all").then(() => {
			/* load the menu */
			loadDefaultToolbar(false);
			setTitle("Project settings");

			// load layout for this window
			fadeToLayout(layout).then(() => {
				// remove the loading animation
				removeTransition();

			}).catch(console.error);
		}).catch(console.error);
	}).catch(console.error);
}).catch(console.error);

// function to load the layout for this window
async function layout() {
	// load the editor parent element as `body`
	const body = document.getElementById("main_content");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load project info layout: parent element main_content not found!");
	}

	clearChildren(body);

	// create a new container
	const contain = document.createElement("div");
	contain.id = "shortcutedit";
	body.appendChild(contain);

	// load the shortcuts data
	const shortcuts = loadShortcutTables();

	// generate HTML
	contain.innerHTML = /*html*/`
		<div>
			<table>
				<tr>
					<th>Shortcut code</th>
					<th>Shortcut keys</th>
					<th>Shortcut description</th>
				</tr>
				${
					// join each shortcut as their own row
					Object.keys(shortcuts).map((key) => {
						return /*html*/`
							<tr>
								<td>${ key }</td>
								<td>${ shortcuts[key].key }</td>
								<td>${ shortcuts[key].description }</td>
							</tr>
						`;
					}).join("")
				}
			</table>
		</div>
	`;

	return true;
}

// helper function to load shortcuts into sensible table form
function loadShortcutTables() {
	const out:{ [key: string]:{ key:string, description: string, type: string, } } = {};

	// load all the shortcut keys from description
	for(const key of Object.keys(shortcutDescriptions)) {
		out[key] = { type: "", key: "unassigned", description: shortcutDescriptions[key], };
	}

	// load settings files as array of data
	const files = loadSettingsFiles(SettingsTypes.editorShortcuts) as { [key: string]: string|string[]}[];

	// process the shortcuts with this fancy new function
	processShortcuts(files, (fn, states) => {
		out[fn] = { type: "", key: makeShortcutString(states), description: shortcutDescriptions[fn] ?? "<missing description>", };
	});

	return out;
}

// convert the shortcut function name into description
const shortcutDescriptions: { [key:string]: string } = {
	"ui.opendevtools":					"Open Chromium developer tools",
	"ui.inspectelement":				"Activate inspect element",
	"ui.fullscreen":					"Maximize the current window",
	"ui.close":							"Close the current window",

	"layout.open.projectinfo":			"Open project info window",
	"layout.open.shortcuts":			"Open shortcut editor window",

	"ui.undo":							"Undo",
	"ui.redo":							"Redo",
	"ui.new":							"New project",
	"ui.open":							"Open file or project",
	"ui.save":							"Save project",
	"ui.saveas":						"Save project as",

	"layout.patternindex.move.up":		"Move selection up",
	"layout.patternindex.move.down":	"Move selection down",
	"layout.patternindex.move.left":	"Move selection left",
	"layout.patternindex.move.right":	"Move selection right",
	"layout.patternindex.movemax.up":	"Move selection to the top",
	"layout.patternindex.movemax.down": "Move selection to the bottom",

	"layout.patternindex.select.up":	"Extend selection up",
	"layout.patternindex.select.down":	"Extend selection down",
	"layout.patternindex.select.left":	"Extend selection left",
	"layout.patternindex.select.right":	"Extend selection right",
	"layout.patternindex.selmax.up":	"Extend selection to the top",
	"layout.patternindex.selmax.down":	"Extend selection to the bottom",

	"layout.patternindex.selall":		"Select the entire matrix",
	"layout.patternindex.selrow":		"Select the matrix row",
	"layout.patternindex.selcolumn":	"Select the matrix column",
	"layout.patternindex.scroll.up":	"Scroll the matrix up",
	"layout.patternindex.scroll.down":	"Scroll the matrix down",

	"layout.patternindex.insert":		"Insert matrix row",
	"layout.patternindex.delete":		"Delete matrix row",
	"layout.patternindex.copy":			"Copy matrix selection to clipboard",
	"layout.patternindex.pasteenter":	"Paste matrix data from clipboard",
	"layout.patternindex.pasteexit":	"Cancel pasting matrix data",
	"layout.patternindex.edit":			"Apply pasting matrix, or edit matrix digits",

	"layout.patternindex.shiftup":		"Shift the selection up",
	"layout.patternindex.shiftdown":	"Shift the selection down",
	"layout.patternindex.change.up":	"Increment the selected digit(s)",
	"layout.patternindex.change.down":	"Decrement the selected digit(s)",

	"layout.patternindex.hex.0":		"Input digit 0",
	"layout.patternindex.hex.1":		"Input digit 1",
	"layout.patternindex.hex.2":		"Input digit 2",
	"layout.patternindex.hex.3":		"Input digit 3",
	"layout.patternindex.hex.4":		"Input digit 4",
	"layout.patternindex.hex.5":		"Input digit 5",
	"layout.patternindex.hex.6":		"Input digit 6",
	"layout.patternindex.hex.7":		"Input digit 7",
	"layout.patternindex.hex.8":		"Input digit 8",
	"layout.patternindex.hex.9":		"Input digit 9",
	"layout.patternindex.hex.A":		"Input digit A",
	"layout.patternindex.hex.B":		"Input digit B",
	"layout.patternindex.hex.C":		"Input digit C",
	"layout.patternindex.hex.D":		"Input digit D",
	"layout.patternindex.hex.E":		"Input digit E",
	"layout.patternindex.hex.F":		"Input digit F",
};
