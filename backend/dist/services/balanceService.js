"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBalanceService = void 0;
const config_1 = require("../config");
const debankService_1 = require("./debankService");
const rabbyService_1 = require("./rabbyService");
/**
 * Фабрика источника баланса по флагу `BALANCE_SOURCE`.
 * `rabby` (по умолчанию) — авторитетный агрегат, фантом-баг устранён.
 * `debank` — легаси-fallback (kill switch).
 */
const createBalanceService = (source = config_1.BALANCE_SOURCE) => source === 'debank'
    ? new debankService_1.DeBankService(config_1.CORROBORATION.debank)
    : new rabbyService_1.RabbyService(config_1.CORROBORATION.rabby);
exports.createBalanceService = createBalanceService;
//# sourceMappingURL=balanceService.js.map