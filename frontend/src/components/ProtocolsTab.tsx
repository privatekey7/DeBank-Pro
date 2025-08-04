import React, { useState, useEffect } from 'react';
import { Activity, Search, ExternalLink, Filter, Download } from 'lucide-react';
import { ProtocolData, FilterOptions } from '../types';
import { apiService } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LogoImage from './icons/LogoImage';
import { getChainLogo, getChainDisplayName } from '../data/chainLogos';
import { exportProtocolsToExcel } from '../utils/excelExport';
import { cn } from '../utils/helpers';
import CustomDropdown from './icons/CustomDropdown';

const ProtocolsTab: React.FC = () => {
  const [protocols, setProtocols] = useState<ProtocolData[]>([]);
  const [filteredProtocols, setFilteredProtocols] = useState<ProtocolData[]>([]);
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
        
        const allProtocols = aggregatedResponse.topProtocols;
        const allWallets = walletsResponse.wallets;
        

        
        setProtocols(allProtocols);
        setFilteredProtocols(allProtocols);
        setWallets(allWallets);
        setError(null);
      } catch (err) {
        setError('Ошибка загрузки протоколов');
        console.error('Error fetching protocols:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Обновление каждые 5 секунд для более быстрой синхронизации

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = protocols;

    // Поиск по названию
    if (searchTerm) {
      filtered = filtered.filter(protocol =>
        protocol.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по цепочке
    if (selectedChain !== 'all') {
      filtered = filtered.filter(protocol => protocol.chain === selectedChain);
    }

    // Фильтр по протоколу
    if (filters.selectedProtocol) {
      filtered = filtered.filter(protocol => protocol.name === filters.selectedProtocol);
    }

    // Дополнительные фильтры
    if (filters.minValue !== undefined) {
      filtered = filtered.filter(protocol => protocol.value >= filters.minValue!);
    }
    if (filters.maxValue !== undefined) {
      filtered = filtered.filter(protocol => protocol.value <= filters.maxValue!);
    }

    // Сортировка
    filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof ProtocolData] as number;
      const bValue = b[sortBy as keyof ProtocolData] as number;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    setFilteredProtocols(filtered);
  }, [protocols, searchTerm, selectedChain, sortBy, sortOrder, filters]);

  const getUniqueChains = () => {
    const chains = new Set<string>();
    protocols.forEach(protocol => chains.add(protocol.chain));
    return Array.from(chains).sort();
  };

  const getUniqueProtocolsForChain = (chain: string) => {
    if (chain === 'all') {
      const allProtocols = new Set<string>();
      protocols.forEach(protocol => allProtocols.add(protocol.name));
      return Array.from(allProtocols).sort();
    } else {
      const chainProtocols = new Set<string>();
      protocols.filter(protocol => protocol.chain === chain).forEach(protocol => chainProtocols.add(protocol.name));
      return Array.from(chainProtocols).sort();
    }
  };



  const getProtocolStats = () => {
    // Сортируем протоколы по стоимости для отображения топ протоколов
    const sortedProtocols = [...protocols].sort((a, b) => b.value - a.value);
    
    // Берем топ 10 протоколов для диаграммы
    return sortedProtocols.slice(0, 10).map((protocol, index) => ({
      name: protocol.name,
      value: protocol.value,
      chain: protocol.chain,
      category: protocol.category,
      logo: protocol.logo,
      color: ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'][index % 10]
    }));
  };

  const handleExport = () => {
    exportProtocolsToExcel(filteredProtocols, wallets);
  };

  const totalValue = protocols.reduce((sum, protocol) => sum + protocol.value, 0);
  const chartData = getProtocolStats().map(protocol => ({
    ...protocol,
    percentage: (protocol.value / totalValue) * 100
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
            <Activity className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Ошибка загрузки протоколов</h3>
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
                placeholder="Поиск протоколов..."
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

              {/* Фильтр по протоколу */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Протокол</label>
                <CustomDropdown
                  value={filters.selectedProtocol || 'all'}
                  onChange={(value) => setFilters({ ...filters, selectedProtocol: value === 'all' ? undefined : value as string })}
                  options={[
                    { value: 'all', label: 'Все протоколы' },
                    ...getUniqueProtocolsForChain(selectedChain).map(protocol => {
                      const protocolData = protocols.find(p => p.name === protocol);
                      return {
                        value: protocol,
                        label: protocol,
                        logo: protocolData?.logo
                      };
                    })
                  ]}
                  placeholder="Все протоколы"
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
        {/* Распределение по протоколам */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Распределение по протоколам</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <LogoImage 
                              src={data.logo} 
                              alt={data.name}
                              size="sm"
                            />
                            <span className="text-slate-100 font-medium">
                              {data.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-slate-300 text-sm">
                              {getChainDisplayName(data.chain)}
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
            {chartData.map((item, index) => {
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <LogoImage 
                      src={item.logo} 
                      alt={item.name}
                      size="sm"
                    />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-100">{formatCurrency(item.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Топ протоколы по стоимости */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Топ протоколы по стоимости</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredProtocols.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), 'Стоимость']}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Таблица протоколов */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              Протоколы ({filteredProtocols.length})
            </h3>
            <div className="text-sm text-slate-400">
              Показано {filteredProtocols.length} из {protocols.length}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Протокол</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Цепочка</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Категория</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Стоимость</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProtocols.map((protocol, index) => (
                <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <LogoImage 
                        src={protocol.logo} 
                        alt={protocol.name}
                        size="md"
                      />
                      <div>
                        <div className="font-medium text-slate-100">{protocol.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <LogoImage
                        src={getChainLogo(protocol.chain)}
                        alt={protocol.chain}
                        size="sm"
                      />
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                         {getChainDisplayName(protocol.chain)}
                       </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                      {protocol.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-medium text-slate-100">{formatCurrency(protocol.value)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => window.open(`https://debank.com/protocols/${protocol.id}`, '_blank')}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      title="Открыть в DeBank"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProtocols.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Протоколы не найдены</h3>
            <p className="text-slate-400">Попробуйте изменить фильтры или поисковый запрос</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProtocolsTab; 