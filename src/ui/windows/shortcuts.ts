import { WindowType } from "../../defs/windowtype";
import { loadDefaultToolbar, setTitle } from "../elements/toolbar/toolbar";
import { loadSettingsFiles, SettingsTypes } from "../../api/files";
import { makeShortcutString, processShortcuts } from "../misc/shortcuts";
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

	// load all.ts asynchronously. This will setup our environment better than we can do here
	import("./all").then((module) => {
		// load the standard shortcuts
		module.loadStandardShortcuts(SettingsTypes.globalShortcuts, {
			close: () => {
				// shortcut for closing the window
				window.ipc.ui.close();
				return true;
			},
		});

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
							<col style="width: 30%">
							<col style="width: 30%">
							<col style="width: 40%">
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
											<td title="${ data.shortcut }">${ data.shortcut }</td>
											<td>${ data.key }</td>
											<td title="${ data.description }">${ data.description }</td>
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
		if(fn.startsWith("pattern")){
			return "Pattern editor";

		} else if(fn.startsWith("*pattern.note")){
			return "Notes";

		} else if(fn.startsWith("matrix")){
			return "Matrix editor";

		} else if(fn.startsWith("piano")){
			return "Piano";

		} else if(fn.startsWith("ui") || fn.startsWith("window")){
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
	"ui.opendevtools":						"Open Chromium developer tools",
	"ui.inspectelement":					"Activate inspect element",
	"ui.fullscreen":						"Maximize the current window",
	"ui.close":								"Close the current window",
	"ui.zoomin":							"Increase the content size",
	"ui.zoomout":							"Decrease the content size",
	"ui.zoomreset":							"Reset the content size to 100%",

	"ui.play":								"Play the full track",
	"ui.playpattern":						"Play the current pattern",
	"ui.stop":								"Stop playing",
	"ui.record":							"Toggle record mode",

	"ui.muteselected":						"Mute the currently selected channel",
	"ui.unmuteselected":					"Unmute the currently selected channel",
	"ui.muteall":							"Mute all channels",
	"ui.unmuteall":							"Unmute all channels",
	"ui.soloselected":						"Mute all but the selected channel",

	"window.projectinfo":					"Open project info window",
	"window.shortcuts":						"Open shortcut editor window",

	"ui.undo":								"Undo",
	"ui.redo":								"Redo",
	"ui.new":								"New project",
	"ui.open":								"Open file or project",
	"ui.save":								"Save project",
	"ui.saveas":							"Save project as",

	"ui.focus.pattern":						"Set focus to the pattern editor",
	"ui.focus.matrix":						"Set focus to the matrix editor",

	"matrix.move.up":						"Move selection up",
	"matrix.move.down":						"Move selection down",
	"matrix.move.left":						"Move selection left",
	"matrix.move.right":					"Move selection right",
	"matrix.movemax.up":					"Move selection to the top",
	"matrix.movemax.down":					"Move selection to the bottom",

	"matrix.select.up":						"Extend selection up",
	"matrix.select.down":					"Extend selection down",
	"matrix.select.left":					"Extend selection left",
	"matrix.select.right":					"Extend selection right",
	"matrix.selmax.up":						"Extend selection to the top",
	"matrix.selmax.down":					"Extend selection to the bottom",

	"matrix.selall":						"Select the entire matrix",
	"matrix.selrow":						"Select the matrix row",
	"matrix.selcolumn":						"Select the matrix column",
	"matrix.scroll.up":						"Scroll the matrix up",
	"matrix.scroll.down":					"Scroll the matrix down",

	"matrix.insert":						"Insert matrix row",
	"matrix.delete":						"Delete matrix row",
	"matrix.copy":							"Copy matrix selection to clipboard",
	"matrix.pasteenter":					"Paste matrix data from clipboard",
	"matrix.pasteexit":						"Cancel pasting matrix data",
	"matrix.edit":							"Apply pasting matrix, or edit matrix digits",

	"matrix.shiftup":						"Shift the selection up",
	"matrix.shiftdown":						"Shift the selection down",
	"matrix.change.up":						"Increment the selected digit(s)",
	"matrix.change.down":					"Decrement the selected digit(s)",

	"matrix.hex.0":							"Input digit 0",
	"matrix.hex.1":							"Input digit 1",
	"matrix.hex.2":							"Input digit 2",
	"matrix.hex.3":							"Input digit 3",
	"matrix.hex.4":							"Input digit 4",
	"matrix.hex.5":							"Input digit 5",
	"matrix.hex.6":							"Input digit 6",
	"matrix.hex.7":							"Input digit 7",
	"matrix.hex.8":							"Input digit 8",
	"matrix.hex.9":							"Input digit 9",
	"matrix.hex.A":							"Input digit A",
	"matrix.hex.B":							"Input digit B",
	"matrix.hex.C":							"Input digit C",
	"matrix.hex.D":							"Input digit D",
	"matrix.hex.E":							"Input digit E",
	"matrix.hex.F":							"Input digit F",

	"piano.toleft":							"Move piano to left",
	"piano.toright":						"Move piano to right",
	"piano.bigger":							"Increase piano size",
	"piano.smaller":						"Decrease piano size",
	"piano.octavedown":						"Increase base octave",
	"piano.octaveup":						"Decrease base octave",
	"piano.hide":							"Hide or unhide piano",
	"*pattern.note.rest":					"Play the rest note",
	"*pattern.note.cut":					"Play the note cut",

	"*pattern.note.octave0.C":				"Play C on current octave",
	"*pattern.note.octave0.C#":				"Play C# on current octave",
	"*pattern.note.octave0.D":				"Play D on current octave",
	"*pattern.note.octave0.D#":				"Play D# on current octave",
	"*pattern.note.octave0.E":				"Play E on current octave",
	"*pattern.note.octave0.F":				"Play F on current octave",
	"*pattern.note.octave0.F#":				"Play F# on current octave",
	"*pattern.note.octave0.G":				"Play G on current octave",
	"*pattern.note.octave0.G#":				"Play G# on current octave",
	"*pattern.note.octave0.A":				"Play A on current octave",
	"*pattern.note.octave0.A#":				"Play A# on current octave",
	"*pattern.note.octave0.B":				"Play B on current octave",

	"*pattern.note.octave1.C":				"Play C on the next octave",
	"*pattern.note.octave1.C#":				"Play C# on the next octave",
	"*pattern.note.octave1.D":				"Play D on the next octave",
	"*pattern.note.octave1.D#":				"Play D# on the next octave",
	"*pattern.note.octave1.E":				"Play E on the next octave",
	"*pattern.note.octave1.F":				"Play F on the next octave",
	"*pattern.note.octave1.F#":				"Play F# on the next octave",
	"*pattern.note.octave1.G":				"Play G on the next octave",
	"*pattern.note.octave1.G#":				"Play G# on the next octave",
	"*pattern.note.octave1.A":				"Play A on the next octave",
	"*pattern.note.octave1.A#":				"Play A# on the next octave",
	"*pattern.note.octave1.B":				"Play B on the next octave",

	"*pattern.note.octave2.C":				"Play C on the octave after",
	"*pattern.note.octave2.C#":				"Play C# on the octave after",
	"*pattern.note.octave2.D":				"Play D on the octave after",
	"*pattern.note.octave2.D#":				"Play D# on the octave after",
	"*pattern.note.octave2.E":				"Play E on the octave after",
	"*pattern.note.octave2.F":				"Play F on the octave after",
	"*pattern.note.octave2.F#":				"Play F# on the octave after",
	"*pattern.note.octave2.G":				"Play G on the octave after",
	"*pattern.note.octave2.G#":				"Play G# on the octave after",
	"*pattern.note.octave2.A":				"Play A on the octave after",
	"*pattern.note.octave2.A#":				"Play A# on the octave after",
	"*pattern.note.octave2.B":				"Play B on the octave after",

	"pattern.sel.move.up":					"Move selection up",
	"pattern.sel.move.down":				"Move selection down",
	"pattern.sel.move.left":				"Move selection left",
	"pattern.sel.move.right":				"Move selection right",
	"pattern.sel.scroll.up":				"Move selection up 4 rows",
	"pattern.sel.scroll.down":				"Move selection down 4 rows",
	"pattern.sel.movehighlight.up":			"Move selection to the closest highlighted row above",
	"pattern.sel.movehighlight.down":		"Move selection to the closest highlighted row below",
	"pattern.sel.movepattern.up":			"Move selection to the pattern above",
	"pattern.sel.movepattern.down":			"Move selection to the pattern below",
	"pattern.sel.rowtop":					"Move selection to the first row in pattern",
	"pattern.sel.rowbottom":				"Move selection to the last row in pattern",
	"pattern.sel.patterntop":				"Move selection to the first row in the first pattern",
	"pattern.sel.patternbottom":			"Move selection to the last row in the last pattern",
	"pattern.sel.movechannel.left":			"Move selection to the channel on the left",
	"pattern.sel.movechannel.right":		"Move selection to the channel on the right",

	"pattern.sel.extend.up":				"Extend selection up",
	"pattern.sel.extend.down":				"Extend selection down",
	"pattern.sel.extend.left":				"Extend selection left",
	"pattern.sel.extend.right":				"Extend selection right",
	"pattern.sel.scrollextend.up":			"Extend selection up 4 rows",
	"pattern.sel.scrollextend.down":		"Extend selection down 4 rows",
	"pattern.sel.extendtop":				"Extend selection to the first row in pattern",
	"pattern.sel.extendbottom":				"Extend selection to the last row in pattern",

	"pattern.sel.fullcolumn":				"Select the entire column if not selected",
	"pattern.sel.fullchannel":				"Select the entire channel if not selected",
	"pattern.sel.fullpattern":				"Select the entire pattern if not selected",
	"pattern.sel.deselect":					"Clear selection",

	"pattern.chfx.up":						"Increase channel effects count",
	"pattern.chfx.down":					"Decrease channel effects count",
};
