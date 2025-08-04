"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logo = void 0;
// Простые ANSI коды для цветов
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};
class Logo {
    // Функция для подсчета видимой длины строки (без ANSI кодов и с учетом эмодзи)
    static getVisibleLength(str) {
        // Убираем ANSI коды
        const cleanStr = str.replace(/\u001b\[[0-9;]*m/g, '');
        // Подсчитываем длину с учетом эмодзи
        let length = 0;
        for (let i = 0; i < cleanStr.length; i++) {
            const char = cleanStr[i];
            // Эмодзи обычно занимают 2 символа в консоли
            if (char.charCodeAt(0) > 127) {
                length += 2;
            }
            else {
                length += 1;
            }
        }
        return length;
    }
    // Красивая ANSI заставка
    static showLogo() {
        console.clear(); // Очищаем экран
        const logo = `
${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║${colors.reset}                                                                              ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}             ${colors.green}${colors.bright}██████╗ ███████╗██████╗  █████╗ ███╗   ██╗██╗  ██╗${colors.reset}               ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}             ${colors.green}${colors.bright}██╔══██╗██╔════╝██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝${colors.reset}               ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}             ${colors.green}${colors.bright}██║  ██║█████╗  ██████╔╝███████║██╔██╗ ██║█████╔╝${colors.reset}                ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}             ${colors.green}${colors.bright}██║  ██║██╔══╝  ██╔══██╗██╔══██║██║╚██╗██║██╔═██╗${colors.reset}                ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}             ${colors.green}${colors.bright}██████╔╝███████╗██████╔╝██║  ██║██║ ╚████║██║  ██╗${colors.reset}               ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}             ${colors.green}${colors.bright}╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝${colors.reset}               ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                                                                              ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.blue}${colors.bright}██████╗ ██████╗   ██████╗${colors.reset}                           ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.blue}${colors.bright}██╔══██╗██╔══██╗ ██╔═══██╗${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.blue}${colors.bright}██████╔╝██████╔╝ ██║   ██║${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.blue}${colors.bright}██╔═══╝ ██╔══██╗ ██║   ██║${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.blue}${colors.bright}██║     ██║  ║██╗ ██████╔╝${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                          ${colors.blue}${colors.bright}╚═╝     ╚═╝  ╚══╝${colors.reset}  ╚════╝                           ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                                                                              ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                    ${colors.gray}💎 Автор: ${colors.reset}${colors.blue}https://t.me/privatekey7${colors.reset}${colors.gray}💎${colors.reset}                      ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}                                                                              ${colors.cyan}║${colors.reset}
${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}
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
    static showStartupStatus(port) {
        console.log('');
        console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset}                    ${colors.green}${colors.bright}✅ СЕРВЕР УСПЕШНО ЗАПУЩЕН ✅${colors.reset}                              ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╠══════════════════════════════════════════════════════════════════════════════╣${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 🌐 API доступен по адресу: http://localhost:${port}/api${colors.reset}                        ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 📱 Frontend доступен по адресу: http://localhost:4001${colors.reset}                       ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 📊 Статус сервера: http://localhost:4000/api/status${colors.reset}                         ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
        console.log('');
    }
    // Показываем сообщение о начале обработки
    static showProcessingStart(walletCount) {
        console.log('');
        console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset}                  ${colors.yellow}${colors.bright}🔄 НАЧАЛО ОБРАБОТКИ КОШЕЛЬКОВ 🔄${colors.reset}                            ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╠══════════════════════════════════════════════════════════════════════════════╣${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} 📋 Количество кошельков для обработки: ${walletCount}${colors.reset}                                   ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}║${colors.reset} ${colors.white} ⏱️  Время начала: ${new Date().toLocaleString('ru-RU')}${colors.reset}                                       ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
        console.log('');
    }
}
exports.Logo = Logo;
//# sourceMappingURL=logo.js.map