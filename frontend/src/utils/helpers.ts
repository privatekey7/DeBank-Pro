import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Утилита для объединения классов Tailwind
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

// Форматирование валюты
export const formatCurrency = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Форматирование процентов
export const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Форматирование адреса кошелька
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Получение цвета для изменения цены
export const getPriceChangeColor = (change: number): string => {
  if (change > 0) return 'text-green-400';
  if (change < 0) return 'text-red-400';
  return 'text-slate-400';
};

// Получение иконки для изменения цены
export const getPriceChangeIcon = (change: number): string => {
  if (change > 0) return '↗';
  if (change < 0) return '↘';
  return '→';
};

// Форматирование числа с разделителями
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

// Форматирование баланса токенов с до 6 знаков после запятой
export const formatTokenBalance = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
};

// Получение цвета для цепочки
export const getChainColor = (chain: string): string => {
  const colors: Record<string, string> = {
    'ethereum': 'bg-blue-500',
    'bsc': 'bg-yellow-500',
    'polygon': 'bg-purple-500',
    'arbitrum': 'bg-blue-600',
    'optimism': 'bg-red-500',
    'avalanche': 'bg-red-600',
    'fantom': 'bg-purple-600',
    'base': 'bg-blue-700',
  };
  return colors[chain.toLowerCase()] || 'bg-slate-500';
};

// Получение цвета для протокола
export const getProtocolColor = (category: string): string => {
  const colors: Record<string, string> = {
    'lending': 'bg-green-500',
    'dex': 'bg-blue-500',
    'yield': 'bg-purple-500',
    'bridge': 'bg-orange-500',
    'staking': 'bg-indigo-500',
    'governance': 'bg-pink-500',
  };
  return colors[category.toLowerCase()] || 'bg-slate-500';
};

// Сокращение больших чисел
export const abbreviateNumber = (value: number): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
};

// Получение времени с момента обновления
export const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

// Валидация адреса Ethereum
export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Функция для получения ссылки на эксплорер токена
export const getTokenExplorerUrl = (tokenAddress: string, chain: string): string => {
  if (!tokenAddress || !chain) return '';
  
  const chainLower = chain.toLowerCase();
  
  // Маппинг эксплореров для разных сетей
  const explorerUrls: { [key: string]: string } = {
    'eth': 'https://etherscan.io/token/',
    'arb': 'https://arbiscan.io/token/',
    'op': 'https://optimistic.etherscan.io/token/',
    'bsc': 'https://bscscan.com/token/',
    'matic': 'https://polygonscan.com/token/',
    'avax': 'https://snowtrace.io/token/',
    'ftm': 'https://ftmscan.com/token/',
    'xdai': 'https://gnosisscan.io/token/',
    'celo': 'https://celoscan.io/token/',
    'kava': 'https://explorer.kava.io/token/',
    'klay': 'https://scope.klaytn.com/token/',
    'core': 'https://scan.coredao.org/token/',
    'dfk': 'https://subnets.avax.network/defi-kingdoms/token/',
    'base': 'https://basescan.org/token/',
    'linea': 'https://lineascan.build/token/',
    'mnt': 'https://explorer.mantle.xyz/token/',
    'scrl': 'https://scrollscan.com/token/',
    'era': 'https://explorer.zksync.io/token/',
    'nova': 'https://nova.arbiscan.io/token/',
    'canto': 'https://tuber.build/token/',
    'doge': 'https://explorer.dogechain.dog/token/',
    'cfx': 'https://confluxscan.io/token/',
    'ron': 'https://explorer.roninchain.com/token/',
    'pze': 'https://zkevm.polygonscan.com/token/',
    'wemix': 'https://explorer.wemix.com/token/',
    'flr': 'https://flare-explorer.flare.network/token/',
    'oas': 'https://explorer.oasys.games/token/',
    'zora': 'https://explorer.zora.energy/token/',
    'opbnb': 'https://opbnbscan.com/token/',
    'shib': 'https://shibariumscan.com/token/',
    'mode': 'https://sepolia.explorer.mode.network/token/',
    'zeta': 'https://explorer.zetachain.com/token/',
    'rari': 'https://mainnet.rarichain.org/token/',
    'merlin': 'https://scan.merlinchain.io/token/',
    'blast': 'https://blastscan.io/token/',
    'karak': 'https://explorer.karak.network/token/',
    'frax': 'https://fraxscan.com/token/',
    'xlayer': 'https://www.xlayerscan.io/token/',
    'itze': 'https://explorer.immutable.com/token/',
    'btr': 'https://www.bitlayerscan.io/token/',
    'b2': 'https://scan.b2.network/token/',
    'bob': 'https://bobscan.com/token/',
    'reya': 'https://explorer.reya.network/token/',
    'bb': 'https://scan.bouncebit.io/token/',
    'taiko': 'https://explorer.a2.taiko.xyz/token/',
    'cyber': 'https://cyberscan.co/token/',
    'sei': 'https://www.seiscan.app/token/',
    'mint': 'https://explorer.mintchain.io/token/',
    'chiliz': 'https://explorer.chiliz.com/token/',
    'dbk': 'https://explorer.dbkchain.com/token/',
    'croze': 'https://cronos.org/explorer/cronos-zkevm/token/',
    'gravity': 'https://explorer.gravitybridge.io/token/',
    'lisk': 'https://explorer.lisk.com/token/',
    'orderly': 'https://explorer.orderly.network/token/',
    'ape': 'https://explorer.apechain.com/token/',
    'ethlink': 'https://explorer.etherlink.com/token/',
    'zircuit': 'https://explorer.zircuit.com/token/',
    'world': 'https://explorer.worldcoin.org/token/',
    'morph': 'https://explorer.morphl2.io/token/',
    'swell': 'https://explorer.swellnetwork.io/token/',
    'zero': 'https://explorer.zerolabs.xyz/token/',
    'sonic': 'https://explorer.sonic.game/token/',
    'corn': 'https://explorer.cornchain.io/token/',
    'hsk': 'https://explorer.hashkey.com/token/',
    'ink': 'https://explorer.inkchain.io/token/',
    'vana': 'https://explorer.vanachain.org/token/',
    'sophon': 'https://explorer.sophon.org/token/',
    'duck': 'https://explorer.duckchain.io/token/',
    'abs': 'https://explorer.abstract.money/token/',
    'soneium': 'https://explorer.soneium.com/token/',
    'bera': 'https://artio.berachain.com/token/',
    'uni': 'https://explorer.unichain.world/token/',
    'story': 'https://explorer.story.xyz/token/',
    'lens': 'https://explorer.lens.xyz/token/',
    'hyper': 'https://explorer.hyperevm.com/token/',
    'hemi': 'https://explorer.hemi.xyz/token/',
    'plume': 'https://explorer.plume.network/token/',
    'katana': 'https://explorer.katana.xyz/token/',
    'xrpl': 'https://explorer.xrpl.org/token/'
  };
  
  const explorerUrl = explorerUrls[chainLower];
  if (!explorerUrl) {
    // Если нет специфичного эксплорера, используем DeBank
    return `https://debank.com/token/${chainLower}?q=${tokenAddress}`;
  }
  
  return `${explorerUrl}${tokenAddress}`;
}; 