import { WalletData } from '../types';
import { RabbyService } from './rabbyService';
/**
 * Публичный контракт источника баланса. Сервер работает через этот интерфейс
 * и не знает деталей реализации.
 */
export interface BalanceService {
    getWalletData(walletAddress: string): Promise<WalletData | null>;
    getProxyStatus(): {
        total: number;
        working: number;
    };
    getProxyStats(): ReturnType<RabbyService['getProxyStats']>;
    clearCache(): void;
    getCacheStats(): {
        totalEntries: number;
        validEntries: number;
        cacheTimeout: number;
    };
}
/**
 * Источник баланса — Rabby API (авторитетный агрегат, фантом-баг устранён).
 * Ветка DeBank удалена (как в github.com/privatekey7/DeBankChecker, PR #5):
 * итог и раньше брался только из total_usd_value.
 */
export declare const createBalanceService: () => BalanceService;
//# sourceMappingURL=balanceService.d.ts.map