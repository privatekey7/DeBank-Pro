import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, BarChart3, PieChart, Bug } from 'lucide-react';
import { TabType, ServerStatus } from './types';
import { apiService } from './services/api';
import { cn } from './utils/helpers';
import OverviewTab from './components/OverviewTab';
import WalletsTab from './components/WalletsTab';
import TokensTab from './components/TokensTab';
import ProtocolsTab from './components/ProtocolsTab';
import DebugPanel from './components/DebugPanel';
import StatusBar from './components/StatusBar';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Применяем тёмную тему по умолчанию
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const statusData = await apiService.getStatus();
        setStatus(statusData);
        setError(null);
      } catch (err) {
        setError('Ошибка подключения к серверу');
        console.error('Error fetching status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    
    // Интервал обновления статуса
    const interval = setInterval(fetchStatus, 3000); // 3 секунды для более быстрого обновления

    return () => clearInterval(interval);
  }, []);



  // Проверяем режим разработки
  const isDevelopment = import.meta.env.DEV;

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: TrendingUp },
    { id: 'wallets', label: 'Кошельки', icon: Wallet },
    { id: 'tokens', label: 'Токены', icon: BarChart3 },
    { id: 'protocols', label: 'Протоколы', icon: PieChart },
    // Показываем вкладку отладки только в режиме разработки
    ...(isDevelopment ? [{ id: 'debug', label: 'Отладка', icon: Bug }] : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'wallets':
        return <WalletsTab />;
      case 'tokens':
        return <TokensTab />;
      case 'protocols':
        return <ProtocolsTab />;
      case 'debug':
        return isDevelopment ? <DebugPanel /> : <OverviewTab />;
      default:
        return <OverviewTab />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300">Загрузка DeBank Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-800 shadow-lg border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-100">DeBank Pro</h1>
              </div>
              <span className="text-sm text-slate-400">Портфолио трекер</span>
            </div>
            
            <div className="flex items-center space-x-3">
                             <a
                 href="https://t.me/privatekey7"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="flex items-center space-x-2 text-sm text-slate-300 hover:text-blue-400 transition-colors"
               >
                                   <img src="/icons/Telegram.png" alt="Telegram" className="w-5 h-5 rounded-full bg-transparent" />
                 <span>PrivateKey</span>
               </a>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "flex items-center space-x-2 py-4 px-1 font-medium text-sm transition-colors",
                    activeTab === tab.id
                      ? "text-blue-400"
                      : "text-slate-400 hover:text-slate-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Status Bar */}
      {status && <StatusBar status={status} />}

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default App; 