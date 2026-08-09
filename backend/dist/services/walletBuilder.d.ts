import { WalletData } from '../types';
/**
 * Сборка `WalletData` из сырых токенов и DeFi-протоколов.
 *
 * Общая для обоих источников (DeBank и Rabby): фильтрует скам/неверифицированные
 * токены, считает 24h-изменение как взвешенное по стоимости, группирует по сетям.
 *
 * `totalOverride` — авторитетный агрегат от источника (Rabby отдаёт готовый
 * `total_usd_value`). Если задан, итог берётся из него НАПРЯМУЮ, а не как сумма
 * `tokens + protocols`, — это устраняет корневой сценарий фантома (contamination
 * при ручном суммировании двух независимых ответов). Если не задан (DeBank),
 * поведение прежнее: итог = сумма токенов и протоколов.
 */
export declare const buildWalletData: (address: string, tokens: any[], portfolio: any[], totalOverride?: number) => WalletData;
//# sourceMappingURL=walletBuilder.d.ts.map