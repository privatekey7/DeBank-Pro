"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBalanceService = void 0;
const config_1 = require("../config");
const rabbyService_1 = require("./rabbyService");
/**
 * Источник баланса — Rabby API (авторитетный агрегат, фантом-баг устранён).
 * Ветка DeBank удалена (как в github.com/privatekey7/DeBankChecker, PR #5):
 * итог и раньше брался только из total_usd_value.
 */
const createBalanceService = () => new rabbyService_1.RabbyService(config_1.CORROBORATION);
exports.createBalanceService = createBalanceService;
//# sourceMappingURL=balanceService.js.map