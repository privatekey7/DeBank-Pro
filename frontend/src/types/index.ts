export type WalletData = {
  address: string;
  totalValue: number;
  change24h: number;
  rank?: number;
  age?: number;
  followers?: number;
  following?: number;
  chains: ChainData[];
  tokens: TokenData[];
  protocols: ProtocolData[];
  lastUpdated: string;
};

export type ChainData = {
  name: string;
  value: number;
  tokens: TokenData[];
};

export type TokenData = {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  price: number;
  chain: string;
  logo?: string;
  address?: string;
};

export type ProtocolData = {
  id: string;
  name: string;
  value: number;
  chain: string;
  category: string;
  logo?: string;
};

export type AggregatedData = {
  totalValue: number;
  totalChange24h: number;
  walletsCount: number;
  topTokens: TokenData[];
  topChains: ChainData[];
  topProtocols: ProtocolData[];
  wallets: WalletData[];
};

export type ProcessingProgress = {
  current: number;
  total: number;
};

export type ServerStatus = {
  status: string;
  walletsCount: number;
  isProcessing: boolean;
  processingProgress?: ProcessingProgress;
  proxyStatus: {
    currentProxy: string;
    totalProxies: number;
    workingProxies: number;
  };
  loggerStats?: {
    totalLogs: number;
    totalDebugData: number;
    debugMode: boolean;
  };
};

export type FilterOptions = {
  minValue?: number;
  maxValue?: number;
  chains?: string[];
  protocols?: string[];
  selectedToken?: string;
  selectedProtocol?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ChartData = {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
};

export type TabType = 'overview' | 'wallets' | 'tokens' | 'protocols' | 'debug'; 