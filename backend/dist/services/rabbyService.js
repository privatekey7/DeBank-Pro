"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbyService = exports.RabbyApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const config_1 = require("../config");
const apiSigner_1 = require("./apiSigner");
const walletBuilder_1 = require("./walletBuilder");
const baseBalanceService_1 = require("./baseBalanceService");
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const buildProxyUrl = (proxy) => {
    const auth = proxy.username && proxy.password
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
class RabbyApiClient {
    constructor(proxy, timeout) {
        this.apiKey = config_1.RABBY.apiKeyInit;
        this.initTs = Math.floor(Date.now() / 1000);
        this.buildHeaders = (params, method, path) => {
            const sign = (0, apiSigner_1.signRequest)(config_1.RABBY.signPrefix, method, path, params);
            return {
                'User-Agent': USER_AGENT,
                'X-API-Key': this.apiKey,
                'X-API-Time': String(this.initTs),
                'x-api-ts': String(sign.ts),
                'x-api-nonce': sign.nonce,
                'x-api-ver': sign.version,
                'x-api-sign': sign.signature,
                'x-client': 'Rabby',
                'x-version': config_1.RABBY.clientVersion
            };
        };
        this.get = async (path, params) => {
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
        this.getTotalBalance = async (address) => {
            const result = await this.get('/v1/user/total_balance', {
                id: address.toLowerCase(),
                is_core: String(config_1.RABBY.isCore)
            });
            return {
                total_usd_value: result?.total_usd_value ?? 0,
                chain_list: Array.isArray(result?.chain_list) ? result.chain_list : []
            };
        };
        /** Токены одной сети. `is_all=false` = только проверенные (core). */
        this.getTokenList = async (address, chainId) => {
            const result = await this.get('/v1/user/token_list', {
                id: address.toLowerCase(),
                chain_id: chainId,
                is_all: 'false'
            });
            return Array.isArray(result) ? result : [];
        };
        /** DeFi-протоколы с позициями. Возвращает `{ apps, error_apps }`. */
        this.getComplexAppList = async (address) => {
            const result = await this.get('/v1/user/complex_app_list', { id: address.toLowerCase() });
            return Array.isArray(result?.apps) ? result.apps : [];
        };
        let agent;
        if (proxy) {
            const url = buildProxyUrl(proxy);
            agent = proxy.protocol.startsWith('socks')
                ? new socks_proxy_agent_1.SocksProxyAgent(url)
                : new https_proxy_agent_1.HttpsProxyAgent(url);
        }
        this.http = axios_1.default.create({
            baseURL: config_1.RABBY.apiBase,
            timeout,
            httpsAgent: agent,
            httpAgent: agent,
            proxy: false
        });
    }
}
exports.RabbyApiClient = RabbyApiClient;
/**
 * Источник баланса на Rabby API. Итог берётся из `total_balance.total_usd_value`
 * НАПРЯМУЮ (авторитетный агрегат уже включает токены + DeFi), а не ручным
 * суммированием — это устраняет корневой сценарий фантома. Токены и протоколы
 * запрашиваются дополнительно только для детализации экспорта.
 */
class RabbyService extends baseBalanceService_1.BaseBalanceService {
    constructor(corroboration) {
        super(corroboration);
        this.requestTimeout = config_1.HTTP.requestTimeoutMs;
        this.fetchWalletData = async (walletAddress, proxy) => {
            const client = new RabbyApiClient(proxy, this.requestTimeout);
            // 1. Авторитетный итог + сети (один запрос, is_core).
            const { total_usd_value, chain_list } = await client.getTotalBalance(walletAddress);
            // 2. Детализация параллельно: токены по ненулевым сетям + DeFi-протоколы.
            const nonEmptyChains = chain_list
                .filter(c => (c?.usd_value || 0) > 0 && c?.id)
                .map(c => c.id);
            const [tokenLists, apps] = await Promise.all([
                Promise.all(nonEmptyChains.map(chainId => client.getTokenList(walletAddress, chainId))),
                client.getComplexAppList(walletAddress)
            ]);
            const tokens = tokenLists.flat();
            const portfolio = this.mapAppsToPortfolio(apps);
            this.logger.addProcessingStep(walletAddress, `Rabby: итог $${total_usd_value.toFixed(2)}, сетей: ${nonEmptyChains.length}, токенов: ${tokens.length}, протоколов: ${portfolio.length}`);
            // Итог — из авторитетного агрегата (totalOverride), а НЕ сумма tokens+protocols.
            const walletData = (0, walletBuilder_1.buildWalletData)(walletAddress, tokens, portfolio, total_usd_value);
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
        this.mapAppsToPortfolio = (apps) => apps.map(app => {
            const items = app?.portfolio_item_list || [];
            const chain = items[0]?.asset_token_list?.[0]?.chain || app?.chain || 'unknown';
            return {
                id: app?.id || 'unknown',
                name: app?.name || 'Unknown Protocol',
                chain,
                logo_url: app?.logo_url,
                portfolio_item_list: items
            };
        });
    }
}
exports.RabbyService = RabbyService;
//# sourceMappingURL=rabbyService.js.map