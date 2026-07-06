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
const proxyService_1 = require("./proxyService");
const loggerService_1 = require("./loggerService");
const API_BASE = 'https://api.debank.com';
const API_KEY_INIT = '3b92c003-ddc1-4c2d-b36e-781838f362c5';
const NONCE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
const NONCE_LENGTH = 40;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sha256Hex = (text) => crypto_1.default.createHash('sha256').update(text, 'utf8').digest('hex');
const hmacSha256Hex = (key, msg) => crypto_1.default.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
const generateNonce = () => {
    let nonce = 'n_';
    for (let i = 0; i < NONCE_LENGTH; i++) {
        nonce += NONCE_ALPHABET[Math.floor(Math.random() * NONCE_ALPHABET.length)];
    }
    return nonce;
};
const sortParams = (params) => Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
const signRequest = (params, method, path) => {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();
    const K = sha256Hex(`debank-api\n${nonce}\n${ts}`);
    const M = sha256Hex(`${method.toUpperCase()}\n${path}\n${sortParams(params)}`);
    return { signature: hmacSha256Hex(K, M), nonce, ts, version: 'v2' };
};
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
            const sign = signRequest(params, method, path);
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
class DeBankService {
    constructor() {
        this.maxRetries = 10; // Попыток с ротацией прокси (как RETRY_ATTEMPTS в DeBankChecker)
        this.requestTimeout = 3000; // Быстрый failover при мёртвых прокси (REQUEST_TIMEOUT=3с)
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут кэш
        // --- Защита от «фантомных» балансов (response contamination) ------------
        // Под высокой конкуренцией DeBank-API иногда отдаёт ответ ОТ ДРУГОГО адреса,
        // и на кошельке с $15 «появляются» сотни тысяч. Данные внутренне консистентны,
        // одной выборкой фантом не отличить — нужна корроборация независимыми
        // запросами. Баланс принимается, только если MIN_AGREE выборок сошлись по
        // totalValue. Фантом случаен и не повторяется → отбрасываем; истинное значение
        // стабильно → подтверждается. (Порт CORROBORATION_* из DeBankChecker.)
        this.corroborationEnabled = true;
        this.corroborationMinAgree = 2; // сошедшихся выборок нужно для приёма
        this.corroborationMaxFetches = 8; // бюджет успешных выборок на кошелёк
        this.corroborationRelTol = 0.02; // относительный допуск согласия (2%)
        this.corroborationAbsTol = 1.0; // абсолютный допуск согласия (USD)
        this.getWalletData = async (walletAddress) => {
            // Проверяем кэш
            const cached = this.cache.get(walletAddress);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                this.logger.addProcessingStep(walletAddress, 'Данные получены из кэша');
                return cached.data;
            }
            this.logger.startWalletDebug(walletAddress);
            this.logger.addProcessingStep(walletAddress, 'Начало обработки кошелька');
            let lastError = null;
            const snapshots = [];
            let fetches = 0;
            // Запас попыток на сетевые сбои поверх бюджета успешных выборок.
            const maxAttempts = this.corroborationEnabled
                ? Math.max(this.maxRetries, this.corroborationMaxFetches * 3)
                : this.maxRetries;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                if (this.corroborationEnabled && fetches >= this.corroborationMaxFetches) {
                    break;
                }
                const proxy = this.proxyService.getNextProxy();
                const proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'no-proxy';
                let data;
                try {
                    this.logger.addProcessingStep(walletAddress, `Попытка ${attempt}/${maxAttempts} с прокси: ${proxyKey}`);
                    data = await this.fetchWalletData(walletAddress, proxy);
                    if (proxy) {
                        this.proxyService.markProxyAsWorking(proxy);
                    }
                }
                catch (error) {
                    lastError = error;
                    this.logger.addError(walletAddress, `Попытка ${attempt} не удалась: ${error}`);
                    // Любая сетевая ошибка → прокси в минус и сразу следующая попытка
                    // с новым прокси, без задержек (как в DeBankChecker).
                    if (proxy) {
                        this.proxyService.markProxyAsFailed(proxy);
                    }
                    continue;
                }
                fetches++;
                // Корроборация выключена — принимаем первую же успешную выборку.
                if (!this.corroborationEnabled) {
                    this.cache.set(walletAddress, { data, timestamp: Date.now() });
                    this.logger.addProcessingStep(walletAddress, 'Обработка завершена успешно');
                    return data;
                }
                // Ищем группу выборок, согласованных с текущей по totalValue.
                snapshots.push(data);
                const cluster = snapshots.filter(s => this.valuesAgree(s.totalValue, data.totalValue));
                if (cluster.length >= this.corroborationMinAgree) {
                    const chosen = this.clusterRepresentative(cluster);
                    this.cache.set(walletAddress, { data: chosen, timestamp: Date.now() });
                    this.logger.addProcessingStep(walletAddress, `Баланс подтверждён (${cluster.length} согласованных выборок): $${chosen.totalValue.toFixed(2)}`);
                    return chosen;
                }
            }
            // Бюджет исчерпан без подтверждения — берём консервативный результат:
            // наибольшую согласованную группу, при равенстве — с меньшей суммой.
            if (snapshots.length > 0) {
                const chosen = this.clusterRepresentative(this.largestAgreeingCluster(snapshots));
                this.cache.set(walletAddress, { data: chosen, timestamp: Date.now() });
                const others = snapshots.map(s => s.totalValue.toFixed(2)).sort();
                this.logger.addError(walletAddress, `Баланс не подтверждён (возможен фантом), взято консервативное значение $${chosen.totalValue.toFixed(2)}; выборки: [${others.join(', ')}]`);
                return chosen;
            }
            this.logger.addError(walletAddress, `Не удалось получить данные после ${maxAttempts} попыток: ${lastError}`);
            return null;
        };
        /** Две суммы согласованы в пределах относительного/абсолютного допуска. */
        this.valuesAgree = (a, b) => Math.abs(a - b) <= Math.max(this.corroborationAbsTol, this.corroborationRelTol * Math.max(Math.abs(a), Math.abs(b)));
        /** Представитель группы: выборка с минимальным totalValue (фантом всегда завышает). */
        this.clusterRepresentative = (cluster) => cluster.reduce((min, s) => (s.totalValue < min.totalValue ? s : min));
        /**
         * Наибольшая группа выборок, согласованных по totalValue. При равенстве
         * размеров выбирается группа с НАИМЕНЬШИМ значением — консервативная защита
         * от инфляции баланса фантомом.
         */
        this.largestAgreeingCluster = (snapshots) => {
            let best = [];
            for (const anchor of snapshots) {
                const cluster = snapshots.filter(s => this.valuesAgree(s.totalValue, anchor.totalValue));
                if (cluster.length > best.length ||
                    (cluster.length === best.length &&
                        best.length > 0 &&
                        this.clusterRepresentative(cluster).totalValue < this.clusterRepresentative(best).totalValue)) {
                    best = cluster;
                }
            }
            return best;
        };
        this.fetchWalletData = async (walletAddress, proxy) => {
            const client = new DeBankApiClient(proxy, this.requestTimeout);
            // Два запроса параллельно вместо загрузки страницы браузером
            const [tokens, portfolio] = await Promise.all([
                client.getTokenBalances(walletAddress),
                client.getPortfolio(walletAddress)
            ]);
            this.logger.addProcessingStep(walletAddress, `Получено токенов: ${tokens.length}, протоколов: ${portfolio.length}`);
            const walletData = this.processWalletData(walletAddress, tokens, portfolio);
            this.logger.setRawData(walletAddress, { token_balance_list: tokens, portfolio_list: portfolio });
            this.logger.setProcessedData(walletAddress, walletData);
            return walletData;
        };
        /**
         * Стоимость позиции протокола с защитой от фантомных данных API:
         * пересчитываем из asset_token_list (без скам-токенов) и берём
         * min(api_value, recalc) — для lending api_value (залог−долг) меньше,
         * для фантомной позиции recalc = 0.
         */
        this.safePositionValue = (item) => {
            const apiValue = Math.max(0, item?.stats?.net_usd_value || 0);
            const assetTokens = item?.asset_token_list || [];
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
        this.processWalletData = (walletAddress, tokens, portfolio) => {
            const walletData = {
                address: walletAddress,
                totalValue: 0,
                change24h: 0,
                chains: [],
                tokens: [],
                protocols: [],
                lastUpdated: new Date().toISOString()
            };
            // Токены: фильтруем скам и неверифицированные
            let totalTokensValue = 0;
            let weightedChange24h = 0;
            let changeWeight = 0;
            for (const token of tokens) {
                if (!token || !(token.amount > 0))
                    continue;
                if (token.is_verified === false || token.is_scam)
                    continue;
                const tokenValue = (token.amount * (token.price || 0)) || 0;
                walletData.tokens.push({
                    symbol: token.symbol,
                    name: token.name,
                    balance: token.amount,
                    value: tokenValue,
                    price: token.price || 0,
                    chain: token.chain || 'unknown',
                    logo: token.logo_url,
                    priceChange24h: token.price_24h_change || 0
                });
                totalTokensValue += tokenValue;
                if (token.price_24h_change !== undefined && token.price_24h_change !== null) {
                    weightedChange24h += tokenValue * token.price_24h_change;
                    changeWeight += tokenValue;
                }
            }
            // Протоколы
            let totalProtocolsValue = 0;
            for (const protocol of portfolio) {
                if (!protocol)
                    continue;
                let protocolTotalValue = 0;
                const items = protocol.portfolio_item_list || [];
                for (const item of items) {
                    protocolTotalValue += this.safePositionValue(item);
                }
                totalProtocolsValue += protocolTotalValue;
                walletData.protocols.push({
                    id: protocol.id || 'unknown',
                    name: protocol.name || 'Unknown Protocol',
                    value: protocolTotalValue,
                    chain: protocol.chain || 'unknown',
                    category: 'defi',
                    logo: protocol.logo_url || undefined
                });
            }
            walletData.totalValue = totalTokensValue + totalProtocolsValue;
            walletData.change24h = changeWeight > 0 ? weightedChange24h / changeWeight : 0;
            // Группируем токены по цепочкам
            const chainMap = new Map();
            for (const token of walletData.tokens) {
                let chain = chainMap.get(token.chain);
                if (!chain) {
                    chain = { name: token.chain, value: 0, tokens: [] };
                    chainMap.set(token.chain, chain);
                }
                chain.value += token.value;
                chain.tokens.push(token);
            }
            walletData.chains = Array.from(chainMap.values()).sort((a, b) => b.value - a.value);
            walletData.tokens.sort((a, b) => b.value - a.value);
            walletData.protocols.sort((a, b) => b.value - a.value);
            this.logger.debug(`Итог ${walletAddress}: $${walletData.totalValue.toFixed(2)} (токены: $${totalTokensValue.toFixed(2)}, протоколы: $${totalProtocolsValue.toFixed(2)})`, { walletAddress });
            return walletData;
        };
        this.getProxyStatus = () => {
            return {
                total: this.proxyService.getProxyCount(),
                working: this.proxyService.getWorkingProxyCount()
            };
        };
        this.getProxyStats = () => {
            return this.proxyService.getProxyStats();
        };
        this.clearCache = () => {
            this.cache.clear();
            this.logger.debug('Кэш очищен');
        };
        this.getCacheStats = () => {
            const now = Date.now();
            const validEntries = Array.from(this.cache.entries()).filter(([_, entry]) => now - entry.timestamp < this.cacheTimeout);
            return {
                totalEntries: this.cache.size,
                validEntries: validEntries.length,
                cacheTimeout: this.cacheTimeout
            };
        };
        this.proxyService = new proxyService_1.ProxyService();
        this.logger = loggerService_1.LoggerService.getInstance();
    }
}
exports.DeBankService = DeBankService;
//# sourceMappingURL=debankService.js.map