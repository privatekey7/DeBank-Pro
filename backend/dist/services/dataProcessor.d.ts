import { WalletData, AggregatedData } from '../types';
export declare class DataProcessor {
    aggregateWalletsData: (wallets: WalletData[]) => AggregatedData;
    getWalletStats: (wallets: WalletData[]) => {
        totalWallets: number;
        totalValue: number;
        averageValue: number;
        medianValue: number;
        topWallet: WalletData | null;
        bottomWallet: WalletData | null;
        valueDistribution: {
            under1k: number;
            under10k: number;
            under100k: number;
            under1m: number;
            over1m: number;
        };
        chainsDistribution: Map<string, number>;
    };
    filterWallets: (wallets: WalletData[], filters: {
        minValue?: number;
        maxValue?: number;
        chains?: string[];
        tokens?: string[];
    }) => WalletData[];
    sortWallets: (wallets: WalletData[], sortBy: string, sortOrder?: "asc" | "desc") => WalletData[];
    exportToCSV: (wallets: WalletData[]) => string;
}
//# sourceMappingURL=dataProcessor.d.ts.map