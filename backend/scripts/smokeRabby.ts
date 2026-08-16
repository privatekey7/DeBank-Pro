/**
 * Live smoke-тест клиента Rabby (docs-аналог инцидента 429): один кошелёк,
 * один прокси из proxy.txt. Проверяет, что заголовки проходят анти-бот
 * (никаких фейковых 429) и что cache_token_list возвращает токены.
 *
 * Запуск из backend/: node dist/scripts/smokeRabby.js
 */
import fs from 'fs';
import path from 'path';
import { RabbyApiClient } from '../src/services/rabbyService';
import { HTTP } from '../src/config';

const WALLETS = path.join(__dirname, '../../wallets.txt');
const PROXIES = path.join(__dirname, '../../proxy.txt');

const parseProxyLine = (line: string) => {
  // поддерживаем http://...@host:port, host:port:user:pass и host:port
  let protocol = 'http';
  let rest = line;
  if (line.includes('://')) {
    [protocol, rest] = line.split('://');
  }
  let username: string | undefined;
  let password: string | undefined;
  let hostPort = rest;
  if (rest.includes('@')) {
    const [auth, tail] = rest.split('@');
    [username, password] = auth.split(':');
    hostPort = tail;
  } else if ((rest.match(/:/g) || []).length === 3) {
    const parts = rest.split(':');
    username = parts[2];
    password = parts[3];
    hostPort = `${parts[0]}:${parts[1]}`;
  }
  const [host, port] = hostPort.split(':');
  return {
    host,
    port: parseInt(port),
    protocol: protocol as any,
    username,
    password
  };
};

const run = async () => {
  const address = fs
    .readFileSync(WALLETS, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('0x'))!;
  const proxyLines = fs
    .readFileSync(PROXIES, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  console.log(`Кошелёк: ${address}`);

  let lastErr: any = null;
  for (const proxyLine of proxyLines.slice(0, 8)) {
    try {
      console.log(`Прокси: ${proxyLine.replace(/^[^@]*@/, '')} (${proxyLine.includes('@') ? '' : 'без '}auth)`);

      const client = new RabbyApiClient(parseProxyLine(proxyLine), 15000);

      let t = Date.now();
      const total = await client.getTotalBalance(address);
      console.log(`total_balance: OK за ${((Date.now() - t) / 1000).toFixed(1)}s → $${total.total_usd_value}, сетей: ${total.chain_list.length}`);

      t = Date.now();
      const tokens = await client.getCacheTokenList(address);
      console.log(`cache_token_list: OK за ${((Date.now() - t) / 1000).toFixed(1)}s → токенов: ${tokens.length}`);

      t = Date.now();
      const apps = await client.getComplexAppList(address);
      console.log(`complex_app_list: OK за ${((Date.now() - t) / 1000).toFixed(1)}s → протоколов: ${apps.length}`);

      console.log('SMOKE OK: анти-бот пропустил все три запроса');
      return;
    } catch (err: any) {
      lastErr = err;
      console.log(`  → ${err?.response?.status ?? ''} ${err?.message ?? err}; пробуем следующий прокси`);
    }
  }
  throw lastErr ?? new Error('нет прокси');
};

run().catch(err => {
  console.error('SMOKE FAIL:', err?.response?.status ?? '', err?.message ?? err);
  process.exit(1);
});
