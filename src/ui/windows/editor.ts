import { WindowType } from "../../defs/windowtype";
import fs from "fs";
/**
 * So.. In order for Jest testing to work, we need to load stuff as modules. However, browsers really don't like CommonJS modules
 * Also, Electron does not work with ES2015 modules. Also, trying to use mix of both is apparently borked to hell. Here we have an
 * amazing solution: Just pretend "exports" exists. Yeah. This will be filled with garbage, probably. But this fixes the issue
 * where browsers don't support CommonJS modules. As it turns out, this single line will fix the issues we're having. I hate this.
 */
window.exports = {};

// set window type
window.type = WindowType.Editor;

// helper function to reload the current theme
window.reloadTheme = () => {
	reloadTheme();
};

// @ts-expect-error - the remaining functions will be defined by all.ts
window.preload = {
	/* open a VGM file */
	vgm: async function() {
		const result = await window.ipc.ui.dialog.open("openfolder", {
			properties: [ "openFile", ],
			filters: [
				{ name: "Vgm Files", extensions: [ "vgm", ], },
				{ name: "All Files", extensions: [ "*", ], },
			],
		});

		// if invalid file was applied or operation was cancelled, abort
		if(!result) {
			return;
		}

		// stop the audio playback and restart it with the new file opened. TODO: This is only test code!
		console.log("VGM", result);
		window.ipc.audio?.stop();
		setTimeout(() => window.ipc.audio?.play(result), 50);
	},

	/**
	 * Execute a shortcut action. This is usually done within UI, such as toolbar
	 *
	 * @param name The name of the shortcut to execute
	 */
	shortcut: async(name:string[]) => {
		await doShortcut(name);
	},
}

/**
 * Helper function to determine if the component is focused
 *
 * @param name The component name to check
 * @returns Boolean indicating if the focus is on the named component
 */
function checkFocus(name:string) {
	return document.querySelector(":focus") === components.get<UIComponent<HTMLElement>>(name)?.element;
}

// create a function to give priority to shortcuts
window.shortcutPriority = (data:string[]) => {
	switch(data.shift()) {
		case "pattern":
			switch(data.shift()) {
				case "hex": return 3;
				default: return 5;
			}

		case "matrix": return checkFocus("matrix") ? 1 : 11;
		case "*pattern": return 4;
		case "piano": return 12;
		case "window": return 13;
		case "ui": return 10;
		default: return 999;
	}
}

import { addShortcutReceiver, doShortcut } from "../misc/shortcuts";
import { loadDefaultToolbar } from "../elements/toolbar/toolbar";
import { loadFlag, SettingsTypes, zorroFormats } from "../../api/files";
import { Module, Project } from "../misc/project";
import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../api/events";
import { createVolumeSlider, simpleValue, SimpleValueReturn, SliderEnum } from "../elements/slider/slider";
import { closePopups, confirmationDialog, createFilename, PopupColors, PopupSizes } from "../elements/popup/popup";
import { Undo } from "../../api/undo";
import { MatrixEditor } from "../elements/matrixeditor/main";
import { Piano } from "../elements/piano/piano";
import { PatternEditor } from "../elements/patterneditor/main";
import { MIDI } from "../misc/MIDI";
import { loadTheme, reloadTheme } from "../misc/theme";
import { PlayMode, Tab } from "../misc/tab";
import { enableMediaKeys } from "../misc/media keys";
import { UIComponent, UIComponentStore, UIShortcutHandler } from "../../api/ui";
import { PlayBar } from "../elements/playbuttonsbar/main";
import { CheckboxEnum, makeCheckbox, CheckboxReturn } from "../elements/checkbox/checkbox";

/* ipc communication */
import "../../system/ipc/html editor";
import "../misc/playback";
import { initPlayback, setFlags, startPlayback, stopPlayback } from "../misc/playback";
import { makeTimeDisplay } from "../elements/time display/time";

// stored list of components active
const components = new UIComponentStore();

// request the appPath variable from main thread
window.ipc.ui.path().then(async() => {
	// TODO: Temporary code to initiate the audio system with an emulator and set volume. Bad!
	window.ipc.audio?.setChip(loadFlag<string>("CHIP") ?? "");

	// STEP 1: Load shortcuts and toolbar
	await loadMainShortcuts();
	loadDefaultToolbar(true);

	// STEP 2: Load project and tab
	if(loadFlag<boolean>("OPEN_PREVIOUS")) {
		// get the cookie for the previously opened project
		const url = await window.ipc.cookie.get("lastproject");

		try {
			// check if an url was provided
			if((url?.length ?? 0) > 0) {
				// check if file exists. generates and error if not
				await fs.promises.access(url as string, fs.constants.F_OK);

				// attempt to load project
				const p = await Project.loadProject(url as string);

				if(p) {
					// load as a tab
					Tab.active = new Tab(p);
				}
			}

		} catch(ex) { /* ignore */ }
	}

	// if no valid tab is loaded, create a new tab with a blank project
	if(!Tab.active) {
		const p = await Project.createProject();

		if(p) {
			// load as a tab
			Tab.active = new Tab(p);
		}
	}

	await initPlayback(Tab.active as Tab);

	// let the other windows know about this project
	window.ipc.project?.init(Tab.active?.project);

	requestAnimationFrame(() => {
		requestAnimationFrame(async() => {
			// make the loading bar fade in properly
			document.getElementById("loadeditor")?.classList.add("fade");

			// STEP 3: load system theme
			const themes = await window.ipc.theme.findAll();
			const tcur = themes[loadFlag<string>("THEME") ?? "prototype"];

			if(tcur) {
				loadTheme(tcur);
			}

			// STEP 4: initialize the layout and components
			await initLayout();

			// STEP 5: initialize miscellaneous less important systems
			MIDI.init();
			await enableMediaKeys();

			// enable discord RPC
			if(loadFlag<boolean>("DISCORD_RPC")) {
				// load Discord RPC integration
				window.ipc.rpc?.init();

				import("../misc/rpc").then((module) => {
					module.init(Tab.active?.project);
				}).catch(console.error);
			}

			// STEP 6: make all the UI components load
			components.setComponentTab(Tab.active as Tab);
			await components.loadComponents(10);

			// STEP 7: Hide loading block
			disableLoading();
		});
	});

}).catch(console.error);

async function loadMainShortcuts() {
	// load all.ts asynchronously. This will setup our environment better than we can do here
	const module = await import("./all");

	module.loadStandardShortcuts(SettingsTypes.editorShortcuts, {
		/* shortcut for opening a file or a project */
		open: async() => {
			// first, ask to save the current project. If user presses cancel, then do not run the code
			if(!await askSavePopup()) {
				return false;
			}

			// open the openFileDialog to find the target file
			const result = await window.ipc.ui.dialog.open("openfolder", {
				properties: [ "openFile", ],
				filters: [
					{ name: "ZorroTracker Module Files", extensions: [ "ztm", ], },
					{ name: "ZorroTracker Files", extensions: [ "zip", ], },
					{ name: "All Files", extensions: [ "*", ], },
				],
			});

			// if invalid file was applied or operation was cancelled, abort
			if(!result) {
				return false;
			}

			// open loading animation
			Undo.clear();
			await enableLoading();
			Tab.active?.project.clearAutosave();

			// try to load the project
			const p = await Project.loadProject(result);

			// check if loaded and if was allowed to load
			if(!p || !await Project.setActiveProject(p)){
				disableLoading();
				return false;
			}

			// unload all components properly
			await components.unloadComponents(10);

			// create a tab for the project
			Tab.active = new Tab(p);
			await initPlayback(Tab.active as Tab);

			// let all windows know about the loaded project
			window.ipc.project?.init(p);

			// load all of the components with this new tab
			components.setComponentTab(Tab.active as Tab);
			await components.loadComponents(10);

			// remove loading animation
			disableLoading();
			return true;
		},

		/* shortcut for creating a new project */
		new: async() => {
			// first, ask to save the current project. If user presses cancel, then do not run the code
			if(!await askSavePopup()) {
				return false;
			}

			// open loading animation
			Undo.clear();
			await enableLoading();
			Tab.active?.project.clearAutosave();

			// try to load the project
			const p = await Project.createProject();

			// check if loaded and if was allowed to load
			if(!p || !await Project.setActiveProject(p)){
				disableLoading();
				return false;
			}

			// unload all components properly
			await components.unloadComponents(10);

			// create a tab for the project
			Tab.active = new Tab(p);
			await initPlayback(Tab.active as Tab);

			// let all windows know about the loaded project
			window.ipc.project?.init(p);

			// load all of the components with this new tab
			components.setComponentTab(Tab.active as Tab);
			await components.loadComponents(10);

			// remove loading animation
			disableLoading();
			return true;
		},

		/* shortcut for closing a project */
		close: () => {
			return false;
		},

		/* shortcut for doing a redo action */
		redo: () => {
			return Undo.redo();
		},

		/* shortcut for doing a undo action */
		undo: () => {
			return Undo.undo();
		},

		/* shortcut for doing a save action */
		save: async() => {
			try {
				return await Tab.active?.project.save() ?? false;

			} catch(ex)  {
				console.error(ex);
			}

			return false;
		},

		/* shortcut for doing a save as action */
		saveas: async() => {
			try {
				return await Tab.active?.project.saveAs() ?? false;

			} catch(ex)  {
				console.error(ex);
			}

			return false;
		},

		/* shortcut for toggling record mode */
		// eslint-disable-next-line require-await
		record: async() => {
			if(!Tab.active){
				return false;
			}

			// toggle record mode
			Tab.active.recordMode = !Tab.active.recordMode;
			return true;
		},

		/* shortcut for enabling play mode */
		play: async() => {
			if(!Tab.active || Tab.active.playMode === PlayMode.PlayAll){
				return false;
			}

			// toggle play mode
			const row = Tab.active?.activeRow ?? 0;

			if(await startPlayback(row - (row % (Tab.active?.module?.patternRows ?? 1)), false, false)){
				Tab.active.playMode = PlayMode.PlayAll;
			}

			return true;
		},

		/* shortcut for enabling play pattern mode */
		playpattern: async() => {
			if(!Tab.active || Tab.active.playMode === PlayMode.PlayPattern){
				return false;
			}

			// toggle play mode
			const row = Tab.active?.activeRow ?? 0;

			if(await startPlayback(row - (row % (Tab.active?.module?.patternRows ?? 1)), true, false)){
				Tab.active.playMode = PlayMode.PlayPattern;
			}

			return true;
		},

		/* shortcut for disabling playback mode */
		// eslint-disable-next-line require-await
		stop: () => {
			if(!Tab.active || Tab.active.playMode === PlayMode.Stopped){
				return false;
			}

			// toggle play mode
			Tab.active.playMode = PlayMode.Stopped;
			stopPlayback().catch(console.error);
			return true;
		},

		/* shortcut for muting the selected channel */
		muteselected: async() => {
			if(!Tab.active || !Tab.active.selectedChannel || Tab.active.selectedChannel.muted){
				return false;
			}

			// mute the selected channel
			await Tab.active.setMute(Tab.active.selectedChannel, true);
			return true;
		},

		/* shortcut for unmuting the selected channel */
		unmuteselected: async() => {
			if(!Tab.active || !Tab.active.selectedChannel || !Tab.active.selectedChannel.muted){
				return false;
			}

			// unmute the selected channel
			await Tab.active.setMute(Tab.active.selectedChannel, false);
			return true;
		},

		/* shortcut for unmuting the selected channel */
		soloselected: async() => {
			if(!Tab.active || !Tab.active.selectedChannel || Tab.active.isSolo(Tab.active.selectedChannel)){
				return false;
			}

			// solo the selected channel
			await Tab.active.setSolo(Tab.active.selectedChannel);
			return true;
		},

		/* shortcut for muting all channels */
		muteall: async() => {
			if(!Tab.active || !Tab.active.selectedChannel || Tab.active.allMute(true)){
				return false;
			}

			// mute all channels
			await Tab.active.setMuteAll(true);
			return true;
		},

		/* shortcut for muting all channels */
		unmuteall: async() => {
			if(!Tab.active || !Tab.active.selectedChannel || Tab.active.allMute(false)){
				return false;
			}

			// unmute all channels
			await Tab.active.setMuteAll(false);
			return true;
		},

		/* shortcut for focusing on something */
		focus: (data:string[]) => {
			// load the target component
			const target = components.get<UIComponent<HTMLElement>>(data.shift() ?? "");

			if(target) {
				// focus on the target
				target.element.focus({ preventScroll: true, });
				return true;
			}

			// nothing to target
			return false;
		},

		/* shortcuts for the pattern editor */
		pattern: (data, e, state) => {
			return components.get<UIShortcutHandler>("pattern")?.receiveShortcut(data, e, state) ?? false;
		},

		/* shortcuts for the piano */
		piano: (data, e, state) => {
			return components.get<UIShortcutHandler>("piano")?.receiveShortcut(data, e, state) ?? false;
		},
	});

	// add some shortcut handlers for components
	addShortcutReceiver("matrix", (data, event, state) => {
		return components.get<UIShortcutHandler>("matrix")?.receiveShortcut(data, event, state) ?? false;
	});

	addShortcutReceiver("pattern", (data, event, state) => {
		return components.get<UIShortcutHandler>("pattern")?.receiveShortcut(data, event, state) ?? false;
	});

	addShortcutReceiver("piano", (data, event, state) => {
		return components.get<UIShortcutHandler>("piano")?.receiveShortcut(data, event, state) ?? false;
	});
}

/**
 * Function to change the module and reload the editor
 *
 * @param index The module index to load to
 */
export async function loadToModule(index:number): Promise<void> {
	// open loading animation
	Undo.clear();
	await enableLoading();
	Tab.active?.project.clearAutosave();

	// unload all components properly
	await components.unloadComponents(10);

	// set the active module
	await Tab.active?.project.setActiveModuleIndex(true, index);

	// if the index is negative then bail
	if(index < 0) {
		return;
	}

	// load all of the components with this new tab
	components.setComponentTab(Tab.active as Tab);
	await components.loadComponents(10);

	// initialize playback manager of the module
	await initPlayback(Tab.active as Tab);

	// remove loading animation
	disableLoading();
}

/**
 * helper function to enable the loading animation
 */
function enableLoading() {
	// get the target element
	const el = document.getElementById("loadeditor");

	if(!el) {
		return;
	}

	// pre-emptively set to normal display
	el.style.display = "";

	// clear the previous timeout if applicable
	if(loadTM) {
		clearTimeout(loadTM);
	}

	// resolve this function in 210ms
	return new Promise((res) => {
		setTimeout(() => {
			// start the hiding animation
			el.classList.remove("hide");
			setTimeout(res, 320);
		}, 25);
	});
}

/**
 * helper function to disable the loading animation
 */
let loadTM: NodeJS.Timeout|undefined;

function disableLoading() {
	// get the target element
	const el = document.getElementById("loadeditor");

	if(!el) {
		return;
	}

	// clear the previous timeout if applicable
	if(loadTM) {
		clearTimeout(loadTM);
	}

	// start the hiding animation
	el.classList.add("hide");

	// hide the entire element in 210ms
	loadTM = setTimeout(() => {
		el.style.display = "none";

		// initialize focus
		focusOnPattern(true);
	}, 340);
}

/**
 * Helper function to initialize all the layout components for this screen
 */
async function initLayout() {
	// load the editor parent element as `body`
	const body = document.getElementById("main_content");

	// check if it was found and is a div
	if(!body || !(body instanceof HTMLDivElement)){
		throw new Error("Unable to load editor layout: parent element main_content not found!");
	}

	/**
	 * -------------------------------------
	 * matrix edit | settings | instruments
	 * -------------------------------------
	 * pattern edit
	 *           piano (float)
	 * -------------------------------------
	 */

	const _top = document.createElement("div");
	_top.id = "editor_top";
	_top.tabIndex = -1;				// hack to allow mouse focus on the top row too
	body.appendChild(_top);

	const _bot = document.createElement("div");
	_bot.id = "editor_bottom";
	body.appendChild(_bot);

	// load all the standard components
	const _pe = new PatternEditor();
	_bot.appendChild(await components.addComponent("pattern", _pe));

	const _matrix = await components.addComponent("matrix", new MatrixEditor());
	_top.appendChild(_matrix);

	const _piano = new Piano();
	_bot.appendChild(await components.addComponent("piano", _piano));

	// create the base pane element
	const _set = document.createElement("div");
	_set.id = "settingspane";
	_top.appendChild(_set);

	// remove the middle click scroll thing... TEMP
	_set.addEventListener("mousedown", (e) => {
		if(e.button === 1) {
			e.preventDefault();
		}
	});

	// the top and bottom panes
	const stop = document.createElement("div");
	const sbot = document.createElement("div");
	_set.appendChild(stop);
	_set.appendChild(sbot);

	// add volume slider and buttons bar in the top row
	stop.appendChild(await components.addComponent("playbar", new PlayBar()));
	stop.appendChild(await components.addComponent("volume", createVolumeSlider(SliderEnum.Horizontal | SliderEnum.Medium)));

	// create the child panes. Create 2 of them
	sbot.appendChild(await components.addComponent("settingsleft", new SettingsPanelLeft()));
	sbot.appendChild(await components.addComponent("settingsright", new SettingsPanelRight()));

	// add handler for elements getting focused. Use it to determine whether to focus on the pattern editor or not
	window.addEventListener("focusin", (e) => {
	//	console.log("in", e.target)

		switch((e.target as HTMLElement).tagName) {
			case "TEXTAREA": case "FORM": case "SELECT": case "A":
				return focusOnPattern(false);

			case "DIV": {
				// special rules for div
				return focusOnPattern((e.target !== _matrix));
			}

			default:
				return focusOnPattern(true);
		}
	});

	// helper function on when the focus goes to `null`. Somehow this works weirdly
	window.addEventListener("focusout", (e) => {
	//	console.log("out", e.relatedTarget)

		if(e.relatedTarget === null) {
			return focusOnPattern(true);
		}
	});

	// initialize focus
	focusOnPattern(true);

	// let the piano access certain functions in shortcuts
	_piano.pianoReceiver = _pe.shortcuts;

	// quick hacky drag-n-drop support
	body.addEventListener("drop", async(e) => {
		e.preventDefault();

		// check if a file was dropped
		if (e.dataTransfer?.items && e.dataTransfer.items.length === 1 && e.dataTransfer.items[0].kind === "file") {
			const filename = e.dataTransfer.items[0].getAsFile()?.path;

			// check if the file is a valid zorrotracker supported format
			if(!filename) {
				return;
			}

			for(const fmt of zorroFormats) {
				// file extension check
				if(filename.endsWith("."+ fmt)) {
					// check file save dialog
					if(!await askSavePopup()) {
						return false;
					}

					// open loading animation
					Undo.clear();
					await enableLoading();
					Tab.active?.project.clearAutosave();

					// try to load the project
					const p = await Project.loadProject(filename);

					// check if loaded and if was allowed to load
					if(!p || !await Project.setActiveProject(p)){
						disableLoading();
						return false;
					}

					// unload all components properly
					await components.unloadComponents(10);

					// create a tab for the project
					Tab.active = new Tab(p);
					await initPlayback(Tab.active as Tab);

					// let all windows know about the loaded project
					window.ipc.project?.init(p);

					// load all of the components with this new tab
					components.setComponentTab(Tab.active as Tab);
					await components.loadComponents(10);

					// remove loading animation
					disableLoading();
					return;
				}
			}

			// tell the user the file isnt recognized
			await confirmationDialog({
				color: PopupColors.Error,
				size: PopupSizes.Small,
				html: /*html*/`
					<h2>File was not recognized</h2>
					<p>This file is not a ZorroTracker project file!</p>
				`, buttons: [
					{ result: undefined, float: "right", color: PopupColors.Error, html: "OK", default: true, },
				],
			});
		}
	});

	body.addEventListener("dragover", (e) => e.preventDefault());
}

// helper function to enable or disable focus on pattern
function focusOnPattern(yes:boolean) {
	components.get<UIComponent<HTMLElement>>("pattern")?.element.classList[yes ? "add" : "remove"]("focus");
}

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
	if(Tab.active?.project && Tab.active?.project.isDirty()) {
		try {
			// ask the user what to do
			switch(await confirmationDialog({
				color: PopupColors.Normal,
				size: PopupSizes.Small,
				html: /*html*/`
					<h2>Do you want to save your changes to ${ createFilename(Tab.active?.project.getFilename(), "?") }</h2>
					<p>Your changes <u>will</u> be lost if you don't save them.</p>
				`, buttons: [
					{ result: 0, float: "left", color: PopupColors.Caution, html: "Don't save", },
					{ result: 2, float: "right", color: PopupColors.Info, html: "Save", },
					{ result: 1, float: "right", color: PopupColors.Normal, html: "Cancel", },
				],
			}) as number) {
				case 2:						// ask the user to save.
					// If there is a save-as dialog and user cancels, or save fails, pretend the cancel button was pressed.
					return Tab.active?.project.save();

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

// load event dispatchers
const projectPatternRows = ZorroEvent.createEvent(ZorroEventEnum.ProjectPatternRows);

async function makeValueBox(range:[ number, number, ], initial:number, label:string, settings:number, change:(value:number) => void) {
	// create the value input box
	const s = await simpleValue(SliderEnum.Horizontal | SliderEnum.Medium | SliderEnum.PlusMinus, "", settings, change);

	// initialize the range and value of the box
	s.setRange(range[0], range[1]);
	s.setValue(initial.toString(), initial);

	// initialize the styles
	s.label.style.width = "80px";
	s.label.style.paddingLeft = "5px";
	s.label.innerHTML = label;

	// return the data
	return s;
}

/**
 * Helper function to calculate BPM and update UI
 */
function updateBPM() {
	let bpm = 0;

	if(Tab.active && Tab.active.module) {
		// calculate BPM
		bpm = (Tab.active.module.rate / (Tab.active.module.ticksPerRow * Tab.active.module.highlights[1])) * 60;
	}

	// save the bpm
	const e = document.getElementById("bpm");

	if(e)  {
		e.innerText = bpm.toFixed(2) +" bpm";
	}
}

const updateSeconds = ZorroEvent.createEvent(ZorroEventEnum.PlaybackSeconds);

/**
 * Class for dealing with the left side of the settings pane
 */
class SettingsPanelLeft implements UIComponent<HTMLDivElement> {
	public element!:HTMLDivElement;
	public tab!:Tab;

	/**
	 * Function to initialize the component
	 */
	public async init(): Promise<HTMLDivElement> {
		// create the main element
		this.element = document.createElement("div");

		// create the octave element
		this.octave = await makeValueBox([ -100, 100, ], 0, "Octave", 0, async(value:number) => {
			const piano = components.get<Piano>("piano");

			if(piano) {
				// update the octave value
				await piano.setOctave(value, false);
			}
		});

		// make a title
		this.octave.label.title = "The current octave for the piano roll.";

		// create the row element
		this.rows = await makeValueBox([ 2, 256, ], 64, "Rows", 2, async(value:number) => {
			if((this.tab.module as Module).patternRows !== value) {
				// update everything with this new value
				(this.tab.module as Module).patternRows = value;
				await projectPatternRows(this.tab.project, this.tab.module as Module, value);

				// project is now dirty!
				this.tab.project.dirty();
			}
		});

		// make a title
		this.rows.label.title = "Number of rows per pattern.";

		// create the highlight a element
		this.hla = await makeValueBox([ 1, 256, ], 1, "Highlight A", 1, (value) => {
			if((this.tab.module as Module).highlights[1] !== value) {
				// update pattern editor and module with the new value
				components.get<PatternEditor>("pattern")?.scrollManager?.changeHighlight(1, value);
				(this.tab.module as Module).highlights[1] = value;
				updateBPM();

				// project is now dirty!
				this.tab.project.dirty();
			}
		});

		// make a title
		this.hla.label.title = "Highlight every x rows. Usually for beats.";

		// create the highlight a element
		this.hlb = await makeValueBox([ 1, 256, ], 1, "Highlight B", 1, (value) => {
			if((this.tab.module as Module).highlights[0] !== value) {
				// update pattern editor and module with the new value
				components.get<PatternEditor>("pattern")?.scrollManager?.changeHighlight(0, value);
				(this.tab.module as Module).highlights[0] = value;

				// project is now dirty!
				this.tab.project.dirty();
			}
		});

		// make a title
		this.hlb.label.title = "Highlight every x rows. Usually for bars.";

		// create the step offset element
		this.step = await makeValueBox([ 0, 256, ], 1, "Step", 2, (value) => {
			this.tab.step = value;
		});

		// make a title
		this.step.label.title = "Number of rows to skip on edit.";

		// create the follow mode element
		this.follow = makeCheckbox(CheckboxEnum.Medium, (value) => {
			this.tab.follow = value;
		});

		// configure the label
		this.follow.label.innerText = "Follow playback";
		this.follow.element.style.width = "176px";
		this.follow.label.style.paddingLeft = "5px";
		this.follow.label.title = "Choose whether to follow the playback or not.";

		// create the record velocity element
		this.velocity = makeCheckbox(CheckboxEnum.Medium, (value) => {
			this.tab.recordVelocity = value;
		});

		// configure the label
		this.velocity.label.innerText = "Record note velocity";
		this.velocity.element.style.width = "176px";
		this.velocity.label.style.paddingLeft = "5px";
		this.velocity.label.title = "Choose whether to record velocity with notes.";

		// append all items in order
		this.element.appendChild(this.octave.element);
		this.element.appendChild(this.rows.element);
		this.element.appendChild(this.hla.element);
		this.element.appendChild(this.hlb.element);
		this.element.appendChild(this.step.element);
		this.element.appendChild(this.velocity.element);
		this.element.appendChild(this.follow.element);
		return this.element;
	}

	// these are the various elements that are loaded as settings
	private octave!: SimpleValueReturn;
	private rows!: SimpleValueReturn;
	private step!: SimpleValueReturn;
	private hla!: SimpleValueReturn;
	private hlb!: SimpleValueReturn;
	private follow!: CheckboxReturn;
	private velocity!: CheckboxReturn;

	/**
	 * Function to load the component
	 */
	public async load(pass:number): Promise<boolean> {
		// component loads in pass 1
		if(pass !== 1) {
			return pass < 1;
		}

		// prepare octave handler
		const piano = components.get<Piano>("piano");

		// tell the piano how to inform when the range is updated outside of the valuebox
		piano?.onRangeUpdate(this.octave.setRange);

		// tell the piano how to inform when the octave is updated outside of the valuebox
		piano?.onOctaveUpdate((value:number) => this.octave.setValue(value.toString(), value));

		// initialize rows element
		this.rows.setValue((this.tab.module as Module).patternRows.toString(), (this.tab.module as Module).patternRows);
		await projectPatternRows(this.tab.project, this.tab.module as Module, (this.tab.module as Module).patternRows);

		// load editor element
		const edit = components.get<PatternEditor>("pattern");

		// initialize highlight a element
		this.hla.setValue((this.tab.module as Module).highlights[1].toString(), (this.tab.module as Module).highlights[1]);
		edit?.scrollManager?.changeHighlight(1, (this.tab.module as Module).highlights[1]);

		// initialize highlight b element
		this.hlb.setValue((this.tab.module as Module).highlights[0].toString(), (this.tab.module as Module).highlights[0]);
		edit?.scrollManager?.changeHighlight(0, (this.tab.module as Module).highlights[0]);
		updateBPM();

		this.follow.setValue(true);
		return false;
	}

	/**
	 * Function to dispose of this component
	 */
	public unload(): boolean {
		return false;
	}
}

/**
 * Class for dealing with the right side of the settings pane
 */
class SettingsPanelRight implements UIComponent<HTMLDivElement> {
	public element!:HTMLDivElement;
	public tab!:Tab;

	/**
	 * Function to initialize the component
	 */
	public async init(): Promise<HTMLDivElement> {
		// create the main element
		this.element = document.createElement("div");

		// create the tempo box
		this.rate = await makeValueBox([ 1, 400, ], 60, "Rate (Hz)", 2, async(value) => {
			if(this.tab.module) {
				this.tab.module.rate = value;
				updateBPM();

				// project is now dirty!
				this.tab.project.dirty();

				// update playback manager flags
				await setFlags(this.tab);

				// update song seconds
				await updateSeconds(this.tab.activeRow, this.tab.secondsPerTick * this.tab.module.ticksPerRow, this.tab.module.patternRows);
			}
		});

		// make a title
		this.rate.label.title = "The driver refresh rate. Higher value = faster music.";

		// create the tempo box
		this.ttpr = await makeValueBox([ 1, 32, ], 6, "Ticks/row", 1, async(value) => {
			if(this.tab.module) {
				this.tab.module.ticksPerRow = value;
				updateBPM();

				// project is now dirty!
				this.tab.project.dirty();

				// update playback manager flags
				await setFlags(this.tab);

				// update song seconds
				await updateSeconds(this.tab.activeRow, this.tab.secondsPerTick * value, this.tab.module.patternRows);
			}
		});

		// make a title
		this.ttpr.label.title = "How many ticks are between each row. Higher value = slower music.";

		// append all items in order
		this.element.appendChild(this.rate.element);
		this.element.appendChild(this.ttpr.element);

		// create the BPM container
		const bpm = document.createElement("div");
		bpm.id = "bpm";
		bpm.innerText = "0 bpm";
		this.element.appendChild(bpm);

		// create the midi container
		const midi = document.createElement("div");
		midi.id = "midi";
		this.element.appendChild(midi);

		// create the instrument test
		this.ins = await makeValueBox([ 0, 256, ], 0, "Instrument", 2, (value) => {
			this.tab.selectedInstrument = value;
		});

		// make a title
		this.ins.label.title = "Set the selected instrument ID";
		this.element.appendChild(this.ins.element);

		// add time display
		this.element.appendChild(makeTimeDisplay());
		return this.element;
	}

	// these are the various elements that are loaded as settings
	private rate!: SimpleValueReturn;
	private ttpr!: SimpleValueReturn;
	private ins!: SimpleValueReturn;

	/**
	 * Function to load the component
	 */
	public load(pass:number): boolean {
		// component loads in pass 1
		if(pass !== 1) {
			return pass < 1;
		}

		// load settings
		this.rate.setValue((this.tab.module as Module).rate.toString(), (this.tab.module as Module).rate);
		this.ttpr.setValue((this.tab.module as Module).ticksPerRow.toString(), (this.tab.module as Module).ticksPerRow);
		updateBPM();
		return false;
	}

	/**
	 * Function to dispose of this component
	 */
	public unload(): boolean {
		return false;
	}
}
