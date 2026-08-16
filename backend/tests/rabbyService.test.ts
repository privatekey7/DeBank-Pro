import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { RabbyService, resetKeyState } from '../src/services/rabbyService';
import { CorroborationConfig, RABBY } from '../src/config';

const ADDR = '0x9f5dc2f69006fffae20247a95f1dfa0cb057bce9';
const RABBY_HOST = 'https://api.rabby.io';

const cfg: CorroborationConfig = {
  enabled: true,
  minAgree: 1, // авторитетный источник — принимаем первую выборку
  maxFetches: 8,
  relTol: 0.02,
  absTol: 1.0
};

// ProxyService читает боевой proxy.txt из корня проекта; если там прокси с
// авторизацией, nock не сможет перехватить туннель. Подменяем на «без прокси».
const makeService = (): RabbyService => {
  const service = new RabbyService(cfg);
  vi.spyOn((service as any).proxyService, 'getNextProxy').mockReturnValue(null);
  return service;
};

// Мокаем ТОЛЬКО внешнюю HTTP-границу (Rabby API), а не наш код.
const mockRabby = (opts: {
  totalUsd: number;
  chains: { id: string; usd_value: number }[];
  tokens?: any[];
  tokensByChain?: Record<string, any[]>; // для фолбэка на по-сетевой token_list
  cacheTokensFails?: boolean;
  apps?: any[];
}) => {
  nock(RABBY_HOST)
    .get('/v1/user/total_balance')
    .query(true)
    .reply(200, {
      data: { total_usd_value: opts.totalUsd, chain_list: opts.chains }
    });

  if (opts.cacheTokensFails) {
    nock(RABBY_HOST)
      .get('/v1/user/cache_token_list')
      .query(true)
      .reply(500, {});
    const chainIds = opts.chains.filter(c => c.usd_value > 0).map(c => c.id);
    nock(RABBY_HOST)
      .get('/v1/user/token_list')
      .query(true)
      .times(chainIds.length)
      .reply(uri => {
        const chainId = new URL(RABBY_HOST + uri).searchParams.get('chain_id') || '';
        return [200, { data: opts.tokensByChain?.[chainId] ?? [] }];
      });
  } else if (opts.tokens !== undefined) {
    nock(RABBY_HOST)
      .get('/v1/user/cache_token_list')
      .query(true)
      .reply(200, { data: opts.tokens });
  }

  nock(RABBY_HOST)
    .get('/v1/user/complex_app_list')
    .query(true)
    .reply(200, { data: { apps: opts.apps ?? [], error_apps: [] } });
};

describe('RabbyService.getWalletData', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    resetKeyState();
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('берёт итог из total_usd_value НАПРЯМУЮ, а не суммой tokens+protocols', async () => {
    mockRabby({
      totalUsd: 380.0,
      chains: [{ id: 'soneium', usd_value: 371.32 }],
      tokens: [
        { symbol: 'ETH', name: 'ETH', amount: 1, price: 371.32, chain: 'soneium', is_verified: true }
      ],
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

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd).not.toBeNull();
    expect(wd!.totalValue).toBe(380.0);
    expect(wd!.tokens).toHaveLength(1);
    expect(wd!.protocols).toHaveLength(1);
  });

  it('фантомный токен в детализации НЕ раздувает итог (устранение фантом-бага)', async () => {
    mockRabby({
      totalUsd: 15.0, // авторитетный итог кошелька
      chains: [{ id: 'eth', usd_value: 15.0 }],
      tokens: [
        // «чужой» токен-фантом на миллион — попал в детализацию, но итог его игнорирует
        { symbol: 'ETH', name: 'ETH', amount: 1, price: 15, chain: 'eth', is_verified: true },
        { symbol: 'PHANTOM', name: 'X', amount: 1_000_000, price: 1, chain: 'eth', is_verified: true }
      ]
    });

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd!.totalValue).toBe(15.0); // а НЕ 1_000_015
  });

  it('токены по всем сетям — ОДНИМ запросом cache_token_list', async () => {
    mockRabby({
      totalUsd: 5,
      chains: [
        { id: 'eth', usd_value: 3 },
        { id: 'bsc', usd_value: 2 },
        { id: 'arb', usd_value: 0 } // нулевую сеть не трогаем
      ],
      tokens: [
        { symbol: 'ETH', name: 'ETH', amount: 1, price: 3, chain: 'eth', is_verified: true },
        { symbol: 'BNB', name: 'BNB', amount: 2, price: 1, chain: 'bsc', is_verified: true }
      ]
    });

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd!.totalValue).toBe(5);
    expect(wd!.tokens).toHaveLength(2);
    expect(nock.isDone()).toBe(true); // ровно 1 cache_token_list был замокан и вызван
  });

  it('при сбое cache_token_list фолбэчит на по-сетевой token_list', async () => {
    mockRabby({
      totalUsd: 7,
      chains: [{ id: 'eth', usd_value: 4 }, { id: 'bsc', usd_value: 3 }],
      cacheTokensFails: true,
      tokensByChain: {
        eth: [{ symbol: 'ETH', name: 'ETH', amount: 1, price: 4, chain: 'eth', is_verified: true }],
        bsc: [{ symbol: 'BNB', name: 'BNB', amount: 3, price: 1, chain: 'bsc', is_verified: true }]
      }
    });

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd!.totalValue).toBe(7);
    expect(wd!.tokens).toHaveLength(2);
    expect(nock.isDone()).toBe(true);
  });

  it('пустой кошелёк (chain_list пуст) не запрашивает токены вовсе', async () => {
    mockRabby({
      totalUsd: 0,
      chains: []
      // tokens не задан → cache_token_list даже не замокан: нежелательный
      // запрос упадёт из-за disableNetConnect
    });

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd!.totalValue).toBe(0);
    expect(wd!.tokens).toHaveLength(0);
    expect(nock.isDone()).toBe(true); // cache_token_list не замокан → не вызывался
  });

  it('отфильтровывает скам/неверифицированные/не-core токены из cache_token_list', async () => {
    mockRabby({
      totalUsd: 15.0,
      chains: [{ id: 'eth', usd_value: 15.0 }],
      tokens: [
        { symbol: 'ETH', name: 'ETH', amount: 1, price: 15, chain: 'eth', is_verified: true, is_core: true },
        { symbol: 'SCAM', name: 'S', amount: 5, price: 100, chain: 'eth', is_scam: true },
        { symbol: 'UNV', name: 'U', amount: 5, price: 100, chain: 'eth', is_verified: false },
        { symbol: 'NONCORE', name: 'N', amount: 5, price: 100, chain: 'eth', is_core: false }
      ]
    });

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd!.tokens).toHaveLength(1);
    expect(wd!.tokens[0].symbol).toBe('ETH');
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

    const service = makeService();
    const wd = await service.getWalletData(ADDR);

    expect(wd!.protocols[0].chain).toBe('arb');
  });
});

describe('Заголовки и ротация ключа RabbyApiClient', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    resetKeyState();
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('шлёт заголовки как клиент Rabby: x-api-time = время выдачи ключа, x-version, sec-fetch-*', async () => {
    nock(RABBY_HOST, {
      reqheaders: {
        'x-api-key': RABBY.apiKeyInit,
        'x-api-time': String(RABBY.apiKeyInitTime), // время ВЫДАЧИ, не now
        'x-api-ver': 'v2',
        'x-client': 'Rabby',
        'x-version': RABBY.clientVersion,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'none',
        'sec-fetch-storage-access': 'active',
        'accept-language': /ru/,
        dnt: '1',
        priority: 'u=1, i'
      }
    })
      .get('/v1/user/total_balance')
      .query(true)
      .reply(200, { data: { total_usd_value: 1, chain_list: [] } });

    const { RabbyApiClient } = await import('../src/services/rabbyService');
    const client = new RabbyApiClient(null, 1000);
    const total = await client.getTotalBalance(ADDR);

    expect(total.total_usd_value).toBe(1);
    expect(nock.isDone()).toBe(true);
  });

  it('ротированный x-set-api-key переживает ошибочный ответ и новый клиент', async () => {
    const rotatedKey = 'rotated-key-42';

    // Первый запрос: 429, но вместе с ним выдан новый ключ — читаем ДО ошибки.
    nock(RABBY_HOST)
      .get('/v1/user/total_balance')
      .query(true)
      .reply(429, '', { 'x-set-api-key': rotatedKey });

    const { RabbyApiClient } = await import('../src/services/rabbyService');
    const first = new RabbyApiClient(null, 1000);
    await expect(first.getTotalBalance(ADDR)).rejects.toThrow();

    // Новый клиент (новая попытка снапшота) должен продолжить с ротированным ключом.
    nock(RABBY_HOST, {
      reqheaders: {
        'x-api-key': rotatedKey,
        // время ротации (now), а не init-время выдачи старого ключа
        'x-api-time': /^(?!1762656362$)\d{10}$/
      }
    })
      .get('/v1/user/total_balance')
      .query(true)
      .reply(200, { data: { total_usd_value: 2, chain_list: [] } });

    const second = new RabbyApiClient(null, 1000);
    const total = await second.getTotalBalance(ADDR);
    expect(total.total_usd_value).toBe(2);
    expect(nock.isDone()).toBe(true);
  });
});
