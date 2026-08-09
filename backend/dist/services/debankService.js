"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeBankService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const config_1 = require("../config");
const apiSigner_1 = require("./apiSigner");
const walletBuilder_1 = require("./walletBuilder");
const baseBalanceService_1 = require("./baseBalanceService");
const API_BASE = 'https://api.debank.com';
const API_KEY_INIT = '3b92c003-ddc1-4c2d-b36e-781838f362c5';
const SIGN_PREFIX = 'debank-api';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const buildProxyUrl = (proxy) => {
    const auth = proxy.username && proxy.password
        ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
        : '';
    return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};
/**
 * Лёгкий клиент DeBank API: подписанные HMAC-SHA256 запросы через прокси
 * (портировано с github.com/privatekey7/DeBankChecker).
 */
class DeBankApiClient {
    constructor(proxy, timeout) {
        this.apiKey = API_KEY_INIT;
        this.initTs = Math.floor(Date.now() / 1000);
        this.randomId = crypto_1.default.randomBytes(16).toString('hex');
        this.buildHeaders = (params, method, path) => {
            const sign = (0, apiSigner_1.signRequest)(SIGN_PREFIX, method, path, params);
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
        /** Кэшированный список токенов по всем сетям (один запрос). */
        this.getTokenBalances = async (address) => {
            const result = await this.get('/token/cache_balance_list', { user_addr: address });
            return Array.isArray(result) ? result : [];
        };
        /** DeFi протоколы с позициями. */
        this.getPortfolio = async (address) => {
            const result = await this.get('/portfolio/project_list', { user_addr: address });
            return Array.isArray(result) ? result : [];
        };
        let agent;
        if (proxy) {
            const url = buildProxyUrl(proxy);
            agent = proxy.protocol.startsWith('socks')
                ? new socks_proxy_agent_1.SocksProxyAgent(url)
                : new https_proxy_agent_1.HttpsProxyAgent(url);
        }
        this.http = axios_1.default.create({
            baseURL: API_BASE,
            timeout,
            httpsAgent: agent,
            httpAgent: agent,
            proxy: false
        });
    }
}
/**
 * Легаси-источник баланса на DeBank API. Итог собирается ВРУЧНУЮ из двух
 * запросов (tokens + protocols) → под нагрузкой возможен фантом. Оставлен как
 * fallback за флагом `BALANCE_SOURCE=debank`; актуальный источник — Rabby.
 */
class DeBankService extends baseBalanceService_1.BaseBalanceService {
    constructor(corroboration) {
        super(corroboration);
        this.requestTimeout = config_1.HTTP.requestTimeoutMs;
        this.fetchWalletData = async (walletAddress, proxy) => {
            const client = new DeBankApiClient(proxy, this.requestTimeout);
            // Два запроса параллельно вместо загрузки страницы браузером
            const [tokens, portfolio] = await Promise.all([
                client.getTokenBalances(walletAddress),
                client.getPortfolio(walletAddress)
            ]);
            this.logger.addProcessingStep(walletAddress, `Получено токенов: ${tokens.length}, протоколов: ${portfolio.length}`);
            // totalOverride не задан → итог = сумма tokens + protocols (прежнее поведение).
            const walletData = (0, walletBuilder_1.buildWalletData)(walletAddress, tokens, portfolio);
            this.logger.setRawData(walletAddress, { token_balance_list: tokens, portfolio_list: portfolio });
            this.logger.setProcessedData(walletAddress, walletData);
            return walletData;
        };
    }
}
exports.DeBankService = DeBankService;
//# sourceMappingURL=debankService.js.map