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
export const valuesAgree = (a: number, b: number, cfg: CorroborationConfig): boolean =>
  Math.abs(a - b) <= Math.max(cfg.absTol, cfg.relTol * Math.max(Math.abs(a), Math.abs(b)));

/**
 * Представитель группы: выборка с минимальным totalValue.
 * Фантом всегда завышает, поэтому консервативно берём наименьшую сумму.
 */
export const clusterRepresentative = (cluster: WalletData[]): WalletData =>
  cluster.reduce((min, s) => (s.totalValue < min.totalValue ? s : min));

/**
 * Наибольшая группа выборок, согласованных по totalValue. При равенстве
 * размеров выбирается группа с НАИМЕНЬШИМ значением — консервативная защита
 * от инфляции баланса фантомом.
 */
export const largestAgreeingCluster = (
  snapshots: WalletData[],
  cfg: CorroborationConfig
): WalletData[] => {
  let best: WalletData[] = [];
  for (const anchor of snapshots) {
    const cluster = snapshots.filter(s => valuesAgree(s.totalValue, anchor.totalValue, cfg));
    if (
      cluster.length > best.length ||
      (cluster.length === best.length &&
        best.length > 0 &&
        clusterRepresentative(cluster).totalValue < clusterRepresentative(best).totalValue)
    ) {
      best = cluster;
    }
  }
  return best;
};

/**
 * Стоимость позиции протокола с защитой от фантомных данных API:
 * пересчитываем из asset_token_list (без скам-токенов) и берём
 * min(api_value, recalc) — для lending api_value (залог−долг) меньше,
 * для фантомной позиции recalc = 0.
 */
export const safePositionValue = (item: any): number => {
  const apiValue = Math.max(0, item?.stats?.net_usd_value || 0);

  const assetTokens: any[] = item?.asset_token_list || [];
  if (assetTokens.length === 0) {
    return 0;
  }

  let recalc = 0;
  for (const t of assetTokens) {
    if (t.is_verified !== false && !t.is_scam) {
      recalc += (t.price || 0) * (t.amount || 0);
    }
  }
  recalc = Math.max(0, recalc);
  if (recalc === 0) {
    return 0;
  }

  return Math.min(apiValue, recalc);
};
