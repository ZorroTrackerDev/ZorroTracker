
import fs from "fs";
import path from "path";
import json5 from "json5";
import { ConfigVersion, GenericConfig } from "../api/scripts/config";
import { dataPath } from "./ipc/ui";

export const scriptsFolder = "scripts";

// function to find all emulators
export async function findAll(folder:string):Promise<{ [key:string]: GenericConfig }> {
	const ret:{ [key:string]: GenericConfig } = {};

	for(const dir of await fs.promises.readdir(path.join(dataPath, scriptsFolder, folder))) {
		// check if this is a valid chip
		try {
			const obj = json5.parse(await fs.promises.readFile(
				path.join(dataPath, scriptsFolder, folder, dir, "config.json5"), "utf8")) as GenericConfig;

			// this is the only valid version
			if(obj.version !== ConfigVersion.b0){
				continue;
			}

			// check all fields are valid
			if(!obj.name || !obj.entry || !obj.uuid) {
				continue;
			}

			// check file exists and update entry to absolute file
			await fs.promises.access(obj.entry = path.join(dataPath, scriptsFolder, folder, dir, obj.entry));

			// append it to results
			ret[obj.uuid] = obj;

		} catch {
			console.log(":(")
		}
	}

	return ret;
}