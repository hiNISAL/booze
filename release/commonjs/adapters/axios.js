"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
const axios_jsonp_1 = __importDefault(require("axios-jsonp"));
const getMethod = (method) => {
    return (method || '').toLocaleUpperCase();
};
exports.default = {
    name: 'axios',
    handler: (options) => __awaiter(void 0, void 0, void 0, function* () {
        let queryString = '';
        const method = getMethod(options.method);
        if ((method === 'GET') || (method === 'JSONP')) {
            queryString = qs_1.default.stringify(options.query);
        }
        const axiosOptions = {
            url: `${options.url}${queryString ? `?${queryString}` : ''}`,
            method: options.method,
            data: options.params,
            headers: options.headers,
        };
        if (getMethod(options.method) === 'JSONP') {
            axiosOptions.adapter = axios_jsonp_1.default;
            axiosOptions.callbackParamName = options.jsonp || 'callback';
        }
        const res = yield (0, axios_1.default)(axiosOptions);
        return res;
    }),
};
