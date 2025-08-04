import { ProxyConfig } from '../types';
export declare class ProxyService {
    private proxies;
    private currentIndex;
    private failedProxies;
    private workingProxies;
    private proxyStats;
    private logger;
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
}
//# sourceMappingURL=proxyService.d.ts.map