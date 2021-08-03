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
	 * Helper function to check if multi selection exists, and if not, then clone the single selection as both of the points in multi selection
	 */
	private checkMultiSelection() {
		if(!this.parent.selectionManager.multi) {
			this.parent.selectionManager.multi = [
				{ ...this.parent.selectionManager.single, },
				{ ...this.parent.selectionManager.single, },
			]
		}
	}

	/**
	 * Helper function to check if multi-selection is in the full column(s)
	 *
	 * @param channel If set, then check also that th full channel is selected
	 */
	private checkSelectAll(channel:boolean) {
		// load the multi seleciton and check if its valid
		const sl = this.parent.selectionManager.multi;

		if(sl) {
			// determine the top and bottom positions of the selection
			const top = +(sl[0].row > sl[1].row);

			// if selection is already at the top and bottom, then check if its around the cursor
			if(sl[top].row === 0 && sl[1-top].row === this.parent.patternLen - 1) {
				// check the if the selection is selecting the entire channel
				const left = +(sl[0].element > sl[1].element);

				if(!channel || (sl[left].element === 0 && sl[1-left].element === this.parent.channelInfo[sl[1-left].channel].elements.length - 1)) {
					// helper function to find the offset from the single selection and multi selection.
					const check = (sel:SingleSelection) => {
						return sel.channel !== this.parent.selectionManager.single.channel ?
							sel.channel - this.parent.selectionManager.single.channel :
							sel.element - this.parent.selectionManager.single.element;
					}

					// check if single selection is inside the multi selection
					const soff = sl.map((s) => check(s));
					if((soff[0] === 0 || soff[1] === 0 || (soff[0] <= 0) !== (soff[1] <= 0))) {
						// if so, then ignore shortcut
						return false;
					}
				}
			}
		}

		return true;
	}

	/**
	 * Function to receive shortcut events from the user.
	 *
	 * @param shortcut Array of strings representing the shotcut data
	 * @returns Whether the shortcut was executed
	 */
	// eslint-disable-next-line require-await
	public async receiveShortcut(data:string[]):Promise<boolean> {
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
							this.checkMultiSelection();

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
						return this.handleMovementCheck(data.shift(), async(pos:Position) => {
							if(pos.x) {
								// function to move the selection
								const move = (sel:SingleSelection, wrap:boolean) => {
									// check if channel is already maximum/minimum
									if(!wrap && (pos.x < 0 ? (sel.channel <= 0) : (sel.channel >= this.parent.channelInfo.length - 1))) {
										return false;
									}

									// move the target channel
									sel.channel += pos.x + this.parent.channelInfo.length;
									sel.channel %= this.parent.channelInfo.length;
									return true;
								};

								// load the selection target
								const [ target, fn, wrap, ] = this.getSelectionTarget();

								if(target === this.parent.selectionManager.single) {
									// single mode, move the channel only
									target.element = 0;
									move(target, true);

								} else if(this.parent.selectionManager.multi) {
									// multi mode, do some special handling
									const sl = this.parent.selectionManager.multi;
									const md = sl[0].channel === sl[1].channel ? "element" : "channel";
									const l = +(sl[0][md] < sl[1][md]);

									// check if the channel is the same
									if(sl[0].channel === sl[1].channel && (sl[1-l].element !== 0 ||
										sl[l].element !== this.parent.channelInfo[sl[l].channel].elements.length - 1)) {
											// special case where the whole channel is highlighted
											sl[l].element = this.parent.channelInfo[sl[l].channel].elements.length - 1;
											sl[1-l].element = 0;

									} else if(pos.x > 0) {
										if(move(sl[1-l], false)) {
											// align the selection to the channel
											sl[1-l].element = this.parent.channelInfo[sl[1-l].channel].elements.length - 1;
											sl[l].element = 0;
											sl[l].channel = sl[1-l].channel;
										}

									} else if(move(sl[l], false)){
										sl[l].element = this.parent.channelInfo[sl[l].channel].elements.length - 1;
										sl[1-l].element = 0;
										sl[1-l].channel = sl[l].channel;
									}

									// update single selection
									const target = +(pos.x > 0 !== sl[0][md] > sl[1][md]);
									this.parent.selectionManager.single.channel = sl[target].channel;
									this.parent.selectionManager.single.element = sl[target].element;

									// update channel and visibility
									this.parent.scrollManager.ensureVisibleChannel(sl[target].channel, sl[target].channel);
									await this.parent.tab.setSelectedChannel(sl[target].channel);
									this.parent.selectionManager.render();
								}

								// move left/right by a single channel
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

					case "extendtop": {
						// if there is no multi selection, clone single selection as the multi selection
						this.checkMultiSelection();

						// find which selection is closest to the top
						const sl = this.parent.selectionManager.multi as MultiSelection;
						const t = +(sl[0].row > sl[1].row);

						// set the row and scroll
						this.parent.selectionManager.single.row = sl[t].row = 0;
						this.parent.scrollManager.scrollToRow(this.parent.selectionManager.single.pattern * this.parent.patternLen);
						return true;
					}

					case "extendbottom": {
						// if there is no multi selection, clone single selection as the multi selection
						this.checkMultiSelection();

						// find which selection is closest to the bottom
						const sl = this.parent.selectionManager.multi as MultiSelection;
						const t = +(sl[0].row < sl[1].row);

						// set the row and scroll
						this.parent.selectionManager.single.row = sl[t].row = this.parent.patternLen - 1;
						this.parent.scrollManager.scrollToRow(((this.parent.selectionManager.single.pattern + 1) * this.parent.patternLen) - 1);
						return true;
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

					case "movehighlight":
						return this.handleMovementCheck(data.shift(), (pos:Position) => {
							if(pos.y) {
								// remove multi selection
								this.parent.selectionManager.clearMultiSelection();

								// prepare variables
								const row = this.parent.selectionManager.single.row;
								const yoff:number[] = [];

								// helper function to correctly calculate the highlight
								const loadOff = (hilite:number) => {
									if(hilite < this.parent.patternLen) {
										// load the target position
										let target = ((pos.y < 0 ? 0 : hilite) - (row % hilite)) || -hilite;

										// check if position crosses the pattern
										if(target >= this.parent.patternLen - row) {
											target = this.parent.patternLen - row;

										} else if(target < -row){
											target = ((pos.y < 0 ? 0 : hilite) - (this.parent.patternLen % hilite)) || -hilite;
										}

										// put the target position in the array
										yoff.push(target);
									}
								};

								// load the row positions
								this.parent.scrollManager.rowHighlights.forEach((h) => loadOff(h));

								// if no targets defined, defined one
								if(yoff.length === 0){
									yoff.push((pos.y < 0 ? 0 : this.parent.patternLen) - row);
								}

								// move up/down to the closest highlight
								return this.parent.selectionManager.moveSingle(0, Math[pos.y < 0 ? "max" : "min"](...yoff), true);
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

					case "fullcolumn": {
						if(!this.checkSelectAll(false)) {
							return false;
						}

						// set the multi selection on the single selection column
						const sl = this.parent.selectionManager.multi = [
							{ ...this.parent.selectionManager.single, },
							{ ...this.parent.selectionManager.single, },
						];

						sl[0].row = 0;
						sl[1].row = this.parent.patternLen - 1;

						// re-render the selection
						this.parent.selectionManager.render();
						return true;
					}

					case "fullchannel": {
						if(!this.checkSelectAll(true)) {
							return false;
						}

						// set the multi selection on the single selection column
						const sl = this.parent.selectionManager.multi = [
							{ ...this.parent.selectionManager.single, },
							{ ...this.parent.selectionManager.single, },
						];

						sl[0].row = 0;
						sl[0].element = 0;
						sl[1].row = this.parent.patternLen - 1;
						sl[1].element = this.parent.channelInfo[this.parent.selectionManager.single.channel].elements.length - 1;

						// re-render the selection
						this.parent.selectionManager.render();
						return true;
					}

					case "fullpattern": {
						// initialize the selection at the edges of the pattern
						this.parent.selectionManager.multi = [
							{
								pattern: this.parent.selectionManager.single.pattern,
								row: 0, channel: 0, element: 0,
							},
							{
								pattern: this.parent.selectionManager.single.pattern,
								row: this.parent.patternLen - 1,
								channel: this.parent.channelInfo.length - 1,
								element: this.parent.channelInfo[this.parent.channelInfo.length - 1].elements.length - 1,
							},
						];

						// re-render the selection
						this.parent.selectionManager.render();
						return true;
					}

					case "deselect":
						// remove multi selection
						return this.parent.selectionManager.clearMultiSelection();
				}
			}
		}

		return false;
	}
}
