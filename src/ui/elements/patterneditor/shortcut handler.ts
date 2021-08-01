import { Position, shortcutDirection, UIShortcutHandler } from "../../../api/ui";
import { PatternEditor } from "./main";
import { MultiSelection, SingleSelection } from "./selection manager";

export class PatternEditorShortcuts implements UIShortcutHandler {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;
	}

	/**
	 * Helper function to handle movement checks
	 */
	private handleMovementCheck(direction:string|undefined, cb: (position:Position) => boolean|Promise<boolean>) {
		// load the position offset for the direction
		const position = shortcutDirection(direction);

		if(position) {
			// if valid, call the function to handle it
			return cb(position);
		}

		return false;
	}

	/**
	 * Helper function to get the selection target. Either single selection or second element of multi selection.
	 */
	private getSelectionTarget(): [ SingleSelection, (x:number, y:number, wrap:boolean) => boolean|Promise<boolean>, boolean ] {
		const mode = !this.parent.selectionManager.multi;

		// return the values according to whether multi selection exists
		return [
			mode ? this.parent.selectionManager.single : (this.parent.selectionManager.multi as MultiSelection)[1],
			mode ? (x:number, y:number, wrap:boolean) => this.parent.selectionManager.moveSingle(x, y, wrap) :
				(x:number, y:number, wrap:boolean) => this.parent.selectionManager.moveMulti(x, y, wrap),
			mode,
		];
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
				case "sel": {
					switch(data.shift()) {
						case "move":
							return this.handleMovementCheck(data.shift(), (pos:Position) => {
								// load the selection target
								const [ , fn, wrap, ] = this.getSelectionTarget();

								// move selection by position
								return fn(pos.x, pos.y, wrap);
							});

						case "extend":
							return this.handleMovementCheck(data.shift(), (pos:Position) => {
								// if there is no multi selection, clone single selection as the multi selection
								if(!this.parent.selectionManager.multi) {
									this.parent.selectionManager.multi = [
										{ ...this.parent.selectionManager.single, },
										{ ...this.parent.selectionManager.single, },
									]
								}

								// extend multi selection
								return this.parent.selectionManager.extendMulti(pos.x, pos.y, false);
							});

						case "scroll":
							return this.handleMovementCheck(data.shift(), (pos:Position) => {
								// load the selection target
								const [ , fn, wrap, ] = this.getSelectionTarget();

								// move selection by position
								return fn(pos.x * 4, pos.y * 4, wrap);
							});

						case "movechannel":
							return this.handleMovementCheck(data.shift(), (pos:Position) => {
								if(pos.x) {
									// load the selection target
									const [ target, fn, wrap, ] = this.getSelectionTarget();

									// move left/right by a single channel
									target.element = 0;
									target.channel += pos.x + this.parent.channelInfo.length;
									target.channel %= this.parent.channelInfo.length;
									return fn(0, 0, wrap);
								}

								return false;
							});

						case "rowtop": {
							// load the selection target
							const [ target, fn, wrap, ] = this.getSelectionTarget();

							// move to the top row of the pattern
							target.row = 0;
							return fn(0, -0.0001, wrap);
						}

						case "rowbottom": {
							// load the selection target
							const [ target, fn, wrap, ] = this.getSelectionTarget();

							// move to the bottom row of the pattern
							target.row = this.parent.patternLen - 1;
							return fn(0, 0.0001, wrap);
						}

						case "movepattern":
							return this.handleMovementCheck(data.shift(), (pos:Position) => {
								if(pos.y) {
									// remove multi selection
									this.parent.selectionManager.clearMultiSelection();

									// move up/down by a single pattern
									return this.parent.selectionManager.moveSingle(0, pos.y * this.parent.patternLen, true);
								}

								return false;
							});

						case "patterntop": {
							// remove multi selection
							this.parent.selectionManager.clearMultiSelection();

							// move to the top row of the pattern
							this.parent.selectionManager.single.row = 0;
							this.parent.selectionManager.single.pattern = 0;
							return this.parent.selectionManager.moveSingle(0, -0.0001, true);
						}

						case "patternbottom": {
							// remove multi selection
							this.parent.selectionManager.clearMultiSelection();

							// move to the bottom row of the pattern
							this.parent.selectionManager.single.row = this.parent.patternLen - 1;
							this.parent.selectionManager.single.pattern = this.parent.tab.matrix.matrixlen - 1;
							return this.parent.selectionManager.moveSingle(0, 0.0001, true);
						}

						case "deselect":
							// remove multi selection
							return this.parent.selectionManager.clearMultiSelection();
					}
				}
			}
		}

		return false;
	}
}
