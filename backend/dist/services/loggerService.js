"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
class LoggerService {
    constructor() {
        this.debugMode = false;
        this.logs = [];
        this.debugData = new Map();
        this.maxLogs = 10000;
    }
    static getInstance() {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    info(message, data, walletAddress) {
        this.addLog('info', message, data, walletAddress);
        if (this.debugMode) {
            console.log(`ℹ️ ${message}`, data || '');
        }
    }
    warn(message, data, walletAddress) {
        this.addLog('warn', message, data, walletAddress);
        console.warn(`⚠️ ${message}`, data || '');
    }
    error(message, data, walletAddress) {
        this.addLog('error', message, data, walletAddress);
        console.error(`❌ ${message}`, data || '');
    }
    debug(message, data, walletAddress) {
        this.addLog('debug', message, data, walletAddress);
        // Отладочные сообщения не выводятся в консоль, но сохраняются в памяти
    }
    addLog(level, message, data, walletAddress) {
        const logEntry = {
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
    startWalletDebug(walletAddress) {
        this.debugData.set(walletAddress, {
            walletAddress,
            processingSteps: [],
            networkRequests: [],
            rawData: null,
            processedData: null,
            errors: []
        });
    }
    addProcessingStep(walletAddress, step) {
        const debugData = this.debugData.get(walletAddress);
        if (debugData) {
            debugData.processingSteps.push(`${new Date().toISOString()}: ${step}`);
        }
    }
    addNetworkRequest(walletAddress, request) {
        const debugData = this.debugData.get(walletAddress);
        if (debugData) {
            debugData.networkRequests.push({
                timestamp: new Date().toISOString(),
                ...request
            });
        }
    }
    setRawData(walletAddress, data) {
        const debugData = this.debugData.get(walletAddress);
        if (debugData) {
            debugData.rawData = data;
        }
    }
    setProcessedData(walletAddress, data) {
        const debugData = this.debugData.get(walletAddress);
        if (debugData) {
            debugData.processedData = data;
        }
    }
    addError(walletAddress, error) {
        const debugData = this.debugData.get(walletAddress);
        if (debugData) {
            debugData.errors.push(`${new Date().toISOString()}: ${error}`);
        }
    }
    getLogs(level, limit) {
        let filteredLogs = this.logs;
        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }
        if (limit) {
            filteredLogs = filteredLogs.slice(-limit);
        }
        return filteredLogs;
    }
    getDebugData(walletAddress) {
        if (walletAddress) {
            return this.debugData.get(walletAddress) || null;
        }
        return Array.from(this.debugData.values());
    }
    clearLogs() {
        this.logs = [];
    }
    clearDebugData(walletAddress) {
        if (walletAddress) {
            this.debugData.delete(walletAddress);
        }
        else {
            this.debugData.clear();
        }
    }
    getStats() {
        return {
            totalLogs: this.logs.length,
            totalDebugData: this.debugData.size,
            debugMode: this.debugMode
        };
    }
}
exports.LoggerService = LoggerService;
//# sourceMappingURL=loggerService.js.map