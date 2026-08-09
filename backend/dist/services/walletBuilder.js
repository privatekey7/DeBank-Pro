"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWalletData = void 0;
const balanceMath_1 = require("./balanceMath");
/**
 * Сборка `WalletData` из сырых токенов и DeFi-протоколов.
 *
 * Общая для обоих источников (DeBank и Rabby): фильтрует скам/неверифицированные
 * токены, считает 24h-изменение как взвешенное по стоимости, группирует по сетям.
 *
 * `totalOverride` — авторитетный агрегат от источника (Rabby отдаёт готовый
 * `total_usd_value`). Если задан, итог берётся из него НАПРЯМУЮ, а не как сумма
 * `tokens + protocols`, — это устраняет корневой сценарий фантома (contamination
 * при ручном суммировании двух независимых ответов). Если не задан (DeBank),
 * поведение прежнее: итог = сумма токенов и протоколов.
 */
const buildWalletData = (address, tokens, portfolio, totalOverride) => {
    const walletData = {
        address,
        totalValue: 0,
        change24h: 0,
        chains: [],
        tokens: [],
        protocols: [],
        lastUpdated: new Date().toISOString()
    };
    // Токены: отбрасываем скам и неверифицированные
    let totalTokensValue = 0;
    let weightedChange24h = 0;
    let changeWeight = 0;
    for (const token of tokens) {
        if (!token || !(token.amount > 0))
            continue;
        if (token.is_verified === false || token.is_scam)
            continue;
        const tokenValue = token.amount * (token.price || 0) || 0;
        walletData.tokens.push({
            symbol: token.symbol,
            name: token.name,
            balance: token.amount,
            value: tokenValue,
            price: token.price || 0,
            chain: token.chain || 'unknown',
            logo: token.logo_url,
            priceChange24h: token.price_24h_change || 0
        });
        totalTokensValue += tokenValue;
        if (token.price_24h_change !== undefined && token.price_24h_change !== null) {
            weightedChange24h += tokenValue * token.price_24h_change;
            changeWeight += tokenValue;
        }
    }
    // Протоколы (DeFi)
    let totalProtocolsValue = 0;
    for (const protocol of portfolio) {
        if (!protocol)
            continue;
        let protocolTotalValue = 0;
        const items = protocol.portfolio_item_list || [];
        for (const item of items) {
            protocolTotalValue += (0, balanceMath_1.safePositionValue)(item);
        }
        totalProtocolsValue += protocolTotalValue;
        walletData.protocols.push({
            id: protocol.id || 'unknown',
            name: protocol.name || 'Unknown Protocol',
            value: protocolTotalValue,
            chain: protocol.chain || 'unknown',
            category: 'defi',
            logo: protocol.logo_url || undefined
        });
    }
    // Итог: авторитетный агрегат источника или ручная сумма (легаси-путь).
    walletData.totalValue =
        totalOverride !== undefined ? totalOverride : totalTokensValue + totalProtocolsValue;
    walletData.change24h = changeWeight > 0 ? weightedChange24h / changeWeight : 0;
    // Группировка токенов по сетям
    const chainMap = new Map();
    for (const token of walletData.tokens) {
        let chain = chainMap.get(token.chain);
        if (!chain) {
            chain = { name: token.chain, value: 0, tokens: [] };
            chainMap.set(token.chain, chain);
        }
        chain.value += token.value;
        chain.tokens.push(token);
    }
    walletData.chains = Array.from(chainMap.values()).sort((a, b) => b.value - a.value);
    walletData.tokens.sort((a, b) => b.value - a.value);
    walletData.protocols.sort((a, b) => b.value - a.value);
    return walletData;
};
exports.buildWalletData = buildWalletData;
//# sourceMappingURL=walletBuilder.js.map