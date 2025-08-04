import { WalletData } from '../types';
export declare class DeBankService {
    private proxyService;
    private logger;
    private maxRetries;
    private requestTimeout;
    private cache;
    private cacheTimeout;
    constructor();
    getWalletData: (walletAddress: string) => Promise<WalletData | null>;
    private scrapeWalletData;
    private launchBrowser;
    private processWalletData;
    private delay;
    getProxyStatus: () => {
        total: number;
        working: number;
    };
    getProxyStats: () => {
        total: number;
        working: number;
        failed: number;
        details: {
            host: string;
            port: number;
            protocol: "http" | "https" | "socks4" | "socks5";
            isWorking: boolean;
            isFailed: boolean;
            success: number;
            fails: number;
            successRate: string;
            lastUsed: string;
        }[];
    };
    clearCache: () => void;
    getCacheStats: () => {
        totalEntries: number;
        validEntries: number;
        cacheTimeout: number;
    };
}
//# sourceMappingURL=debankService.d.ts.map