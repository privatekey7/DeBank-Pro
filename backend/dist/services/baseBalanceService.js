"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseBalanceService = void 0;
const proxyService_1 = require("./proxyService");
const loggerService_1 = require("./loggerService");
const config_1 = require("../config");
const balanceMath_1 = require("./balanceMath");
/**
 * Базовый сервис получения балансов: кэш, ротация прокси и корроборация против
 * «фантомных» балансов (response contamination). Конкретный источник (DeBank /
 * Rabby) реализует только `fetchWalletData` — один снимок кошелька через прокси.
 *
 * Под высокой конкуренцией API иногда отдаёт ответ ОТ ДРУГОГО адреса, и на
 * кошельке с $15 «появляются» сотни тысяч. Данные внутренне консистентны, одной
 * выборкой фантом не отличить — нужна корроборация независимыми запросами.
 * Баланс принимается, только если `minAgree` выборок сошлись по totalValue.
 */
class BaseBalanceService {
    constructor(corroboration) {
        this.maxRetries = config_1.HTTP.maxRetries;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
        this.getWalletData = async (walletAddress) => {
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
            const maxAttempts = this.corroboration.enabled
                ? Math.max(this.maxRetries, this.corroboration.maxFetches * 3)
                : this.maxRetries;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                if (this.corroboration.enabled && fetches >= this.corroboration.maxFetches) {
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
                    if (proxy) {
                        this.proxyService.markProxyAsFailed(proxy);
                    }
                    continue;
                }
                fetches++;
                if (!this.corroboration.enabled) {
                    this.cache.set(walletAddress, { data, timestamp: Date.now() });
                    this.logger.addProcessingStep(walletAddress, 'Обработка завершена успешно');
                    return data;
                }
                // Ищем группу выборок, согласованных с текущей по totalValue.
                snapshots.push(data);
                const cluster = snapshots.filter(s => (0, balanceMath_1.valuesAgree)(s.totalValue, data.totalValue, this.corroboration));
                if (cluster.length >= this.corroboration.minAgree) {
                    const chosen = (0, balanceMath_1.clusterRepresentative)(cluster);
                    this.cache.set(walletAddress, { data: chosen, timestamp: Date.now() });
                    this.logger.addProcessingStep(walletAddress, `Баланс подтверждён (${cluster.length} согласованных выборок): $${chosen.totalValue.toFixed(2)}`);
                    return chosen;
                }
            }
            // Бюджет исчерпан без подтверждения — консервативный результат.
            if (snapshots.length > 0) {
                const chosen = (0, balanceMath_1.clusterRepresentative)((0, balanceMath_1.largestAgreeingCluster)(snapshots, this.corroboration));
                this.cache.set(walletAddress, { data: chosen, timestamp: Date.now() });
                const others = snapshots.map(s => s.totalValue.toFixed(2)).sort();
                this.logger.addError(walletAddress, `Баланс не подтверждён (возможен фантом), взято консервативное значение $${chosen.totalValue.toFixed(2)}; выборки: [${others.join(', ')}]`);
                return chosen;
            }
            this.logger.addError(walletAddress, `Не удалось получить данные после ${maxAttempts} попыток: ${lastError}`);
            return null;
        };
        this.getProxyStatus = () => ({
            total: this.proxyService.getProxyCount(),
            working: this.proxyService.getWorkingProxyCount()
        });
        this.getProxyStats = () => this.proxyService.getProxyStats();
        this.clearCache = () => {
            this.cache.clear();
            this.logger.debug('Кэш очищен');
        };
        this.getCacheStats = () => {
            const now = Date.now();
            const validEntries = Array.from(this.cache.entries()).filter(([, entry]) => now - entry.timestamp < this.cacheTimeout);
            return {
                totalEntries: this.cache.size,
                validEntries: validEntries.length,
                cacheTimeout: this.cacheTimeout
            };
        };
        this.proxyService = new proxyService_1.ProxyService();
        this.logger = loggerService_1.LoggerService.getInstance();
        this.corroboration = corroboration;
    }
}
exports.BaseBalanceService = BaseBalanceService;
//# sourceMappingURL=baseBalanceService.js.map