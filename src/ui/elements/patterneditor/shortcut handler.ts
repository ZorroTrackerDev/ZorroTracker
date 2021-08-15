import { FeatureFlag } from "../../../api/driver";
import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../../api/events";
import { PatternCell, PatternData } from "../../../api/matrix";
import { Note } from "../../../api/notes";
import { clipboard, ClipboardType, Position, shortcutDirection, UIShortcutHandler } from "../../../api/ui";
import { PatternEditorClipboard } from "./clipboard";
import { PatternEditor } from "./main";
import { PianoProcessor } from "./piano processor";
import { MultiSelection, SingleSelection } from "./selection manager";

export class PatternEditorShortcuts implements UIShortcutHandler {
	private parent:PatternEditor;
	private pianoProcessor:PianoProcessor;
	private clipboard:PatternEditorClipboard;

	constructor(parent:PatternEditor) {
		this.parent = parent;
		_shortcut = this;

		// generate helpers
		this.pianoProcessor = new PianoProcessor(parent);
		this.clipboard = new PatternEditorClipboard(parent);
	}

	/**
	 * Helper function to determine if pattern editor has focus
	 */
	public editorHasFocus(): boolean {
		return this.parent.element.classList.contains("focus");
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
	public async receiveShortcut(data:string[], e:KeyboardEvent|undefined, state:boolean|undefined):Promise<boolean> {
		// has focus, process the shortcut
		switch(data.shift()) {
			case "sel": return this.handleSelectionShortcut(data);
			case "data": return this.handleDataShortcut(data);
			case "chfx": return this.handleChannelEffectsShortcut(data);
			case "note": return this.handleNoteShortcut(data, state);
			case "hex": return this.handleDigitShortcut(parseInt(data.shift() ?? "NaN", 16));
		}

		return false;
	}

	/**
	 * Handle shortcuts from the `chfx` subgroup
	 */
	private handleChannelEffectsShortcut(data:string[]) {
		return this.handleMovementCheck(data.shift(), async(pos:Position) => {
			if(pos.y) {
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// got up/down, load channel
				const ch = this.parent.selectionManager.single.channel;

				// check if this channel supports effects
				if((this.parent.tab.channels[ch].features & FeatureFlag.EFFECTS) === 0) {
					return false;
				}

				// calculate the effects number
				const fx = Math.max(1, Math.min(this.parent.maxEffects, this.parent.tab.channels[ch].info.effects - pos.y));

				if(this.parent.tab.channels[ch].info.effects !== fx) {
					// effects amount changed, update now
					await this.parent.setChannelEffects(fx, ch);
					return true;
				}
			}

			return false;
		});
	}

	/**
	 * Handle shortcuts from the `sel` subgroup
	 */
	private async handleSelectionShortcut(data:string[]) {
		switch(data.shift()) {
			case "move":
				return this.handleMovementCheck(data.shift(), (pos:Position) => {
					// disable digit editing mode
					this.parent.selectionManager.clearEditMode();

					// load the selection target
					const [ , fn, wrap, ] = this.getSelectionTarget();

					// move selection by position
					return fn(pos.x, pos.y, wrap);
				});

			case "extend":
				return this.handleMovementCheck(data.shift(), (pos:Position) => {
					// disable digit editing mode
					this.parent.selectionManager.clearEditMode();

					// if there is no multi selection, clone single selection as the multi selection
					this.checkMultiSelection();

					// extend multi selection
					return this.parent.selectionManager.extendMulti(pos.x, pos.y, false);
				});

			case "scroll":
				return this.handleMovementCheck(data.shift(), (pos:Position) => {
					// disable digit editing mode
					this.parent.selectionManager.clearEditMode();

					// load the selection target
					const [ , fn, wrap, ] = this.getSelectionTarget();

					// move selection by position
					return fn(pos.x * 4, pos.y * 4, wrap);
				});

			case "scrollextend":
				return this.handleMovementCheck(data.shift(), (pos:Position) => {
					// disable digit editing mode
					this.parent.selectionManager.clearEditMode();

					// if there is no multi selection, clone single selection as the multi selection
					this.checkMultiSelection();

					// extend multi selection
					return this.parent.selectionManager.extendMulti(pos.x * 4, pos.y * 4, false);
				});

			case "movechannel":
				return this.handleMovementCheck(data.shift(), async(pos:Position) => {
					if(pos.x) {
						// disable digit editing mode
						this.parent.selectionManager.clearEditMode();

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
							await this.parent.scrollManager.ensureVisibleChannel(sl[target].channel, sl[target].channel);
							await this.parent.tab.setSelectedChannel(sl[target].channel);
							this.parent.selectionManager.render();
						}

						// move left/right by a single channel
						return fn(0, 0, wrap);
					}

					return false;
				});

			case "rowtop": {
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// load the selection target
				const [ target, fn, wrap, ] = this.getSelectionTarget();

				// move to the top row of the pattern
				target.row = 0;
				return fn(0, -0.0001, wrap);
			}

			case "rowbottom": {
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// load the selection target
				const [ target, fn, wrap, ] = this.getSelectionTarget();

				// move to the bottom row of the pattern
				target.row = this.parent.patternLen - 1;
				return fn(0, 0.0001, wrap);
			}

			case "extendtop": {
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// if there is no multi selection, clone single selection as the multi selection
				this.checkMultiSelection();

				// find which selection is closest to the top
				const sl = this.parent.selectionManager.multi as MultiSelection;
				const t = +(sl[0].row > sl[1].row);

				// set the row and scroll
				this.parent.selectionManager.single.row = sl[t].row = 0;
				await this.parent.scrollManager.scrollToRow(this.parent.selectionManager.single.pattern * this.parent.patternLen);
				return true;
			}

			case "extendbottom": {
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// if there is no multi selection, clone single selection as the multi selection
				this.checkMultiSelection();

				// find which selection is closest to the bottom
				const sl = this.parent.selectionManager.multi as MultiSelection;
				const t = +(sl[0].row < sl[1].row);

				// set the row and scroll
				this.parent.selectionManager.single.row = sl[t].row = this.parent.patternLen - 1;
				await this.parent.scrollManager.scrollToRow(((this.parent.selectionManager.single.pattern + 1) * this.parent.patternLen) - 1);
				return true;
			}

			case "movepattern":
				return this.handleMovementCheck(data.shift(), (pos:Position) => {
					if(pos.y) {
						// disable digit editing mode
						this.parent.selectionManager.clearEditMode();

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
						// disable digit editing mode
						this.parent.selectionManager.clearEditMode();

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
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// remove multi selection
				this.parent.selectionManager.clearMultiSelection();

				// move to the top row of the pattern
				this.parent.selectionManager.single.row = 0;
				this.parent.selectionManager.single.pattern = 0;
				return this.parent.selectionManager.moveSingle(0, -0.0001, true);
			}

			case "patternbottom": {
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

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

				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

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

				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

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
				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

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

		return false;
	}

	/**
	 * Handle shortcuts from the `data` subgroup
	 */
	private async handleDataShortcut(data:string[]) {
		// ignore if not in record mode
		if(!this.parent.tab.recordMode) {
			return true;
		}

		switch(data.shift()) {
			case "cut": {
				// generate clipboard data
				const data = await this.clipboard.generateCopy(this.parent.selectionManager.multi);

				if(data) {
					// if data is valid, update clipboard
					await clipboard.set(ClipboardType.Pattern, data);

					// delete this section
					await this.deleteSelection();
				}

				return true;
			}

			case "copy": {
				// generate clipboard data
				const data = await this.clipboard.generateCopy(this.parent.selectionManager.multi);

				if(data) {
					// if data is valid, update clipboard
					await clipboard.set(ClipboardType.Pattern, data);
				}

				return true;
			}

			case "paste": {
				// load clipboard data
				const data = await clipboard.get(ClipboardType.Pattern);

				if(data) {
					// if data is valid, update clipboard
					await this.clipboard.pasteData(this.parent.selectionManager.single, data, false);
				}

				return true;
			}

			case "mix": {
				// load clipboard data
				const data = await clipboard.get(ClipboardType.Pattern);

				if(data) {
					// if data is valid, update clipboard
					await this.clipboard.pasteData(this.parent.selectionManager.single, data, true);
				}

				return true;
			}

			case "change1":
				return this.handleMovementCheck(data.shift(), async(pos:Position) => {
					if(!pos.y || !await this.handleDataChangeShortcut((sel:SingleSelection) => [ sel, sel, ],
						(pd:PatternData, pattern:number, channel:number, rstart:number, rend:number, estart:number, eend:number) =>
							this.processDataChange(-pos.y, false, pd, pattern, channel, rstart, rend, estart, eend))){
								return false;
							}

					// disable digit editing mode
					this.parent.selectionManager.clearEditMode();
					return true;
				});

			case "change10":
				return this.handleMovementCheck(data.shift(), async(pos:Position) => {
					if(!pos.y || !await this.handleDataChangeShortcut((sel:SingleSelection) => [ sel, sel, ],
						(pd:PatternData, pattern:number, channel:number, rstart:number, rend:number, estart:number, eend:number) =>
							this.processDataChange(-pos.y, true, pd, pattern, channel, rstart, rend, estart, eend))){
								return false;
							}

					// disable digit editing mode
					this.parent.selectionManager.clearEditMode();
					return true;
				});

			case "delete":
				await this.deleteSelection();
				return true;

			case "insert":
				if(!await this.handleDataChangeShortcut((sel:SingleSelection) => [
						{ pattern: sel.pattern, row: sel.row, channel: sel.channel, element: 0, },
						{ pattern: sel.pattern, row: sel.row, channel: sel.channel, element: 0, },
					], (pd:PatternData, pattern:number, channel:number, rstart:number, rend:number) =>
						this.insertRows(pd, pattern, channel, rstart, rend)
					)){
						return false;
					}

				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();
				return true;

			case "remove":
				if(!await this.handleDataChangeShortcut((sel:SingleSelection) => sel.row === 0 ? null : [
						{ pattern: sel.pattern, row: sel.row - 1, channel: sel.channel, element: 0, },
						{ pattern: sel.pattern, row: sel.row - 1, channel: sel.channel, element: 0, },
					], (pd:PatternData, pattern:number, channel:number, rstart:number, rend:number) =>
						this.removeRows(pd, pattern, channel, rstart, rend)
					)){
						return false;
					}

				// disable digit editing mode
				this.parent.selectionManager.clearEditMode();

				// move selection if in single mode
				if(!this.parent.selectionManager.multi) {
					await this.parent.selectionManager.moveSingle(0, -1, false);
				}

				return true;
		}

		return false;
	}

	/**
	 * Function to delete the current selection. Used for the delete and cut shortcuts
	 */
	private async deleteSelection() {
		if(!await this.handleDataChangeShortcut((sel:SingleSelection) => {
			// if in the note column in single selection, also delete the volume and instrument
			const els = this.parent.channelInfo[sel.channel].elements;

			if(els[sel.element] === 0) {
				let last = sel.element;

				// check if there is a note and instrument column
				for(let e = sel.element;e < els.length;e++) {
					if(els[e] > 2) {
						break;
					}

					// note or instrument
					last = e;
				}

				return [ sel, { pattern: sel.pattern, row: sel.row, channel: sel.channel, element: last, }, ];
			}

			// delete this single cell
			return [ sel, sel, ];
		},
		(pd:PatternData, pattern:number, channel:number, rstart:number, rend:number, estart:number, eend:number) =>
			this.deleteData(pd, pattern, channel, rstart, rend, estart, eend)
		)){
			return false;
		}

		// disable digit editing mode
		this.parent.selectionManager.clearEditMode();

		// if this is single selection, apply step
		if(!this.parent.selectionManager.multi) {
			await this.parent.selectionManager.applyStep();
		}
	}

	/**
	 * Load the ordered selection (index 0 is top-left, index 1 is bottom-right), based on the current multi- or single-selection
	 *
	 * @param multi The multi-selection to use for checking. It can also be valid if single selection should be used
	 * @param single A function to call to handle single selections correctly
	 * @returns The new multi-selection based on the input, or `null` if failed
	 */
	public getOrderSelection(multi:null|MultiSelection, single:(sel:SingleSelection) => null|MultiSelection): null|MultiSelection {
		if(!multi) {
			// single mode, just choose this single element
			return single(this.parent.selectionManager.single);
		}

		// multi mode, create new selections based on which side is which
		const left = +((multi[0].channel !== multi[1].channel) ? (multi[0].channel > multi[1].channel) : (multi[0].element > multi[1].element));
		const top = +((multi[0].pattern !== multi[1].pattern) ? (multi[0].pattern > multi[1].pattern) : (multi[0].row > multi[1].row));

		return [
			// top-left
			{ pattern: multi[top].pattern, row: multi[top].row, channel: multi[left].channel, element: multi[left].element, },

			// bottom-right
			{ pattern: multi[1-top].pattern, row: multi[1-top].row, channel: multi[1-left].channel, element: multi[1-left].element, },
		]
	}

	/**
	 * Handle shortcuts that change the selected data offsets some amount
	 */
	private async handleDataChangeShortcut(single: (sel:SingleSelection) => null|MultiSelection,
		func: (pd:PatternData, pattern:number, channel:number, rstart:number, rend:number, estart:number, eend:number) => Promise<unknown>|unknown) {
		// load the ordered boundaries of the selection
		const sel = this.getOrderSelection(this.parent.selectionManager.multi, single);

		if(!sel) {
			return false;
		}

		// loop through each row
		for(let channel = sel[0].channel;channel <= sel[1].channel; channel++) {
			const pats:number[] = [];

			for(let pattern = sel[0].pattern;pattern <= sel[1].pattern; pattern++) {
				// get the real pattern number and check it exists and wasnt updated
				const rp = this.parent.tab.matrix.get(channel, pattern);

				if(typeof rp !== "number" || pats.includes(rp)) {
					continue;
				}

				// load the pattern data based on pattern number
				const pd = this.parent.tab.matrix.patterns[channel][rp];

				if(!pd) {
					continue;
				}

				// store the pattern as updated
				pats.push(rp);

				// get the rows for this channel
				let rstart = 0, rend = this.parent.patternLen - 1;

				if(pattern === sel[0].pattern) {
					rstart = sel[0].row;
				}

				if(pattern === sel[1].pattern) {
					rend = sel[1].row;
				}

				// get the elements for this channel
				let estart = 0, eend = this.parent.channelInfo[channel].elements.length;

				if(channel === sel[0].channel) {
					estart = sel[0].element;
				}

				if(channel === sel[1].channel) {
					eend = sel[1].element;
				}

				// handle rendering for this area
				await func(pd, rp, channel, rstart, rend, estart, eend);
			}
		}

		return true;
	}

	/**
	 * Helper function to process row insert
	 */
	private async insertRows(pd:PatternData, pattern:number, channel:number, rstart:number, rend:number) {
		// len = number of rows to shift
		const len = rend - rstart + 1;

		// copy rows down
		for(let row = 255 - len;row >= rstart; --row) {
			pd.cells[row + len] = pd.cells[row];
		}

		// generate new rows
		for(let row = rend;row >= rstart; --row) {
			pd.cells[row] = new PatternCell();
		}

		// reload graphics
		await this.parent.scrollManager.updateDataRows(pattern, rstart, this.parent.patternLen, channel);
		this.parent.tab.project.dirty();
	}

	/**
	 * Helper function to process row removal
	 */
	private async removeRows(pd:PatternData, pattern:number, channel:number, rstart:number, rend:number) {
		// len = number of rows to shift
		const len = rend - rstart + 1;

		// copy rows up
		for(let row = rend;row < 256; row++) {
			pd.cells[row - len] = pd.cells[row];
		}

		// generate new rows
		for(let row = 256 - len;row < 256; row++) {
			pd.cells[row] = new PatternCell();
		}

		// reload graphics
		await this.parent.scrollManager.updateDataRows(pattern, rstart, this.parent.patternLen, channel);
		this.parent.tab.project.dirty();
	}

	/**
	 * Helper function to process data deletion
	 */
	private async deleteData(pd:PatternData, pattern:number, channel:number, rstart:number, rend:number, estart:number, eend:number) {
		let mod = false;

		for(let e = estart;e <= eend;e ++) {
			// find the element ID
			const ele = this.parent.channelInfo[channel].elements[e];

			for(let r = rstart;r <= rend;r ++) {
				// handle this element increment
				switch(ele) {
					case 1: case 2: {		// volume, instrument
						// if already null, skip
						if(pd.cells[r][ele === 1 ? "instrument" : "volume"] === null) {
							continue;
						}

						// delete value
						pd.cells[r][ele === 1 ? "instrument" : "volume"] = null;
						mod = true;
						break;
					}

					case 0: {		// notes
						// if already null, skip
						if(pd.cells[r].note === Note.Null) {
							continue;
						}

						// delete note
						pd.cells[r].note = Note.Null;
						mod = true;
						break;
					}

					default: { // effects
						const fx = ((ele - 3) / 2) | 0, param = (ele - 3) & 1 ? "value" : "id";

						// if already null, skip
						if(pd.cells[r].effects[fx][param] === 0) {
							continue;
						}

						// delete effect id or value
						pd.cells[r].effects[fx][param] = 0;
						mod = true;
						break;
					}
				}
			}
		}

		// if modified, make the project dirty
		if(mod) {
			this.parent.tab.project.dirty();
			pd.edited = true;
		}

		// update rows in channel
		await this.parent.scrollManager.updateDataRows(pattern, rstart, rend + 1, channel);
	}

	/**
	 * Helper function to process data change
	 */
	private async processDataChange(dir:number, is10:boolean, pd:PatternData,
		pattern:number, channel:number, rstart:number, rend:number, estart:number, eend:number) {
		let mod = false;

		for(let e = estart;e <= eend;e ++) {
			// find the element ID
			const ele = this.parent.channelInfo[channel].elements[e];

			for(let r = rstart;r <= rend;r ++) {
				// handle this element increment
				switch(ele) {
					case 1: case 2: {		// volume, instrument
						// find the maximum amount
						const max = ele === 1 ? 0xFF : 1 + this.parent.tab.notesCache[this.parent.tab.channels[channel].type].maxvolume;

						// load the value and check if it was not set
						let value = pd.cells[r][ele === 1 ? "instrument" : "volume"];

						if(value === null) {
							continue;
						}

						// modify the value and convert FF to 00
						value += dir * (is10 ? 0x10 : 1);
						value = Math.max(0, Math.min(max, value));

						// save value
						pd.cells[r][ele === 1 ? "instrument" : "volume"] = value;
						mod = true;
						break;
					}

					case 0: {		// notes
						let value = pd.cells[r].note;

						if(value < Note.First) {
							// ignore technical notes
							continue;
						}

						// get notes info
						const cache = this.parent.tab.notesCache[this.parent.tab.channels[channel].type];

						// offset the note
						value += dir * (is10 ? cache.octave.size : 1);

						// check if note is valid
						if(typeof cache.notes[value].frequency !== "number") {
							// nope, ignore
							continue;
						}

						// do not allow using technical notes
						if(value < Note.First) {
							value = Note.First;
						}

						// save note
						pd.cells[r].note = value;
						mod = true;
						break;
					}

					default:		// ignore effects
						break;
				}
			}
		}

		// if modified, make the project dirty
		if(mod) {
			this.parent.tab.project.dirty();
			pd.edited = true;
		}

		// update rows in channel
		await this.parent.scrollManager.updateDataRows(pattern, rstart, rend + 1, channel);
	}

	/**
	 * Function to place a digit on the pattern
	 */
	private async handleDigitShortcut(digit:number) {
		// ignore invalid digits or not in record mode
		if(!this.editorHasFocus() || typeof digit !== "number" || isNaN(digit)) {
			return false;
		}

		// ignore if not focused
		if(!this.parent.tab.recordMode) {
			return false;
		}

		// check if this is a volume or instrument column
		const eid = this.getCurrentElementId();

		switch(eid) {
			// test volume + instrument
			case 1: case 2: break;

			default:
				return false;
		}

		// find the current cell and check its valid
		const info = this.parent.shortcuts.getCurrentPatternCell();

		if(!info) {
			return false;
		}
		// find the maximum amount
		const max = eid === 1 ? 0xFF :
			this.parent.tab.notesCache[this.parent.tab.channels[this.parent.selectionManager.single.channel].type].maxvolume;

		// get the element name we're editing
		const enm = eid === 1 ? "instrument" : "volume";
		let step = false;

		// check which digit we're editing
		switch(this.parent.selectionManager.digitEdit) {
			case 0: {
				// insert the new value in and we're done
				info[2][enm] = Math.min(max, digit);

				// check if this can fit in 1 digit
				if(max < 0x10) {
					step = true;

				} else {
					// needs 2 digits
					this.parent.selectionManager.digitEdit++;
				}
				break;
			}

			case 1: {
				// create the value in this dumb way
				info[2][enm] = Math.min(max, ((info[2][enm] ?? 0) << 4) | digit);
				step = true;
				this.parent.selectionManager.digitEdit = 0;
				break;
			}

			// just in case something goes really weird
			default: return false;
		}

		// re-render this element
		await this.parent.shortcuts.updateCurrentRow(info[0]);

		// apply step only when needed
		if(step) {
			await this.parent.selectionManager.applyStep();
		}

		// project is dirty now
		this.parent.tab.project.dirty();
		info[1].edited = true;

		return true;
	}

	/**
	 * Function to find the last instrument # in this pattern and channel
	 */
	public getLastInstrument(): number|null {
		// load the next pattern and check if its valid
		const pat = this.getCurrentPattern();

		if(!pat) {
			return null;
		}

		// loop for each row, trying to find the instrument
		for(let r = this.parent.selectionManager.single.row;r >= 0; --r) {
			if(pat[1].cells[r] && pat[1].cells[r].instrument !== null) {
				// found the instrument, return it
				return pat[1].cells[r].instrument;
			}
		}

		// no instrument found
		return null;
	}

	/**
	 * Helper function to get the ID of the currently selected element in single selection
	 */
	public getCurrentElementId(): number {
		return this.parent.channelInfo[this.parent.selectionManager.single.channel].elements[this.parent.selectionManager.single.element];
	}

	/**
	 * Helper function to get the currently active pattern cell
	 */
	public getCurrentPattern(): null|[ number, PatternData, ] {
		// load the current channel
		const ch = this.parent.selectionManager.single.channel;

		// get the real pattern number
		const rp = this.parent.tab.matrix.get(ch, this.parent.selectionManager.single.pattern);

		if(typeof rp !== "number") {
			return null;
		}

		// load the pattern data based on pattern number
		const pd = this.parent.tab.matrix.patterns[ch][rp];

		if(!pd) {
			return null;
		}

		// find the cell that we're targeting
		return [ rp, pd, ];
	}

	/**
	 * Helper function to get the currently active pattern cell
	 */
	public getCurrentPatternCell(): null|[ number, PatternData, PatternCell, ] {
		const pat = this.getCurrentPattern();

		if(!pat) {
			return null;
		}

		// find the cell that we're targeting
		const cell = pat[1].cells[this.parent.selectionManager.single.row];
		return !cell ? null : [ ...pat, cell, ];
	}

	/**
	 * Helper function to update the current data row
	 */
	public updateCurrentRow(pattern:number): Promise<void> {
		const sel = this.parent.selectionManager.single;
		return this.parent.scrollManager.updateDataRows(pattern, sel.row, sel.row + 1, sel.channel);
	}

	/**
	 * Map strings to note numbers. This will allow the Piano to correctly release notes
	 */
	private scmap:{ [key:string]: number, } = {};

	/**
	 * Handle shortcuts from the `note` subgroup
	 */
	private handleNoteShortcut(data:string[], state:boolean|undefined) {
		// helper function to process an octave of notes
		const octave = (data:string[], octave:number) => {
			// helper function to trigger a single note
			const note = async(note:number) => {
				// get the scmap name for this note
				const name = octave +"-"+ note;

				if(state) {
					// fetch octave info
					const octaveInfo = (await this.parent.tab.getNotes(this.parent.tab.selectedChannel.type)).octave;

					// calculate the note
					const n = octaveInfo.C0 + note + ((this.parent.tab.octave + octave) * octaveInfo.size);

					// trigger the note
					this.triggerNote(n, 1);
					this.scmap[name] = n;

				} else if(this.scmap[name]){
					// release the note and remove scmap reference
					this.releaseNote(this.scmap[name], 0);
					delete this.scmap[name];
				}

				return true;
			};

			// read the note and handle it
			switch(data.shift()?.toUpperCase()) {
				case "C":	return note(0);
				case "C#":	return note(1);
				case "D":	return note(2);
				case "D#":	return note(3);
				case "E":	return note(4);
				case "F":	return note(5);
				case "F#":	return note(6);
				case "G":	return note(7);
				case "G#":	return note(8);
				case "A":	return note(9);
				case "A#":	return note(10);
				case "B":	return note(11);
			}

			// note not found
			return false;
		}

		// helper function to process special note
		const specialNote = (note:number) => {
			if(state) {
				return this.triggerNote(note, 1);

			} else {
				return this.releaseNote(note, 0);
			}
		};

		// process the shortcut
		switch(data.shift()?.toLowerCase()) {
			case "rest":		return specialNote(Note.Rest);
			case "cut":			return specialNote(Note.Cut);
			case "octave0":		return octave(data, 0);
			case "octave1":		return octave(data, 1);
			case "octave2":		return octave(data, 2);
		}

		return false;
	}

	/**
	 * Trigger a note at a certain velocity
	 *
	 * @param note The note ID to trigger
	 * @param velocity The velocity to trigger the note with, from 0 to 1.0.
	 * @returns boolean indicatin whether the note was triggered
	 */
	public triggerNote(note:number, velocity:number):boolean {
		return this.pianoProcessor.triggerNote(note, velocity);
	}

	/**
	 * Release a note
	 *
	 * @param note The note ID to release
	 * @param velocity The velocity to release the note with, from 0 to 1.0.
	 * @returns boolean indicatin whether the note was released
	 */
	public releaseNote(note:number, velocity:number): boolean {
		return this.pianoProcessor.releaseNote(note, velocity);
	}

	/**
	 * Helper function to get relative note to start of current octave, mainly for MIDI devices.
	 *
	 * @param offset The note offset from the start of current octave
	 * @returns the translated note
	 */
	public async getRelativeNote(offset:number): Promise<number> {
		const octave = (await this.parent.tab.getNotes(this.parent.tab.selectedChannel.type)).octave;
		return ((this.parent.tab.octave + 1) * octave.size) + octave.C0 + offset;
	}
}

let _shortcut:undefined|PatternEditorShortcuts;

/*
 * Store a translation table of MIDI notes -> driver notes. This allows the octave to change without disturbing the MIDI note.
 */
const keys:number[] = Array(128);

/**
 * Helper event listener for the MidiNoteOn event, so that the piano can receive notes from MIDI devices
 */
ZorroEvent.addListener(ZorroEventEnum.MidiNoteOn, async(event:ZorroEventObject, channel:number, note:number, velocity:number) => {
	if(_shortcut) {
		// get the relative note to trigger
		const rn = await _shortcut.getRelativeNote(note - 60);

		// attempt to trigger the note
		if(_shortcut.triggerNote(rn, velocity)) {
			keys[note] = rn;
		}
	}
});

/**
 * Helper event listener for the MidiNoteOff event, so that the piano can receive notes from MIDI devices
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MidiNoteOff, async(event:ZorroEventObject, channel:number, note:number, velocity:number) => {
	if(_shortcut) {
		// attempt to release the note
		if(_shortcut.releaseNote(keys[note], velocity)) {
			keys[note] = 0;
		}
	}
});
