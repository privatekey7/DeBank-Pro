import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { RabbyService } from '../src/services/rabbyService';
import { CorroborationConfig } from '../src/config';

const ADDR = '0x9f5dc2f69006fffae20247a95f1dfa0cb057bce9';
const RABBY = 'https://api.rabby.io';

const cfg: CorroborationConfig = {
  enabled: true,
  minAgree: 1, // авторитетный источник — принимаем первую выборку
  maxFetches: 8,
  relTol: 0.02,
  absTol: 1.0
};

// Мокаем ТОЛЬКО внешнюю HTTP-границу (Rabby API), а не наш код.
const mockRabby = (opts: {
  totalUsd: number;
  chains: { id: string; usd_value: number }[];
  tokensByChain?: Record<string, any[]>;
  apps?: any[];
}) => {
  nock(RABBY)
    .get('/v1/user/total_balance')
    .query(true)
    .reply(200, {
      data: { total_usd_value: opts.totalUsd, chain_list: opts.chains }
    });

  nock(RABBY)
    .get('/v1/user/token_list')
    .query(true)
    .times(opts.chains.filter(c => c.usd_value > 0).length)
    .reply(uri => {
      const chainId = new URL(RABBY + uri).searchParams.get('chain_id') || '';
      return [200, { data: opts.tokensByChain?.[chainId] ?? [] }];
    });

  nock(RABBY)
    .get('/v1/user/complex_app_list')
    .query(true)
    .reply(200, { data: { apps: opts.apps ?? [], error_apps: [] } });
};

describe('RabbyService.getWalletData', () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('берёт итог из total_usd_value НАПРЯМУЮ, а не суммой tokens+protocols', async () => {
    mockRabby({
      totalUsd: 380.0,
      chains: [{ id: 'soneium', usd_value: 371.32 }],
      tokensByChain: {
        soneium: [{ symbol: 'ETH', name: 'ETH', amount: 1, price: 371.32, chain: 'soneium', is_verified: true }]
      },
      apps: [
        {
          id: 'hyperliquid',
          name: 'Hyperliquid',
          portfolio_item_list: [
            { stats: { net_usd_value: 8.68 }, asset_token_list: [{ price: 1, amount: 8.68, is_verified: true }] }
          ]
        }
      ]
    });

    const service = new RabbyService(cfg);
    const wd = await service.getWalletData(ADDR);

    expect(wd).not.toBeNull();
    expect(wd!.totalValue).toBe(380.0);
    expect(wd!.tokens).toHaveLength(1);
    expect(wd!.protocols).toHaveLength(1);
  });

  it('фантомный токен в token_list НЕ раздувает итог (устранение фантом-бага)', async () => {
    mockRabby({
      totalUsd: 15.0, // авторитетный итог кошелька
      chains: [{ id: 'eth', usd_value: 15.0 }],
      tokensByChain: {
        // «чужой» токен-фантом на миллион — попал в детализацию, но итог его игнорирует
        eth: [
          { symbol: 'ETH', name: 'ETH', amount: 1, price: 15, chain: 'eth', is_verified: true },
          { symbol: 'PHANTOM', name: 'X', amount: 1_000_000, price: 1, chain: 'eth', is_verified: true }
        ]
      }
    });

    const service = new RabbyService(cfg);
    const wd = await service.getWalletData(ADDR);

    expect(wd!.totalValue).toBe(15.0); // а НЕ 1_000_015
  });

  it('запрашивает токены только по ненулевым сетям', async () => {
    mockRabby({
      totalUsd: 5,
      chains: [
        { id: 'eth', usd_value: 5 },
        { id: 'bsc', usd_value: 0 } // нулевую сеть не трогаем
      ],
      tokensByChain: {
        eth: [{ symbol: 'ETH', name: 'ETH', amount: 1, price: 5, chain: 'eth', is_verified: true }]
      }
    });

    const service = new RabbyService(cfg);
    const wd = await service.getWalletData(ADDR);

    expect(wd!.totalValue).toBe(5);
    expect(nock.isDone()).toBe(true); // ровно 1 token_list-запрос был замокан и вызван
  });

  it('переносит сеть DeFi-позиции из токена (у Rabby нет chain на уровне протокола)', async () => {
    mockRabby({
      totalUsd: 8.68,
      chains: [],
      apps: [
        {
          id: 'hyperliquid',
          name: 'Hyperliquid',
          portfolio_item_list: [
            {
              stats: { net_usd_value: 8.68 },
              asset_token_list: [{ price: 1, amount: 8.68, is_verified: true, chain: 'arb' }]
            }
          ]
        }
      ]
    });

    const service = new RabbyService(cfg);
    const wd = await service.getWalletData(ADDR);

    expect(wd!.protocols[0].chain).toBe('arb');
  });
});
