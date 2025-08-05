import React, { useState, useEffect } from 'react';
import { Coins, Search, Filter, Download } from 'lucide-react';
import { TokenData, FilterOptions } from '../types';
import { apiService } from '../services/api';
import { formatCurrency, formatTokenBalance, getTokenExplorerUrl } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LogoImage from './icons/LogoImage';
import { getChainLogo, getChainDisplayName, getChainData } from '../data/chainLogos';
import { exportTokensToExcel } from '../utils/excelExport';
import { cn } from '../utils/helpers';
import CustomDropdown from './icons/CustomDropdown';

const TokensTab: React.FC = () => {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenData[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [sortBy] = useState('value');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aggregatedResponse, walletsResponse] = await Promise.all([
          apiService.getAggregated(),
          apiService.getWallets()
        ]);
        
        const allTokens = aggregatedResponse.topTokens;
        const allWallets = walletsResponse.wallets;
        

        
        setTokens(allTokens);
        setFilteredTokens(allTokens);
        setWallets(allWallets);
        setError(null);
      } catch (err) {
        setError('Ошибка загрузки токенов');
        console.error('Error fetching tokens:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Обновление каждые 5 секунд для более быстрой синхронизации

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = tokens;

    // Поиск по символу, названию или сети
    if (searchTerm) {
      filtered = filtered.filter(token =>
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getChainDisplayName(token.chain).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по цепочке
    if (selectedChain !== 'all') {
      filtered = filtered.filter(token => token.chain === selectedChain);
    }

    // Дополнительные фильтры
    if (filters.minValue !== undefined) {
      filtered = filtered.filter(token => token.value >= filters.minValue!);
    }
    if (filters.maxValue !== undefined) {
      filtered = filtered.filter(token => token.value <= filters.maxValue!);
    }
    
    // Фильтр по токену
    if (filters.selectedToken) {
      filtered = filtered.filter(token => token.symbol === filters.selectedToken);
    }

    // Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'chain') {
        const aChain = getChainDisplayName(a.chain);
        const bChain = getChainDisplayName(b.chain);
        const comparison = aChain.localeCompare(bChain);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      
      const aValue = a[sortBy as keyof TokenData] as number;
      const bValue = b[sortBy as keyof TokenData] as number;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    setFilteredTokens(filtered);
  }, [tokens, searchTerm, selectedChain, sortBy, sortOrder, filters]);

  const getUniqueChains = () => {
    const chains = new Set<string>();
    tokens.forEach(token => chains.add(token.chain));
    return Array.from(chains).sort();
  };

  const getUniqueTokensForChain = (chain: string) => {
    if (chain === 'all') {
      const allTokens = new Set<string>();
      tokens.forEach(token => allTokens.add(token.symbol));
      return Array.from(allTokens).sort();
    } else {
      const chainTokens = new Set<string>();
      tokens.filter(token => token.chain === chain).forEach(token => chainTokens.add(token.symbol));
      return Array.from(chainTokens).sort();
    }
  };

  const getChainStats = () => {
    const stats = new Map<string, { totalValue: number; tokenCount: number }>();
    
    tokens.forEach(token => {
      const existing = stats.get(token.chain) || { totalValue: 0, tokenCount: 0 };
      stats.set(token.chain, {
        totalValue: existing.totalValue + token.value,
        tokenCount: existing.tokenCount + 1
      });
    });

    return Array.from(stats.entries()).map(([chain, data]) => ({
      name: getChainDisplayName(chain),
      chainName: chain, // Добавляем оригинальное название для получения логотипа
      value: data.totalValue,
      tokenCount: data.tokenCount
    }));
  };

  const handleExport = () => {
    exportTokensToExcel(filteredTokens, wallets, filters);
  };

  const chartData = getChainStats().map((chain, index) => ({
    name: chain.name,
    chainName: chain.chainName, // Добавляем оригинальное название для получения логотипа
    value: chain.value,
    tokenCount: chain.tokenCount,
    color: ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4'][index % 6]
  }));

  // Вычисляем общую стоимость для расчета процентов
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
  
  // Добавляем процент к каждому элементу
  const chartDataWithPercentage = chartData.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
            <div className="h-4 bg-slate-700 rounded mb-4 w-1/3"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Coins className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Ошибка загрузки токенов</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск токенов, названий или сетей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-800 text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors",
                showFilters
                  ? "bg-blue-900/20 border-blue-600 text-blue-400"
                  : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
              )}
            >
              <Filter className="w-4 h-4" />
              <span>Фильтры</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Экспорт</span>
            </button>
          </div>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Фильтр по стоимости */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Стоимость в USD</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Мин"
                    value={filters.minValue || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) >= 0) {
                        setFilters({ ...filters, minValue: value === '' ? undefined : parseFloat(value) });
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800 text-slate-100"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Макс"
                    value={filters.maxValue || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) >= 0) {
                        setFilters({ ...filters, maxValue: value === '' ? undefined : parseFloat(value) });
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800 text-slate-100"
                  />
                </div>
              </div>

              {/* Фильтр по цепочке */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Цепочка</label>
                <CustomDropdown
                  value={selectedChain}
                  onChange={(value) => setSelectedChain(value as string)}
                  options={[
                    { value: 'all', label: 'Все цепочки' },
                    ...getUniqueChains().map(chain => ({
                      value: chain,
                      label: getChainDisplayName(chain),
                      logo: getChainLogo(chain)
                    }))
                  ]}
                  placeholder="Все цепочки"
                />
              </div>

              {/* Токен */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Токен</label>
                <CustomDropdown
                  value={filters.selectedToken || 'all'}
                  onChange={(value) => setFilters({ ...filters, selectedToken: value === 'all' ? undefined : value as string })}
                  options={[
                    { value: 'all', label: 'Все токены' },
                    ...getUniqueTokensForChain(selectedChain).map(token => {
                      const tokenData = tokens.find(t => t.symbol === token);
                      return {
                        value: token,
                        label: token,
                        logo: tokenData?.logo
                      };
                    })
                  ]}
                  placeholder="Все токены"
                />
              </div>
            </div>

            {/* Кнопка сброса фильтров */}
            <div className="mt-4">
              <button
                onClick={() => {
                  setFilters({});
                  setSearchTerm('');
                  setSelectedChain('all');
                }}
                className="text-sm text-slate-400 hover:text-slate-300"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Распределение по цепочкам */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Распределение токенов по цепочкам</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataWithPercentage}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartDataWithPercentage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const chainData = getChainData(data.chainName);
                      
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            {chainData?.logo && (
                              <img 
                                src={chainData.logo} 
                                alt={data.name}
                                className="w-5 h-5 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <span className="text-slate-100 font-medium">
                              {data.name}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">
                            Стоимость: {formatCurrency(data.value)}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {data.percentage.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  contentStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {chartDataWithPercentage.map((item, index) => {
              const chainData = getChainData(item.chainName);
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    {chainData?.logo && (
                      <img 
                        src={chainData.logo} 
                        alt={item.name}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-100">{formatCurrency(item.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Топ токены по стоимости */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Топ токены по стоимости</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const topTokens = filteredTokens.slice(0, 10);
                const totalValue = topTokens.reduce((sum, token) => sum + token.value, 0);
                return topTokens.map(token => ({
                  ...token,
                  displayName: `${token.symbol} (${getChainDisplayName(token.chain)})`,
                  percentage: (token.value / totalValue) * 100
                }));
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis 
                  dataKey="displayName" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tickFormatter={(value) => {
                    // Сокращаем длинные названия для лучшей читаемости
                    if (value.length > 15) {
                      const parts = value.split(' (');
                      if (parts.length === 2) {
                        const symbol = parts[0];
                        const chain = parts[1].replace(')', '');
                        // Сокращаем название сети если оно слишком длинное
                        const shortChain = chain.length > 8 ? chain.substring(0, 8) + '...' : chain;
                        return `${symbol} (${shortChain})`;
                      }
                    }
                    return value;
                  }}
                />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const chainData = getChainData(data.chain);
                      
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-slate-100 font-medium">
                              {data.symbol}
                            </span>
                            {chainData?.logo && (
                              <img 
                                src={chainData.logo} 
                                alt={getChainDisplayName(data.chain)}
                                className="w-5 h-5 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <p className="text-slate-300 text-sm">
                            Стоимость: {formatCurrency(data.value)}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {data.percentage.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  contentStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Таблица токенов */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              Токены ({filteredTokens.length})
            </h3>
            <div className="text-sm text-slate-400">
              Показано {filteredTokens.length} из {tokens.length}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Токен</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Цепочка</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Баланс</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Цена</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Стоимость</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((token, index) => (
                <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <LogoImage 
                        src={token.logo} 
                        alt={token.name || token.symbol}
                        size="md"
                      />
                      <div>
                        <div className="font-medium text-slate-100">
                          {token.address ? (
                            <a
                              href={getTokenExplorerUrl(token.address, token.chain)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Открыть в эксплорере"
                            >
                              {token.symbol}
                            </a>
                          ) : (
                            token.symbol
                          )}
                        </div>
                        <div className="text-sm text-slate-400">{token.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <LogoImage
                        src={getChainLogo(token.chain)}
                        alt={token.chain}
                        size="sm"
                      />
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                         {getChainDisplayName(token.chain)}
                       </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-sm text-slate-100">{formatTokenBalance(token.balance)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-slate-100">{formatCurrency(token.price)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-medium text-slate-100">{formatCurrency(token.value)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTokens.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Токены не найдены</h3>
            <p className="text-slate-400">Попробуйте изменить фильтры или поисковый запрос</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokensTab; 