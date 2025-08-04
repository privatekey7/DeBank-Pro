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
  getLogs: async (params?: { level?: string; limit?: string }): Promise<any> => {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append('level', params.level);
    if (params?.limit) queryParams.append('limit', params.limit);
    
    const response = await api.get(`/logs?${queryParams}`);
    return response.data;
  },

  // Переключить режим отладки
  toggleDebugMode: async (enabled: boolean): Promise<any> => {
    const response = await api.post('/debug/mode', { enabled });
    return response.data;
  },

  // Очистить логи
  clearLogs: async (walletAddress?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (walletAddress) params.append('walletAddress', walletAddress);
    
    const response = await api.delete(`/logs?${params}`);
    return response.data;
  },

  // Фильтровать кошельки
  filterWallets: async (filters: FilterOptions): Promise<{ wallets: WalletData[]; total: number }> => {
    const response = await api.post('/wallets/filter', filters);
    return response.data;
  },

  // Экспорт в CSV
  exportCSV: async (): Promise<Blob> => {
    const response = await api.get('/export/csv', {
      responseType: 'blob'
    });
    return response.data;
  },

  // Очистить данные
  clearData: async (): Promise<{ message: string }> => {
    const response = await api.delete('/wallets');
    return response.data;
  },

  // Перезапустить обработку кошельков
  processWallets: async (): Promise<{ message: string; walletsCount: number }> => {
    const response = await api.post('/wallets/process');
    return response.data;
  },

  // Получить данные конкретного кошелька
  getWallet: async (address: string): Promise<WalletData> => {
    const response = await api.get(`/wallets/${address}`);
    return response.data;
  },
};

export default apiService; 