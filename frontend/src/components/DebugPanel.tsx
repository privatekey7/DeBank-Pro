import React, { useState } from 'react';
import { apiService } from '../services/api';


interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  walletAddress?: string;
}

interface DebugData {
  walletAddress: string;
  processingSteps: string[];
  networkRequests: any[];
  rawData: any;
  processedData: any;
  errors: string[];
}

interface LoggerStats {
  totalLogs: number;
  totalDebugData: number;
  debugMode: boolean;
}

const DebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debugData, setDebugData] = useState<DebugData[]>([]);
  const [loggerStats, setLoggerStats] = useState<LoggerStats | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [logLevel, setLogLevel] = useState<string>('');
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'debug' | 'logos'>('logs');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getLogs({ 
        level: logLevel || undefined, 
        limit: '100' 
      });
      setLogs(response.logs);
    } catch (error) {
      console.error('Ошибка при получении логов:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDebugData();
      setDebugData(Array.isArray(response.debugData) ? response.debugData : [response.debugData]);
    } catch (error) {
      console.error('Ошибка при получении отладочных данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoggerStats = async () => {
    try {
      const response = await apiService.getStatus();
      if (response.loggerStats) {
        setLoggerStats(response.loggerStats);
        setDebugMode(response.loggerStats.debugMode);
      }
    } catch (error) {
      console.error('Ошибка при получении статистики логгера:', error);
    }
  };

  const toggleDebugMode = async () => {
    try {
      await apiService.toggleDebugMode(!debugMode);
      setDebugMode(!debugMode);
      fetchLoggerStats();
    } catch (error) {
      console.error('Ошибка при изменении режима отладки:', error);
    }
  };

  const clearLogs = async () => {
    try {
      await apiService.clearLogs(selectedWallet || undefined);
      fetchLogs();
      fetchDebugData();
    } catch (error) {
      console.error('Ошибка при очистке логов:', error);
    }
  };

  const processWallets = async () => {
    try {
      setLoading(true);
      const response = await apiService.processWallets();
      console.log('Обработка кошельков завершена:', response);
      // Обновляем данные после обработки
      fetchLoggerStats();
    } catch (error) {
      console.error('Ошибка при обработке кошельков:', error);
    } finally {
      setLoading(false);
    }
  };

  // Убираем автоматическую загрузку данных

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="p-6 bg-slate-800 rounded-lg shadow-lg border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-100">Панель отладки</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchLoggerStats();
              fetchLogs();
              fetchDebugData();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Загрузить данные
          </button>
          <button
            onClick={processWallets}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Обработка...' : 'Перезапустить обработку'}
          </button>
          <button
            onClick={toggleDebugMode}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              debugMode 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-slate-600 text-white hover:bg-slate-700'
            }`}
          >
            {debugMode ? 'Отладка включена' : 'Отладка выключена'}
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Очистить логи
          </button>
        </div>
      </div>

      {loggerStats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-700">
            <div className="text-sm text-blue-400 font-medium">Всего логов</div>
            <div className="text-2xl font-bold text-blue-300">{loggerStats.totalLogs}</div>
          </div>
          <div className="bg-green-900/20 p-4 rounded-lg border border-green-700">
            <div className="text-sm text-green-400 font-medium">Отладочных данных</div>
            <div className="text-2xl font-bold text-green-300">{loggerStats.totalDebugData}</div>
          </div>
          <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-700">
            <div className="text-sm text-purple-400 font-medium">Режим отладки</div>
            <div className="text-2xl font-bold text-purple-300">{debugMode ? 'Включен' : 'Выключен'}</div>
          </div>
        </div>
      )}

      {/* Вкладки */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'logs' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Логи
        </button>
        <button
          onClick={() => setActiveTab('debug')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'debug' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Отладка
        </button>
        <button
          onClick={() => setActiveTab('logos')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'logos' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Тест логотипов
        </button>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Логи */}
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Логи системы</h3>
            <div className="flex gap-2">
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-3 py-1 border border-slate-600 rounded-md text-sm bg-slate-800 text-slate-100"
              >
                <option value="">Все уровни</option>
                <option value="error">Ошибки</option>
                <option value="warn">Предупреждения</option>
                <option value="info">Информация</option>
                <option value="debug">Отладка</option>
              </select>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Обновить
              </button>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {logs.map((log, index) => (
              <div key={index} className="bg-slate-800 p-3 rounded border border-slate-600">
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-medium ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-slate-300 mt-1">{log.message}</div>
                {log.walletAddress && (
                  <div className="text-xs text-slate-400 mt-1">
                    Кошелек: {log.walletAddress}
                  </div>
                )}
                {log.data && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer">Данные</summary>
                    <pre className="text-xs bg-slate-700 p-2 rounded mt-1 overflow-x-auto text-slate-300">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>


      </div>
      )}

      {activeTab === 'debug' && (
        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Отладочные данные</h3>
            <button
              onClick={fetchDebugData}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Обновить
            </button>
          </div>
          
          <input
            type="text"
            placeholder="Адрес кошелька (опционально)"
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value)}
            className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm mb-4 bg-slate-800 text-slate-100 placeholder-slate-400"
          />
          
          <div className="space-y-4">
            {debugData.map((data, index) => (
              <div key={index} className="bg-slate-800 p-4 rounded border border-slate-600">
                <h4 className="font-semibold text-slate-100 mb-2">{data.walletAddress}</h4>
                <div className="text-sm text-slate-400 mb-2">{data.processingSteps.length} шагов</div>
                
                <details className="mb-2">
                  <summary className="text-xs text-slate-400 cursor-pointer">Шаги обработки</summary>
                  <ul className="text-xs bg-slate-700 p-2 rounded mt-1 space-y-1 text-slate-300">
                    {data.processingSteps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ul>
                </details>
                
                <details className="mb-2">
                  <summary className="text-xs text-slate-400 cursor-pointer">Сетевые запросы</summary>
                  <pre className="text-xs bg-slate-700 p-2 rounded mt-1 overflow-x-auto text-slate-300">
                    {JSON.stringify(data.networkRequests, null, 2)}
                  </pre>
                </details>
                
                <details className="mb-2">
                  <summary className="text-xs text-slate-400 cursor-pointer">Сырые данные</summary>
                  <pre className="text-xs bg-slate-700 p-2 rounded mt-1 overflow-x-auto text-slate-300">
                    {JSON.stringify(data.rawData, null, 2)}
                  </pre>
                </details>
                
                <details>
                  <summary className="text-xs text-slate-400 cursor-pointer">Обработанные данные</summary>
                  <pre className="text-xs bg-slate-700 p-2 rounded mt-1 overflow-x-auto text-slate-300">
                    {JSON.stringify(data.processedData, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logos' && (
        <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
          <h3 className="text-lg font-medium text-slate-200 mb-4">Тест логотипов</h3>
          <p className="text-slate-400">Компонент тестирования логотипов был удален для очистки кода.</p>
        </div>
      )}
    </div>
  );
};

export default DebugPanel; 