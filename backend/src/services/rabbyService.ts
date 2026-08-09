import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig, RABBY, HTTP } from '../config';
import { signRequest } from './apiSigner';
import { buildWalletData } from './walletBuilder';
import { BaseBalanceService } from './baseBalanceService';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const buildProxyUrl = (proxy: ProxyConfig): string => {
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : '';
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};

/**
 * Лёгкий клиент Rabby API: подписанные HMAC-SHA256 запросы через прокси.
 *
 * Отличия от DeBank-клиента (проверено HAR + Season12):
 *  - base URL `api.rabby.io`, префикс подписи `rabby-api`;
 *  - идентификация через `x-client: Rabby` + `x-version` (без `account`/`source`/Referer);
 *  - параметр адреса — `id` (lowercase);
 *  - начальный `x-api-key` — Rabby-ключ, ротируется через `x-set-api-key`.
 */
export class RabbyApiClient {
  private apiKey = RABBY.apiKeyInit;
  private initTs = Math.floor(Date.now() / 1000);
  private http: AxiosInstance;

  constructor(proxy: ProxyConfig | null, timeout: number) {
    let agent;
    if (proxy) {
      const url = buildProxyUrl(proxy);
      agent = proxy.protocol.startsWith('socks')
        ? new SocksProxyAgent(url)
        : new HttpsProxyAgent(url);
    }
    this.http = axios.create({
      baseURL: RABBY.apiBase,
      timeout,
      httpsAgent: agent,
      httpAgent: agent,
      proxy: false
    });
  }

  private buildHeaders = (params: Record<string, string>, method: string, path: string) => {
    const sign = signRequest(RABBY.signPrefix, method, path, params);
    return {
      'User-Agent': USER_AGENT,
      'X-API-Key': this.apiKey,
      'X-API-Time': String(this.initTs),
      'x-api-ts': String(sign.ts),
      'x-api-nonce': sign.nonce,
      'x-api-ver': sign.version,
      'x-api-sign': sign.signature,
      'x-client': 'Rabby',
      'x-version': RABBY.clientVersion
    };
  };

  private get = async (path: string, params: Record<string, string>): Promise<any> => {
    const headers = this.buildHeaders(params, 'GET', path);
    const resp = await this.http.get(path, { params, headers });

    const newKey = resp.headers['x-set-api-key'];
    if (newKey) {
      this.apiKey = newKey;
    }

    const data = resp.data;
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data;
    }
    return data;
  };

  /**
   * Готовый агрегированный баланс + разбивка по сетям (ОДИН запрос).
   * `is_core=true` отсекает скам/непроверенное — как галка в UI Rabby.
   * Возвращает `total_usd_value` и `chain_list[]`.
   */
  public getTotalBalance = async (
    address: string
  ): Promise<{ total_usd_value: number; chain_list: any[] }> => {
    const result = await this.get('/v1/user/total_balance', {
      id: address.toLowerCase(),
      is_core: String(RABBY.isCore)
    });
    return {
      total_usd_value: result?.total_usd_value ?? 0,
      chain_list: Array.isArray(result?.chain_list) ? result.chain_list : []
    };
  };

  /** Токены одной сети. `is_all=false` = только проверенные (core). */
  public getTokenList = async (address: string, chainId: string): Promise<any[]> => {
    const result = await this.get('/v1/user/token_list', {
      id: address.toLowerCase(),
      chain_id: chainId,
      is_all: 'false'
    });
    return Array.isArray(result) ? result : [];
  };

  /** DeFi-протоколы с позициями. Возвращает `{ apps, error_apps }`. */
  public getComplexAppList = async (address: string): Promise<any[]> => {
    const result = await this.get('/v1/user/complex_app_list', { id: address.toLowerCase() });
    return Array.isArray(result?.apps) ? result.apps : [];
  };
}

/**
 * Источник баланса на Rabby API. Итог берётся из `total_balance.total_usd_value`
 * НАПРЯМУЮ (авторитетный агрегат уже включает токены + DeFi), а не ручным
 * суммированием — это устраняет корневой сценарий фантома. Токены и протоколы
 * запрашиваются дополнительно только для детализации экспорта.
 */
export class RabbyService extends BaseBalanceService {
  private requestTimeout = HTTP.requestTimeoutMs;

  constructor(corroboration: CorroborationConfig) {
    super(corroboration);
  }

  protected fetchWalletData = async (
    walletAddress: string,
    proxy: ProxyConfig | null
  ): Promise<WalletData> => {
    const client = new RabbyApiClient(proxy, this.requestTimeout);

    // 1. Авторитетный итог + сети (один запрос, is_core).
    const { total_usd_value, chain_list } = await client.getTotalBalance(walletAddress);

    // 2. Детализация параллельно: токены по ненулевым сетям + DeFi-протоколы.
    const nonEmptyChains = chain_list
      .filter(c => (c?.usd_value || 0) > 0 && c?.id)
      .map(c => c.id as string);

    const [tokenLists, apps] = await Promise.all([
      Promise.all(nonEmptyChains.map(chainId => client.getTokenList(walletAddress, chainId))),
      client.getComplexAppList(walletAddress)
    ]);

    const tokens = tokenLists.flat();
    const portfolio = this.mapAppsToPortfolio(apps);

    this.logger.addProcessingStep(
      walletAddress,
      `Rabby: итог $${total_usd_value.toFixed(2)}, сетей: ${nonEmptyChains.length}, токенов: ${tokens.length}, протоколов: ${portfolio.length}`
    );

    // Итог — из авторитетного агрегата (totalOverride), а НЕ сумма tokens+protocols.
    const walletData = buildWalletData(walletAddress, tokens, portfolio, total_usd_value);
    this.logger.setRawData(walletAddress, {
      token_balance_list: tokens,
      portfolio_list: portfolio
    });
    this.logger.setProcessedData(walletAddress, walletData);

    return walletData;
  };

  /**
   * Приводим Rabby-приложения к форме DeBank-протокола, ожидаемой билдером.
   * У Rabby нет сети на уровне протокола — берём её из первого токена позиции,
   * если есть (на суммы не влияет, только на группировку в экспорте).
   */
  private mapAppsToPortfolio = (apps: any[]): any[] =>
    apps.map(app => {
      const items: any[] = app?.portfolio_item_list || [];
      const chain =
        items[0]?.asset_token_list?.[0]?.chain || app?.chain || 'unknown';
      return {
        id: app?.id || 'unknown',
        name: app?.name || 'Unknown Protocol',
        chain,
        logo_url: app?.logo_url,
        portfolio_item_list: items
      };
    });
}
