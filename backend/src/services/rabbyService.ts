import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig, RABBY, HTTP } from '../config';
import { signRequest } from './apiSigner';
import { buildWalletData } from './walletBuilder';
import { BaseBalanceService } from './baseBalanceService';

// Node не умеет имперсонировать TLS-фингерпринт (в Python-эталоне это делает
// curl_cffi), поэтому UA задаём явно — «голый» axios без User-Agent палится
// сильнее всего.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const buildProxyUrl = (proxy: ProxyConfig): string => {
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : '';
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};

// Общий на процесс магазин ключа: снапшоты создают новый клиент на каждую
// попытку, а ротированный сервером ключ терять нельзя — иначе каждый клиент
// снова начнёт с init-ключа и его лимитов. Все клиенты продолжают с последнего
// выданного ключа; время выдачи нового ключа — момент ротации. Node
// однопоточен, поэтому обычного объекта достаточно (аналог _KEY_STATE в
// Python-эталоне).
interface KeyState {
  key: string;
  time: number;
}
const keyState: KeyState = { key: RABBY.apiKeyInit, time: RABBY.apiKeyInitTime };

const rotateKey = (newKey: string): number => {
  if (newKey && newKey !== keyState.key) {
    keyState.key = newKey;
    keyState.time = Math.floor(Date.now() / 1000);
  }
  return keyState.time;
};

/** Сброс магазина ключа к init-значению (для тестов). */
export const resetKeyState = (): void => {
  keyState.key = RABBY.apiKeyInit;
  keyState.time = RABBY.apiKeyInitTime;
};

/**
 * Лёгкий клиент Rabby API: подписанные HMAC-SHA256 запросы через прокси.
 *
 * Заголовки идентификации должны ТОЧНО повторять клиент Rabby (сверено с HAR
 * браузерного расширения; см. docs/incident-429-antibot.md в DeBankChecker):
 *   - подписные заголовки — в нижнем регистре (x-api-key, x-api-time, ...);
 *   - x-api-time — время ВЫДАЧИ текущего API-ключа, а не время запроса;
 *   - x-version — 0.94.2 (версия из HAR расширения);
 *   - браузерные заголовки (accept-language, dnt, priority, sec-fetch-*)
 *     досылаются поверх User-Agent.
 * Анти-бот API на любое отклонение отвечает фейковым 429 с пустым телом —
 * именно так душился /v1/user/token_list при верной подписи.
 */
export class RabbyApiClient {
  private apiKey: string;
  private keyTime: number;
  private http: AxiosInstance;

  constructor(proxy: ProxyConfig | null, timeout: number) {
    this.apiKey = keyState.key;
    this.keyTime = keyState.time;

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
    // Состав и кейсинг — строго по HAR расширения Rabby: отклонение карается
    // фейковым 429 с пустым телом.
    return {
      'User-Agent': USER_AGENT,
      accept: 'application/json, text/plain, */*',
      'accept-language': 'ru,ru-RU;q=0.9,en-US;q=0.8,en;q=0.7',
      dnt: '1',
      priority: 'u=1, i',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'none',
      'sec-fetch-storage-access': 'active',
      'x-api-key': this.apiKey,
      'x-api-time': String(this.keyTime), // время ВЫДАЧИ ключа
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

    let resp;
    try {
      resp = await this.http.get(path, { params, headers });
    } catch (error: any) {
      // Ротация ключа читается ДО выброса ошибки: сервер может выдать новый
      // ключ вместе с 429/403 — раньше (raise_for_status до чтения заголовка
      // в эталоне, axios-throw здесь) он терялся.
      const newKey = error?.response?.headers?.['x-set-api-key'];
      if (newKey) {
        this.keyTime = rotateKey(newKey);
        this.apiKey = newKey;
      }
      throw error;
    }

    const newKey = resp.headers['x-set-api-key'];
    if (newKey && newKey !== this.apiKey) {
      this.keyTime = rotateKey(newKey);
      this.apiKey = newKey;
    }

    const data = resp.data;
    if (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      Object.keys(data).every(k => k === 'data' || k === 'error_code')
    ) {
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

  /**
   * Токены кошелька по ВСЕМ сетям одним запросом (серверный кэш).
   * Заменяет десятки запросов token_list (по одному на сеть) — расширение
   * Rabby само использует этот эндпоинт для быстрой загрузки. Ответ — тот же
   * формат токенов, фильтрация на стороне чекера.
   */
  public getCacheTokenList = async (address: string): Promise<any[]> => {
    const result = await this.get('/v1/user/cache_token_list', { id: address.toLowerCase() });
    return Array.isArray(result) ? result : [];
  };

  /** Токены одной сети (фолбэк при сбое cache_token_list). `is_all=false` = только core. */
  public getTokenList = async (address: string, chainId: string): Promise<any[]> => {
    const result = await this.get('/v1/user/token_list', {
      id: address.toLowerCase(),
      chain_id: chainId,
      is_all: String(!RABBY.isCore)
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

    const nonEmptyChains = chain_list
      .filter(c => (c?.usd_value || 0) > 0 && c?.id)
      .map(c => c.id as string);

    // 2. Детализация параллельно: токены + DeFi-протоколы.
    //    Токены: все сети одним запросом (cache_token_list); при сбое —
    //    фолбэк на по-сетевой token_list. Пустой chain_list (пустой кошелёк)
    //    → запросы токенов не выполняются вовсе (так же поступает расширение).
    const [tokens, apps] = await Promise.all([
      this.fetchTokens(client, walletAddress, nonEmptyChains),
      client.getComplexAppList(walletAddress)
    ]);

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

  private fetchTokens = async (
    client: RabbyApiClient,
    address: string,
    nonEmptyChains: string[]
  ): Promise<any[]> => {
    if (nonEmptyChains.length === 0) return [];

    let tokens: any[];
    try {
      tokens = await client.getCacheTokenList(address);
    } catch {
      tokens = [];
      for (const chainId of nonEmptyChains) {
        tokens = tokens.concat(await client.getTokenList(address, chainId));
      }
    }

    // cache_token_list отдаёт всё подряд — скам/несоверифицированные/
    // не-core фильтруем сами (token_list с is_all=false уже отфильтрован
    // сервером, повторный фильтр безвреден).
    return tokens.filter(
      t =>
        t &&
        t.is_verified !== false &&
        !t.is_scam &&
        (!RABBY.isCore || t.is_core !== false)
    );
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
