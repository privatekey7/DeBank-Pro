"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP = exports.RABBY = exports.CORROBORATION = void 0;
/**
 * Источник (Rabby) авторитетный — готовый агрегат в одном ответе, поэтому
 * `minAgree = 1`: лишних запросов корроборация не делает, но механика
 * остаётся как страховка.
 */
exports.CORROBORATION = {
    enabled: true,
    minAgree: 1,
    maxFetches: 8,
    relTol: 0.02,
    absTol: 1.0
};
/** Константы Rabby API (проверены воспроизведением подписи из HAR веб-версии). */
exports.RABBY = {
    apiBase: 'https://api.rabby.io',
    /** Начальный x-api-key из HAR; сервер ротирует через `x-set-api-key`. */
    apiKeyInit: '7cee6f31-6611-4821-beb8-6ca9e29ed965',
    /**
     * Время выдачи init-ключа (из HAR веб-клиента). Отправляется как x-api-time:
     * сервер ожидает время ВЫДАЧИ ключа, а не время запроса — вместе с кейсингом
     * заголовков это сверено с HAR (иначе анти-бот отвечает фейковым 429).
     */
    apiKeyInitTime: 1762656362,
    /** Версия клиента Rabby (из HAR расширения), под которую записана схема. */
    clientVersion: '0.94.2',
    /** Префикс строки подписи (у DeBank был `debank-api`). */
    signPrefix: 'rabby-api',
    /** Брать только проверенные (core) токены — как галка в UI Rabby. */
    isCore: true
};
/** Общие сетевые параметры клиентов баланса. */
exports.HTTP = {
    /** Быстрый failover при мёртвых прокси. */
    requestTimeoutMs: 3000,
    /** Попыток с ротацией прокси на сетевых сбоях. */
    maxRetries: 10
};
//# sourceMappingURL=config.js.map