"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Request_1 = __importDefault(require("../Request"));
exports.default = (url, prefix) => {
    return (0, Request_1.default)({
        url,
        prefix,
        method: 'OPTIONS',
    });
};
