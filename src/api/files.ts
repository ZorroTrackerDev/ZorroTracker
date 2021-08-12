import json5 from "json5";
import fs from "fs";
import path from "path";
import { confirmationDialog, createFilename, PopupColors, PopupSizes } from "../ui/elements/popup/popup";

/**
 * What formats are valid ZorroTracker files
 */
export const zorroFormats = [ "ztm", "zip", ];

/**
 * Function to get all the files in current directory and subdirectories
 *
 * @param directory The directory to inspect for files
 * @param recursive Whether to process subdirectories too
 */
export async function getAllFiles(directory:string, recursive:boolean): Promise<string[]> {
	// read the directory contents
	const files = (await fs.promises.readdir(directory)).map((f) => path.join(directory, f));

	// convert to promises for checking what the files are
	const promises = files.map((f) => fs.promises.lstat(f));

	// convert these to booleans for the final checks
	const directories = (await Promise.all(promises)).map((f) => f.isDirectory());

	// loop through each directory to fetch files
	const ret:string[] = [];
	const subs:Promise<string[]>[] = [];

	for(let i = 0;i < directories.length;i ++) {
		if(directories[i]) {
			if(recursive) {
				// handle recursive directory calls
				subs.push(getAllFiles(files[i], true));
			}
		} else {
			// append the file in there
			ret.push(files[i]);
		}
	}

	// resolve all subdirectories
	(await Promise.all(subs)).forEach((fls) => ret.push(...fls));

	// return the final result
	return ret;
}

/**
 * Function to find how many bytes are taken up by all files in a directory
 *
 * @param directory The directory to inspect for files
 * @param recursive Whether to process subdirectories too
 */
export async function totalDirectorySize(directory:string, recursive:boolean): Promise<number> {
	// get all the files to inspect
	const files = await getAllFiles(directory, recursive);

	// convert to promises for checking what the files are
	const promises = files.map((f) => fs.promises.lstat(f));

	// convert these to booleans for the final checks
	return (await Promise.all(promises)).reduce((acc, f) => acc + f.size, 0);
}

/**
 * Function to get all the files in the directory, sorted oldest to newest
 *
 * @param directory The directory to inspect for files
 * @param recursive Whether to process subdirectories too
 */
export async function getOldestFilesInDirectory(directory:string, recursive:boolean): Promise<string[]> {
	// get all the files to inspect
	const files = await getAllFiles(directory, recursive);

	// convert to promises for checking what the files are
	const promises = await Promise.all(files.map((f) => fs.promises.lstat(f)));

	// convert to array of [ file, stats ]
	const foc = files.map((f, ix) => [ f, promises[ix], ]) as [ string, fs.Stats ][];

	// sort the array and convert to only filenames
	return foc.sort((a, b) => a[1].mtimeMs - b[1].mtimeMs).map((d) => d[0]);
}

/**
 * SettingsTypes enum is here to enforce data safety and allowing us to rename properties without breaking code that uses them.
 */
export enum SettingsTypes {
	globalShortcuts = "globalshortcuts",
	editorShortcuts = "editorshortcuts",
	flags = "flags",
}

/* constands for the locations of settings data files */
const settingsDirectory = "settings";
const fileMappingsSource = path.join(settingsDirectory, "files.json5");

// the cached file mappings data. This is used to make sure nobody tampers with the file while the app is running.
let _cachedFileMappings: { [key: string]: string|string[] };

/**
 * load the settings file data structures depending on the type of setting you're trying to load.
 *
 * @param settingsType Describes the type of data you are trying to load. This enum will figure out the correct filename for you.
 * @returns List of the file data for the defines files. JSON files are interpreted by default. No guarantee of what you might get out. Be careful
 * @throws anything. Invalid files will throw just about any error.
 */
export function loadSettingsFiles(settingsType:SettingsTypes): unknown[] {
	if(!_cachedFileMappings) {
		// if the configuration file was not cached, cache it now.
		const rawfile = fs.readFileSync(path.join(window.path.data, fileMappingsSource), "utf-8");
		_cachedFileMappings = json5.parse(rawfile);
	}

	// check if the settings entry exists. If not, pretend we have got 0 files
	if(!_cachedFileMappings[settingsType]){
		console.error("files.json5 does not have key "+ settingsType + "! Please check that your settings file is valid! Program may be unstable.");
		return [];
	}

	if(Array.isArray(_cachedFileMappings[settingsType])) {
		// this is an array of filesnames, convert every one individually
		console.info("files.json5 load key "+ settingsType +": [ "+ (_cachedFileMappings[settingsType] as string[]).join(", ") +" ]");
		return loadFiles([ window.path.data, settingsDirectory, ], _cachedFileMappings[settingsType] as string[]);

	} else {
		// this is not an array, convert the single filename
		console.info("files.json5 load key "+ settingsType +": [ "+ _cachedFileMappings[settingsType] +" ]");
		return loadFiles([ window.path.data, settingsDirectory, ], [ _cachedFileMappings[settingsType] as string, ]);
	}
}

/**
 * Load array of file names as file contentes
 *
 * @param files The files to read and interpret
 * @param base The base folders
 * @returns List of the file data for the defines files. JSON files are interpreted by default. No guarantee of what you might get out. Be careful
 * @throws anything. Invalid files will throw just about any error.
 */
export function loadFiles(base:string[], files:string[]): unknown[] {
	const retFiles:unknown[] = [];

	// run through every single file
	for(const fileName of files) {
		try {
			// read the file based on its filename. All files must be in the "settingsDirectory".
			const fileAddress = path.join(...base, fileName);
			let fileData = fs.readFileSync(fileAddress, "utf-8");

			if(fileAddress.endsWith(".json") || fileAddress.endsWith(".json5")) {
				// special: json5 files need to be parsed
				fileData = json5.parse(fileData);
			}

			// push file contents into the return array
			retFiles.push(fileData);

		} catch(ex) {
			/* ignore all failing files */
		}
	}

	// return all the files
	return retFiles;
}

/**
 * Load the settings type into an object. Will account for multiple user defined files, aggregating to a single object.
 *
 * @param settingsType Describes the type of data you are trying to load. This enum will figure out the correct filename for you.
 * @returns An object describing the object with all defined properties, latest file taking precedent
 * @throws anything. Invalid files will throw just about any error.
 */
export function loadSettingsObject(settingsType:SettingsTypes): Record<string, unknown> {
	const ret:Record<string, unknown> = {};

	// if the flags file was not cached, cache it now.
	const flags = loadSettingsFiles(settingsType);

	for(const f of flags) {
		try {
			// try to handle flags now
			if(f && typeof f === "object") {
				for(const key in f) {
					// add flags from f to ret
					ret[key] = (f as Record<string, unknown>)[key];
				}
			}

		} catch(ex){
			/* ignore all failing files */
		}
	}

	return ret;
}

// the cached flagss data. This is used to cache the program settings for faster access.
let _cachedFlags: { [key: string]: unknown };

/**
 * Load a flag value from the flags filetype.
 *
 * @param name The name of the flag to find
 * @returns Anything converted to the specified type, or undefined if not found.
 * @throws anything. Invalid files will throw just about any error.
 */
export function loadFlag<type = unknown>(name:string): type|undefined {
	if(!_cachedFlags) {
		// if the flags file was not cached, cache it now.
		_cachedFlags = loadSettingsObject(SettingsTypes.flags);
	}

	// check if the flag even exists
	if(!(name in _cachedFlags)) {
		console.error("flags.json5 does not have key "+ name + "! Please check that your flags file is valid! Program may be unstable.");
		return;
	}

	// load the flag value
	console.info("flags.json5 load key "+ name +":", _cachedFlags[name]);
	return _cachedFlags[name] as type;
}

// results of an fs error popup
enum fsResult {
	INVALID, OK
}

/**
 * Function to display an FS error, depending on the code
 *
 * @param error the string representing the error
 * @returns The resulting button press that the user pressed. Uusually just OK
 */
export async function fserror(error:string|undefined, filename:string): Promise<fsResult> {
	// default style maker
	const defaultDialog = (p:string) => {
		return confirmationDialog({
			color: PopupColors.Normal,
			size: PopupSizes.Small,
			html: /*html*/`
				<h2>Can not save to file ${ createFilename(filename, "!") }</h2>
				<p>${ p }</p>
			`, buttons: [
				{ result: undefined, float: "right", color: PopupColors.Normal, html: "OK", },
			],
		});
	}

	switch(error) {
		case "EPERM":				// no permissions?
			await defaultDialog("Make sure no other program is using the file currently.");
			return fsResult.OK;

		case "EACCES":				// no access?
			await defaultDialog("Unable to access the file.");
			return fsResult.OK;

		case "ENOSPC":				// no space in fs?
			await defaultDialog("Not enough space to save the file.");
			return fsResult.OK;

		default:				// misc error
			await defaultDialog("An unknown exception occured. Please try again later.");
			return fsResult.INVALID;
	}
}
