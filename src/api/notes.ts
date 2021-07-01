export enum Note {
	Null = 0,
	Rest = 1,
	First = 4,

	C0 = First + (12 * 5),
	Last = 255,
}

export const DefaultOctave = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", ];
export const OctaveSize = 12;
