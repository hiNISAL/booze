"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeBody = exports.makeBodySymbol = void 0;
const helpers_1 = require("../../helpers");
exports.makeBodySymbol = (0, helpers_1.createSymbol)('body');
const makeBody = (options) => {
    return Object.assign(Object.assign({}, options), { [exports.makeBodySymbol]: true });
};
exports.makeBody = makeBody;
