import { WalletData } from '../types';
export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: any;
    walletAddress?: string;
}
export interface DebugData {
    walletAddress: string;
    processingSteps: string[];
    networkRequests: any[];
    rawData: any;
    processedData: WalletData | null;
    errors: string[];
}
export declare class LoggerService {
    private static instance;
    private debugMode;
    private logs;
    private debugData;
    private maxLogs;
    private constructor();
    static getInstance(): LoggerService;
    setDebugMode(enabled: boolean): void;
    info(message: string, data?: any, walletAddress?: string): void;
    warn(message: string, data?: any, walletAddress?: string): void;
    error(message: string, data?: any, walletAddress?: string): void;
    debug(message: string, data?: any, walletAddress?: string): void;
    private addLog;
    startWalletDebug(walletAddress: string): void;
    addProcessingStep(walletAddress: string, step: string): void;
    addNetworkRequest(walletAddress: string, request: any): void;
    setRawData(walletAddress: string, data: any): void;
    setProcessedData(walletAddress: string, data: WalletData): void;
    addError(walletAddress: string, error: string): void;
    getLogs(level?: LogEntry['level'], limit?: number): LogEntry[];
    getDebugData(walletAddress?: string): DebugData[] | DebugData | null;
    clearLogs(): void;
    clearDebugData(walletAddress?: string): void;
    getStats(): {
        totalLogs: number;
        totalDebugData: number;
        debugMode: boolean;
    };
}
//# sourceMappingURL=loggerService.d.ts.map