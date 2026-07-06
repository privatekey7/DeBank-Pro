import { ProxyConfig } from '../types';
export declare class ProxyService {
    private proxies;
    private currentIndex;
    private failedProxies;
    private workingProxies;
    private proxyStats;
    private logger;
    private lastResetTime;
    constructor();
    private loadProxies;
    private parseProxyLine;
    getNextProxy: () => ProxyConfig | null;
    markProxyAsFailed: (proxy: ProxyConfig) => void;
    markProxyAsWorking: (proxy: ProxyConfig) => void;
    getProxyCount: () => number;
    getWorkingProxyCount: () => number;
    reloadProxies: () => void;
    getProxyStats: () => {
        total: number;
        working: number;
        failed: number;
        recentlyFailed: number;
        details: {
            host: string;
            port: number;
            protocol: "http" | "https" | "socks4" | "socks5";
            isWorking: boolean;
            isFailed: boolean;
            isRecentlyFailed: boolean;
            success: number;
            fails: number;
            successRate: string;
            lastUsed: string;
            lastFailure: string;
            timeSinceLastFailure: string;
        }[];
    };
    checkProxyHealth(proxy: ProxyConfig): Promise<boolean>;
}
//# sourceMappingURL=proxyService.d.ts.map