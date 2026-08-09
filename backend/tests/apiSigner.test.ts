import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { signRequest, generateNonce } from '../src/services/apiSigner';

const harFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/rabby-har-signatures.json'), 'utf8')
);

describe('signRequest (Rabby)', () => {
  it('воспроизводит подписи из HAR веб-версии Rabby байт-в-байт', () => {
    for (const c of harFixture.cases) {
      const result = signRequest(harFixture.prefix, 'GET', c.path, c.params, c.nonce, c.ts);
      expect(result.signature, `подпись для ${c.path}`).toBe(c.expected);
      expect(result.nonce).toBe(c.nonce);
      expect(result.ts).toBe(c.ts);
      expect(result.version).toBe('v2');
    }
  });

  it('сортирует query-параметры по ключу независимо от порядка объекта', () => {
    const a = signRequest('rabby-api', 'GET', '/x', { b: '2', a: '1' }, 'n_test', 1000);
    const b = signRequest('rabby-api', 'GET', '/x', { a: '1', b: '2' }, 'n_test', 1000);
    expect(a.signature).toBe(b.signature);
  });

  it('меняет подпись при смене префикса (rabby-api vs debank-api)', () => {
    const rabby = signRequest('rabby-api', 'GET', '/x', { id: '0xabc' }, 'n_test', 1000);
    const debank = signRequest('debank-api', 'GET', '/x', { id: '0xabc' }, 'n_test', 1000);
    expect(rabby.signature).not.toBe(debank.signature);
  });
});

describe('generateNonce', () => {
  it('возвращает nonce вида n_ + 40 символов из алфавита клиента', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^n_[0-9A-Za-z]{40}$/);
    // Алфавит клиента Rabby/DeBank без Y и j (sic).
    expect(nonce.slice(2)).not.toMatch(/[Yj]/);
  });
});
