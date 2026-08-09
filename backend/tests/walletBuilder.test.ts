import { describe, it, expect } from 'vitest';
import { buildWalletData } from '../src/services/walletBuilder';

const ADDR = '0x9f5dc2f69006fffae20247a95f1dfa0cb057bce9';

const token = (over: Record<string, any> = {}) => ({
  symbol: 'ETH',
  name: 'Ethereum',
  amount: 1,
  price: 100,
  chain: 'eth',
  is_verified: true,
  price_24h_change: 0.1,
  ...over
});

describe('buildWalletData', () => {
  it('без totalOverride: итог = сумма токенов + протоколов (легаси DeBank)', () => {
    const tokens = [token({ amount: 2, price: 50 })]; // 100
    const portfolio = [
      {
        id: 'aave',
        name: 'Aave',
        chain: 'eth',
        portfolio_item_list: [
          { stats: { net_usd_value: 40 }, asset_token_list: [{ price: 1, amount: 40, is_verified: true }] }
        ]
      }
    ];
    const wd = buildWalletData(ADDR, tokens, portfolio);
    expect(wd.totalValue).toBeCloseTo(140, 6);
  });

  it('с totalOverride: итог берётся из авторитетного агрегата напрямую (Rabby)', () => {
    const tokens = [token({ amount: 2, price: 50 })]; // detail 100
    const portfolio: any[] = [];
    const wd = buildWalletData(ADDR, tokens, portfolio, 380.0);
    // Итог НЕ равен сумме деталей — он равен authoritative override.
    expect(wd.totalValue).toBe(380.0);
  });

  it('фантомный токен НЕ раздувает итог при заданном override', () => {
    const tokens = [
      token({ symbol: 'REAL', amount: 1, price: 15 }),
      token({ symbol: 'PHANTOM', amount: 1_000_000, price: 1 }) // «чужой» токен
    ];
    const wd = buildWalletData(ADDR, tokens, [], 15.0);
    expect(wd.totalValue).toBe(15.0); // фантом в деталях не влияет на авторитетный итог
  });

  it('отбрасывает скам и неверифицированные токены из детализации', () => {
    const tokens = [
      token({ symbol: 'GOOD', is_verified: true }),
      token({ symbol: 'SCAM', is_scam: true }),
      token({ symbol: 'UNVERIFIED', is_verified: false })
    ];
    const wd = buildWalletData(ADDR, tokens, []);
    expect(wd.tokens.map(t => t.symbol)).toEqual(['GOOD']);
  });

  it('пропускает токены с нулевым/отрицательным балансом', () => {
    const tokens = [token({ symbol: 'ZERO', amount: 0 }), token({ symbol: 'OK', amount: 1 })];
    const wd = buildWalletData(ADDR, tokens, []);
    expect(wd.tokens.map(t => t.symbol)).toEqual(['OK']);
  });

  it('группирует токены по сетям и сортирует по стоимости', () => {
    const tokens = [
      token({ symbol: 'A', chain: 'eth', amount: 1, price: 10 }),
      token({ symbol: 'B', chain: 'bsc', amount: 1, price: 30 }),
      token({ symbol: 'C', chain: 'eth', amount: 1, price: 5 })
    ];
    const wd = buildWalletData(ADDR, tokens, []);
    expect(wd.chains[0].name).toBe('bsc'); // 30 > 15
    expect(wd.chains[1].name).toBe('eth');
    expect(wd.chains[1].value).toBe(15);
  });

  it('считает change24h как взвешенное по стоимости', () => {
    const tokens = [
      token({ symbol: 'A', amount: 1, price: 100, price_24h_change: 0.2 }), // вес 100
      token({ symbol: 'B', amount: 1, price: 300, price_24h_change: -0.1 }) // вес 300
    ];
    const wd = buildWalletData(ADDR, tokens, []);
    // (100*0.2 + 300*-0.1) / 400 = (20 - 30)/400 = -0.025
    expect(wd.change24h).toBeCloseTo(-0.025, 6);
  });
});
