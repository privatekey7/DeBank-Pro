import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { DeBankService } from './services/debankService';
import { DataProcessor } from './services/dataProcessor';
import { WalletData } from './types';
import { LoggerService } from './services/loggerService';
import { ProgressBar } from './utils/progressBar';
import { Logo } from './utils/logo';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:4001', // React app
  credentials: true
}));
app.use(express.json());

// Services
const debankService = new DeBankService();
const dataProcessor = new DataProcessor();
const logger = LoggerService.getInstance();

// Пути для файлов данных
const DATA_DIR = path.join(__dirname, '../../data');
const WALLETS_DATA_FILE = path.join(DATA_DIR, 'wallets_data.json');
const PROCESSING_STATE_FILE = path.join(DATA_DIR, 'processing_state.json');

// Создаем директорию для данных если её нет
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Функция для загрузки кошельков из файла
const loadWalletsFromFile = (): string[] => {
  try {
    const walletsPath = path.join(__dirname, '../../wallets.txt');
    logger.debug('Путь к файлу кошельков', { path: walletsPath });
    
    if (!fs.existsSync(walletsPath)) {
      logger.warn('Файл wallets.txt не найден, создаем пустой файл');
      fs.writeFileSync(walletsPath, '');
      return [];
    }
    
    const content = fs.readFileSync(walletsPath, 'utf8');
    const addresses = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('0x'));
    
    logger.info(`Загружено ${addresses.length} адресов кошельков из файла`);
    logger.debug('Адреса кошельков', { addresses });
    
    return addresses;
  } catch (error) {
    logger.error('Ошибка при загрузке кошельков из файла', error);
    return [];
  }
};

// Функция для сохранения данных кошельков в JSON файл
const saveWalletsData = (walletsData: WalletData[]): void => {
  try {
    const dataToSave = {
      timestamp: Date.now(),
      totalWallets: walletsData.length,
      wallets: walletsData
    };
    
    fs.writeFileSync(WALLETS_DATA_FILE, JSON.stringify(dataToSave, null, 2));
    logger.info(`Данные ${walletsData.length} кошельков сохранены в файл`);
  } catch (error) {
    logger.error('Ошибка при сохранении данных кошельков', error);
  }
};

// Функция для загрузки данных кошельков из JSON файла
const loadWalletsData = (): WalletData[] => {
  try {
    if (!fs.existsSync(WALLETS_DATA_FILE)) {
      logger.info('Файл с данными кошельков не найден, начинаем с пустого состояния');
      return [];
    }
    
    const fileContent = fs.readFileSync(WALLETS_DATA_FILE, 'utf8');
    const data = JSON.parse(fileContent);
    
    logger.info(`Загружено ${data.wallets.length} кошельков из файла данных`);
    return data.wallets || [];
  } catch (error) {
    logger.error('Ошибка при загрузке данных кошельков', error);
    return [];
  }
};

// Функция для очистки старых данных при запуске
const cleanupOldData = (): void => {
  try {
    // Удаляем старые файлы данных
    if (fs.existsSync(WALLETS_DATA_FILE)) {
      fs.unlinkSync(WALLETS_DATA_FILE);
      logger.info('Старые данные кошельков удалены');
    }
    
    if (fs.existsSync(PROCESSING_STATE_FILE)) {
      fs.unlinkSync(PROCESSING_STATE_FILE);
      logger.info('Старое состояние обработки удалено');
    }
    
    logger.info('Очистка старых данных завершена');
  } catch (error) {
    logger.error('Ошибка при очистке старых данных', error);
  }
};

// Функция для сохранения состояния обработки
const saveProcessingState = (state: { isProcessing: boolean; progress: { current: number; total: number } | null }): void => {
  try {
    const stateToSave = {
      ...state,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(PROCESSING_STATE_FILE, JSON.stringify(stateToSave, null, 2));
  } catch (error) {
    logger.error('Ошибка при сохранении состояния обработки', error);
  }
};

// In-memory storage
let walletsData: WalletData[] = [];
let isProcessing = false;
let processingProgress: { current: number; total: number } | null = null;

// API Routes

// Получить статус сервера
app.get('/api/status', (req, res) => {
  const proxyStatus = debankService.getProxyStatus();
  const proxyStats = debankService.getProxyStats();
  const loggerStats = logger.getStats();
  const cacheStats = debankService.getCacheStats();
  
  // Получаем общее количество кошельков из файла
  const totalWallets = loadWalletsFromFile().length;
  
  // Проверяем наличие файлов данных
  const hasDataFile = fs.existsSync(WALLETS_DATA_FILE);
  const hasStateFile = fs.existsSync(PROCESSING_STATE_FILE);
  
  // Получаем размер файла данных
  let dataFileSize = 0;
  if (hasDataFile) {
    try {
      const stats = fs.statSync(WALLETS_DATA_FILE);
      dataFileSize = stats.size;
    } catch (error) {
      logger.error('Ошибка при получении размера файла данных', error);
    }
  }
  
  res.json({
    status: 'running',
    walletsCount: totalWallets, // Используем общее количество из файла
    processedWalletsCount: walletsData.length, // Количество обработанных кошельков в памяти
    isProcessing,
    processingProgress, // Добавляем прогресс обработки
    dataFiles: {
      hasDataFile,
      hasStateFile,
      dataFileSize: `${(dataFileSize / 1024 / 1024).toFixed(2)} MB`
    },
    proxyStatus,
    proxyStats,
    loggerStats,
    cacheStats
  });
});

// Получить все данные кошельков
app.get('/api/wallets', (req, res) => {
  try {
    const { sortBy = 'totalValue', sortOrder = 'desc' } = req.query;
    
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    let sortedWallets = dataProcessor.sortWallets(
      walletsData, 
      sortBy as string, 
      sortOrder as 'asc' | 'desc'
    );

    res.json({
      wallets: sortedWallets,
      total: sortedWallets.length
    });
  } catch (error) {
    logger.error('Ошибка при получении кошельков', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить агрегированные данные
app.get('/api/aggregated', (req, res) => {
  try {
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const aggregated = dataProcessor.aggregateWalletsData(walletsData);
    res.json(aggregated);
  } catch (error) {
    logger.error('Ошибка при получении агрегированных данных', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить статистику
app.get('/api/stats', (req, res) => {
  try {
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const stats = dataProcessor.getWalletStats(walletsData);
    res.json(stats);
  } catch (error) {
    logger.error('Ошибка при получении статистики', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Фильтровать кошельки
app.post('/api/wallets/filter', (req, res) => {
  try {
    const filters = req.body;
    
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const filteredWallets = dataProcessor.filterWallets(walletsData, filters);
    
    res.json({
      wallets: filteredWallets,
      total: filteredWallets.length
    });
  } catch (error) {
    logger.error('Ошибка при фильтрации кошельков', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Фильтровать токены по стоимости
app.post('/api/tokens/filter', (req, res) => {
  try {
    const filters = req.body;
    
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const filteredTokens = dataProcessor.filterTokensByValue(walletsData, filters);
    
    res.json({
      tokens: filteredTokens,
      total: filteredTokens.length
    });
  } catch (error) {
    logger.error('Ошибка при фильтрации токенов', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Фильтровать протоколы по стоимости
app.post('/api/protocols/filter', (req, res) => {
  try {
    const filters = req.body;
    
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const filteredProtocols = dataProcessor.filterProtocolsByValue(walletsData, filters);
    
    res.json({
      protocols: filteredProtocols,
      total: filteredProtocols.length
    });
  } catch (error) {
    logger.error('Ошибка при фильтрации протоколов', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Экспорт в CSV
app.get('/api/export/csv', (req, res) => {
  try {
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const csvContent = dataProcessor.exportToCSV(walletsData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=wallets_data.csv');
    res.send(csvContent);
  } catch (error) {
    logger.error('Ошибка при экспорте CSV', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Очистить все данные
app.delete('/api/wallets', (req, res) => {
  try {
    walletsData = [];
    
    // Удаляем файл с данными
    if (fs.existsSync(WALLETS_DATA_FILE)) {
      fs.unlinkSync(WALLETS_DATA_FILE);
      logger.info('Файл с данными кошельков удален');
    }
    
    res.json({ message: 'Все данные очищены' });
  } catch (error) {
    logger.error('Ошибка при очистке данных', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить данные конкретного кошелька
app.get('/api/wallets/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    // Загружаем данные из файла если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = loadWalletsData();
    }
    
    const wallet = walletsData.find(w => w.address.toLowerCase() === address.toLowerCase());
    
    if (!wallet) {
      return res.status(404).json({ error: 'Кошелек не найден' });
    }
    
    res.json(wallet);
  } catch (error) {
    logger.error('Ошибка при получении кошелька', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить логи системы
app.get('/api/logs', (req, res) => {
  try {
    const { level, limit } = req.query;
    const logs = logger.getLogs(level as any, limit ? parseInt(limit as string) : undefined);
    res.json({ logs });
  } catch (error) {
    logger.error('Ошибка при получении логов', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить отладочную информацию
app.get('/api/debug', (req, res) => {
  try {
    const { walletAddress } = req.query;
    const debugData = logger.getDebugData(walletAddress as string);
    res.json({ debugData });
  } catch (error) {
    logger.error('Ошибка при получении отладочной информации', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Управление режимом отладки
app.post('/api/debug/mode', (req, res) => {
  try {
    const { enabled } = req.body;
    logger.setDebugMode(enabled);
    res.json({ message: `Режим отладки ${enabled ? 'включен' : 'выключен'}` });
  } catch (error) {
    logger.error('Ошибка при изменении режима отладки', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Очистить логи
app.delete('/api/logs', (req, res) => {
  try {
    const { walletAddress } = req.query;
    if (walletAddress) {
      logger.clearDebugData(walletAddress as string);
    } else {
      logger.clearLogs();
      logger.clearDebugData();
    }
    res.json({ message: 'Логи очищены' });
  } catch (error) {
    logger.error('Ошибка при очистке логов', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Очистить кэш
app.delete('/api/cache', (req, res) => {
  try {
    debankService.clearCache();
    res.json({ message: 'Кэш очищен' });
  } catch (error) {
    logger.error('Ошибка при очистке кэша', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Очистить все данные и файлы
app.delete('/api/data', (req, res) => {
  try {
    walletsData = [];
    
    // Удаляем файлы данных
    if (fs.existsSync(WALLETS_DATA_FILE)) {
      fs.unlinkSync(WALLETS_DATA_FILE);
      logger.info('Файл с данными кошельков удален');
    }
    
    if (fs.existsSync(PROCESSING_STATE_FILE)) {
      fs.unlinkSync(PROCESSING_STATE_FILE);
      logger.info('Файл состояния обработки удален');
    }
    
    // Очищаем кэш
    debankService.clearCache();
    
    res.json({ message: 'Все данные и файлы очищены' });
  } catch (error) {
    logger.error('Ошибка при очистке данных', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Перезапустить обработку кошельков
app.post('/api/wallets/process', async (req, res) => {
  try {
    if (isProcessing) {
      return res.status(400).json({ error: 'Обработка уже выполняется' });
    }
    
    const addresses = loadWalletsFromFile();
    if (addresses.length === 0) {
      return res.status(400).json({ error: 'Нет кошельков для обработки' });
    }
    
    Logo.showProcessingStart(addresses.length);
    await processWallets(addresses);
    
    res.json({ 
      message: `Обработка завершена. Обработано ${addresses.length} кошельков`,
      walletsCount: walletsData.length
    });
  } catch (error) {
    logger.error('Ошибка при перезапуске обработки кошельков', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Добавить кошельки
app.post('/api/wallets/add', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Неверный формат данных' });
    }
    
    // Сохраняем адреса в файл
    const walletsPath = path.join(__dirname, '../../wallets.txt');
    const existingAddresses = loadWalletsFromFile();
    const newAddresses = addresses.filter(addr => !existingAddresses.includes(addr));
    
    if (newAddresses.length > 0) {
      const allAddresses = [...existingAddresses, ...newAddresses];
      fs.writeFileSync(walletsPath, allAddresses.join('\n'));
      logger.info(`Добавлено ${newAddresses.length} новых кошельков`);
    }
    
    res.json({ 
      message: `Добавлено ${newAddresses.length} новых кошельков`,
      totalWallets: existingAddresses.length + newAddresses.length
    });
  } catch (error) {
    logger.error('Ошибка при добавлении кошельков', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Функция для обработки кошельков
const processWallets = async (addresses: string[]) => {
  logger.info(`Начинаем обработку ${addresses.length} кошельков`);
  const newWalletsData: WalletData[] = [];
  const failedAddresses: string[] = [];
  
  // Инициализируем прогресс
  processingProgress = { current: 0, total: addresses.length };
  isProcessing = true;
  
  // Создаем прогресс бар
  const progressBar = new ProgressBar(addresses.length);
  
  // Максимальное количество одновременных запросов
  const maxConcurrent = 3; // Уменьшаем для более стабильной работы
  const batchSize = addresses.length > 50 ? 15 : addresses.length > 20 ? 10 : 5; // Уменьшаем размер батча для лучшей стабильности
  
  // Функция для обработки одного кошелька с повторными попытками
  const processWalletWithRetry = async (address: string, retryCount = 0): Promise<WalletData | null> => {
    const maxRetries = 3;
    
    try {
      const walletData = await debankService.getWalletData(address);
      
      if (walletData) {
        logger.info(`Успешно получены данные для ${address}: $${walletData.totalValue.toFixed(2)}`);
        return walletData;
      } else {
        logger.warn(`Не удалось получить данные для ${address} (попытка ${retryCount + 1}/${maxRetries})`);
        return null;
      }
    } catch (error) {
      logger.error(`Ошибка при обработке кошелька ${address} (попытка ${retryCount + 1}/${maxRetries})`, error);
      
      if (retryCount < maxRetries - 1) {
        // Ждем перед повторной попыткой (увеличиваем время с каждой попыткой)
        const delay = (retryCount + 1) * 2000; // 2, 4, 6 секунд
        logger.info(`Повторная попытка для ${address} через ${delay}мс...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return processWalletWithRetry(address, retryCount + 1);
      } else {
        logger.error(`Исчерпаны все попытки для кошелька ${address}`);
        return null;
      }
    }
  };
  
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    logger.info(`Обработка батча ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)}: ${batch.length} кошельков`);
    
    // Создаем промисы для параллельной обработки
    const promises = batch.map(async (address, index) => {
      const globalIndex = i + index;
      logger.info(`Обработка кошелька ${globalIndex + 1}/${addresses.length}: ${address}`);
      
      const walletData = await processWalletWithRetry(address);
      return { address, walletData };
    });
    
    // Обрабатываем батч с ограничением параллелизма
    const batchResults = await Promise.allSettled(promises);
    
    // Собираем успешные результаты и неудачные адреса
    let successCount = 0;
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.walletData) {
        newWalletsData.push(result.value.walletData);
        successCount++;
      } else if (result.status === 'fulfilled' && !result.value.walletData) {
        failedAddresses.push(result.value.address);
      }
    });
    
    // Обновляем прогресс
    processingProgress.current = i + batch.length;
    progressBar.update(i + batch.length);
    
    logger.info(`Батч ${Math.floor(i / batchSize) + 1} завершен: ${successCount}/${batch.length} успешно`);
    
    // Увеличиваем паузу между батчами для снижения нагрузки
    if (i + batchSize < addresses.length) {
      logger.info(`Пауза между батчами...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Увеличиваем с 1 до 3 секунд
    }
  }
  
  // Обрабатываем неудачные кошельки еще раз с увеличенными задержками
  if (failedAddresses.length > 0) {
    logger.info(`Повторная обработка ${failedAddresses.length} неудачных кошельков...`);
    
    // Создаем отдельный прогресс бар для повторной обработки
    const retryProgressBar = new ProgressBar(failedAddresses.length);
    
    for (let i = 0; i < failedAddresses.length; i++) {
      const address = failedAddresses[i];
      logger.info(`Финальная попытка для ${address}...`);
      
      try {
        // Увеличиваем задержку перед финальной попыткой
        await new Promise(resolve => setTimeout(resolve, 10000)); // Увеличиваем с 5 до 10 секунд
        
        const walletData = await debankService.getWalletData(address);
        if (walletData) {
          newWalletsData.push(walletData);
          logger.info(`Успешно получены данные для ${address} в финальной попытке`);
        } else {
          logger.error(`Не удалось получить данные для ${address} даже в финальной попытке`);
        }
      } catch (error) {
        logger.error(`Ошибка при финальной попытке для ${address}`, error);
      }
      
      // Обновляем прогресс повторной обработки
      retryProgressBar.update(i + 1);
    }
    
    retryProgressBar.complete();
  }
  
  // Обновляем данные и сохраняем в файл
  walletsData = newWalletsData;
  saveWalletsData(newWalletsData);
  
  isProcessing = false;
  processingProgress = null;
  saveProcessingState({ isProcessing, progress: processingProgress });
  
  // Завершаем прогресс бар
  progressBar.complete();
  
  const successRate = ((newWalletsData.length / addresses.length) * 100).toFixed(1);
  logger.info(`Обработка завершена. Получено данных для ${newWalletsData.length}/${addresses.length} кошельков (${successRate}%)`);
  logger.debug('Данные кошельков после обновления', { walletsData });
};

// Запуск сервера
app.listen(PORT, async () => {
  // Показываем красивую заставку
  Logo.showLogo();
  Logo.showStartupStatus(Number(PORT));
  
  logger.info(`Backend сервер запущен на порту ${PORT}`);
  logger.info(`API доступен по адресу: http://localhost:${PORT}/api`);
  
  // Очищаем старые данные при запуске
  logger.info('Очистка старых данных при запуске...');
  cleanupOldData();
  
  // Загружаем данные из файла если есть
  logger.info('Загрузка данных кошельков из файла...');
  walletsData = loadWalletsData();
  
  if (walletsData.length > 0) {
    logger.info(`Загружено ${walletsData.length} кошельков из файла данных`);
  } else {
    // Автоматически загружаем и обрабатываем кошельки при запуске если нет сохраненных данных
    logger.info('Автоматическая загрузка кошельков из файла...');
    const addresses = loadWalletsFromFile();
    
    if (addresses.length > 0) {
      logger.info(`Найдено ${addresses.length} кошельков в файле wallets.txt`);
      logger.info('Начинаем автоматическую обработку...');
      Logo.showProcessingStart(addresses.length);
      
      await processWallets(addresses);
      
      logger.info('Автоматическая обработка завершена');
    } else {
      logger.warn('Файл wallets.txt пуст или не содержит валидных адресов');
    }
  }
});

export default app; 