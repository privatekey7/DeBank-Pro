import crypto from 'crypto';

/**
 * Подпись запросов к DeBank/Rabby API (HMAC-SHA256).
 *
 * Алгоритм идентичен у обоих сервисов, отличается только префикс строки ключа
 * (`debank-api` / `rabby-api`) — проверено воспроизведением подписи из HAR
 * веб-версий байт-в-байт:
 *   K    = sha256("{prefix}\n{nonce}\n{ts}")
 *   M    = sha256("{METHOD}\n{path}\n{отсортированные по ключу query-параметры}")
 *   sign = HMAC-SHA256(key=K, msg=M)
 */

const NONCE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
const NONCE_LENGTH = 40;

export type SignResult = {
  signature: string;
  nonce: string;
  ts: number;
  version: string;
};

const sha256Hex = (text: string): string =>
  crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const hmacSha256Hex = (key: string, msg: string): string =>
  crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');

export const generateNonce = (): string => {
  let nonce = 'n_';
  for (let i = 0; i < NONCE_LENGTH; i++) {
    nonce += NONCE_ALPHABET[Math.floor(Math.random() * NONCE_ALPHABET.length)];
  }
  return nonce;
};

const sortParams = (params: Record<string, string>): string =>
  Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');

/**
 * Подпись запроса. `nonce`/`ts` передаются явно только в тестах — в проде
 * генерируются автоматически.
 */
export const signRequest = (
  prefix: string,
  method: string,
  path: string,
  params: Record<string, string>,
  nonce: string = generateNonce(),
  ts: number = Math.floor(Date.now() / 1000)
): SignResult => {
  const K = sha256Hex(`${prefix}\n${nonce}\n${ts}`);
  const M = sha256Hex(`${method.toUpperCase()}\n${path}\n${sortParams(params)}`);
  return { signature: hmacSha256Hex(K, M), nonce, ts, version: 'v2' };
};
