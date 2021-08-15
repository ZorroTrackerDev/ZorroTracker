import { NoteData, NoteReturnType } from "../../../api/driver";
import { PatternData } from "../../../api/matrix";
import { PatternEditor } from "./main";
import { MultiSelection, SingleSelection } from "./selection manager";

export class PatternEditorClipboard {
	private parent:PatternEditor;

	constructor(parent:PatternEditor) {
		this.parent = parent;
	}

	/**
	 * Handler for copying an area of the pattern editor into a string
	 *
	 * @param selection The `MultiSelection` object that describes the area to copy
	 * @returns a string that represents the data in this selection, or `null` if failed
	 */
	public async generateCopy(selection:MultiSelection|null): Promise<string|null> {
		// load the ordered selection
		const sl = this.parent.shortcuts.getOrderSelection(selection, () => null);

		if(!sl) {
			return null;
		}

		// load pattern row info
		const pattern = sl[0].pattern;
		const datas:PatternData[] = [];
		const notes:NoteReturnType[] = [];

		// load each active pattern
		for(let channel = sl[0].channel;channel <= sl[1].channel;channel++) {
			// get the real pattern number for the channel
			const rp = this.parent.tab.matrix.get(channel, pattern);

			if(typeof rp !== "number") {
				return null;
			}

			// load the pattern data based on pattern number
			const pd = this.parent.tab.matrix.patterns[channel][rp];

			if(!pd) {
				return null;
			}

			// save the pattern to the channel
			datas[channel] = pd;

			// pre-load the notes data
			const type = this.parent.tab.channels[channel].type;

			if(!notes[type]) {
				notes[type] = await this.parent.tab.getNotes(type);
			}
		}

		let ret = "";

		// loop for each row
		for(let row = sl[0].row;row <= sl[1].row;row++) {
			for(let channel = sl[0].channel;channel <= sl[1].channel;channel++) {
				// load the elements for this channel
				let estart = 0, eend = this.parent.channelInfo[channel].elements.length;

				if(channel === sl[0].channel) {
					estart = sl[0].element;
				}

				if(channel === sl[1].channel) {
					eend = sl[1].element;
				}

				ret += "| ";
				const cell = datas[channel].cells[row];

				// loop through each element
				for(let e = 0;e < 3 + (2 * this.parent.tab.channels[channel].info.effects);e ++) {
					// check what index this element is in the channel, if at all
					const index = this.parent.channelInfo[channel].elements.indexOf(e);

					// if this is not selected, append with dots
					if(index < estart || index > eend) {
						ret += e === 0 ? ".... " : ".. ";
						continue;
					}

					switch(e) {
						case 0:		// note - 4 cells
							ret += this.convertNote(notes[this.parent.tab.channels[channel].type].notes[cell.note]) +" ";
							break;

						case 1:		// instrument - 2 cells
							ret += (cell.instrument === null ? "--" : cell.instrument.toByte()) +" ";
							break;

						case 2:		// volume - 2 cells
							ret += (cell.volume === null ? "--" : cell.volume.toByte()) +" ";
							break;

						case 3: case 5: case 7: case 9: case 11: case 13: case 15: case 17:		// effect - 2 cells
							ret += "-- ";		// TODO
							break;

						case 4: case 6: case 8: case 10: case 12: case 14: case 16: case 18:	// value - 2 cells
							ret += "-- ";		// TODO
							break;
					}
				}
			}

			ret += "|\n";
		}


		return ret;
	}

	/**
	 * Helper function to convert note to a string
	 */
	private convertNote(note:NoteData|null) {
		// check for invalid notes
		if(!note || note.frequency === undefined) {
			return "----";
		}

		// convert the note
		let ret = note.name.padEnd(2, "-");

		// convert the octave
		const octave = note.octave === null ? "" : note.octave < 0 ? Math.abs(note.octave) +"_" : note.octave;
		ret = (ret + octave).padEnd(4, "-");

		// finally, return the result
		return ret;
	}

	/**
	 * Function to paste data from a formatted string onto the pattern editor
	 *
	 * @param location The position that acts as the top-left position where to apply the paste to
	 * @param data The string that represents the data to be pasted
	 * @param mix If `false`, blanks will overwrite previously existing data in the pattern.
	 */
	public async pasteData(location:SingleSelection, data:string, mix:boolean): Promise<void> {
		// validate the paste string and convert to tokens
		const tokens = this.validatePaste(data);

		if(!tokens) {
			return;
		}

		// load the selection region and apply it to the selection manager
		const select = this.pasteSelection(tokens, location);
		this.parent.selectionManager.multi = select;
		this.parent.selectionManager.render();

		// apply the selection area now
		await this.applyPaste(select, tokens, mix);
	}

	/**
	 * Function to apply the paste tokens into the paste selection area
	 */
	private async applyPaste(sel:MultiSelection, tokens:string[][][], mix:boolean) {
		const notes:{ [key:number]: string[] } = {};

		// prepare the regex to use depending on mode
		const regex = (mix ? /[.-]+/ : /[.]+/);

		for(let channel = sel[0].channel;channel <= sel[1].channel;channel++){
			// load channel type
			const type = this.parent.tab.channels[channel].type;

			// if doesn't exist, generate the note table
			if(!notes[type]) {
				notes[type] = Array(256);
			}

			// get the real pattern number for the channel
			const rp = this.parent.tab.matrix.get(channel, sel[0].pattern);

			if(typeof rp !== "number") {
				continue;
			}

			// load the pattern data based on pattern number
			const pd = this.parent.tab.matrix.patterns[channel][rp];

			if(!pd) {
				continue;
			}

			// make sure the pattern is no longer automatically deleted
			pd.edited = true;

			// loop through all rows and channels, merging data
			for(let row = sel[0].row;row <= sel[1].row;row++){
				for(let element = 0;element < tokens[row - sel[0].row][channel - sel[0].channel].length; element++) {
					// check if this needs to be written
					const data = tokens[row - sel[0].row][channel - sel[0].channel][element];
					const cell = pd.cells[row];

					if(data.replace(regex, "").length === 0) {
						// if this contains no actual data (or is empty in mix mode), skip row
						continue;
					}

					switch(element) {
						case 0: {	// note - 4 cells
							const dn = data.toUpperCase();
							const ix = notes[type].indexOf(dn);

							// check if the note was defined
							if(ix >= 0) {
								cell.note = ix;
								break;
							}

							// load note data table
							const tbl = (await this.parent.tab.getNotes(type)).notes;
							let success = false;

							// function to keep populating the table until we find the note
							for(let i = 0;i < 256;i ++) {
								if(!notes[type][i]) {
									// load note data
									notes[type][i] = this.convertNote(tbl[i]).toUpperCase();

									if(notes[type][i] === dn) {
										// found the right note
										cell.note = i;
										success = true;
										break;
									}
								}
							}

							if(!success) {
								// failed to find anything, note is not set
								cell.note = 0;
							}
							break;
						}

						case 1: {	// instrument - 2 cells
							const value = parseInt(data, 16);
							cell.instrument = isNaN(value) ? null : value;
							break;
						}

						case 2: {	// volume - 2 cells
							const value = parseInt(data, 16);
							cell.volume = isNaN(value) ? null : value;
							break;
						}

						case 3: case 5: case 7: case 9: case 11: case 13: case 15: case 17:		// effect - 2 cells
							// TODO
							break;

						case 4: case 6: case 8: case 10: case 12: case 14: case 16: case 18:	// value - 2 cells
							// TODO
							break;
					}
				}
			}

			// reload graphics for channel
			await this.parent.scrollManager.updateDataRows(rp, sel[0].row, sel[1].row + 1, channel);
			this.parent.tab.project.dirty();
		}
	}

	/**
	 * Helper function to validate if the paste data is in the correct format, and return a more friendly format back
	 */
	private validatePaste(data:string) {
		// split the paste data as line format
		const lines = data.split("\n").map((d) => d.trim());

		// if the first line is empty, remove it
		if(lines[0].length === 0) {
			lines.shift();
		}

		// if the last line is empty, remove it
		if(lines[lines.length - 1].length === 0) {
			lines.pop();
		}

		// check that all the lines are the same length and start with a channel separator
		for(let l = 0;l < lines.length;l ++) {
			if(lines[l].length !== lines[0].length || !lines[l].startsWith("|") || !lines[l].endsWith("|")) {
				// if check failed, bail out
				return null;
			}
		}

		// convert each line into a list of tokens. Format: tokens[row][channel][element]
		const tokens:string[][][] = [];

		for(let l = 0;l < lines.length;l ++) {
			tokens[l] = [];

			// split the string to fetch channels
			const channels = lines[l].substring(1, lines[l].length - 1).split("|");

			for(const cd of channels) {
				// store all the individual elements for the channel
				tokens[l].push(cd.trim().split(" "));
			}
		}

		// validate that there is the same num of channels everywhere
		for(let l = 1;l < lines.length;l ++) {
			if(tokens[0].length !== tokens[l].length) {
				// not the correct number of channels
				return null;
			}

			// check number of elements
			for(let c = 0;c < tokens[0].length;c ++) {
				if(tokens[0][c].length !== tokens[l][c].length) {
					// not the correct number of elements
					return null;
				}
			}
		}

		// all done, return the token data
		return tokens;
	}

	/**
	 * Function to generate the selection area for paste, based on the top-left corner of the selection and data area
	 */
	private pasteSelection(tokens:string[][][], location:SingleSelection): MultiSelection {
		// generate selection base
		const sel:SingleSelection = {
			pattern: location.pattern,
			row: Math.min(location.row + tokens.length - 1, this.parent.patternLen - 1),
			channel: location.channel + tokens[0].length - 1,
			element: 0,
		};

		if(sel.channel > this.parent.channelInfo.length - 1) {
			// cap to the maximum channel
			sel.channel = this.parent.channelInfo.length - 1;
			sel.element = this.parent.channelInfo[sel.channel].elements.length - 1;

		} else {
			// find the last element in the channel that is used
			const row = tokens.length - 1, channel = tokens[row].length - 1;

			let e = tokens[row][channel].length - 1;
			for(;e >= 0;--e) {
				if(tokens[row][channel][e].replace(/\./g, "").length !== 0) {
					// if this element contains actual values, this is the first valid element. break out
					break;
				}
			}

			// calculate the element
			sel.element = Math.max(0, this.parent.channelInfo[channel + sel.channel]?.elements.indexOf(e) ?? 0);
		}

		// find the starting element for the first channel
		const max = 3 + (2 * this.parent.tab.channels[sel.channel].info.effects);
		let start = 0;

		for(;start <= max; start++) {
			if(tokens[0][0][start].replace(/\./g, "").length !== 0) {
				// if this element contains actual values, this is the first valid element. break out
				break;
			}
		}

		// calculate the element
		start = Math.max(0, this.parent.channelInfo[sel.channel]?.elements.indexOf(start) ?? 0);

		// and return the actual selection now
		return [ { ...location, element: start, }, sel, ];
	}
}
