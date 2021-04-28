export class SN76489 {
	attenuation:number;

	init:(clockrate?:number, samplerate:number) => void;
	reset:() => void;
	write:(command:number) => void;
	update:(samples:number) => Buffer;
	config:(mute:number, boost:number, volume:number, feedback:number, nsw:number) => void;
}