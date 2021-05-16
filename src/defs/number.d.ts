export {};

declare global {
	interface Number {
		toHex: (digits:number) => string;
		toByte: () => string;
	}
}
