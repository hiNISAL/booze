"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BodyTypeHeader = exports.bodyTypeSymbol = void 0;
const helpers_1 = require("../../helpers/");
exports.bodyTypeSymbol = (0, helpers_1.createSymbol)('bodyType');
const BodyType = (type) => {
    return (0, helpers_1.setTag)(exports.bodyTypeSymbol, type);
};
BodyType.Type = {
    Form: 'Form',
    JSON: 'JSON',
};
exports.BodyTypeHeader = {
    Form: 'application/x-www-form-urlencoded',
    JSON: 'application/json',
};
exports.default = BodyType;
