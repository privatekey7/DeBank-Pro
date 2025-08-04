export declare class ProgressBar {
    private total;
    private current;
    private barLength;
    private startTime;
    constructor(total: number, barLength?: number);
    update(current: number): void;
    increment(): void;
    private render;
    private formatTime;
    complete(): void;
    error(message: string): void;
}
//# sourceMappingURL=progressBar.d.ts.map