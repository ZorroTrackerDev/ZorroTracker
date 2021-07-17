import { Project } from "./project";

/**
 * Helper class to store all state related to the current opened tab
 */
export class Tab {
	/**
	 * The currently active tab
	 */
	public static active:Tab|undefined;

	/**
	 * Initialize a new tab
	 *
	 * @param project
	 */
	constructor(project:Project) {
		this._project = project;
	}

	/**
	 * The project opened in this tab
	 */
	private _project:Project;
	public get project():Project {
		return this._project
	}
}
