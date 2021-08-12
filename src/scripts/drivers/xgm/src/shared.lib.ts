import { PSGCMD, YMREG } from "../../../../api/chip";


/**
 * Mapping table between channel ID and hardware-based ID
 */
export const hwid = [
	YMREG.ch1, YMREG.ch2, YMREG.ch3,
	YMREG.ch1 | 4, YMREG.ch2 | 4, YMREG.ch3 | 4,
	PSGCMD.PSG1, PSGCMD.PSG2, PSGCMD.PSG3, PSGCMD.PSG4,
	0, 0,
];
