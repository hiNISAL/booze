"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prefixSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.prefixSymbol = Symbol('prefixPropKey');
exports.default = (prefix) => {
    return (0, helpers_1.setTag)(exports.prefixSymbol, prefix);
};
