import * as ExcelJS from 'exceljs';

export const exportToExcel = async (data: any[], filename: string, sheetName: string = 'Data') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    data.forEach(row => {
      const rowData = headers.map(header => row[header]);
      worksheet.addRow(rowData);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Функция для экспорта токенов с подробной информацией и правильной фильтрацией
export const exportTokensToExcel = (filteredTokens: any[], wallets: any[] = [], filters?: any) => {
  const exportData: any[] = [];
  
  // Проходим по всем кошелькам
  wallets.forEach(wallet => {
    wallet.tokens.forEach((walletToken: any) => {
      // Проверяем, есть ли этот токен в отфильтрованных данных
      const isTokenInFiltered = filteredTokens.some(filteredToken => 
        filteredToken.symbol === walletToken.symbol && 
        filteredToken.chain === walletToken.chain
      );
      
      if (isTokenInFiltered) {
        // Применяем фильтры по минимальной и максимальной сумме к конкретному токену
        let shouldInclude = true;
        
        if (filters?.minValue !== undefined && walletToken.value < filters.minValue) {
          shouldInclude = false;
        }
        
        if (filters?.maxValue !== undefined && walletToken.value > filters.maxValue) {
          shouldInclude = false;
        }
        
        if (shouldInclude) {
          exportData.push({
            'Символ': walletToken.symbol,
            'Название': walletToken.name,
            'Цепочка': walletToken.chain,
            'Баланс': walletToken.balance,
            'Цена': walletToken.price,
            'Стоимость': walletToken.value,
            'Адрес кошелька': wallet.address
          });
        }
      }
    });
  });
  
  exportToExcel(exportData, 'tokens_export', 'Токены');
};

// Функция для экспорта протоколов с подробной информацией и правильной фильтрацией
export const exportProtocolsToExcel = (filteredProtocols: any[], wallets: any[] = [], filters?: any) => {
  const exportData: any[] = [];
  
  // Создаем уникальный список протоколов из отфильтрованных данных
  const uniqueProtocols = new Map<string, any>();
  filteredProtocols.forEach(protocol => {
    const key = `${protocol.name}-${protocol.chain}`;
    uniqueProtocols.set(key, protocol);
  });
  
  // Проходим по всем кошелькам и их протоколам
  wallets.forEach(wallet => {
    wallet.protocols.forEach((walletProtocol: any) => {
      const protocolKey = `${walletProtocol.name}-${walletProtocol.chain}`;
      
      // Проверяем, есть ли этот протокол в отфильтрованных данных
      if (uniqueProtocols.has(protocolKey)) {
        // Применяем фильтры по минимальной и максимальной сумме к конкретному протоколу
        let shouldInclude = true;
        
        if (filters?.minValue !== undefined && walletProtocol.value < filters.minValue) {
          shouldInclude = false;
        }
        
        if (filters?.maxValue !== undefined && walletProtocol.value > filters.maxValue) {
          shouldInclude = false;
        }
        
        if (shouldInclude) {
          exportData.push({
            'Название протокола': walletProtocol.name,
            'Цепочка': walletProtocol.chain,
            'Категория': walletProtocol.category || 'defi',
            'Стоимость протокола в кошельке (USD)': walletProtocol.value,
            'Адрес кошелька': wallet.address
          });
        }
      }
    });
  });
  
  exportToExcel(exportData, 'protocols_export', 'Протоколы');
};

// Функция для экспорта кошельков
export const exportWalletsToExcel = (wallets: any[]) => {
  const exportData = wallets.map(wallet => ({
    'Адрес': wallet.address,
    'Общая стоимость': wallet.totalValue,
    'Количество токенов': wallet.tokens.length,
    'Количество протоколов': wallet.protocols.length,
    'Цепочки': wallet.chains.map((chain: any) => chain.name).join(', '),
    'Последнее обновление': wallet.lastUpdated
  }));
  
  exportToExcel(exportData, 'wallets_export', 'Кошельки');
}; 