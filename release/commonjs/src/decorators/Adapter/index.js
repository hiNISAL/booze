"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.adapterSymbol = (0, helpers_1.createSymbol)('adapter');
exports.default = (adapter) => {
    return (0, helpers_1.setTag)(exports.adapterSymbol, adapter);
};
