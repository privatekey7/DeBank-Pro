import fs from 'fs';
import path from 'path';
import { ProxyConfig } from '../types';
import { LoggerService } from './loggerService';

export class ProxyService {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  private failedProxies = new Set<string>();
  private workingProxies = new Set<string>();
  private proxyStats = new Map<string, { success: number; fails: number; lastUsed: number; lastFailure: number }>();
  private logger: LoggerService;
  private lastResetTime = Date.now();

  constructor() {
    this.logger = LoggerService.getInstance();
    this.loadProxies();
  }

  private loadProxies = (): void => {
    try {
      const proxyFilePath = path.join(process.cwd(), '..', 'proxy.txt');
      if (!fs.existsSync(proxyFilePath)) {
        this.logger.warn('Файл proxy.txt не найден. Прокси не будут использоваться.');
        return;
      }

      const proxyContent = fs.readFileSync(proxyFilePath, 'utf-8');
      const proxyLines = proxyContent.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'));

      this.proxies = proxyLines.map(line => this.parseProxyLine(line.trim()));
      
      this.logger.info(`Загружено ${this.proxies.length} прокси`);
    } catch (error) {
      this.logger.error('Ошибка при загрузке прокси', error);
    }
  };

  private parseProxyLine = (line: string): ProxyConfig => {
    // Поддержка различных форматов прокси
    // http://user:pass@host:port
    // socks5://user:pass@host:port
    // host:port
    // user:pass@host:port
    // host:port:user:pass

    let protocol = 'http';
    let host = '';
    let port = 80;
    let username = '';
    let password = '';

    // Подсчитываем количество двоеточий для определения формата
    const colonCount = (line.match(/:/g) || []).length;

    if (line.includes('://')) {
      // Форматы с протоколом: http://user:pass@host:port или socks5://host:port
      const [protocolPart, rest] = line.split('://');
      protocol = protocolPart as 'http' | 'https' | 'socks4' | 'socks5';
      
      if (rest.includes('@')) {
        const [auth, hostPort] = rest.split('@');
        const [user, pass] = auth.split(':');
        username = user;
        password = pass;
        
        const [hostPart, portPart] = hostPort.split(':');
        host = hostPart;
        port = parseInt(portPart) || (protocol === 'https' ? 443 : 80);
      } else {
        const [hostPart, portPart] = rest.split(':');
        host = hostPart;
        port = parseInt(portPart) || (protocol === 'https' ? 443 : 80);
      }
    } else if (line.includes('@')) {
      // Формат: user:pass@host:port
      const [auth, hostPort] = line.split('@');
      const [user, pass] = auth.split(':');
      username = user;
      password = pass;
      
      const [hostPart, portPart] = hostPort.split(':');
      host = hostPart;
      port = parseInt(portPart) || 80;
    } else if (colonCount === 3) {
      // Новый формат: host:port:user:pass
      const parts = line.split(':');
      host = parts[0];
      port = parseInt(parts[1]) || 80;
      username = parts[2];
      password = parts[3];
    } else {
      // Простой формат: host:port
      const [hostPart, portPart] = line.split(':');
      host = hostPart;
      port = parseInt(portPart) || 80;
    }

    return {
      host,
      port,
      protocol: protocol as 'http' | 'https' | 'socks4' | 'socks5',
      username: username || undefined,
      password: password || undefined
    };
  };

  public getNextProxy = (): ProxyConfig | null => {
    if (this.proxies.length === 0) {
      return null;
    }

    // Фильтруем только прокси с авторизацией
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    
    if (authProxies.length === 0) {
      this.logger.debug('Нет прокси с авторизацией, используем без прокси');
      return null;
    }

    // Если все прокси неработающие, сбрасываем список неудачных каждые 10 минут
    const now = Date.now();
    if (this.failedProxies.size === authProxies.length && now - this.lastResetTime > 600000) {
      this.logger.debug('Все прокси неработающие, сбрасываем список неудачных (10 минут прошло)');
      this.failedProxies.clear();
      this.lastResetTime = now;
    }

    // Сортируем прокси по надежности (работающие прокси в приоритете)
    const sortedProxies = authProxies.sort((a, b) => {
      const aKey = `${a.protocol}://${a.host}:${a.port}`;
      const bKey = `${b.protocol}://${b.host}:${b.port}`;
      
      const aWorking = this.workingProxies.has(aKey);
      const bWorking = this.workingProxies.has(bKey);
      
      const aFailed = this.failedProxies.has(aKey);
      const bFailed = this.failedProxies.has(bKey);
      
      // Работающие прокси в приоритете
      if (aWorking && !bWorking) return -1;
      if (!aWorking && bWorking) return 1;
      
      // Неудачные прокси в конце
      if (aFailed && !bFailed) return 1;
      if (!aFailed && bFailed) return -1;
      
      // По статистике успешности
      const aStats = this.proxyStats.get(aKey) || { success: 0, fails: 0, lastUsed: 0 };
      const bStats = this.proxyStats.get(bKey) || { success: 0, fails: 0, lastUsed: 0 };
      
      const aRatio = aStats.success / (aStats.success + aStats.fails) || 0;
      const bRatio = bStats.success / (bStats.success + bStats.fails) || 0;
      
      if (aRatio !== bRatio) return bRatio - aRatio;
      
      // По времени последнего использования (менее используемые в приоритете)
      return aStats.lastUsed - bStats.lastUsed;
    });

    // Берем первый доступный прокси
    for (const proxy of sortedProxies) {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      
      // Обновляем статистику использования
      const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, lastFailure: 0 };
      stats.lastUsed = Date.now();
      this.proxyStats.set(proxyKey, stats);
      
      this.logger.debug(`Выбран прокси: ${proxy.host}:${proxy.port} (работающий: ${this.workingProxies.has(proxyKey)}, неудачный: ${this.failedProxies.has(proxyKey)})`);
      return proxy;
    }

    // Если все прокси неработающие, сбрасываем список и пробуем снова
    this.failedProxies.clear();
    this.logger.debug('Все прокси неработающие, сбрасываем список неудачных');
    return sortedProxies[0] || null;
  };

  public markProxyAsFailed = (proxy: ProxyConfig): void => {
    const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    this.failedProxies.add(proxyKey);
    this.workingProxies.delete(proxyKey);
    
    // Обновляем статистику
    const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, lastFailure: 0 };
    stats.fails++;
    stats.lastFailure = Date.now();
    this.proxyStats.set(proxyKey, stats);
    
    this.logger.debug(`Прокси ${proxyKey} помечен как неработающий (успехов: ${stats.success}, неудач: ${stats.fails})`);
  };

  public markProxyAsWorking = (proxy: ProxyConfig): void => {
    const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    this.failedProxies.delete(proxyKey);
    this.workingProxies.add(proxyKey);
    
    // Обновляем статистику
    const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, lastFailure: 0 };
    stats.success++;
    this.proxyStats.set(proxyKey, stats);
    
    this.logger.debug(`Прокси ${proxyKey} помечен как работающий (успехов: ${stats.success}, неудач: ${stats.fails})`);
  };

  public getProxyCount = (): number => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    return authProxies.length;
  };

  public getWorkingProxyCount = (): number => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    return authProxies.filter(proxy => {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      return this.workingProxies.has(proxyKey) && !this.failedProxies.has(proxyKey);
    }).length;
  };

  public reloadProxies = (): void => {
    this.proxies = [];
    this.failedProxies.clear();
    this.workingProxies.clear();
    this.proxyStats.clear();
    this.currentIndex = 0;
    this.loadProxies();
  };

  public getProxyStats = () => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    const stats = authProxies.map(proxy => {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      const proxyStats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, lastFailure: 0 };
      const successRate = proxyStats.success + proxyStats.fails > 0 
        ? (proxyStats.success / (proxyStats.success + proxyStats.fails) * 100).toFixed(1)
        : '0.0';
      
      // Определяем статус прокси на основе времени последней неудачи
      const timeSinceLastFailure = proxyStats.lastFailure > 0 ? Date.now() - proxyStats.lastFailure : Infinity;
      const isRecentlyFailed = timeSinceLastFailure < 300000; // 5 минут
      
      return {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        isWorking: this.workingProxies.has(proxyKey),
        isFailed: this.failedProxies.has(proxyKey),
        isRecentlyFailed,
        success: proxyStats.success,
        fails: proxyStats.fails,
        successRate: `${successRate}%`,
        lastUsed: proxyStats.lastUsed > 0 ? new Date(proxyStats.lastUsed).toISOString() : 'never',
        lastFailure: proxyStats.lastFailure > 0 ? new Date(proxyStats.lastFailure).toISOString() : 'never',
        timeSinceLastFailure: timeSinceLastFailure !== Infinity ? `${Math.floor(timeSinceLastFailure / 1000)}s ago` : 'never'
      };
    });

    return {
      total: authProxies.length,
      working: this.getWorkingProxyCount(),
      failed: authProxies.length - this.getWorkingProxyCount(),
      recentlyFailed: stats.filter(s => s.isRecentlyFailed).length,
      details: stats
    };
  };

  // Метод для проверки здоровья прокси
  public async checkProxyHealth(proxy: ProxyConfig): Promise<boolean> {
    try {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      
      // Простая проверка доступности прокси через Puppeteer
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: [`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`]
      });
      
      const page = await browser.newPage();
      await page.authenticate({
        username: proxy.username!,
        password: proxy.password!
      });
      
      // Пробуем загрузить простую страницу
      await page.goto('https://httpbin.org/ip', { timeout: 10000 });
      await browser.close();
      
      return true;
    } catch (error) {
      this.logger.debug(`Проверка здоровья прокси ${proxy.host}:${proxy.port} не удалась: ${error}`);
      return false;
    }
  };
} 