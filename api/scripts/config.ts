// list of all valid config versions. These may be used to validate scripts are compatible with the program.
export enum ConfigVersion {
	b0 = "b0",
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
}