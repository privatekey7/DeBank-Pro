# DeBank Pro Backend

Backend сервер для сбора данных с DeBank через playwright-extra и puppeteer-extra-plugin-stealth.

## Установка

```bash
npm install
```

## Настройка прокси

1. Отредактируйте файл `../proxy.txt` в корне проекта
2. Добавьте ваши прокси по одному на строку
3. Поддерживаемые форматы:
   - `http://user:pass@host:port`
   - `socks5://user:pass@host:port`
   - `host:port`
   - `user:pass@host:port`

## Запуск

### Режим разработки
```bash
npm run dev
```

### Продакшн
```bash
npm run build
npm start
```

## API Endpoints

### Статус сервера
```
GET /api/status
```

### Добавить кошельки
```
POST /api/wallets/add
Body: { "addresses": ["0x123...", "0x456..."] }
```

### Получить кошельки
```
GET /api/wallets?sortBy=totalValue&sortOrder=desc
```

### Агрегированные данные
```
GET /api/aggregated
```

### Статистика
```
GET /api/stats
```

### Фильтрация
```
POST /api/wallets/filter
Body: { "minValue": 1000, "chains": ["ethereum"] }
```

### Экспорт CSV
```
GET /api/export/csv
```

### Очистить данные
```
DELETE /api/wallets
```

## Особенности

- Автоматическая ротация прокси
- Обработка ошибок и повторные попытки
- Stealth режим для обхода блокировок
- In-memory хранение данных
- Поддержка множественных кошельков

## Логи

Сервер выводит подробные логи процесса обработки кошельков и статуса прокси. 