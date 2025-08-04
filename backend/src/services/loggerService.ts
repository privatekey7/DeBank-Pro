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

export class LoggerService {
  private static instance: LoggerService;
  private debugMode = false;
  private logs: LogEntry[] = [];
  private debugData: Map<string, DebugData> = new Map();
  private maxLogs = 10000;

  private constructor() {}

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  public info(message: string, data?: any, walletAddress?: string): void {
    this.addLog('info', message, data, walletAddress);
    if (this.debugMode) {
      console.log(`ℹ️ ${message}`, data || '');
    }
  }

  public warn(message: string, data?: any, walletAddress?: string): void {
    this.addLog('warn', message, data, walletAddress);
    console.warn(`⚠️ ${message}`, data || '');
  }

  public error(message: string, data?: any, walletAddress?: string): void {
    this.addLog('error', message, data, walletAddress);
    console.error(`❌ ${message}`, data || '');
  }

  public debug(message: string, data?: any, walletAddress?: string): void {
    this.addLog('debug', message, data, walletAddress);
    // Отладочные сообщения не выводятся в консоль, но сохраняются в памяти
  }

  private addLog(level: LogEntry['level'], message: string, data?: any, walletAddress?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      walletAddress
    };

    this.logs.push(logEntry);

    // Ограничиваем количество логов в памяти
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  public startWalletDebug(walletAddress: string): void {
    this.debugData.set(walletAddress, {
      walletAddress,
      processingSteps: [],
      networkRequests: [],
      rawData: null,
      processedData: null,
      errors: []
    });
  }

  public addProcessingStep(walletAddress: string, step: string): void {
    const debugData = this.debugData.get(walletAddress);
    if (debugData) {
      debugData.processingSteps.push(`${new Date().toISOString()}: ${step}`);
    }
  }

  public addNetworkRequest(walletAddress: string, request: any): void {
    const debugData = this.debugData.get(walletAddress);
    if (debugData) {
      debugData.networkRequests.push({
        timestamp: new Date().toISOString(),
        ...request
      });
    }
  }

  public setRawData(walletAddress: string, data: any): void {
    const debugData = this.debugData.get(walletAddress);
    if (debugData) {
      debugData.rawData = data;
    }
  }

  public setProcessedData(walletAddress: string, data: WalletData): void {
    const debugData = this.debugData.get(walletAddress);
    if (debugData) {
      debugData.processedData = data;
    }
  }

  public addError(walletAddress: string, error: string): void {
    const debugData = this.debugData.get(walletAddress);
    if (debugData) {
      debugData.errors.push(`${new Date().toISOString()}: ${error}`);
    }
  }

  public getLogs(level?: LogEntry['level'], limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  public getDebugData(walletAddress?: string): DebugData[] | DebugData | null {
    if (walletAddress) {
      return this.debugData.get(walletAddress) || null;
    }
    
    return Array.from(this.debugData.values());
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public clearDebugData(walletAddress?: string): void {
    if (walletAddress) {
      this.debugData.delete(walletAddress);
    } else {
      this.debugData.clear();
    }
  }

  public getStats(): { totalLogs: number; totalDebugData: number; debugMode: boolean } {
    return {
      totalLogs: this.logs.length,
      totalDebugData: this.debugData.size,
      debugMode: this.debugMode
    };
  }
} 