import { WalletData, ProxyConfig } from '../types';
import { CorroborationConfig } from '../config';
import { BaseBalanceService } from './baseBalanceService';
/**
 * Легаси-источник баланса на DeBank API. Итог собирается ВРУЧНУЮ из двух
 * запросов (tokens + protocols) → под нагрузкой возможен фантом. Оставлен как
 * fallback за флагом `BALANCE_SOURCE=debank`; актуальный источник — Rabby.
 */
export declare class DeBankService extends BaseBalanceService {
    private requestTimeout;
    constructor(corroboration: CorroborationConfig);
    protected fetchWalletData: (walletAddress: string, proxy: ProxyConfig | null) => Promise<WalletData>;
}
//# sourceMappingURL=debankService.d.ts.map