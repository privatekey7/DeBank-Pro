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



// Функция для экспорта токенов с подробной информацией
export const exportTokensToExcel = (filteredTokens: any[], wallets: any[] = []) => {
  const exportData: any[] = [];
  
  // Используем отфильтрованные токены вместо всех токенов из кошельков
  filteredTokens.forEach(token => {
    // Находим кошельки, которые содержат этот конкретный токен
    const walletsWithToken = wallets.filter(wallet => 
      wallet.tokens.some((t: any) => t.symbol === token.symbol && t.chain === token.chain)
    );
    
    // Для каждого кошелька с этим токеном создаем отдельную строку
    walletsWithToken.forEach(wallet => {
      const walletToken = wallet.tokens.find((t: any) => t.symbol === token.symbol && t.chain === token.chain);
              if (walletToken) {
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
    });
  });
  
  exportToExcel(exportData, 'tokens_export', 'Токены');
};



// Функция для экспорта протоколов с подробной информацией
export const exportProtocolsToExcel = (filteredProtocols: any[], wallets: any[] = []) => {
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
        // Собираем токены этого кошелька в той же цепочке
        const tokensInChain = wallet.tokens.filter((token: any) => token.chain === walletProtocol.chain);
        const totalTokensValue = tokensInChain.reduce((sum: number, token: any) => sum + token.value, 0);
        
        exportData.push({
          'Название протокола': walletProtocol.name,
          'Цепочка': walletProtocol.chain,
          'Категория': walletProtocol.category || 'defi',
          'Стоимость протокола в кошельке (USD)': walletProtocol.value, // Индивидуальная стоимость для этого кошелька
          'Адрес кошелька': wallet.address
        });
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