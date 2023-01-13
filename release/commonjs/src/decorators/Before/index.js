"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beforeSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.beforeSymbol = Symbol('before');
exports.default = (callback) => {
    return (0, helpers_1.setTag)(exports.beforeSymbol, callback);
};
