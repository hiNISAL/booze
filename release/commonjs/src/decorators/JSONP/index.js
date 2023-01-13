"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonpSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.jsonpSymbol = (0, helpers_1.createSymbol)('jsonp');
exports.default = () => {
    return (0, helpers_1.setTag)(exports.jsonpSymbol, true);
};
