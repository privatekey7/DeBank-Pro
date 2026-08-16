/**
 * Конфигурация источника баланса.
 *
 * Исторически балансы брались из DeBank API, где итог считался ВРУЧНУЮ
 * (`tokens + protocols` из двух отдельных запросов). Под нагрузкой DeBank-edge
 * иногда отдаёт ответ от чужого адреса (response contamination) → «фантомные»
 * балансы. Rabby (api.rabby.io) отдаёт готовый агрегированный итог одним
 * запросом `/v1/user/total_balance`, поэтому ручного суммирования нет и
 * корневой сценарий фантома исчезает.
 *
 * Ветка DeBank удалена (как в github.com/privatekey7/DeBankChecker, PR #5):
 * итог и раньше брался только из авторитетного агрегата, так что функционально
 * ничего не потеряно.
 */
/** Настройки корроборации (защита от фантомных балансов). */
export type CorroborationConfig = {
    /** Включена ли корроборация независимыми выборками. */
    enabled: boolean;
    /** Сколько согласованных выборок нужно для приёма баланса. */
    minAgree: number;
    /** Бюджет успешных выборок на кошелёк. */
    maxFetches: number;
    /** Относительный допуск согласия сумм (доля). */
    relTol: number;
    /** Абсолютный допуск согласия сумм (USD). */
    absTol: number;
};
/**
 * Источник (Rabby) авторитетный — готовый агрегат в одном ответе, поэтому
 * `minAgree = 1`: лишних запросов корроборация не делает, но механика
 * остаётся как страховка.
 */
export declare const CORROBORATION: CorroborationConfig;
/** Константы Rabby API (проверены воспроизведением подписи из HAR веб-версии). */
export declare const RABBY: {
    readonly apiBase: "https://api.rabby.io";
    /** Начальный x-api-key из HAR; сервер ротирует через `x-set-api-key`. */
    readonly apiKeyInit: "7cee6f31-6611-4821-beb8-6ca9e29ed965";
    /**
     * Время выдачи init-ключа (из HAR веб-клиента). Отправляется как x-api-time:
     * сервер ожидает время ВЫДАЧИ ключа, а не время запроса — вместе с кейсингом
     * заголовков это сверено с HAR (иначе анти-бот отвечает фейковым 429).
     */
    readonly apiKeyInitTime: 1762656362;
    /** Версия клиента Rabby (из HAR расширения), под которую записана схема. */
    readonly clientVersion: "0.94.2";
    /** Префикс строки подписи (у DeBank был `debank-api`). */
    readonly signPrefix: "rabby-api";
    /** Брать только проверенные (core) токены — как галка в UI Rabby. */
    readonly isCore: true;
};
/** Общие сетевые параметры клиентов баланса. */
export declare const HTTP: {
    /** Быстрый failover при мёртвых прокси. */
    readonly requestTimeoutMs: 3000;
    /** Попыток с ротацией прокси на сетевых сбоях. */
    readonly maxRetries: 10;
};
//# sourceMappingURL=config.d.ts.map