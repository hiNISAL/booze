"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headerSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.headerSymbol = Symbol('headerSymbol');
exports.default = (headerKey, headerValue) => {
    if ((0, helpers_1.isString)(headerKey)) {
        headerKey = {
            [headerKey]: headerValue,
        };
    }
    return (0, helpers_1.setTag)(exports.headerSymbol, headerKey);
};
