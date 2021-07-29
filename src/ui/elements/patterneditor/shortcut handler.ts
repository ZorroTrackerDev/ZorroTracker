import { shortcutDirection, UIShortcutHandler } from "../../../api/ui";
import { PatternEditor } from "./main";

export class PatternEditorShortcuts implements UIShortcutHandler {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;
	}


	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[]):Promise<boolean> {
		if(document.querySelector(":focus") === this.parent.element) {
			// has focus, process the shortcut
			switch(data.shift()) {
				case "ss": {
					switch(data.shift()) {
						case "move": {
							// load the movement for single selection
							const movement = shortcutDirection(data.shift());

							if(movement) {
								// if movement found, move the selection by that amount
								this.parent.selectionManager.moveSingle(movement.x, movement.y, true);
								return true;
							}

							return false;
						}
					}
				}
			}
		}

		return false;
	}
}
