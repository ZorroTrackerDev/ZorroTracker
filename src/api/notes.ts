export enum Note {
	Null = 0,
	Rest = 1,
	First = 4,

	C0 = First + (12 * 5),
	Last = 255,
}

/**
 * The number of notes in a default octave
 */
export const OctaveSize = 12;

/**
 * The note names for the default octave
 */
export const DefaultOctave = [ "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B", ];

/**
 * The sharpness styles for the default octave
 */
export const DefaultOctaveSharp:(""|"center"|"left"|"right")[] = [ "", "left", "", "right", "", "", "left",  "", "center", "", "right", "", ];
