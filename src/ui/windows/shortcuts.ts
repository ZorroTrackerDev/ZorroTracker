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
		if(fn.startsWith("layout.matrix")){
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
	"ui.zoomin":						"Increase the content size",
	"ui.zoomout":						"Decrease the content size",

	"layout.open.projectinfo":			"Open project info window",
	"layout.open.shortcuts":			"Open shortcut editor window",

	"ui.undo":							"Undo",
	"ui.redo":							"Redo",
	"ui.new":							"New project",
	"ui.open":							"Open file or project",
	"ui.save":							"Save project",
	"ui.saveas":						"Save project as",

	"layout.matrix.move.up":			"Move selection up",
	"layout.matrix.move.down":			"Move selection down",
	"layout.matrix.move.left":			"Move selection left",
	"layout.matrix.move.right":			"Move selection right",
	"layout.matrix.movemax.up":			"Move selection to the top",
	"layout.matrix.movemax.down":		"Move selection to the bottom",

	"layout.matrix.select.up":			"Extend selection up",
	"layout.matrix.select.down":		"Extend selection down",
	"layout.matrix.select.left":		"Extend selection left",
	"layout.matrix.select.right":		"Extend selection right",
	"layout.matrix.selmax.up":			"Extend selection to the top",
	"layout.matrix.selmax.down":		"Extend selection to the bottom",

	"layout.matrix.selall":				"Select the entire matrix",
	"layout.matrix.selrow":				"Select the matrix row",
	"layout.matrix.selcolumn":			"Select the matrix column",
	"layout.matrix.scroll.up":			"Scroll the matrix up",
	"layout.matrix.scroll.down":		"Scroll the matrix down",

	"layout.matrix.insert":				"Insert matrix row",
	"layout.matrix.delete":				"Delete matrix row",
	"layout.matrix.copy":				"Copy matrix selection to clipboard",
	"layout.matrix.pasteenter":			"Paste matrix data from clipboard",
	"layout.matrix.pasteexit":			"Cancel pasting matrix data",
	"layout.matrix.edit":				"Apply pasting matrix, or edit matrix digits",

	"layout.matrix.shiftup":			"Shift the selection up",
	"layout.matrix.shiftdown":			"Shift the selection down",
	"layout.matrix.change.up":			"Increment the selected digit(s)",
	"layout.matrix.change.down":		"Decrement the selected digit(s)",

	"layout.matrix.hex.0":				"Input digit 0",
	"layout.matrix.hex.1":				"Input digit 1",
	"layout.matrix.hex.2":				"Input digit 2",
	"layout.matrix.hex.3":				"Input digit 3",
	"layout.matrix.hex.4":				"Input digit 4",
	"layout.matrix.hex.5":				"Input digit 5",
	"layout.matrix.hex.6":				"Input digit 6",
	"layout.matrix.hex.7":				"Input digit 7",
	"layout.matrix.hex.8":				"Input digit 8",
	"layout.matrix.hex.9":				"Input digit 9",
	"layout.matrix.hex.A":				"Input digit A",
	"layout.matrix.hex.B":				"Input digit B",
	"layout.matrix.hex.C":				"Input digit C",
	"layout.matrix.hex.D":				"Input digit D",
	"layout.matrix.hex.E":				"Input digit E",
	"layout.matrix.hex.F":				"Input digit F",
};