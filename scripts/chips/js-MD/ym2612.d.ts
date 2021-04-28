export class YM2612 {
	version:number;
	start:number;
	count:number;
	chip:YMX|null;

	init:(clock?:number, rate?:number) => void;
	reset:() => void;
	/**
	 * @param address +0x100 = port2
	 */
	write:(address:number, value:number) => void;
	read:() => number;
	update:(samples:number) => Buffer;
	config:(bitcount:number) => void;
	toggle:(channel:number, mute:boolean) => void;
}

export class YMX {
	CH:[FM_CH, FM_CH, FM_CH, FM_CH, FM_CH, FM_CH];
	dacen:number;
	dacout:number;
	OPN:FM_OPN;
}

export class FM_OPN {
	// needed?
}

export class FM_CH {
	// needed?
}