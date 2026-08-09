import { describe, it, expect } from 'vitest';
import {
  valuesAgree,
  clusterRepresentative,
  largestAgreeingCluster,
  safePositionValue
} from '../src/services/balanceMath';
import { WalletData } from '../src/types';
import { CorroborationConfig } from '../src/config';

const cfg: CorroborationConfig = {
  enabled: true,
  minAgree: 2,
  maxFetches: 8,
  relTol: 0.02,
  absTol: 1.0
};

const snap = (totalValue: number): WalletData => ({
  address: '0xabc',
  totalValue,
  change24h: 0,
  chains: [],
  tokens: [],
  protocols: [],
  lastUpdated: '2026-01-01T00:00:00.000Z'
});

describe('valuesAgree', () => {
  it('согласует суммы в пределах абсолютного допуска', () => {
    expect(valuesAgree(15.0, 15.5, cfg)).toBe(true);
  });
  it('не согласует далеко расходящиеся суммы (фантом)', () => {
    expect(valuesAgree(15.0, 1_000_000, cfg)).toBe(false);
  });
  it('использует относительный допуск для крупных сумм', () => {
    expect(valuesAgree(100_000, 101_000, cfg)).toBe(true); // 1% < 2%
    expect(valuesAgree(100_000, 105_000, cfg)).toBe(false); // 5% > 2%
  });
});

describe('clusterRepresentative', () => {
  it('берёт выборку с минимальным итогом (фантом завышает)', () => {
    const chosen = clusterRepresentative([snap(15), snap(15.4), snap(14.9)]);
    expect(chosen.totalValue).toBe(14.9);
  });
});

describe('largestAgreeingCluster', () => {
  it('выбирает наибольшую согласованную группу, отбрасывая одиночный фантом', () => {
    const snapshots = [snap(15.0), snap(15.2), snap(999_999), snap(15.1)];
    const cluster = largestAgreeingCluster(snapshots, cfg);
    expect(cluster).toHaveLength(3);
    expect(clusterRepresentative(cluster).totalValue).toBe(15.0);
  });

  it('при равных размерах групп выбирает меньшую по значению (консервативно)', () => {
    const snapshots = [snap(10), snap(10.1), snap(500), snap(500.2)];
    const cluster = largestAgreeingCluster(snapshots, cfg);
    expect(clusterRepresentative(cluster).totalValue).toBe(10);
  });
});

describe('safePositionValue', () => {
  it('возвращает 0 без asset_token_list', () => {
    expect(safePositionValue({ stats: { net_usd_value: 100 } })).toBe(0);
  });

  it('берёт min(api_value, пересчёт) — защита от завышенного api_value', () => {
    const item = {
      stats: { net_usd_value: 1_000_000 },
      asset_token_list: [{ price: 2, amount: 3, is_verified: true }]
    };
    expect(safePositionValue(item)).toBe(6);
  });

  it('исключает скам/неверифицированные токены из пересчёта', () => {
    const item = {
      stats: { net_usd_value: 50 },
      asset_token_list: [
        { price: 10, amount: 2, is_verified: true }, // 20
        { price: 1000, amount: 1, is_scam: true } // игнор
      ]
    };
    expect(safePositionValue(item)).toBe(20);
  });

  it('для lending берёт меньший api_value (залог − долг)', () => {
    const item = {
      stats: { net_usd_value: 30 },
      asset_token_list: [{ price: 1, amount: 100, is_verified: true }]
    };
    expect(safePositionValue(item)).toBe(30);
  });
});
