export enum ConfigVersion {
	b0 = "b0",
}

export interface GenericConfig {
	version: ConfigVersion,
	entry: string,
	name: string,
	uuid: string,
}