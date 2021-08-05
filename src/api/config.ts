// list of all valid config versions. These may be used to validate scripts are compatible with the program.
export enum ConfigVersion {
	b0 = "b0",					// first test version of the API
	b1 = "b1",					// second version of the API, with expanded functionality to support actual real-world use cases
	b2 = "b2",					// third version of the API
}

// a generic configuration object, which specific configurations will extend from.
export interface GenericConfig {
	// version of this configuration
	version: ConfigVersion,

	// usually the script filename to use
	entry: string,

	// name of the script or configuration
	name: string,

	// an unique identifier for the script or configuration
	uuid: string,

	// the date the configuration object was created
	date: string,

	// credits information for the configuration
	credits: { author:string, url?:string, info:string, }[],
}
