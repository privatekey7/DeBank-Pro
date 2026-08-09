import { WalletData } from '../types';
import { CorroborationConfig } from '../config';
/**
 * Чистые функции для защиты от «фантомных» балансов (response contamination).
 *
 * Фантом случаен и завышает сумму → отбрасываем; истинное значение стабильно и
 * повторяется → подтверждается. Здесь только математика согласования выборок,
 * без сети и состояния — легко тестируется. (Порт CORROBORATION_* из
 * github.com/privatekey7/DeBankChecker.)
 */
/** Две суммы согласованы в пределах относительного/абсолютного допуска. */
export declare const valuesAgree: (a: number, b: number, cfg: CorroborationConfig) => boolean;
/**
 * Представитель группы: выборка с минимальным totalValue.
 * Фантом всегда завышает, поэтому консервативно берём наименьшую сумму.
 */
export declare const clusterRepresentative: (cluster: WalletData[]) => WalletData;
/**
 * Наибольшая группа выборок, согласованных по totalValue. При равенстве
 * размеров выбирается группа с НАИМЕНЬШИМ значением — консервативная защита
 * от инфляции баланса фантомом.
 */
export declare const largestAgreeingCluster: (snapshots: WalletData[], cfg: CorroborationConfig) => WalletData[];
/**
 * Стоимость позиции протокола с защитой от фантомных данных API:
 * пересчитываем из asset_token_list (без скам-токенов) и берём
 * min(api_value, recalc) — для lending api_value (залог−долг) меньше,
 * для фантомной позиции recalc = 0.
 */
export declare const safePositionValue: (item: any) => number;
//# sourceMappingURL=balanceMath.d.ts.map