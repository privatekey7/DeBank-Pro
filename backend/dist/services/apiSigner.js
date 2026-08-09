"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signRequest = exports.generateNonce = void 0;
const crypto_1 = __importDefault(require("crypto"));
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
const sha256Hex = (text) => crypto_1.default.createHash('sha256').update(text, 'utf8').digest('hex');
const hmacSha256Hex = (key, msg) => crypto_1.default.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
const generateNonce = () => {
    let nonce = 'n_';
    for (let i = 0; i < NONCE_LENGTH; i++) {
        nonce += NONCE_ALPHABET[Math.floor(Math.random() * NONCE_ALPHABET.length)];
    }
    return nonce;
};
exports.generateNonce = generateNonce;
const sortParams = (params) => Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
/**
 * Подпись запроса. `nonce`/`ts` передаются явно только в тестах — в проде
 * генерируются автоматически.
 */
const signRequest = (prefix, method, path, params, nonce = (0, exports.generateNonce)(), ts = Math.floor(Date.now() / 1000)) => {
    const K = sha256Hex(`${prefix}\n${nonce}\n${ts}`);
    const M = sha256Hex(`${method.toUpperCase()}\n${path}\n${sortParams(params)}`);
    return { signature: hmacSha256Hex(K, M), nonce, ts, version: 'v2' };
};
exports.signRequest = signRequest;
//# sourceMappingURL=apiSigner.js.map