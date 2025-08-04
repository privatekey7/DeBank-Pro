import chalk from 'chalk';

export class Logo {
  // Функция для подсчета видимой длины строки (без ANSI кодов и с учетом эмодзи)
  private static getVisibleLength(str: string): number {
    // Убираем ANSI коды
    const cleanStr = str.replace(/\u001b\[[0-9;]*m/g, '');
    
    // Подсчитываем длину с учетом эмодзи
    let length = 0;
    for (let i = 0; i < cleanStr.length; i++) {
      const char = cleanStr[i];
      // Эмодзи обычно занимают 2 символа в консоли
      if (char.charCodeAt(0) > 127) {
        length += 2;
      } else {
        length += 1;
      }
    }
    return length;
  }

  // Красивая ANSI заставка
  static showLogo() {
    console.clear(); // Очищаем экран
    
    const logo = `
${chalk.cyan('╔══════════════════════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                                              ${chalk.cyan('║')}
${chalk.cyan('║')}             ${chalk.green.bold('██████╗ ███████╗██████╗  █████╗ ███╗   ██╗██╗  ██╗')}               ${chalk.cyan('║')}
${chalk.cyan('║')}             ${chalk.green.bold('██╔══██╗██╔════╝██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝')}               ${chalk.cyan('║')}
${chalk.cyan('║')}             ${chalk.green.bold('██║  ██║█████╗  ██████╔╝███████║██╔██╗ ██║█████╔╝')}                ${chalk.cyan('║')}
${chalk.cyan('║')}             ${chalk.green.bold('██║  ██║██╔══╝  ██╔══██╗██╔══██║██║╚██╗██║██╔═██╗')}                ${chalk.cyan('║')}
${chalk.cyan('║')}             ${chalk.green.bold('██████╔╝███████╗██████╔╝██║  ██║██║ ╚████║██║  ██╗')}               ${chalk.cyan('║')}
${chalk.cyan('║')}             ${chalk.green.bold('╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝')}               ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                              ${chalk.cyan('║')}
${chalk.cyan('║')}                          ${chalk.blue.bold('██████╗ ██████╗   ██████╗')}                           ${chalk.cyan('║')}
${chalk.cyan('║')}                          ${chalk.blue.bold('██╔══██╗██╔══██╗ ██╔═══██╗')}                          ${chalk.cyan('║')}
${chalk.cyan('║')}                          ${chalk.blue.bold('██████╔╝██████╔╝ ██║   ██║')}                          ${chalk.cyan('║')}
${chalk.cyan('║')}                          ${chalk.blue.bold('██╔═══╝ ██╔══██╗ ██║   ██║')}                          ${chalk.cyan('║')}
${chalk.cyan('║')}                          ${chalk.blue.bold('██║     ██║  ║██╗ ██████╔╝')}                          ${chalk.cyan('║')}
${chalk.cyan('║')}                          ${chalk.blue.bold('╚═╝     ╚═╝  ╚══╝')}  ╚════╝                           ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                              ${chalk.cyan('║')}
${chalk.cyan('║')}                    ${chalk.gray('💎 Автор: ')}${chalk.blue('https://t.me/privatekey7')}${chalk.gray('💎')}                      ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                              ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════════════════════╝')}
`;

    console.log(logo);
    console.log(''); // Пустая строка после логотипа
  }

  // Показываем информацию о системе
  static showSystemInfo() {
    // Убираем информацию о системе
    return;
  }

  // Показываем статус запуска
  static showStartupStatus(port: number) {
    console.log('');
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + '                    ' + chalk.green.bold('✅ СЕРВЕР УСПЕШНО ЗАПУЩЕН ✅') + '                              ' + chalk.cyan('║'));
    console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + chalk.white(`  🌐 API доступен по адресу: http://localhost:${port}/api`) + '                        ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.white(`  📱 Frontend доступен по адресу: http://localhost:4001`) + '                       ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.white(`  📊 Статус сервера: http://localhost:4000/api/status`) + '                         ' + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════════════════════╝'));
    console.log('');
  }

  // Показываем сообщение о начале обработки
  static showProcessingStart(walletCount: number) {
    console.log('');
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + '                  ' + chalk.yellow.bold('🔄 НАЧАЛО ОБРАБОТКИ КОШЕЛЬКОВ 🔄') + '                            ' + chalk.cyan('║'));
    console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + chalk.white(`  📋 Количество кошельков для обработки: ${walletCount}`) + '                                   ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.white(`  ⏱️  Время начала: ${new Date().toLocaleString('ru-RU')}`) + '                                       ' + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════════════════════╝'));
    console.log('');
  }
} 