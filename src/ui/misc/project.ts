import admZip from "adm-zip";
import { PatternIndex } from "../../api/matrix";
import { ConfigVersion } from "../../api/scripts/config";
import { fadeToLayout, LayoutType, loadLayout } from "./layout";

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
	 * @param file The file location to save the project file to
	 * @returns null if failed to create the project correctly, or the project data
	 */
	public static async createProject(file:string):Promise<Project|null> {
		console.info("Create new project: "+ file);

		const project = new Project(file);
		project.config = Project.createTestConfig();
		project.modules = [];
		Project.createTestModule(project);
		return project;
	}

	private static createTestConfig():ProjectConfig {
		return {
			name: "Test Project",
			version: ConfigVersion.b0,
			autosave: null,
			chip: "9d8d2954-ad94-11eb-8529-0242ac130003",	// Nuked
			driver: "9d8d267a-ad94-11eb-8529-0242ac130003",	// VGM
		};
	}

	private static createTestModule(p:Project): void {
		p.addModule({
			name: "Test Module",
			author: "User",
			lastDate: new Date(),
			index: 0,
			file: "!test",
		});

		p.setActiveModule("!test");
		p.index.setChannels([ "FM1", "FM2", "FM3", "FM4", "FM5", "FM6", "PCM", "PSG1", "PSG2", "PSG3", "PSG4", ]);
	}

	/**
	 * Function to load a project from a .zorro file into memory
	 *
	 * @param file The file location to load the project file from
	 * @throws Any exceptions when the input file can not be read or is not a zip file
	 * @returns null if failed to load the project, or the project data
	 */
	public static async loadProject(file:string):Promise<Project|null> {
		console.info("Load project: "+ file);
		const project = new Project(file);
		return project;
	}

	public static async loadProjectInfo(file:string): Promise<boolean> {
		// open loading animation
		await loadLayout(LayoutType.Loading);

		// try to load the project
		const p = await Project.loadProject(file);

		if(!p){
			await loadLayout(LayoutType.NoLoading);
			return false;
		}

		// save project as current
		Project.current = p;
		await fadeToLayout(LayoutType.Editor);
		await loadLayout(LayoutType.NoLoading);
		return true;
	}

	/**
	 * Create a new `Project` with no data
	 *
	 * @param file The file to use for this project
	 */
	constructor(file:string) {
		this.file = file;
		this.data = {};
	}

	private file:string;
	public config!:ProjectConfig;
	public modules!:Module[];
	public data: { [key:string]: ModuleData };

	/**
	 * Function to save the project to disk
	 *
	 * @param autosave Whether to do an autosave, or if to make a normal save
	 * @returns boolean indicating whether the save was successful
	 */
	public async save(autosave:boolean):Promise<void> {
		return new Promise((res, rej) => {
			window.isLoading = true;
			console.info("Save project: "+ this.file);

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
			zip.writeZip(this.file, (err) => {
				if(err) {
					rej(err);
				}

				// success, resolve the promise
				res();

				// if not autosaving, then clear the dirty flag
				this.dirty = this.dirty && autosave;
				window.isLoading = false;
			});
		})
	}

	/**
	 * Function to add a new module to the project
	 *
	 * @param data The module data, that defines various things about the module
	 */
	public addModule(data:Module):void {
		// check if the data already exists. If so, this is very bad!
		if(this.data[data.file]) {
			throw new Error("Module "+ data.file +" already exists! Can not continue!");
		}

		// put it in the module data array
		this.modules.push(data);

		// set new module data
		this.data[data.file] = {
			// create an empty patternIndex
			index: new PatternIndex(this),
		};
	}

	/* The name of the currently active module */
	private _current = "";
	public dirty = false;

	/**
	 * Function to set the active module by its name.
	 *
	 * @param name The name of the module to use
	 * @returns Boolean indicating whether it was successful
	 */
	public setActiveModule(name:string):boolean {
		if(this.data[name]){
			// module found, set the active module
			this._current = name;
			return true;
		}

		// failed, bail
		return false;
	}

	/* get the currently active module's object */
	private get _moduleData() {
		if(this.data[this._current]) {
			// the currently active module exists
			return this.data[this._current];
		}

		throw new Error("Unable to load module data: The active module does not exist.");
	}

	/* the PatternIndex for the current module */
	public get index():PatternIndex {
		return this._moduleData.index;
	}
}

export interface ProjectConfig {
	/**
	 * Name of the project. This is separate from the names of individual modules!
	 */
	name: string,

	/**
	 * Version of the API the project was created under. This is so that newer versions of ZorroTracker can correctly convert project versions.
	 */
	version: ConfigVersion,

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
}

export interface ModuleData {
	/**
	 * The pattern index data
	 */
	index: PatternIndex,
}