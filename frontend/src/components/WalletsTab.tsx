import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ExternalLink, Copy, Eye } from 'lucide-react';
import { WalletData } from '../types';
import { apiService } from '../services/api';
import { formatCurrency, formatAddress, getTimeAgo } from '../utils/helpers';
import { getChainDisplayName } from '../data/chainLogos';

const WalletsTab: React.FC = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('totalValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const response = await apiService.getWallets(sortBy, sortOrder);
        setWallets(response.wallets);
        setError(null);
      } catch (err) {
        setError('Ошибка загрузки кошельков');
        console.error('Error fetching wallets:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallets();
  }, [sortBy, sortOrder]);



  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  const handleViewWallet = (address: string) => {
    window.open(`https://debank.com/profile/${address}`, '_blank');
  };





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
            <Eye className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Ошибка загрузки кошельков</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Результаты */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              Кошельки ({wallets.length})
            </h3>
            <div className="text-sm text-slate-400">
              Всего кошельков: {wallets.length}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Адрес</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('totalValue')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>Стоимость</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Цепочки</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Токены</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Протоколы</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Обновлено</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Действия</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet, index) => (
                <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm text-slate-100">{formatAddress(wallet.address)}</span>
                      <button
                        onClick={() => handleCopyAddress(wallet.address)}
                        className="text-slate-400 hover:text-slate-300 transition-colors"
                        title="Копировать адрес"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-100">{formatCurrency(wallet.totalValue)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {wallet.chains.slice(0, 3).map((chain, chainIndex) => (
                        <span
                          key={chainIndex}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400"
                        >
                          {getChainDisplayName(chain.name)}
                        </span>
                      ))}
                      {wallet.chains.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                          +{wallet.chains.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400">{wallet.tokens.length}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400">{wallet.protocols.length}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-500">{getTimeAgo(wallet.lastUpdated)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleViewWallet(wallet.address)}
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

        {wallets.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Кошельки не найдены</h3>
            <p className="text-slate-400">Нет доступных кошельков для отображения</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletsTab; 