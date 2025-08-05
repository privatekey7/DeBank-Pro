import axios from 'axios';
import { WalletData, AggregatedData, ServerStatus, FilterOptions } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Получить статус сервера
  getStatus: async (): Promise<ServerStatus> => {
    const response = await api.get('/status');
    return response.data;
  },

  // Получить все кошельки
  getWallets: async (sortBy = 'totalValue', sortOrder = 'desc'): Promise<{ wallets: WalletData[]; total: number }> => {
    const response = await api.get('/wallets', {
      params: { sortBy, sortOrder }
    });
    return response.data;
  },

  // Получить агрегированные данные
  getAggregated: async (): Promise<AggregatedData> => {
    const response = await api.get('/aggregated');
    return response.data;
  },

  // Получить статистику
  getStats: async (): Promise<any> => {
    const response = await api.get('/stats');
    return response.data;
  },

  // Получить отладочные данные
  getDebugData: async (): Promise<any> => {
    const response = await api.get('/debug');
    return response.data;
  },

  // Получить логи
  getLogs: async (level?: string, limit?: number): Promise<any> => {
    const response = await api.get('/logs', {
      params: { level, limit }
    });
    return response.data;
  },

  // Фильтровать кошельки
  filterWallets: async (filters: FilterOptions): Promise<{ wallets: WalletData[]; total: number }> => {
    const response = await api.post('/wallets/filter', filters);
    return response.data;
  },

  // Фильтровать токены по стоимости
  filterTokens: async (filters: FilterOptions): Promise<{ tokens: any[]; total: number }> => {
    const response = await api.post('/tokens/filter', filters);
    return response.data;
  },

  // Фильтровать протоколы по стоимости
  filterProtocols: async (filters: FilterOptions): Promise<{ protocols: any[]; total: number }> => {
    const response = await api.post('/protocols/filter', filters);
    return response.data;
  },

  // Добавить кошельки
  addWallets: async (addresses: string[]): Promise<any> => {
    const response = await api.post('/wallets/add', { addresses });
    return response.data;
  },

  // Очистить данные
  clearData: async (): Promise<any> => {
    const response = await api.delete('/wallets');
    return response.data;
  },

  // Очистить логи
  clearLogs: async (walletAddress?: string): Promise<any> => {
    const response = await api.delete('/logs', {
      params: { walletAddress }
    });
    return response.data;
  },

  // Очистить кэш
  clearCache: async (): Promise<any> => {
    const response = await api.delete('/cache');
    return response.data;
  },

  // Экспорт CSV
  exportCSV: async (): Promise<Blob> => {
    const response = await api.get('/export/csv', {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default apiService; 