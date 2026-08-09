import { ProxyService } from './proxyService';
import { LoggerService } from './loggerService';
import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig, HTTP } from '../config';
import { valuesAgree, clusterRepresentative, largestAgreeingCluster } from './balanceMath';

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
export abstract class BaseBalanceService {
  protected proxyService: ProxyService;
  protected logger: LoggerService;
  protected corroboration: CorroborationConfig;
  private maxRetries = HTTP.maxRetries;
  private cache = new Map<string, { data: WalletData; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 минут

  constructor(corroboration: CorroborationConfig) {
    this.proxyService = new ProxyService();
    this.logger = LoggerService.getInstance();
    this.corroboration = corroboration;
  }

  /** Один снимок кошелька через конкретный источник. Бросает при сетевой ошибке. */
  protected abstract fetchWalletData(
    walletAddress: string,
    proxy: ProxyConfig | null
  ): Promise<WalletData>;

  public getWalletData = async (walletAddress: string): Promise<WalletData | null> => {
    const cached = this.cache.get(walletAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.logger.addProcessingStep(walletAddress, 'Данные получены из кэша');
      return cached.data;
    }

    this.logger.startWalletDebug(walletAddress);
    this.logger.addProcessingStep(walletAddress, 'Начало обработки кошелька');

    let lastError: Error | null = null;
    const snapshots: WalletData[] = [];
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

      let data: WalletData;
      try {
        this.logger.addProcessingStep(walletAddress, `Попытка ${attempt}/${maxAttempts} с прокси: ${proxyKey}`);
        data = await this.fetchWalletData(walletAddress, proxy);
        if (proxy) {
          this.proxyService.markProxyAsWorking(proxy);
        }
      } catch (error) {
        lastError = error as Error;
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
      const cluster = snapshots.filter(s => valuesAgree(s.totalValue, data.totalValue, this.corroboration));
      if (cluster.length >= this.corroboration.minAgree) {
        const chosen = clusterRepresentative(cluster);
        this.cache.set(walletAddress, { data: chosen, timestamp: Date.now() });
        this.logger.addProcessingStep(
          walletAddress,
          `Баланс подтверждён (${cluster.length} согласованных выборок): $${chosen.totalValue.toFixed(2)}`
        );
        return chosen;
      }
    }

    // Бюджет исчерпан без подтверждения — консервативный результат.
    if (snapshots.length > 0) {
      const chosen = clusterRepresentative(largestAgreeingCluster(snapshots, this.corroboration));
      this.cache.set(walletAddress, { data: chosen, timestamp: Date.now() });
      const others = snapshots.map(s => s.totalValue.toFixed(2)).sort();
      this.logger.addError(
        walletAddress,
        `Баланс не подтверждён (возможен фантом), взято консервативное значение $${chosen.totalValue.toFixed(2)}; выборки: [${others.join(', ')}]`
      );
      return chosen;
    }

    this.logger.addError(walletAddress, `Не удалось получить данные после ${maxAttempts} попыток: ${lastError}`);
    return null;
  };

  public getProxyStatus = () => ({
    total: this.proxyService.getProxyCount(),
    working: this.proxyService.getWorkingProxyCount()
  });

  public getProxyStats = () => this.proxyService.getProxyStats();

  public clearCache = () => {
    this.cache.clear();
    this.logger.debug('Кэш очищен');
  };

  public getCacheStats = () => {
    const now = Date.now();
    const validEntries = Array.from(this.cache.entries()).filter(
      ([, entry]) => now - entry.timestamp < this.cacheTimeout
    );

    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      cacheTimeout: this.cacheTimeout
    };
  };
}
