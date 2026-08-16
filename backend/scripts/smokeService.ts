/**
 * Live e2e-проверка полного пути RabbyService.getWalletData (первые N
 * кошельков из wallets.txt, реальные прокси из proxy.txt).
 *
 * Запуск из backend/: npx ts-node scripts/smokeService.ts [N]
 */
import fs from 'fs';
import path from 'path';
import { RabbyService } from '../src/services/rabbyService';
import { CORROBORATION } from '../src/config';

const run = async () => {
  const n = parseInt(process.argv[2] || '5', 10);
  const addresses = fs
    .readFileSync(path.join(__dirname, '../../wallets.txt'), 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('0x'))
    .slice(0, n);

  const service = new RabbyService(CORROBORATION);

  const t0 = Date.now();
  const results = await Promise.all(
    addresses.map(async addr => {
      const t = Date.now();
      try {
        const wd = await service.getWalletData(addr);
        return `${addr.slice(0, 10)}… ${wd ? `OK $${wd.totalValue.toFixed(2)} (${wd.tokens.length} токенов, ${wd.protocols.length} протоколов)` : 'NULL'}`;
      } catch (e: any) {
        return `${addr.slice(0, 10)}… THROW ${e?.message}`;
      } finally {
        void ((Date.now() - t) / 1000).toFixed(1);
      }
    })
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  for (const r of results) console.log(r);
  console.log(`\nE2E OK: ${addresses.length} кошельков за ${elapsed}s (${service.getProxyStatus().working}/${service.getProxyStatus().total} прокси рабочие)`);
};

run().catch(err => {
  console.error('E2E FAIL:', err?.message ?? err);
  process.exit(1);
});
