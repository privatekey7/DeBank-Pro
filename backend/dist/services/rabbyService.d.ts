import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig } from '../config';
import { BaseBalanceService } from './baseBalanceService';
/**
 * Лёгкий клиент Rabby API: подписанные HMAC-SHA256 запросы через прокси.
 *
 * Отличия от DeBank-клиента (проверено HAR + Season12):
 *  - base URL `api.rabby.io`, префикс подписи `rabby-api`;
 *  - идентификация через `x-client: Rabby` + `x-version` (без `account`/`source`/Referer);
 *  - параметр адреса — `id` (lowercase);
 *  - начальный `x-api-key` — Rabby-ключ, ротируется через `x-set-api-key`.
 */
export declare class RabbyApiClient {
    private apiKey;
    private initTs;
    private http;
    constructor(proxy: ProxyConfig | null, timeout: number);
    private buildHeaders;
    private get;
    /**
     * Готовый агрегированный баланс + разбивка по сетям (ОДИН запрос).
     * `is_core=true` отсекает скам/непроверенное — как галка в UI Rabby.
     * Возвращает `total_usd_value` и `chain_list[]`.
     */
    getTotalBalance: (address: string) => Promise<{
        total_usd_value: number;
        chain_list: any[];
    }>;
    /** Токены одной сети. `is_all=false` = только проверенные (core). */
    getTokenList: (address: string, chainId: string) => Promise<any[]>;
    /** DeFi-протоколы с позициями. Возвращает `{ apps, error_apps }`. */
    getComplexAppList: (address: string) => Promise<any[]>;
}
/**
 * Источник баланса на Rabby API. Итог берётся из `total_balance.total_usd_value`
 * НАПРЯМУЮ (авторитетный агрегат уже включает токены + DeFi), а не ручным
 * суммированием — это устраняет корневой сценарий фантома. Токены и протоколы
 * запрашиваются дополнительно только для детализации экспорта.
 */
export declare class RabbyService extends BaseBalanceService {
    private requestTimeout;
    constructor(corroboration: CorroborationConfig);
    protected fetchWalletData: (walletAddress: string, proxy: ProxyConfig | null) => Promise<WalletData>;
    /**
     * Приводим Rabby-приложения к форме DeBank-протокола, ожидаемой билдером.
     * У Rabby нет сети на уровне протокола — берём её из первого токена позиции,
     * если есть (на суммы не влияет, только на группировку в экспорте).
     */
    private mapAppsToPortfolio;
}
//# sourceMappingURL=rabbyService.d.ts.map