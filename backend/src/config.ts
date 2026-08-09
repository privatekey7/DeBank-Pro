/**
 * Конфигурация источников баланса.
 *
 * Исторически балансы брались из DeBank API, где итог считался ВРУЧНУЮ
 * (`tokens + protocols` из двух отдельных запросов). Под нагрузкой DeBank-edge
 * иногда отдаёт ответ от чужого адреса (response contamination) → «фантомные»
 * балансы. Rabby (api.rabby.io) отдаёт готовый агрегированный итог одним
 * запросом `/v1/user/total_balance`, поэтому ручного суммирования нет и
 * корневой сценарий фантома исчезает.
 *
 * Переключатель `BALANCE_SOURCE` позволяет мгновенно откатиться на DeBank
 * (feature flag / kill switch), не трогая код — как `BALANCE_SOURCE` в
 * github.com/privatekey7/DeBankChecker.
 */

export type BalanceSource = 'rabby' | 'debank';

/**
 * Активный источник баланса. Можно переопределить переменной окружения
 * `BALANCE_SOURCE=debank` без пересборки.
 */
export const BALANCE_SOURCE: BalanceSource =
  (process.env.BALANCE_SOURCE as BalanceSource) === 'debank' ? 'debank' : 'rabby';

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
 * Для Rabby источник авторитетный (готовый агрегат в одном ответе), поэтому
 * `minAgree = 1` — лишних запросов не делаем. Для DeBank оставляем прежнюю
 * корроборацию (2 согласованных выборки), т.к. там итог собирается вручную.
 */
export const CORROBORATION: Record<BalanceSource, CorroborationConfig> = {
  rabby: {
    enabled: true,
    minAgree: 1,
    maxFetches: 8,
    relTol: 0.02,
    absTol: 1.0
  },
  debank: {
    enabled: true,
    minAgree: 2,
    maxFetches: 8,
    relTol: 0.02,
    absTol: 1.0
  }
};

/** Константы Rabby API (проверены воспроизведением подписи из HAR веб-версии). */
export const RABBY = {
  apiBase: 'https://api.rabby.io',
  /** Начальный x-api-key из HAR; сервер ротирует через `x-set-api-key`. */
  apiKeyInit: '7cee6f31-6611-4821-beb8-6ca9e29ed965',
  /** Версия клиента Rabby, под которую записан HAR. */
  clientVersion: '0.94.1',
  /** Префикс строки подписи (у DeBank — `debank-api`). */
  signPrefix: 'rabby-api',
  /** Брать только проверенные (core) токены — как галка в UI Rabby. */
  isCore: true
} as const;

/** Общие сетевые параметры клиентов баланса. */
export const HTTP = {
  /** Быстрый failover при мёртвых прокси. */
  requestTimeoutMs: 3000,
  /** Попыток с ротацией прокси на сетевых сбоях. */
  maxRetries: 10
} as const;
