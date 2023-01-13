"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afterSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.afterSymbol = (0, helpers_1.createSymbol)('after');
exports.default = (callback) => {
    return (0, helpers_1.setTag)(exports.afterSymbol, callback);
};
