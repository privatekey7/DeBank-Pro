"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const debankService_1 = require("./services/debankService");
const dataProcessor_1 = require("./services/dataProcessor");
const loggerService_1 = require("./services/loggerService");
const progressBar_1 = require("./utils/progressBar");
const logo_1 = require("./utils/logo");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: 'http://localhost:4001', // React app
    credentials: true
}));
app.use(express_1.default.json());
// Services
const debankService = new debankService_1.DeBankService();
const dataProcessor = new dataProcessor_1.DataProcessor();
const logger = loggerService_1.LoggerService.getInstance();
// Пути для файлов данных
const DATA_DIR = path_1.default.join(__dirname, '../../data');
const WALLETS_DATA_FILE = path_1.default.join(DATA_DIR, 'wallets_data.json');
const PROCESSING_STATE_FILE = path_1.default.join(DATA_DIR, 'processing_state.json');
// Создаем директорию для данных если её нет
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
// Функция для загрузки кошельков из файла
const loadWalletsFromFile = () => {
    try {
        const walletsPath = path_1.default.join(__dirname, '../../wallets.txt');
        logger.debug('Путь к файлу кошельков', { path: walletsPath });
        if (!fs_1.default.existsSync(walletsPath)) {
            logger.warn('Файл wallets.txt не найден, создаем пустой файл');
            fs_1.default.writeFileSync(walletsPath, '');
            return [];
        }
        const content = fs_1.default.readFileSync(walletsPath, 'utf8');
        const addresses = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.startsWith('0x'));
        logger.info(`Загружено ${addresses.length} адресов кошельков из файла`);
        logger.debug('Адреса кошельков', { addresses });
        return addresses;
    }
    catch (error) {
        logger.error('Ошибка при загрузке кошельков из файла', error);
        return [];
    }
};
// Функция для сохранения данных кошельков в JSON файл
const saveWalletsData = (walletsData) => {
    try {
        const dataToSave = {
            timestamp: Date.now(),
            totalWallets: walletsData.length,
            wallets: walletsData
        };
        fs_1.default.writeFileSync(WALLETS_DATA_FILE, JSON.stringify(dataToSave, null, 2));
        logger.info(`Данные ${walletsData.length} кошельков сохранены в файл`);
    }
    catch (error) {
        logger.error('Ошибка при сохранении данных кошельков', error);
    }
};
// Функция для загрузки данных кошельков из JSON файла
const loadWalletsData = () => {
    try {
        if (!fs_1.default.existsSync(WALLETS_DATA_FILE)) {
            logger.info('Файл с данными кошельков не найден, начинаем с пустого состояния');
            return [];
        }
        const fileContent = fs_1.default.readFileSync(WALLETS_DATA_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        logger.info(`Загружено ${data.wallets.length} кошельков из файла данных`);
        return data.wallets || [];
    }
    catch (error) {
        logger.error('Ошибка при загрузке данных кошельков', error);
        return [];
    }
};
// Функция для очистки старых данных при запуске
const cleanupOldData = () => {
    try {
        // Удаляем старые файлы данных
        if (fs_1.default.existsSync(WALLETS_DATA_FILE)) {
            fs_1.default.unlinkSync(WALLETS_DATA_FILE);
            logger.info('Старые данные кошельков удалены');
        }
        if (fs_1.default.existsSync(PROCESSING_STATE_FILE)) {
            fs_1.default.unlinkSync(PROCESSING_STATE_FILE);
            logger.info('Старое состояние обработки удалено');
        }
        logger.info('Очистка старых данных завершена');
    }
    catch (error) {
        logger.error('Ошибка при очистке старых данных', error);
    }
};
// Функция для сохранения состояния обработки
const saveProcessingState = (state) => {
    try {
        const stateToSave = {
            ...state,
            timestamp: Date.now()
        };
        fs_1.default.writeFileSync(PROCESSING_STATE_FILE, JSON.stringify(stateToSave, null, 2));
    }
    catch (error) {
        logger.error('Ошибка при сохранении состояния обработки', error);
    }
};
// In-memory storage
let walletsData = [];
let isProcessing = false;
let processingProgress = null;
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
    const hasDataFile = fs_1.default.existsSync(WALLETS_DATA_FILE);
    const hasStateFile = fs_1.default.existsSync(PROCESSING_STATE_FILE);
    // Получаем размер файла данных
    let dataFileSize = 0;
    if (hasDataFile) {
        try {
            const stats = fs_1.default.statSync(WALLETS_DATA_FILE);
            dataFileSize = stats.size;
        }
        catch (error) {
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
        let sortedWallets = dataProcessor.sortWallets(walletsData, sortBy, sortOrder);
        res.json({
            wallets: sortedWallets,
            total: sortedWallets.length
        });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        logger.error('Ошибка при фильтрации кошельков', error);
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
    }
    catch (error) {
        logger.error('Ошибка при экспорте CSV', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Очистить все данные
app.delete('/api/wallets', (req, res) => {
    try {
        walletsData = [];
        // Удаляем файл с данными
        if (fs_1.default.existsSync(WALLETS_DATA_FILE)) {
            fs_1.default.unlinkSync(WALLETS_DATA_FILE);
            logger.info('Файл с данными кошельков удален');
        }
        res.json({ message: 'Все данные очищены' });
    }
    catch (error) {
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
    }
    catch (error) {
        logger.error('Ошибка при получении кошелька', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Получить логи системы
app.get('/api/logs', (req, res) => {
    try {
        const { level, limit } = req.query;
        const logs = logger.getLogs(level, limit ? parseInt(limit) : undefined);
        res.json({ logs });
    }
    catch (error) {
        logger.error('Ошибка при получении логов', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Получить отладочную информацию
app.get('/api/debug', (req, res) => {
    try {
        const { walletAddress } = req.query;
        const debugData = logger.getDebugData(walletAddress);
        res.json({ debugData });
    }
    catch (error) {
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
    }
    catch (error) {
        logger.error('Ошибка при изменении режима отладки', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Очистить логи
app.delete('/api/logs', (req, res) => {
    try {
        const { walletAddress } = req.query;
        if (walletAddress) {
            logger.clearDebugData(walletAddress);
        }
        else {
            logger.clearLogs();
            logger.clearDebugData();
        }
        res.json({ message: 'Логи очищены' });
    }
    catch (error) {
        logger.error('Ошибка при очистке логов', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Очистить кэш
app.delete('/api/cache', (req, res) => {
    try {
        debankService.clearCache();
        res.json({ message: 'Кэш очищен' });
    }
    catch (error) {
        logger.error('Ошибка при очистке кэша', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Очистить все данные и файлы
app.delete('/api/data', (req, res) => {
    try {
        walletsData = [];
        // Удаляем файлы данных
        if (fs_1.default.existsSync(WALLETS_DATA_FILE)) {
            fs_1.default.unlinkSync(WALLETS_DATA_FILE);
            logger.info('Файл с данными кошельков удален');
        }
        if (fs_1.default.existsSync(PROCESSING_STATE_FILE)) {
            fs_1.default.unlinkSync(PROCESSING_STATE_FILE);
            logger.info('Файл состояния обработки удален');
        }
        // Очищаем кэш
        debankService.clearCache();
        res.json({ message: 'Все данные и файлы очищены' });
    }
    catch (error) {
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
        logo_1.Logo.showProcessingStart(addresses.length);
        await processWallets(addresses);
        res.json({
            message: `Обработка завершена. Обработано ${addresses.length} кошельков`,
            walletsCount: walletsData.length
        });
    }
    catch (error) {
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
        const walletsPath = path_1.default.join(__dirname, '../../wallets.txt');
        const existingAddresses = loadWalletsFromFile();
        const newAddresses = addresses.filter(addr => !existingAddresses.includes(addr));
        if (newAddresses.length > 0) {
            const allAddresses = [...existingAddresses, ...newAddresses];
            fs_1.default.writeFileSync(walletsPath, allAddresses.join('\n'));
            logger.info(`Добавлено ${newAddresses.length} новых кошельков`);
        }
        res.json({
            message: `Добавлено ${newAddresses.length} новых кошельков`,
            totalWallets: existingAddresses.length + newAddresses.length
        });
    }
    catch (error) {
        logger.error('Ошибка при добавлении кошельков', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
// Функция для обработки кошельков
const processWallets = async (addresses) => {
    logger.info(`Начинаем обработку ${addresses.length} кошельков`);
    const newWalletsData = [];
    const failedAddresses = [];
    // Инициализируем прогресс
    processingProgress = { current: 0, total: addresses.length };
    isProcessing = true;
    // Создаем прогресс бар
    const progressBar = new progressBar_1.ProgressBar(addresses.length);
    // Максимальное количество одновременных запросов
    const maxConcurrent = 5;
    const batchSize = addresses.length > 50 ? 20 : addresses.length > 20 ? 15 : 10; // Адаптивный размер батча
    // Функция для обработки одного кошелька с повторными попытками
    const processWalletWithRetry = async (address, retryCount = 0) => {
        const maxRetries = 3;
        try {
            const walletData = await debankService.getWalletData(address);
            if (walletData) {
                logger.info(`Успешно получены данные для ${address}: $${walletData.totalValue.toFixed(2)}`);
                return walletData;
            }
            else {
                logger.warn(`Не удалось получить данные для ${address} (попытка ${retryCount + 1}/${maxRetries})`);
                return null;
            }
        }
        catch (error) {
            logger.error(`Ошибка при обработке кошелька ${address} (попытка ${retryCount + 1}/${maxRetries})`, error);
            if (retryCount < maxRetries - 1) {
                // Ждем перед повторной попыткой (увеличиваем время с каждой попыткой)
                const delay = (retryCount + 1) * 2000; // 2, 4, 6 секунд
                logger.info(`Повторная попытка для ${address} через ${delay}мс...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return processWalletWithRetry(address, retryCount + 1);
            }
            else {
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
            }
            else if (result.status === 'fulfilled' && !result.value.walletData) {
                failedAddresses.push(result.value.address);
            }
        });
        // Обновляем прогресс
        processingProgress.current = i + batch.length;
        progressBar.update(i + batch.length);
        logger.info(`Батч ${Math.floor(i / batchSize) + 1} завершен: ${successCount}/${batch.length} успешно`);
        // Небольшая пауза между батчами для снижения нагрузки
        if (i + batchSize < addresses.length) {
            logger.info(`Пауза между батчами...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    // Обрабатываем неудачные кошельки еще раз с увеличенными задержками
    if (failedAddresses.length > 0) {
        logger.info(`Повторная обработка ${failedAddresses.length} неудачных кошельков...`);
        // Создаем отдельный прогресс бар для повторной обработки
        const retryProgressBar = new progressBar_1.ProgressBar(failedAddresses.length);
        for (let i = 0; i < failedAddresses.length; i++) {
            const address = failedAddresses[i];
            logger.info(`Финальная попытка для ${address}...`);
            try {
                // Увеличиваем задержку перед финальной попыткой
                await new Promise(resolve => setTimeout(resolve, 5000));
                const walletData = await debankService.getWalletData(address);
                if (walletData) {
                    newWalletsData.push(walletData);
                    logger.info(`Успешно получены данные для ${address} в финальной попытке`);
                }
                else {
                    logger.error(`Не удалось получить данные для ${address} даже в финальной попытке`);
                }
            }
            catch (error) {
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
    logo_1.Logo.showLogo();
    logo_1.Logo.showStartupStatus(Number(PORT));
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
    }
    else {
        // Автоматически загружаем и обрабатываем кошельки при запуске если нет сохраненных данных
        logger.info('Автоматическая загрузка кошельков из файла...');
        const addresses = loadWalletsFromFile();
        if (addresses.length > 0) {
            logger.info(`Найдено ${addresses.length} кошельков в файле wallets.txt`);
            logger.info('Начинаем автоматическую обработку...');
            logo_1.Logo.showProcessingStart(addresses.length);
            await processWallets(addresses);
            logger.info('Автоматическая обработка завершена');
        }
        else {
            logger.warn('Файл wallets.txt пуст или не содержит валидных адресов');
        }
    }
});
exports.default = app;
//# sourceMappingURL=server.js.map