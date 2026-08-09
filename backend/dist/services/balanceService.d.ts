import { WalletData } from '../types';
import { BalanceSource } from '../config';
import { DeBankService } from './debankService';
/**
 * Публичный контракт источника баланса — общий для DeBank и Rabby. Сервер
 * работает через этот интерфейс и не знает, какой источник активен.
 */
export interface BalanceService {
    getWalletData(walletAddress: string): Promise<WalletData | null>;
    getProxyStatus(): {
        total: number;
        working: number;
    };
    getProxyStats(): ReturnType<DeBankService['getProxyStats']>;
    clearCache(): void;
    getCacheStats(): {
        totalEntries: number;
        validEntries: number;
        cacheTimeout: number;
    };
}
/**
 * Фабрика источника баланса по флагу `BALANCE_SOURCE`.
 * `rabby` (по умолчанию) — авторитетный агрегат, фантом-баг устранён.
 * `debank` — легаси-fallback (kill switch).
 */
export declare const createBalanceService: (source?: BalanceSource) => BalanceService;
//# sourceMappingURL=balanceService.d.ts.map