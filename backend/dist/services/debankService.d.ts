import { WalletData } from '../types';
export declare class DeBankService {
    private proxyService;
    private logger;
    private maxRetries;
    private requestTimeout;
    private cache;
    private cacheTimeout;
    private corroborationEnabled;
    private corroborationMinAgree;
    private corroborationMaxFetches;
    private corroborationRelTol;
    private corroborationAbsTol;
    constructor();
    getWalletData: (walletAddress: string) => Promise<WalletData | null>;
    /** Две суммы согласованы в пределах относительного/абсолютного допуска. */
    private valuesAgree;
    /** Представитель группы: выборка с минимальным totalValue (фантом всегда завышает). */
    private clusterRepresentative;
    /**
     * Наибольшая группа выборок, согласованных по totalValue. При равенстве
     * размеров выбирается группа с НАИМЕНЬШИМ значением — консервативная защита
     * от инфляции баланса фантомом.
     */
    private largestAgreeingCluster;
    private fetchWalletData;
    /**
     * Стоимость позиции протокола с защитой от фантомных данных API:
     * пересчитываем из asset_token_list (без скам-токенов) и берём
     * min(api_value, recalc) — для lending api_value (залог−долг) меньше,
     * для фантомной позиции recalc = 0.
     */
    private safePositionValue;
    private processWalletData;
    getProxyStatus: () => {
        total: number;
        working: number;
    };
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
    clearCache: () => void;
    getCacheStats: () => {
        totalEntries: number;
        validEntries: number;
        cacheTimeout: number;
    };
}
//# sourceMappingURL=debankService.d.ts.map