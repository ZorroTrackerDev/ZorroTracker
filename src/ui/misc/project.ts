import admZip from "adm-zip";
import fs from "fs";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { ConfigVersion } from "../../api/config";
import { fserror, loadFlag } from "../../api/files";
import { confirmationDialog, PopupColors, PopupSizes } from "../elements/popup/popup";
import { ipcRenderer } from "electron";
import { ipcEnum } from "../../system/ipc/ipc enum";
import { WindowType } from "../../defs/windowtype";
import { setTitle } from "../elements/toolbar/toolbar";
import { ChannelInfo, DriverChannel } from "../../api/driver";
import { Tab } from "./tab";

// load all the events
const eventProject = ZorroEvent.createEvent(ZorroEventEnum.ProjectOpen);
const eventSelect = ZorroEvent.createEvent(ZorroEventEnum.SelectModule);
const eventCreate = ZorroEvent.createEvent(ZorroEventEnum.ModuleCreate);
const eventDelete = ZorroEvent.createEvent(ZorroEventEnum.ModuleDelete);
const eventUpdate = ZorroEvent.createEvent(ZorroEventEnum.ModuleUpdate);

/**
 * FILE STRUCTURE FOR .ztm FILES
 *
 * <aything>.zorro
 *		.zorro -> (json) ProjectConfig
 *		.modules -> (json) Module[]
 *		modules
 *			<uuid or other string>
 *				.matrix -> (binary) PatternIndex.matrix
 *				.patterns -> (binary) PatternIndex.patterns
 */
export class Project {
	public static readonly VERSION = ConfigVersion.b1;

	/**
	 * Helper function to load a project based on project's configuration. This is used for sub-windows to aid editing
	 *
	 * @param config The project configuration data
	 * @param modules The module config array
	 */
	public static loadInternal(config:ProjectConfig, modules:Module[]):void {
		// create a blank project and make sure it doesn't bork
		const p = new Project("", new admZip());

		if(!p) {
			throw new Error("CAn't create a blank project. What???");
		}

		// initiate a new tab with the data
		Tab.active = new Tab(p);
		p.modules = modules;
		p.config = config;
		p.setActiveModuleIndex(false, 0).catch(console.error);
	}

	/**
	 * Function to create a project from with file path
	 *
	 * @returns Boolean indicating whether the project loading was not cancelled
	 */
	public static async setActiveProject(project:Project|undefined):Promise<boolean> {
		// run the project open event and return result
		return !(await eventProject(project)).event.canceled;
	}

	/**
	 * Function to create a project from with file path
	 *
	 * @returns the newly created project
	 */
	public static async createProject():Promise<Project> {
		console.info("Create new project");

		// initialize the driver instance
		const driver = loadFlag<string>("DEFAULT_DRIVER") ?? "";
		await window.ipc.audio?.setDriver(driver);

		// initiate new project without settings
		const project = new Project("", new admZip());
		project.driverChannels = await window.ipc.driver.getChannels();
		project.modules = [];

		// set project config to default value
		project.config = {
			name: "New project",
			version: Project.VERSION,
			type: ZorroConfigType.Project,
			autosave: null,
			driver: driver,
		};

		// create a single default module
		const m = project.addModule();
		m.name = "New module";
		await project.setActiveModuleIndex(false, 0);

		// mark this project as not dirty for now
		project.clean();

		// return the project itself
		return project;
	}

	/**
	 * Function to load a project from a .zorro file into memory
	 *
	 * @param file The file location to load the project file from
	 * @throws Any exceptions when the input file can not be read or is not a zip file
	 * @returns null if failed to load the project, or the project data
	 */
	public static async loadProject(file:string):Promise<Project|undefined> {
		console.info("Load project:", file);

		try {
			// create a new zip file
			let zip:admZip;
			try {
				zip = new admZip(file);

			} catch(ex) {
				Project.projectError("Unable to open the file. This file is either not a project file, or is corrupted.");
				console.error("Failed to load project:", ex);
				return;
			}

			// create a new project
			const project = new Project(file, zip);

			/**
			 * Safe function to read file contents as JSON
			 *
			 * @param f The filename
			 * @param error The string to create an error with if the file was not found
			 * @returns the JSON object
			 */
			const _readSafe = (f:string, error:string) => {
				// try to get the file, but if failed, return a null
				const dat = zip.getEntry(f);

				if(!dat){
					Project.projectError(error);
					return;
				}

				// read the file as UTF8
				return JSON.parse(zip.readAsText(dat));
			}

			{	// try to read the zorro file
				const file = _readSafe(".zorro", "This does not appear to be a ZorroTracker file.");

				if(!file) {
					return;
				}

				// save the project config
				project.config = file as ProjectConfig;

				// validate the project config
				switch(project.config.version) {
					case ConfigVersion.b1:
						break;

					default:
						Project.projectError("Project version is "+ project.config.version +", which is invalid or unsupported.");
						return;
				}

				// validate its type
				switch(project.config.type) {
					case ZorroConfigType.Project:
						break;

					default:
						Project.projectError("Project type is "+ Project.typeString(project.config.type) +", which is unsupported.");
						return;
				}

				// make sure autosaves are accounted for
				if(project.config.autosave) {
					project.file = project.config.autosave;
					project.config.autosave = null;
				}
			}

			{	// read the modules file
				const file = _readSafe(".modules", "Expected file .modules to exist in the project file, but it was not found.");

				if(file === undefined) {
					return;
				}

				// check if its valid
				if(!Array.isArray(file) && !file) {
					Project.projectError("Unable to read project data. This project file might be corrupted.");
					return;
				}

				// copy modules data
				project.modules = file as Module[];
			}

			// check that all channels are valid
			for(const m of project.modules) {
				if(!Array.isArray(m.channels)) {
					Project.projectError("Unable to load channel data for module. This project file might be corrupted");
					return;
				}
			}

			// set the first module as the active module
			await project.setActiveModuleIndex(false, 0);

			// initialize the driver instance
			await window.ipc.audio?.setDriver(project.config.driver);
			project.driverChannels = await window.ipc.driver.getChannels();
			return project;

		} catch(ex) {
			// uh oh, no clue what this is about. Whoopsidaisies!
			Project.projectError("Unable to load the project file for some reason. Open the console or the log file for more information.");
			console.error("Failed to load project:", ex);
			return undefined;
		}
	}

	private loadHandler: undefined|(() => void);
	private saveHandler: undefined|(() => Promise<void[]>);

	/**
	 * Function to set the load and save handlers for this project
	 *
	 * @param load The function to handle loading module data
	 * @param save The function to handle saving module data
	 */
	public setDataHandlers(load:(data:LoadSaveData<LoadType>, module:Module) => void, save:() => LoadSaveData<SaveType>):void {
		// load some variables used below
		const module = () => this.modules[this.activeModuleIndex];
		const file = () => "modules/"+ module().file +"/";

		// helper function for the load handler to load a specific module filename
		const readFile = (name:string) => {
			const dat = this.zip.readFile(file() + name);

			return dat;
		};

		// initialize a custom load handler
		this.loadHandler = () => {
			load({
				patterns: () => readFile(".patterns"),
				matrix: () => readFile(".matrix"),
			}, module());
		}

		// helper function for the save handler to write a specific module filename
		const writeFile = async(name:string, buffer:Promise<Uint8Array>) => {
			return this.zip.addFile(file() + name, Buffer.from(await buffer));
		};

		// initialize a custom save handler
		this.saveHandler = () => {
			// run the save function
			const data = save();

			// write all files from the returned object
			return Promise.all(Object.entries(data).map(([ key, value, ]) => writeFile("."+ key, value)));
		}

		// must cause to load the first time its called
		try {
			this.loadHandler();
		} catch(ex){
			Project.projectError(ex);
			throw ex;
		}
	}

	/**
	 * Convert `ZorroModuleType` to a string, for display purposes
	 *
	 * @param type The type of the module to convert
	 * @returns The converted module type string
	 */
	public static typeString(type:ZorroModuleType): string {
		switch(type) {
			case ZorroModuleType.Song:	return "song";
			case ZorroModuleType.SFX:	return "sfx";
			case ZorroModuleType.Patch:	return "patch";
		}

		return "unk";
	}

	/**
	 * Show an error report for the user regarding an issue with the project itself.
	 *
	 * @param text The description of the error.
	 */
	public static projectError(text:string): void {
		confirmationDialog({
			color: PopupColors.Normal,
			size: PopupSizes.Small,
			html: /*html*/`
				<h2>Can not load the project file!</h2>
				<p>${ text }</p>
			`, buttons: [
				{ result: undefined, float: "right", color: PopupColors.Normal, html: "OK", default: true, },
			],
		}).catch(console.error);
	}

	/**
	 * Create a new `Project` with no data
	 *
	 * @param file The file to use for this project
	 * @param zip The in-memory Zip file to use for this project
	 */
	constructor(file:string, zip:admZip) {
		this.file = file;
		this.zip = zip;
	}

	private zip:admZip;
	private file:string;
	public config!:ProjectConfig;
	public modules!:Module[];
	public driverChannels!:DriverChannel[];

	/**
	 * Helper function to get the file location of this project
	 *
	 * @returns The file name as a string. If nothing is provided, invents a filename
	 */
	public getFilename(): string {
		// checks when there is no filename yet, just use a default value
		if(this.file.length === 0) {
			return "Untitled.ztm";
		}

		// return the file location of this project
		return this.file;
	}

	/**
	 * Function to save the file at somewhere else but the file location
	 *
	 * @returns boolean indicating whether the save was successful
	 */
	public async saveAs(): Promise<boolean> {
		window.isLoading = true;

		const result = await window.ipc.ui.dialog.save("openfolder", {
			filters: [
				{ name: "ZorroTracker Module Files", extensions: [ "ztm", ], },
				{ name: "ZorroTracker Files", extensions: [ "zip", ], },
				{ name: "All Files", extensions: [ "*", ], },
			],
		});

		// check if the save was canceled
		if(!result) {
			window.isLoading = false;
			return false;
		}

		try {
			// set the new file and save data
			this.file = result;
			await this.saveData(result);

		} catch(ex) {
			console.error(ex);
			return false;
		}

		// clear the dirty flag
		window.isLoading = false;
		this.clean();
		return true;
	}

	/**
	 * Function to save the project to disk
	 *
	 * @param autosave Whether to do an autosave, or if to make a normal save
	 * @returns boolean indicating whether the save was successful
	 */
	public async save(autosave:boolean): Promise<boolean> {
		window.isLoading = true;

		// check if the file does not exist
		if(!this.file) {
			return this.saveAs();
		}

		try {
			// save the actual data
			await this.saveData(this.file);

		} catch(ex) {
			console.error(ex);
			return false;
		}

		// if not autosaving, then clear the dirty flag
		this._dirty = this._dirty && autosave;
		this.updateTitle();
		window.isLoading = false;
		return true;
	}

	/**
	 * Function to save the project data to file
	 *
	 * @param file The output file location
	 */
	private async saveData(file:string): Promise<void> {
		window.isLoading = true;
		console.info("Save project: "+ file);

		{	// store project config to zip
			const _json = JSON.stringify(this.config);
			this.zip.addFile(".zorro", Buffer.alloc(_json.length, _json));
		}

		{	// store project modules to zip
			const _json = JSON.stringify(this.modules);
			this.zip.addFile(".modules", Buffer.alloc(_json.length, _json));
		}

		// save the individual module data
		if(this.saveHandler) {
			await this.saveHandler();
		}

		// atomic save the zip file (use a promise because stupid API)
		return new Promise<void>((res, rej) => {
			// write the zip file into disk
			this.zip.writeZip(file + ".temp", (err) => {
				if(err) {
					rej(err);
				}

				// rename the file on success
				fs.rename(file + ".temp", file, (err) => {
					if(err) {
						rej(err);
						fserror(err.code, file).catch(console.error);
					}

					// success, resolve the promise
					res();

					// also save this as the last opened project now
					window.ipc.cookie.set("lastproject", file);
				});
			});
		});
	}

	/**
	 * Function to generate an unique name for new modules
	 */
	private static generateName() {
		const name:number[] = [];

		// prepare the dates
		const date = new Date();
		const year = date.getFullYear();
		const mill = date.getMilliseconds();

		/**
		 * Convert the current date into the name field. Format:
		 * xxxxxxxx yyyyoooo iiiiiiii yyyddddd iissssss yyyhhhhh xxxxxxxx yymmmmmm xxxxxxxx
		 */
		name.push(Math.random() * 256);
		name.push(date.getMonth()	| ((year >> 4) & 0xF0));
		name.push(mill & 0xFF);
		name.push(date.getDate()	| (year & 0xE0));
		name.push(date.getSeconds()	| ((mill >> 2) & 0xC0));
		name.push(date.getHours()	| ((year << 3) & 0xE0));
		name.push(Math.random() * 256);
		name.push(date.getMinutes()	| ((year << 5) & 0xC0));
		name.push(Math.random() * 256);

		// convert to base64, and replace a few characters
		return Buffer.from(name).toString("base64").replace(/\//g, "-").replace(/\+/g, "_").replace(/=/g, "");
	}

	/**
	 * Function to delete a module and all its data
	 *
	 * @param index The index of the module to target
	 * @returns Boolean indicating whether it was successful
	 */
	public async deleteModule(index:number): Promise<boolean> {
		// check if the module index is valid
		if(index < 0 || index >= this.modules.length){
			return false;
		}

		// get module filename and check if the event can continue
		const file = this.modules[index].file;

		if((await eventDelete(this, this.modules[index])).event.canceled){
			return false;
		}

		// delete the module and its data
		this.modules.splice(index, 1);

		// loop for all the filenames in the modules
		for(const key of this.moduleFiles) {
			// delete the file in the zip
			this.zip.deleteFile("modules/"+ file +"/"+ key);
		}

		// if this module was currently active, set active module to nothing
		if(this.activeModuleIndex === index){
			let target = index - 1;

			// check if we can select a non-null selection
			if(target === -1 && this.modules.length > 0) {
				target = 0;
			}

			// select this new position
			await this.setActiveModuleIndex(false, target);
		}

		// success!
		return true;
	}

	/**
	 * Function to add a new module to the project. Default settings will be used
	 *
	 * @param file If provided, the filename will be used in the file, as opposed to generating one
	 * @returns The new module
	 */
	public addModule(file?:string): Module {
		// load initial effects count
		const fx = Math.max(1, Math.min(8, loadFlag<number>("INITIAL_EFFECT_COUNT") ?? 1));

		const data = {
			file: file ?? Project.generateName(),
			name: "",
			author: "",
			index: 0,		// TODO: Generate index
			patternRows: loadFlag<number>("INITIAL_PATTERN_ROWS") ?? 64,
			highlights: [ loadFlag<number>("HIGHLIGHT_B_DEFAULT") ?? 16, loadFlag<number>("HIGHLIGHT_A_DEFAULT") ?? 4, ] as [ number, number, ],
			type: ZorroModuleType.Song,
			lastDate: new Date(),
			channels: this.driverChannels.map((c) => {
				// initialize the channels with effect count
				return { id: c.id, name: c.name, effects: fx, };
			}),
		}

		if(!file) {
			// check if the data already exists. If so, try to generate a new one
			while(this.modules.find((m) => m.file === data.file)) {
				data.file = Project.generateName();
			}
		}

		// put it in the module data array
		this.modules.push(data);

		if(window.type === WindowType.Editor) {
			// send the create event
			eventCreate(this, data).catch(console.error);
		}

		// return the module name
		return data;
	}

	/* The name of the currently active module */
	public activeModuleIndex = -1;
	private _dirty = false;

	/**
	 * Function to mark the project as "dirty". This will cause save confirmation dialogs to appear
	 */
	public dirty(): void {
		this._dirty = true;
		this.updateTitle();
	}

	/**
	 * Function to mark the project as not "dirty". Only use in appropriate situations!!!
	 */
	public clean(): void {
		this._dirty = false;
		this.updateTitle();
	}

	/**
	 * Function to get the project dirty status.
	 *
	 * @returns boolean indicating whether the project is "dirty" or not.
	 */
	public isDirty(): boolean {
		return this._dirty;
	}

	/**
	 * Helper function to update the window title
	 */
	private updateTitle() {
		if(window.type === WindowType.Editor) {
			// load the module name
			const module = this.activeModuleIndex < 0 ? "" : this.modules[this.activeModuleIndex].name;

			// set the title according to mode
			setTitle("🦊 ZorroTracker"+ (module.length === 0 ? "" : " - "+ module + (this._dirty ? "*" : "")));
		}
	}

	/**
	 * Function to set the active module by its filename.
	 *
	 * @param save Boolean to indicate whether to save the previous module data or not.
	 * @param file The filename of the module to use
	 * @returns Boolean indicating whether it was successful
	 */
	public setActiveModuleFile(save:boolean, file:string): Promise<boolean> {
		// get the module index and then run the code
		const ix = this.getModuleIndexByFile(file);
		return this.setActiveModuleIndex(save, ix);
	}

	/**
	 * Helper function to find the module index by name
	 *
	 * @param file The filename of the module to use
	 * @returns The index of the module, or -1 if not found
	 */
	public getModuleIndexByFile(file:string): number|-1 {
		// loop through all modules to find the right index
		for(let i = (this.modules?.length - 1 ?? 0);i >= 0; --i) {
			if(this.modules[i].file === file) {
				return i;
			}
		}

		// not found
		return -1;
	}

	/**
	 * Function to set the active module by its module index (not index setting, actual order).
	 *
	 * @param save Boolean to indicate whether to save the previous module data or not.
	 * @param index The index order of the module to check. If not set, the current index will be used.
	 * @returns Boolean indicating whether it was successful
	 */
	public async setActiveModuleIndex(save:boolean, index?:number): Promise<boolean> {
		// decide the index to use
		const ix = index ?? this.activeModuleIndex;

		if(this.modules && ix >= -1 && ix < this.modules.length && await this.setActiveCheck(ix)){
			// tell the UI to save data of the previous module
			if(save && this.saveHandler) {
				await this.saveHandler();
			}

			// set module selection index
			this.activeModuleIndex = ix;

			if(ix === -1) {
				// special case for no selection
				return true;
			}

			// tell the UI to load this modules data
			if(this.loadHandler) {
				try {
					this.loadHandler();
				} catch(ex) {
					Project.projectError(ex);
				}
			}

			// module found, set the active module
			this.updateTitle();
			return true;
		}

		// failed, bail
		this.updateTitle();
		return false;
	}

	/**
	 * Helper function to check if we can set an active module, and sending the active event
	 *
	 * @param index The index order of the module to check
	 * @returns The index of the module that was found
	 */
	private async setActiveCheck(index:number): Promise<boolean> {
		console.info("project select module", index, "-", this.modules[index]?.file ?? "<null>");

		// send the select event if found, and returns its value
		return !(await eventSelect(this, this.modules[index])).event.canceled;
	}

	/**
	 * Function to edit the module details for the selected module
	 */
	public changeModule(): void {
		// check if module exists
		if(this.activeModuleIndex < 0) {
			return;
		}

		if(window.type === WindowType.Editor) {
			// send the update event and ignore cancellation
			eventUpdate(this, this.modules[this.activeModuleIndex]).catch(console.error);

		} else {
			// send request to update module data
			ipcRenderer.send(ipcEnum.ProjectSetModule, this.modules[this.activeModuleIndex]);

			// send the update event and ignore cancellation
			eventUpdate(this, this.modules[this.activeModuleIndex]).catch(console.error);
		}

		// update title in case it changed
		this.updateTitle();
	}

	/**
	 * Function to clone a module including its data
	 *
	 * @param source The source module to clone from
	 * @param destination The destination module to clone to
	 * @returns Boolean indicating whether it was successful or not
	 */
	public async cloneModule(source:Module, destination:Module): Promise<boolean> {
		let ret = true;

		// clone the module details
		destination.author = source.author;
		destination.index = source.index;
		destination.name = "clone of "+ source.name;
		destination.channels = source.channels;
		destination.type = source.type;

		if(window.type === WindowType.Editor) {
			if(this.saveHandler && source === this.modules[this.activeModuleIndex]) {
				// need to save data first
				await this.saveHandler();
			}

			// loop for all the filenames in the modules
			for(const key of this.moduleFiles) {
				// read the source file
				const data = this.zip.readFile("modules/"+ source.file +"/"+ key);
				console.log(data?.length, key, source.file, destination.file)

				if(data) {
					// write to the destination file
					this.zip.addFile("modules/"+ destination.file +"/"+ key, data);

				} else {
					// well we failed for some reason huh
					ret = false;
				}
			}
		}

		// return whether everything was successful
		return ret;
	}

	/**
	 * An array of filenames each module holds
	 */
	private moduleFiles = [
		".matrix", ".patterns",
	];
}

/**
 * Helper type to define how to represent data in load or save functions.
 */
export type LoadSaveData<T> = {
	patterns: T,
	matrix: T,
};

export type LoadType = () => Buffer|null;
export type SaveType = Promise<Uint8Array>;

export interface ZorroConfig {
	/**
	 * Name of the file. This is separate from the names of individual modules!
	 */
	name: string,

	/**
	 * Type of the file. This will determine what fields are expected to exist.
	 */
	type: ZorroConfigType,

	/**
	 * Version of the API the project was created under. This is so that newer versions of ZorroTracker can correctly convert project versions.
	 */
	version: ConfigVersion,
}

export enum ZorroConfigType {
	Project,
}

export interface ProjectConfig extends ZorroConfig {
	/**
	 * UUID of the driver we are using currently for the project
	 */
	driver: string,

	/**
	 * This points to the parent file (the project that was autosaved) for autosaves, or null if this is the actual project file.
	 */
	autosave: string|null,
}

enum ZorroModuleType {
	Song,				// song files, this is the main music of a game for example.
	SFX,				// sound effect files, these are additional sounds layered on top of music.
	Patch,				// patches. Some drivers, such as GEMS, use patch banks instead of patches per file.
}

export interface Module {
	/**
	 * Name of the module.
	 */
	name: string,

	/**
	 * Author of the module. This is the user input text box value
	 */
	author: string,

	/**
	 * The last modified date of this module
	 */
	lastDate: Date,

	/**
	 * The index value of the module. This can be used by drivers in any way.
	 */
	index: number,

	/**
	 * File name of the module. This will refer to a folder in the modules folder.
	 */
	file: string,

	/**
	 * Type of this module, various types are used for each module
	 */
	type: ZorroModuleType,

	/**
	 * The channels defined if this is a Song or SFX type
	 */
	channels?: ChannelInfo[],

	/**
	 * The number of rows in each pattern
	 */
	patternRows: number,

	/**
	 * Highlight A and highlight B values
	 */
	highlights: [ number, number, ],
}
