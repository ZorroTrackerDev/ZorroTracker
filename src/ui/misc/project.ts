import admZip from "adm-zip";
import { ZorroEvent, ZorroEventEnum, ZorroSenderTypes } from "../../api/events";
import { PatternIndex } from "../../api/matrix";
import { ConfigVersion } from "../../api/scripts/config";

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
	/* The project that is currently being edited, or undefined if no project is loaded */
	public static current:Project|undefined;

	/**
	 * Function to create a project from with file path
	 *
	 * @returns null if failed to create the project correctly, or the project data
	 */
	public static async createProject():Promise<Project|null> {
		console.info("Create new project");

		const project = new Project("");
		project.config = Project.createTestConfig();
		project.modules = [];
		return project;
	}

	private static createTestConfig():ProjectConfig {
		return {
			name: "",
			version: ConfigVersion.b0,
			type: ZorroConfigType.Project,
			autosave: null,
			chip: "9d8d2954-ad94-11eb-8529-0242ac130003",	// Nuked
			driver: "9d8d267a-ad94-11eb-8529-0242ac130003",	// VGM
		};
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
			// create a new project
			const project = new Project(file);

			// create a new zip file
			const zip = new admZip(file);

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
					throw new Error(error);
				}

				// read the file as UTF8
				return JSON.parse(zip.readAsText(dat));
			}

			{	// try to read the zorro file
				const file = _readSafe(".zorro", "Expected file .zorro to exist in the project file, but was not found.");

				if(!file) {
					throw new Error("Can not read .zorro file!");
				}

				// save the project config
				project.config = file as ProjectConfig;

				// validate the project config
				switch(project.config.version) {
					case ConfigVersion.b0:
						break;

					default:
						throw new Error("This project version "+ project.config.version +" is invalid.");
				}

				// validate its type
				switch(project.config.type) {
					case ZorroConfigType.Project:
						break;

					default:
						throw new Error("File type "+ project.config.type +" is not supported.");
				}

				// make sure autosaves are accounted for
				if(project.config.autosave) {
					project.file = project.config.autosave;
					project.config.autosave = null;
				}
			}

			{	// read the modules file
				const file = _readSafe(".modules", "Expected file .modules to exist in the project file, but was not found.");

				if(!Array.isArray(file) && !file) {
					throw new Error("Can not read .modules file!");
				}

				// copy modules data
				project.modules = file as Module[];
			}

			/**
			 * Safe function to read file contents as binary
			 *
			 * @param f The filename
			 * @returns the JSON object
			 */
			const _dataSafe = (f:string) => {
				// try to get the file, but if failed, return a null
				const dat = zip.readFile(f);

				if(!dat){
					throw new Error("Expected file"+ f +" to exist, but it was not found!");
				}

				return dat;
			}

			// laod all module datas
			for(const m of project.modules) {
				// initialize the module data
				const x:ModuleData = {
					index: new PatternIndex(project),
				};

				// set channels and prepare matrix and patterns
				x.index.setChannels([ "FM1", "FM2", "FM3", "FM4", "FM5", "FM6", "PCM", "PSG1", "PSG2", "PSG3", "PSG4", ]);
				x.index.loadMatrix(_dataSafe("modules/"+ m.file +"/.matrix"));
				x.index.loadPatterns(_dataSafe("modules/"+ m.file +"/.patterns"));

				// save into projecct
				project.data[m.file] = x;
			}

			return project;

		} catch(ex) {
			console.error("Failed to load project:", ex);
			return undefined;
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

	private eventSelect:ZorroSenderTypes[ZorroEventEnum.SelectModule];
	private eventCreate:ZorroSenderTypes[ZorroEventEnum.ModuleCreate];
	private eventDelete:ZorroSenderTypes[ZorroEventEnum.ModuleDelete];
	private eventUpdate:ZorroSenderTypes[ZorroEventEnum.ModuleUpdate];

	/**
	 * Create a new `Project` with no data
	 *
	 * @param file The file to use for this project
	 */
	constructor(file:string) {
		this.eventSelect = ZorroEvent.createEvent(ZorroEventEnum.SelectModule);
		this.eventCreate = ZorroEvent.createEvent(ZorroEventEnum.ModuleCreate);
		this.eventDelete = ZorroEvent.createEvent(ZorroEventEnum.ModuleDelete);
		this.eventUpdate = ZorroEvent.createEvent(ZorroEventEnum.ModuleUpdate);

		this.file = file;
		this.data = {};
	}

	private file:string;
	public config!:ProjectConfig;
	public modules!:Module[];
	public data:{ [key:string]: ModuleData };

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
			return false;
		}

		// set the new file and save data
		this.file = result;
		await this.saveData(result);

		// if not autosaving, then clear the dirty flag
		window.isLoading = this._dirty = false;
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

		// save the actual data
		await this.saveData(this.file);

		// if not autosaving, then clear the dirty flag
		this._dirty = this._dirty && autosave;
		window.isLoading = false;
		return true;
	}

	/**
	 * Function to save the project data to file
	 *
	 * @param file The output file location
	 * @returns boolean indicating whether the save was successful
	 */
	private saveData(file:string): Promise<void> {
		return new Promise((res, rej) => {
			window.isLoading = true;
			console.info("Save project: "+ file);

			// create a new zip file
			const zip = new admZip();

			{	// store project config to zip
				const _json = JSON.stringify(this.config);
				zip.addFile(".zorro", Buffer.alloc(_json.length, _json));
			}

			{	// store project modules to zip
				const _json = JSON.stringify(this.modules);
				zip.addFile(".modules", Buffer.alloc(_json.length, _json));
			}

			{	// write all the modules
				for (const [ key, value, ] of Object.entries(this.data)) {
					// write this module
					const _matrix = value.index.saveMatrix();
					zip.addFile("modules/"+ key +"/.matrix", Buffer.from(_matrix.buffer));

					const _patterns = value.index.savePatterns();
					zip.addFile("modules/"+ key +"/.patterns", Buffer.from(_patterns.buffer));

				}
			}

			// save the zip file
			zip.writeZip(file, (err) => {
				if(err) {
					rej(err);
				}

				// success, resolve the promise
				res();
			});
		})
	}

	/**
	 * Function to generate an unique name for new modules
	 */
	private static generateName() {
		// generate a random-ish string that should get no duplicates
		const base = "m"+ Date.now() +"z"+ Math.round(Math.random() * 256).toByte();

		// convert to base64
		return Buffer.from(base).toString("base64");
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

		if((await this.eventDelete(this, this.modules[index], this.data[file])).event.canceled){
			return false;
		}

		// delete the module and its data
		this.modules.splice(index, 1);
		delete this.data[file];

		// if this module was currently active, set active module to nothing
		if(this.activeModuleIndex === index){
			await this.setActiveModuleIndex(index - 1);
		}

		// success!
		return true;
	}

	/**
	 * Function to add a new module to the project. Default settings will be used
	 *
	 * @returns The new module
	 */
	public addModule(): Module {
		const data = {
			file: Project.generateName(),
			name: "",
			author: "",
			index: 0,		// TODO: Generate index
			type: ZorroModuleType.Song,
			lastDate: new Date(),
		}

		// check if the data already exists. If so, try to generate a new one
		while(this.data[data.file]) {
			data.file = Project.generateName();
		}

		// put it in the module data array
		this.modules.push(data);

		// set new module data
		this.data[data.file] = {
			// create an empty patternIndex
			index: new PatternIndex(this),
		};

		// return the module name
		return data;
	}

	/* The name of the currently active module */
	public activeModuleIndex = -1;
	private activeModuleFile = "";
	private _dirty = false;

	/**
	 * Function to mark the project as "dirty". This will cause save confirmation dialogs to appear
	 */
	public dirty(): void {
		this._dirty = true;
	}

	/**
	 * Function to set the active module by its filename.
	 *
	 * @param file The filename of the module to use
	 * @returns Boolean indicating whether it was successful
	 */
	public setActiveModuleFile(file:string): Promise<boolean> {
		// get the module index and then run the code
		const ix = this.getModuleIndexByFile(file);
		return this.setActiveModuleIndex(ix);
	}

	/**
	 * Helper function to find the module index by name
	 *
	 * @param file The filename of the module to use
	 * @returns The index of the module, or -1 if not found
	 */
	public getModuleIndexByFile(file:string): number|-1 {
		// loop through all modules to find the right index
		for(let i = 0;i < this.modules.length;i ++) {
			if(this.modules[i].file === file) {
				return i;
			}
		}

		// not found½
		return -1;
	}

	/**
	 * Function to set the active module by its module index (not index setting, actual order).
	 *
	 * @param index The index order of the module to check. If not set, the current index will be used.
	 * @param check If false, DO NOT ask to change module index. This is because the event is already being ran.
	 * @returns Boolean indicating whether it was successful
	 */
	public async setActiveModuleIndex(index?:number): Promise<boolean> {
		// decide the index to use
		const ix = index ?? this.activeModuleIndex;

		if(ix >= -1 && ix < this.modules.length && await this.setActiveCheck(ix)){
			// set module selection index
			this.activeModuleIndex = ix;

			if(ix === -1) {
				// special case for no selection
				this.activeModuleFile = "";
				return true;
			}

			// module found, set the active module
			this.activeModuleFile = this.modules[ix].file;
			return true;
		}

		// failed, bail
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
		return !(await this.eventSelect(this, this.modules[index], index < 0 ? undefined : this.data[this.modules[index].file])).event.canceled;
	}

	/**
	 * Function to edit the module details for the selected module
	 */
	public changeModule(): void {
		// check if module exists
		if(this.activeModuleIndex < 0 || !this.data[this.activeModuleFile]) {
			return;
		}

		// send the update event and ignore cancellation
		this.eventUpdate(this, this.modules[this.activeModuleIndex], this.data[this.activeModuleFile]).catch(console.error);
		this.dirty();
	}

	/* get the currently active module's object */
	private get _moduleData() {
		if(this.data[this.activeModuleFile]) {
			// the currently active module exists
			return this.data[this.activeModuleFile];
		}

		throw new Error("Unable to load module data: The active module "+ this.activeModuleFile +" does not exist.");
	}

	/* the PatternIndex for the current module */
	public get index():PatternIndex {
		return this._moduleData.index;
	}

	/**
	 * Function to clone a module including its data
	 *
	 * @param source The source module to clone from
	 * @param destination The destination module to clone to
	 * @returns Boolean indicating whether it was successful or not
	 */
	public cloneModule(source:Module, destination:Module): boolean {
		let ret = true;

		// clone the module details
		destination.author = source.author;
		destination.index = source.index;
		destination.name = "clone of "+ source.name;

		// load the module datas
		const sdata = this.data[source.file];
		const ddata = this.data[destination.file];

		// clone the all the data
		ddata.index.setChannels(sdata.index.channels);
		ret = ret && ddata.index.loadPatterns(Buffer.from(sdata.index.savePatterns()));
		ret = ret && ddata.index.loadMatrix(Buffer.from(sdata.index.saveMatrix()));

		// return whether everything was successful
		return ret;
	}
}

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
	 * UUID of the chip we are using currently for the project
	 */
	chip: string,

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
	 * The index value of the module. This is basically just for expressing the order of the modules to be shown in the UI.
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
}

export interface ModuleData {
	/**
	 * The pattern index data
	 */
	index: PatternIndex,
}