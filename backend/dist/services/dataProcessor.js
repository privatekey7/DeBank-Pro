"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProcessor = void 0;
class DataProcessor {
    constructor() {
        this.aggregateWalletsData = (wallets) => {
            const aggregated = {
                totalValue: 0,
                totalChange24h: 0,
                walletsCount: wallets.length,
                topTokens: [],
                topChains: [],
                topProtocols: [],
                wallets: wallets
            };
            // Собираем все токены из всех кошельков
            const allTokens = new Map();
            const allChains = new Map();
            const allProtocols = new Map();
            wallets.forEach(wallet => {
                // Суммируем общие значения
                aggregated.totalValue += wallet.totalValue;
                aggregated.totalChange24h += wallet.change24h;
                // Обрабатываем токены
                wallet.tokens.forEach(token => {
                    const key = `${token.symbol}-${token.chain}`;
                    if (allTokens.has(key)) {
                        const existing = allTokens.get(key);
                        existing.balance += token.balance;
                        existing.value += token.value;
                    }
                    else {
                        allTokens.set(key, { ...token });
                    }
                });
                // Обрабатываем цепочки
                wallet.chains.forEach(chain => {
                    if (allChains.has(chain.name)) {
                        const existing = allChains.get(chain.name);
                        existing.value += chain.value;
                        existing.tokens.push(...chain.tokens);
                    }
                    else {
                        allChains.set(chain.name, { ...chain });
                    }
                });
                // Обрабатываем протоколы
                wallet.protocols.forEach(protocol => {
                    const key = `${protocol.id}-${protocol.chain}`;
                    if (allProtocols.has(key)) {
                        const existing = allProtocols.get(key);
                        existing.value += protocol.value;
                    }
                    else {
                        allProtocols.set(key, { ...protocol });
                    }
                });
            });
            // Сортируем и берем топ токены
            aggregated.topTokens = Array.from(allTokens.values())
                .sort((a, b) => b.value - a.value)
                .slice(0, 20);
            // Сортируем и берем топ цепочки
            aggregated.topChains = Array.from(allChains.values())
                .sort((a, b) => b.value - a.value)
                .slice(0, 10);
            // Сортируем и берем топ протоколы
            aggregated.topProtocols = Array.from(allProtocols.values())
                .sort((a, b) => b.value - a.value)
                .slice(0, 15);
            return aggregated;
        };
        this.getWalletStats = (wallets) => {
            const stats = {
                totalWallets: wallets.length,
                totalValue: 0,
                averageValue: 0,
                medianValue: 0,
                topWallet: null,
                bottomWallet: null,
                valueDistribution: {
                    under1k: 0,
                    under10k: 0,
                    under100k: 0,
                    under1m: 0,
                    over1m: 0
                },
                chainsDistribution: new Map()
            };
            if (wallets.length === 0)
                return stats;
            // Сортируем кошельки по стоимости
            const sortedWallets = [...wallets].sort((a, b) => b.totalValue - a.totalValue);
            stats.totalValue = sortedWallets.reduce((sum, wallet) => sum + wallet.totalValue, 0);
            stats.averageValue = stats.totalValue / stats.totalWallets;
            stats.topWallet = sortedWallets[0];
            stats.bottomWallet = sortedWallets[sortedWallets.length - 1];
            // Вычисляем медиану
            const mid = Math.floor(sortedWallets.length / 2);
            stats.medianValue = sortedWallets.length % 2 === 0
                ? (sortedWallets[mid - 1].totalValue + sortedWallets[mid].totalValue) / 2
                : sortedWallets[mid].totalValue;
            // Распределение по стоимости
            wallets.forEach(wallet => {
                if (wallet.totalValue < 1000)
                    stats.valueDistribution.under1k++;
                else if (wallet.totalValue < 10000)
                    stats.valueDistribution.under10k++;
                else if (wallet.totalValue < 100000)
                    stats.valueDistribution.under100k++;
                else if (wallet.totalValue < 1000000)
                    stats.valueDistribution.under1m++;
                else
                    stats.valueDistribution.over1m++;
            });
            // Распределение по цепочкам
            wallets.forEach(wallet => {
                wallet.chains.forEach(chain => {
                    const current = stats.chainsDistribution.get(chain.name) || 0;
                    stats.chainsDistribution.set(chain.name, current + 1);
                });
            });
            return stats;
        };
        this.filterWallets = (wallets, filters) => {
            return wallets.filter(wallet => {
                // Фильтр по стоимости
                if (filters.minValue && wallet.totalValue < filters.minValue)
                    return false;
                if (filters.maxValue && wallet.totalValue > filters.maxValue)
                    return false;
                // Фильтр по цепочкам
                if (filters.chains && filters.chains.length > 0) {
                    const walletChains = wallet.chains.map(chain => chain.name);
                    const hasMatchingChain = filters.chains.some(chain => walletChains.includes(chain));
                    if (!hasMatchingChain)
                        return false;
                }
                // Фильтр по токенам
                if (filters.tokens && filters.tokens.length > 0) {
                    const walletTokens = wallet.tokens.map(token => token.symbol);
                    const hasMatchingToken = filters.tokens.some(token => walletTokens.includes(token));
                    if (!hasMatchingToken)
                        return false;
                }
                return true;
            });
        };
        this.sortWallets = (wallets, sortBy, sortOrder = 'desc') => {
            const sorted = [...wallets];
            sorted.sort((a, b) => {
                let aValue;
                let bValue;
                switch (sortBy) {
                    case 'totalValue':
                        aValue = a.totalValue;
                        bValue = b.totalValue;
                        break;
                    case 'change24h':
                        aValue = a.change24h;
                        bValue = b.change24h;
                        break;
                    case 'rank':
                        aValue = a.rank || Infinity;
                        bValue = b.rank || Infinity;
                        break;
                    case 'age':
                        aValue = a.age || 0;
                        bValue = b.age || 0;
                        break;
                    case 'followers':
                        aValue = a.followers || 0;
                        bValue = b.followers || 0;
                        break;
                    case 'lastUpdated':
                        aValue = new Date(a.lastUpdated).getTime();
                        bValue = new Date(b.lastUpdated).getTime();
                        break;
                    default:
                        aValue = a.totalValue;
                        bValue = b.totalValue;
                }
                if (sortOrder === 'asc') {
                    return aValue - bValue;
                }
                else {
                    return bValue - aValue;
                }
            });
            return sorted;
        };
        this.exportToCSV = (wallets) => {
            const headers = [
                'Address',
                'Total Value (USD)',
                '24h Change (USD)',
                'Rank',
                'Age (days)',
                'Followers',
                'Following',
                'Chains Count',
                'Tokens Count',
                'Last Updated'
            ];
            const rows = wallets.map(wallet => [
                wallet.address,
                wallet.totalValue.toFixed(2),
                wallet.change24h.toFixed(2),
                wallet.rank || '',
                wallet.age || '',
                wallet.followers || '',
                wallet.following || '',
                wallet.chains.length,
                wallet.tokens.length,
                wallet.lastUpdated
            ]);
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
            return csvContent;
        };
    }
}
exports.DataProcessor = DataProcessor;
//# sourceMappingURL=dataProcessor.js.map