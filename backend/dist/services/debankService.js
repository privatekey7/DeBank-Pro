"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeBankService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const proxyService_1 = require("./proxyService");
const loggerService_1 = require("./loggerService");
class DeBankService {
    constructor() {
        this.maxRetries = 4; // Увеличиваем количество попыток
        this.requestTimeout = 20000; // Увеличиваем таймаут запроса
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут кэш
        this.getWalletData = async (walletAddress) => {
            // Проверяем кэш
            const cached = this.cache.get(walletAddress);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                this.logger.addProcessingStep(walletAddress, 'Данные получены из кэша');
                return cached.data;
            }
            let retries = 0;
            let lastError = null;
            let usedProxies = new Set();
            // Начинаем отладку для этого кошелька
            this.logger.startWalletDebug(walletAddress);
            this.logger.addProcessingStep(walletAddress, 'Начало обработки кошелька');
            while (retries < this.maxRetries) {
                let proxy = null;
                let proxyKey = 'no-proxy';
                try {
                    proxy = this.proxyService.getNextProxy();
                    proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'no-proxy';
                    // Проверяем, не использовали ли мы уже этот прокси
                    if (usedProxies.has(proxyKey)) {
                        this.logger.addProcessingStep(walletAddress, `Прокси ${proxyKey} уже использован, пропускаем`);
                        retries++;
                        continue;
                    }
                    usedProxies.add(proxyKey);
                    this.logger.addProcessingStep(walletAddress, `Попытка ${retries + 1}/${this.maxRetries} с прокси: ${proxyKey}`);
                    const data = await this.scrapeWalletData(walletAddress, proxy);
                    if (data && proxy) {
                        this.proxyService.markProxyAsWorking(proxy);
                        this.logger.addProcessingStep(walletAddress, `Прокси ${proxyKey} работает корректно`);
                    }
                    // Сохраняем в кэш
                    if (data) {
                        this.cache.set(walletAddress, { data, timestamp: Date.now() });
                    }
                    this.logger.addProcessingStep(walletAddress, 'Обработка завершена успешно');
                    return data;
                }
                catch (error) {
                    lastError = error;
                    retries++;
                    this.logger.addError(walletAddress, `Попытка ${retries} не удалась: ${error}`);
                    // Если ошибка связана с прокси, помечаем его как неработающий и сразу переходим к следующему
                    if (error instanceof Error && (error.message.includes('ERR_INVALID_AUTH_CREDENTIALS') ||
                        error.message.includes('ERR_PROXY_CONNECTION_FAILED') ||
                        error.message.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
                        error.message.includes('ERR_NO_SUPPORTED_PROXIES') ||
                        error.message.includes('timeout') ||
                        error.message.includes('ECONNRESET'))) {
                        // Помечаем прокси как неудачный
                        if (proxy) {
                            this.proxyService.markProxyAsFailed(proxy);
                            this.logger.addProcessingStep(walletAddress, `Прокси ${proxyKey} помечен как неработающий`);
                        }
                        this.logger.addProcessingStep(walletAddress, 'Ошибка прокси, переходим к следующему прокси');
                        continue; // Сразу переходим к следующей попытке без задержки
                    }
                    // Ждем перед следующей попыткой только для других ошибок
                    if (retries < this.maxRetries - 1) {
                        const delay = 2000 * retries; // Увеличиваем задержку: 0, 2, 4, 6 секунд
                        this.logger.addProcessingStep(walletAddress, `Ожидание ${delay}мс перед следующей попыткой...`);
                        await this.delay(delay);
                    }
                }
            }
            this.logger.addError(walletAddress, `Не удалось получить данные после ${this.maxRetries} попыток`);
            return null;
        };
        this.scrapeWalletData = async (walletAddress, proxy) => {
            const browser = await this.launchBrowser(proxy);
            try {
                const page = await browser.newPage();
                // Настройка таймаутов
                page.setDefaultTimeout(this.requestTimeout);
                // Устанавливаем User-Agent для большей совместимости
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                // Если есть прокси с авторизацией, настраиваем аутентификацию для этой страницы
                if (proxy && proxy.username && proxy.password) {
                    await page.authenticate({
                        username: proxy.username,
                        password: proxy.password
                    });
                }
                this.logger.addProcessingStep(walletAddress, `Переходим на страницу: https://debank.com/profile/${walletAddress}`);
                // Устанавливаем обработчики ДО перехода на страницу
                this.logger.addProcessingStep(walletAddress, 'Устанавливаем обработчики сетевых запросов...');
                const networkData = {
                    user: undefined,
                    token_balance_list: undefined,
                    portfolio_list: undefined,
                    total_net_curve: undefined
                };
                const tokenBalanceList = [];
                const portfolioList = [];
                page.on('request', (request) => {
                    const url = request.url();
                    if (url.includes('api.debank.com')) {
                        this.logger.addNetworkRequest(walletAddress, { type: 'request', url });
                        // Расширяем перехват для всех возможных эндпоинтов протоколов
                        if (url.includes('/portfolio/project_list') ||
                            url.includes('/portfolio') ||
                            url.includes('/protocol') ||
                            url.includes('/project_list') ||
                            url.includes('/user/protocol') ||
                            url.includes('/user/portfolio') ||
                            url.includes('/user/project')) {
                            this.logger.addProcessingStep(walletAddress, `Обнаружен запрос к протоколам: ${url}`);
                        }
                    }
                });
                page.on('response', async (response) => {
                    try {
                        const url = response.url();
                        // Строгая фильтрация - только нужные эндпоинты
                        if (url.includes('api.debank.com/token/balance_list?user_addr=')) {
                            this.logger.addProcessingStep(walletAddress, `Обнаружен ответ от DeBank API токенов: ${url} (статус: ${response.status()})`);
                            if (response.ok()) {
                                try {
                                    const data = await response.json();
                                    tokenBalanceList.push(data);
                                    this.logger.addProcessingStep(walletAddress, 'Данные токенов получены');
                                }
                                catch (jsonError) {
                                    this.logger.addError(walletAddress, `Ошибка парсинга JSON для токенов ${url}: ${jsonError}`);
                                }
                            }
                        }
                        else if (url.includes('api.debank.com/portfolio/project_list?user_addr=') ||
                            url.includes('api.debank.com/portfolio?user_addr=') ||
                            url.includes('api.debank.com/protocol?user_addr=') ||
                            url.includes('api.debank.com/user/protocol?user_addr=') ||
                            url.includes('api.debank.com/project_list?user_addr=') ||
                            url.includes('api.debank.com/user/portfolio?user_addr=') ||
                            url.includes('api.debank.com/user/project?user_addr=')) {
                            this.logger.addProcessingStep(walletAddress, `Обнаружен ответ от DeBank API протоколов: ${url} (статус: ${response.status()})`);
                            if (response.ok()) {
                                try {
                                    const data = await response.json();
                                    portfolioList.push(data);
                                    this.logger.addProcessingStep(walletAddress, 'Данные протоколов получены');
                                    this.logger.debug('Структура данных протоколов', { data });
                                }
                                catch (jsonError) {
                                    this.logger.addError(walletAddress, `Ошибка парсинга JSON для протоколов ${url}: ${jsonError}`);
                                }
                            }
                        }
                        else if (url.includes('api.debank.com') && url.includes('user_addr=')) {
                            // Логируем все API запросы к пользователю для отладки
                            this.logger.debug(`Другой API запрос к пользователю: ${url} (статус: ${response.status()})`, { walletAddress });
                        }
                    }
                    catch (e) {
                        this.logger.addError(walletAddress, `Ошибка обработки ответа ${response.url()}: ${e}`);
                    }
                });
                // Переход на страницу кошелька
                const url = `https://debank.com/profile/${walletAddress}`;
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 120000
                });
                this.logger.addProcessingStep(walletAddress, 'Страница загружена, ждем появления "Data updated"...');
                // Ждем появления текста "Data updated" на странице
                try {
                    await page.waitForFunction('document.body.innerText.includes("Data updated")', { timeout: 30000 } // Увеличиваем таймаут с 15 до 30 секунд
                    );
                    this.logger.addProcessingStep(walletAddress, '"Data updated" обнаружен, начинаем сбор данных...');
                }
                catch (error) {
                    this.logger.addProcessingStep(walletAddress, '"Data updated" не найден в течение 30 секунд, продолжаем сбор данных...');
                }
                // Ждем завершения всех сетевых запросов
                this.logger.addProcessingStep(walletAddress, 'Ждем завершения всех сетевых запросов...');
                await page.waitForFunction('window.performance.getEntriesByType("resource").filter(r => r.name.includes("api.debank.com")).every(r => r.responseEnd > 0)', { timeout: 20000 } // Увеличиваем таймаут с 10 до 20 секунд
                ).catch(() => {
                    this.logger.addProcessingStep(walletAddress, 'Не удалось дождаться завершения всех запросов, продолжаем...');
                });
                // Альтернативная проверка - ждем появления элементов протоколов на странице
                try {
                    await page.waitForFunction('document.querySelectorAll("[class*=\'protocol\'], [class*=\'project\'], [class*=\'portfolio\']").length > 0', { timeout: 10000 } // Увеличиваем таймаут с 5 до 10 секунд
                    );
                    this.logger.addProcessingStep(walletAddress, 'Элементы протоколов обнаружены на странице');
                }
                catch (error) {
                    this.logger.addProcessingStep(walletAddress, 'Элементы протоколов не обнаружены, продолжаем...');
                }
                // Ждем дополнительное время для сбора всех данных
                this.logger.addProcessingStep(walletAddress, 'Ждем 8 секунд для завершения сбора данных...');
                await this.delay(8000); // Увеличиваем с 3 до 8 секунд
                // Дополнительная проверка - ждем появления данных протоколов в DOM
                try {
                    await page.waitForFunction('document.querySelectorAll("[data-testid*=\'protocol\'], [data-testid*=\'project\'], [class*=\'Protocol\'], [class*=\'Project\']").length > 0', { timeout: 15000 });
                    this.logger.addProcessingStep(walletAddress, 'Элементы протоколов обнаружены в DOM');
                }
                catch (error) {
                    this.logger.addProcessingStep(walletAddress, 'Элементы протоколов не обнаружены в DOM, продолжаем...');
                }
                // Проверяем количество запросов к API протоколов
                const protocolRequests = await page.evaluate(() => {
                    const entries = performance.getEntriesByType('resource');
                    return entries.filter(entry => entry.name.includes('api.debank.com') &&
                        (entry.name.includes('portfolio') || entry.name.includes('protocol') || entry.name.includes('project'))).length;
                });
                this.logger.addProcessingStep(walletAddress, `Найдено ${protocolRequests} запросов к API протоколов`);
                // Если нет запросов к протоколам, пробуем вызвать их вручную
                if (protocolRequests === 0) {
                    this.logger.addProcessingStep(walletAddress, 'Запросы к протоколам не найдены, пробуем вызвать их вручную...');
                    try {
                        await page.evaluate((address) => {
                            // Пробуем вызвать API протоколов вручную
                            const fetchProtocols = async () => {
                                try {
                                    const response = await fetch(`https://api.debank.com/portfolio/project_list?user_addr=${address}`);
                                    if (response.ok) {
                                        const data = await response.json();
                                        globalThis.manualProtocolData = data;
                                    }
                                }
                                catch (error) {
                                    console.error('Ошибка при ручном вызове API протоколов:', error);
                                }
                            };
                            fetchProtocols();
                        }, walletAddress);
                        // Ждем немного для выполнения запроса
                        await this.delay(3000);
                        // Проверяем, получили ли мы данные
                        const manualData = await page.evaluate(() => {
                            return globalThis.manualProtocolData;
                        });
                        if (manualData) {
                            this.logger.addProcessingStep(walletAddress, 'Данные протоколов получены через ручной вызов API');
                            portfolioList.push(manualData);
                        }
                    }
                    catch (error) {
                        this.logger.addProcessingStep(walletAddress, `Ошибка при ручном вызове API протоколов: ${error}`);
                    }
                }
                // Проверяем, есть ли данные протоколов в собранных данных
                if (portfolioList.length === 0) {
                    this.logger.addProcessingStep(walletAddress, 'Данные протоколов не найдены, пробуем альтернативный метод...');
                    // Пробуем получить данные протоколов через JavaScript
                    try {
                        const protocolData = await page.evaluate(() => {
                            // Ищем данные протоколов в глобальных переменных или localStorage
                            const globalData = globalThis.__NEXT_DATA__;
                            if (globalData && globalData.props && globalData.props.pageProps) {
                                return globalData.props.pageProps;
                            }
                            // Ищем в других возможных местах
                            const appData = globalThis.appData;
                            if (appData && appData.protocols) {
                                return { protocols: appData.protocols };
                            }
                            return null;
                        });
                        if (protocolData) {
                            this.logger.addProcessingStep(walletAddress, 'Данные протоколов найдены через JavaScript');
                            portfolioList.push(protocolData);
                        }
                    }
                    catch (error) {
                        this.logger.addProcessingStep(walletAddress, `Ошибка при получении данных через JavaScript: ${error}`);
                    }
                }
                // Дополнительная проверка - ждем еще немного для завершения всех запросов
                if (portfolioList.length === 0) {
                    this.logger.addProcessingStep(walletAddress, 'Данные протоколов все еще не найдены, ждем еще 5 секунд...');
                    await this.delay(5000);
                    // Проверяем еще раз
                    const finalProtocolRequests = await page.evaluate(() => {
                        const entries = performance.getEntriesByType('resource');
                        return entries.filter(entry => entry.name.includes('api.debank.com') &&
                            (entry.name.includes('portfolio') || entry.name.includes('protocol') || entry.name.includes('project'))).length;
                    });
                    this.logger.addProcessingStep(walletAddress, `После дополнительного ожидания найдено ${finalProtocolRequests} запросов к API протоколов`);
                }
                // Добавляем собранные данные в networkData
                if (tokenBalanceList.length > 0) {
                    networkData.token_balance_list = tokenBalanceList;
                    this.logger.addProcessingStep(walletAddress, `Собрано ${tokenBalanceList.length} записей токенов`);
                }
                else {
                    this.logger.addProcessingStep(walletAddress, 'Не найдено записей токенов');
                    networkData.token_balance_list = [];
                }
                if (portfolioList.length > 0) {
                    networkData.portfolio_list = portfolioList;
                    this.logger.addProcessingStep(walletAddress, `Собрано ${portfolioList.length} записей протоколов`);
                    this.logger.debug('Детали собранных данных протоколов:', {
                        walletAddress,
                        portfolioListLength: portfolioList.length,
                        portfolioListKeys: portfolioList.map((item, index) => ({
                            index,
                            keys: Object.keys(item || {}),
                            hasData: !!item.data,
                            dataLength: Array.isArray(item.data) ? item.data.length : 'not array'
                        }))
                    });
                }
                else {
                    this.logger.addProcessingStep(walletAddress, 'Не найдено записей протоколов');
                    this.logger.debug('Проблема с получением данных протоколов:', {
                        walletAddress,
                        networkRequests: tokenBalanceList.length,
                        portfolioRequests: portfolioList.length
                    });
                    networkData.portfolio_list = [];
                }
                // Сохраняем сырые данные для отладки
                this.logger.setRawData(walletAddress, networkData);
                // Обрабатываем полученные данные
                const walletData = this.processWalletData(walletAddress, networkData);
                if (walletData) {
                    this.logger.setProcessedData(walletAddress, walletData);
                }
                this.logger.addProcessingStep(walletAddress, `Обработка завершена для кошелька ${walletAddress}`);
                return walletData;
            }
            catch (error) {
                this.logger.addError(walletAddress, `Ошибка при сборе данных: ${error}`);
                // Если ошибка связана с прокси, помечаем его как неработающий
                if (proxy && error instanceof Error && (error.message.includes('ERR_INVALID_AUTH_CREDENTIALS') ||
                    error.message.includes('ERR_PROXY_CONNECTION_FAILED') ||
                    error.message.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
                    error.message.includes('ERR_NO_SUPPORTED_PROXIES'))) {
                    this.proxyService.markProxyAsFailed(proxy);
                    this.logger.addProcessingStep(walletAddress, `Прокси ${proxy.host}:${proxy.port} помечен как неработающий из-за ошибки: ${error.message}`);
                }
                return null;
            }
            finally {
                await browser.close();
            }
        };
        this.launchBrowser = async (proxy) => {
            const launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',
                    '--disable-javascript',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-field-trial-config',
                    '--disable-ipc-flooding-protection',
                    '--memory-pressure-off',
                    '--max_old_space_size=4096'
                ]
            };
            if (proxy) {
                // Используем только хост и порт для прокси сервера
                const proxyArg = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
                launchOptions.args.push(`--proxy-server=${proxyArg}`);
                this.logger.debug(`Используется прокси: ${proxy.protocol}://${proxy.host}:${proxy.port}`);
            }
            const browser = await puppeteer_1.default.launch(launchOptions);
            // Если есть прокси с авторизацией, настраиваем аутентификацию через CDP
            if (proxy && proxy.username && proxy.password) {
                const page = await browser.newPage();
                await page.authenticate({
                    username: proxy.username,
                    password: proxy.password
                });
                await page.close();
            }
            return browser;
        };
        this.processWalletData = (walletAddress, networkData) => {
            const walletData = {
                address: walletAddress,
                totalValue: 0,
                change24h: 0,
                chains: [],
                tokens: [],
                protocols: [],
                lastUpdated: new Date().toISOString()
            };
            // Обрабатываем данные пользователя
            if (networkData.user) {
                walletData.rank = networkData.user.rank;
                walletData.age = networkData.user.age;
                walletData.followers = networkData.user.followers_count;
                walletData.following = networkData.user.following_count;
            }
            // Общий баланс будет рассчитан после обработки токенов и протоколов
            this.logger.debug('Общий баланс будет рассчитан из суммы токенов и протоколов', { walletAddress });
            // Переменные для расчета изменения за 24 часа
            let totalValue = 0;
            let weightedChange24h = 0;
            // Обрабатываем токены - без объединения дубликатов
            this.logger.debug('Обработка токенов...', { walletAddress });
            let totalTokensValue = 0;
            if (networkData.token_balance_list) {
                networkData.token_balance_list.forEach((chainData) => {
                    const tokens = chainData.data || chainData.tokens || [];
                    if (Array.isArray(tokens)) {
                        tokens.forEach((token) => {
                            if (token.amount > 0) {
                                const tokenValue = (token.amount * (token.price || 0)) || 0;
                                // Логируем токены с высокой стоимостью для отладки
                                if (tokenValue > 100) {
                                    this.logger.debug(`Высокий токен: ${token.symbol} - ${token.amount} x $${token.price} = $${tokenValue.toFixed(2)}`, { walletAddress });
                                }
                                // Добавляем каждый токен отдельно без проверки на дубликаты
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
                                // Добавляем к общему изменению за 24 часа (взвешенное по стоимости)
                                if (token.price_24h_change !== undefined) {
                                    const tokenChangeContribution = tokenValue * token.price_24h_change;
                                    weightedChange24h += tokenChangeContribution;
                                    totalValue += tokenValue;
                                }
                            }
                        });
                    }
                });
                // Сортируем токены по стоимости для анализа
                const sortedTokens = walletData.tokens.sort((a, b) => b.value - a.value);
                this.logger.debug('Топ-10 токенов по стоимости', {
                    walletAddress,
                    topTokens: sortedTokens.slice(0, 10).map(t => ({ symbol: t.symbol, chain: t.chain, value: t.value }))
                });
                this.logger.debug(`Общая стоимость токенов: $${totalTokensValue.toFixed(2)}`, { walletAddress });
                // Логируем стоимость по цепочкам
                const chainValues = new Map();
                walletData.tokens.forEach(token => {
                    const currentValue = chainValues.get(token.chain) || 0;
                    chainValues.set(token.chain, currentValue + token.value);
                });
                this.logger.debug('Стоимость токенов по цепочкам', {
                    walletAddress,
                    chainValues: Array.from(chainValues.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([chain, value]) => ({ chain, value }))
                });
            }
            // Обрабатываем протоколы - финальная версия
            this.logger.debug('Обработка протоколов...', { walletAddress });
            this.logger.debug('Структура networkData.portfolio_list:', {
                walletAddress,
                portfolioListLength: networkData.portfolio_list?.length,
                portfolioListType: typeof networkData.portfolio_list,
                portfolioList: networkData.portfolio_list
            });
            let totalProtocolsValue = 0;
            if (networkData.portfolio_list && networkData.portfolio_list.length > 0) {
                networkData.portfolio_list.forEach((portfolioData, index) => {
                    this.logger.debug(`Обработка portfolioData[${index}]:`, {
                        walletAddress,
                        portfolioDataType: typeof portfolioData,
                        portfolioDataKeys: Object.keys(portfolioData || {}),
                        portfolioData: portfolioData
                    });
                    // Обрабатываем данные протоколов из portfolio_list
                    if (portfolioData.data && Array.isArray(portfolioData.data)) {
                        const protocols = portfolioData.data;
                        this.logger.debug(`Найдено ${protocols.length} протоколов в portfolioData[${index}]`, { walletAddress });
                        protocols.forEach((protocol, protocolIndex) => {
                            this.logger.debug(`Обработка протокола ${protocolIndex}:`, {
                                walletAddress,
                                protocolKeys: Object.keys(protocol || {}),
                                protocol: protocol
                            });
                            let protocolTotalValue = 0;
                            // Обрабатываем portfolio_item_list для каждого протокола
                            if (protocol.portfolio_item_list && Array.isArray(protocol.portfolio_item_list)) {
                                this.logger.debug(`Протокол ${protocol.name} имеет ${protocol.portfolio_item_list.length} элементов`, { walletAddress });
                                protocol.portfolio_item_list.forEach((item, itemIndex) => {
                                    // Используем net_usd_value из stats
                                    const itemValue = item.stats?.net_usd_value || 0;
                                    protocolTotalValue += itemValue;
                                    this.logger.debug(`Элемент ${itemIndex} протокола ${protocol.name}:`, {
                                        walletAddress,
                                        itemValue,
                                        itemStats: item.stats,
                                        itemKeys: Object.keys(item || {})
                                    });
                                });
                            }
                            else {
                                this.logger.debug(`Протокол ${protocol.name} не имеет portfolio_item_list или он не является массивом`, {
                                    walletAddress,
                                    hasPortfolioItemList: !!protocol.portfolio_item_list,
                                    portfolioItemListType: typeof protocol.portfolio_item_list
                                });
                            }
                            this.logger.debug(`Протокол ${protocol.name}: общая стоимость = $${protocolTotalValue.toFixed(6)}`, { walletAddress });
                            // Логируем данные протокола для отладки логотипов
                            this.logger.debug(`Данные протокола ${protocol.name}:`, {
                                walletAddress,
                                protocolData: {
                                    id: protocol.id,
                                    name: protocol.name,
                                    logo_url: protocol.logo_url,
                                    chain: protocol.chain,
                                    hasLogo: !!protocol.logo_url
                                }
                            });
                            totalProtocolsValue += protocolTotalValue;
                            walletData.protocols.push({
                                id: protocol.id || 'unknown',
                                name: protocol.name || 'Unknown Protocol',
                                value: protocolTotalValue,
                                chain: protocol.chain || 'unknown',
                                category: 'defi',
                                logo: protocol.logo_url || undefined
                            });
                            this.logger.debug(`Добавлен протокол: ${protocol.name} - $${protocolTotalValue.toFixed(2)}`, { walletAddress });
                        });
                    }
                    else {
                        this.logger.debug(`portfolioData[${index}] не содержит массив data`, {
                            walletAddress,
                            hasData: !!portfolioData.data,
                            dataType: typeof portfolioData.data
                        });
                    }
                });
            }
            else {
                this.logger.debug('portfolio_list пуст или отсутствует', {
                    walletAddress,
                    hasPortfolioList: !!networkData.portfolio_list,
                    portfolioListLength: networkData.portfolio_list?.length
                });
            }
            this.logger.debug(`Общая стоимость протоколов: $${totalProtocolsValue.toFixed(2)}`, { walletAddress });
            // Рассчитываем общий баланс из суммы токенов и протоколов
            walletData.totalValue = totalTokensValue + totalProtocolsValue;
            // Рассчитываем изменение за 24 часа (взвешенное по стоимости)
            if (totalValue > 0) {
                walletData.change24h = weightedChange24h / totalValue;
            }
            else {
                walletData.change24h = 0;
            }
            this.logger.debug(`Общий баланс из токенов: $${totalTokensValue.toFixed(2)}`, { walletAddress });
            this.logger.debug(`Общий баланс из протоколов: $${totalProtocolsValue.toFixed(2)}`, { walletAddress });
            this.logger.debug(`Итоговый общий баланс: $${walletData.totalValue.toFixed(2)}`, { walletAddress });
            // Группируем токены по цепочкам
            const chainMap = new Map();
            walletData.tokens.forEach(token => {
                if (!chainMap.has(token.chain)) {
                    chainMap.set(token.chain, {
                        name: token.chain,
                        value: 0,
                        tokens: []
                    });
                }
                const chain = chainMap.get(token.chain);
                chain.value += token.value;
                chain.tokens.push(token);
            });
            walletData.chains = Array.from(chainMap.values());
            // Сортируем цепочки по стоимости
            walletData.chains.sort((a, b) => b.value - a.value);
            // Финальное логирование
            this.logger.debug(`Итоговый баланс кошелька ${walletAddress}: $${walletData.totalValue.toFixed(2)}`, { walletAddress });
            this.logger.debug(`Количество токенов: ${walletData.tokens.length}`, { walletAddress });
            this.logger.debug(`Количество протоколов: ${walletData.protocols.length}`, { walletAddress });
            this.logger.debug(`Количество цепочек: ${walletData.chains.length}`, { walletAddress });
            return walletData;
        };
        this.delay = (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
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