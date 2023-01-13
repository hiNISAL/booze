"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beforeExecSourceFnSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.beforeExecSourceFnSymbol = (0, helpers_1.createSymbol)('beforeExec');
exports.default = (callback) => {
    return (0, helpers_1.setTag)(exports.beforeExecSourceFnSymbol, callback);
};
