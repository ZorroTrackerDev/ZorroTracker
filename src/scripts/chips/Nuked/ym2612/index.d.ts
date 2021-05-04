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
}

export function newYM2612Chip(): YM;
export function newYM3438Chip(): YM;
