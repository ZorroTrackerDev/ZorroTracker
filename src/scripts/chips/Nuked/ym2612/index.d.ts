export const YM2612: string;
export const YM3438: string;

export declare class YM {
    constructor(type: string);
    public reset(): void;
    public setType(type: string): void;
    public clock(): Array<number>;
    public write(port: number, data: number): void;
    public setTestPin(value: number): void;
    public readTestPin(): number;
    public readIrqPin(): number;
    public read(port: number): number;
    public setClockRate(clock: number, rate: number): void;
    public resetWithClockRate(clock: number, rate: number): void;
    public writeBuffered(port: number, data: number): void;
    public generateResampled(): Array<number>;
    public update(samplesSize: number): Array<number>;
}

export function newYM2612Chip(): YM;
export function newYM3438Chip(): YM;
