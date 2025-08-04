import React from 'react';
import { ServerStatus } from '../types';
import { cn } from '../utils/helpers';
import { Wifi, WifiOff, Clock, Users } from 'lucide-react';

interface StatusBarProps {
  status: ServerStatus;
}

const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const getProgressPercentage = () => {
    if (!status.processingProgress || status.walletsCount === 0) return 0;
    return Math.round((status.processingProgress.current / status.walletsCount) * 100);
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            {/* Статус сервера */}
            <div className="flex items-center space-x-2">
              {status.status === 'running' ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className={cn(
                "font-medium",
                status.status === 'running' ? "text-green-400" : "text-red-400"
              )}>
                {status.status === 'running' ? 'Сервер работает' : 'Сервер недоступен'}
              </span>
            </div>

            {/* Количество кошельков */}
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">
                {status.walletsCount} кошельков
              </span>
            </div>

            {/* Статус обработки с прогресс-баром */}
            {status.isProcessing && (
              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
                <div className="flex items-center space-x-2">
                  <span className="text-blue-400 font-medium">
                    Получаю данные {status.processingProgress?.current || 0}/{status.walletsCount}
                  </span>
                  {status.processingProgress && (
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 transition-all duration-300 ease-out"
                        style={{ width: `${getProgressPercentage()}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar; 