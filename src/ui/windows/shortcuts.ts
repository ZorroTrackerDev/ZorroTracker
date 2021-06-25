import { WindowType } from "../../defs/windowtype";
import { loadDefaultToolbar, setTitle } from "../elements/toolbar/toolbar";
import { loadSettingsFiles, SettingsTypes } from "../../api/files";
import { addShortcutReceiver, makeShortcutString, processShortcuts } from "../misc/shortcuts";
import { clearChildren, fadeToLayout, loadTransition, removeTransition } from "../misc/layout";

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
			setTitle("Shortcuts");

			// load layout for this window
			fadeToLayout(layout).then(() => {
				// remove the loading animation
				removeTransition();

			}).catch(console.error);
		}).catch(console.error);
	}).catch(console.error);
}).catch(console.error);

// function to load the layout for this window
// eslint-disable-next-line require-await
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
			${
				Object.keys(shortcuts).map((key) => {
					return /*html*/`
						<table>
							<tr>
								<th colspan="3" style="font-size: 15pt;">${ key }</th>
							</tr>
							<tr>
								<th>Shortcut code</th>
								<th>Shortcut keys</th>
								<th>Shortcut description</th>
							</tr>
							${
								// join each shortcut as their own row
								shortcuts[key].map((data) => {
									return /*html*/`
										<tr>
											<td>${ data.shortcut }</td>
											<td>${ data.key }</td>
											<td>${ data.description }</td>
										</tr>
									`;
								}).join("")
							}
						</table>
					`;
				}).join("")
			}
		</div>
	`;

	return true;
}

// helper function to load shortcuts into sensible table form
function loadShortcutTables() {
	// helper function to convert layout path type to index
	const getType = (fn:string) => {
		if(fn.startsWith("layout.patternindex")){
			return "Pattern index";

		} else if(fn.startsWith("ui") || fn.startsWith("layout.open")){
			return "General";
		}

		return "Unknown";
	}

	// helper function to set a shortcut value
	const set = (fn:string, key:string) => {
		// load the type
		const type = getType(fn);

		// if array not defined, define it
		if(!out[type]) {
			out[type] = [];
		}

		// find the shortcut already defined
		const item = out[type].find((i) => i.shortcut === fn);

		if(item) {
			// update item data
			item.key = key;

		} else {
			// did not exist, create a new item
			out[type].push({ shortcut: fn, key: key, description: shortcutDescriptions[fn] ?? "<missing description>", });
		}
	}

	// initialize the output data structure
	const out:{ [key: string]:{ key:string, description: string, shortcut: string, }[] } = {};

	// load all the shortcut keys from description
	for(const fn of Object.keys(shortcutDescriptions)) {
		set(fn, "unassigned");
	}

	// load settings files as array of data
	const files = loadSettingsFiles(SettingsTypes.editorShortcuts) as { [key: string]: string|string[]}[];

	// process the shortcuts with this fancy new function
	processShortcuts(files, (fn, states) => {
		set(fn, makeShortcutString(states));
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
