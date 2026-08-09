import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig, HTTP } from '../config';
import { signRequest } from './apiSigner';
import { buildWalletData } from './walletBuilder';
import { BaseBalanceService } from './baseBalanceService';

const API_BASE = 'https://api.debank.com';
const API_KEY_INIT = '3b92c003-ddc1-4c2d-b36e-781838f362c5';
const SIGN_PREFIX = 'debank-api';
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
 * Лёгкий клиент DeBank API: подписанные HMAC-SHA256 запросы через прокси
 * (портировано с github.com/privatekey7/DeBankChecker).
 */
class DeBankApiClient {
  private apiKey = API_KEY_INIT;
  private initTs = Math.floor(Date.now() / 1000);
  private randomId = crypto.randomBytes(16).toString('hex');
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
      baseURL: API_BASE,
      timeout,
      httpsAgent: agent,
      httpAgent: agent,
      proxy: false
    });
  }

  private buildHeaders = (params: Record<string, string>, method: string, path: string) => {
    const sign = signRequest(SIGN_PREFIX, method, path, params);
    const account = JSON.stringify({
      random_at: this.initTs,
      random_id: this.randomId,
      user_addr: null,
      connected_addr: null
    });
    return {
      'User-Agent': USER_AGENT,
      Referer: 'https://debank.com/',
      Origin: 'https://debank.com',
      'X-API-Key': this.apiKey,
      'X-API-Time': String(this.initTs),
      'x-api-ts': String(sign.ts),
      'x-api-nonce': sign.nonce,
      'x-api-ver': sign.version,
      'x-api-sign': sign.signature,
      source: 'web',
      account
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

  /** Кэшированный список токенов по всем сетям (один запрос). */
  public getTokenBalances = async (address: string): Promise<any[]> => {
    const result = await this.get('/token/cache_balance_list', { user_addr: address });
    return Array.isArray(result) ? result : [];
  };

  /** DeFi протоколы с позициями. */
  public getPortfolio = async (address: string): Promise<any[]> => {
    const result = await this.get('/portfolio/project_list', { user_addr: address });
    return Array.isArray(result) ? result : [];
  };
}

/**
 * Легаси-источник баланса на DeBank API. Итог собирается ВРУЧНУЮ из двух
 * запросов (tokens + protocols) → под нагрузкой возможен фантом. Оставлен как
 * fallback за флагом `BALANCE_SOURCE=debank`; актуальный источник — Rabby.
 */
export class DeBankService extends BaseBalanceService {
  private requestTimeout = HTTP.requestTimeoutMs;

  constructor(corroboration: CorroborationConfig) {
    super(corroboration);
  }

  protected fetchWalletData = async (
    walletAddress: string,
    proxy: ProxyConfig | null
  ): Promise<WalletData> => {
    const client = new DeBankApiClient(proxy, this.requestTimeout);

    // Два запроса параллельно вместо загрузки страницы браузером
    const [tokens, portfolio] = await Promise.all([
      client.getTokenBalances(walletAddress),
      client.getPortfolio(walletAddress)
    ]);

    this.logger.addProcessingStep(
      walletAddress,
      `Получено токенов: ${tokens.length}, протоколов: ${portfolio.length}`
    );

    // totalOverride не задан → итог = сумма tokens + protocols (прежнее поведение).
    const walletData = buildWalletData(walletAddress, tokens, portfolio);
    this.logger.setRawData(walletAddress, { token_balance_list: tokens, portfolio_list: portfolio });
    this.logger.setProcessedData(walletAddress, walletData);

    return walletData;
  };
}
