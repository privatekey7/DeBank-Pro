import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig } from '../config';
import { BaseBalanceService } from './baseBalanceService';
/** Сброс магазина ключа к init-значению (для тестов). */
export declare const resetKeyState: () => void;
/**
 * Лёгкий клиент Rabby API: подписанные HMAC-SHA256 запросы через прокси.
 *
 * Заголовки идентификации должны ТОЧНО повторять клиент Rabby (сверено с HAR
 * браузерного расширения; см. docs/incident-429-antibot.md в DeBankChecker):
 *   - подписные заголовки — в нижнем регистре (x-api-key, x-api-time, ...);
 *   - x-api-time — время ВЫДАЧИ текущего API-ключа, а не время запроса;
 *   - x-version — 0.94.2 (версия из HAR расширения);
 *   - браузерные заголовки (accept-language, dnt, priority, sec-fetch-*)
 *     досылаются поверх User-Agent.
 * Анти-бот API на любое отклонение отвечает фейковым 429 с пустым телом —
 * именно так душился /v1/user/token_list при верной подписи.
 */
export declare class RabbyApiClient {
    private apiKey;
    private keyTime;
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
    /**
     * Токены кошелька по ВСЕМ сетям одним запросом (серверный кэш).
     * Заменяет десятки запросов token_list (по одному на сеть) — расширение
     * Rabby само использует этот эндпоинт для быстрой загрузки. Ответ — тот же
     * формат токенов, фильтрация на стороне чекера.
     */
    getCacheTokenList: (address: string) => Promise<any[]>;
    /** Токены одной сети (фолбэк при сбое cache_token_list). `is_all=false` = только core. */
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
    private fetchTokens;
    /**
     * Приводим Rabby-приложения к форме DeBank-протокола, ожидаемой билдером.
     * У Rabby нет сети на уровне протокола — берём её из первого токена позиции,
     * если есть (на суммы не влияет, только на группировку в экспорте).
     */
    private mapAppsToPortfolio;
}
//# sourceMappingURL=rabbyService.d.ts.map