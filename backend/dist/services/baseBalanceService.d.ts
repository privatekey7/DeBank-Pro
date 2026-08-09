import { ProxyService } from './proxyService';
import { LoggerService } from './loggerService';
import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig } from '../config';
/**
 * Базовый сервис получения балансов: кэш, ротация прокси и корроборация против
 * «фантомных» балансов (response contamination). Конкретный источник (DeBank /
 * Rabby) реализует только `fetchWalletData` — один снимок кошелька через прокси.
 *
 * Под высокой конкуренцией API иногда отдаёт ответ ОТ ДРУГОГО адреса, и на
 * кошельке с $15 «появляются» сотни тысяч. Данные внутренне консистентны, одной
 * выборкой фантом не отличить — нужна корроборация независимыми запросами.
 * Баланс принимается, только если `minAgree` выборок сошлись по totalValue.
 */
export declare abstract class BaseBalanceService {
    protected proxyService: ProxyService;
    protected logger: LoggerService;
    protected corroboration: CorroborationConfig;
    private maxRetries;
    private cache;
    private cacheTimeout;
    constructor(corroboration: CorroborationConfig);
    /** Один снимок кошелька через конкретный источник. Бросает при сетевой ошибке. */
    protected abstract fetchWalletData(walletAddress: string, proxy: ProxyConfig | null): Promise<WalletData>;
    getWalletData: (walletAddress: string) => Promise<WalletData | null>;
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
//# sourceMappingURL=baseBalanceService.d.ts.map