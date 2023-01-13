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
const qs_1 = __importDefault(require("qs"));
const adapter_1 = __importDefault(require("../../../adapter"));
const helpers_1 = require("../../../helpers/");
const Adapter_1 = require("../../Adapter");
const Headers_1 = require("../../Headers");
const Prefix_1 = require("../../Prefix");
const makeBody_1 = require("../../../methods/makeBody");
const Before_1 = require("../../Before");
const JSONP_1 = require("../../JSONP");
const After_1 = require("../../After");
const BeforeExecSourceFn_1 = require("../../BeforeExecSourceFn");
const eachBeforeExecSourceFn_1 = require("../../../methods/eachBeforeExecSourceFn");
const eachAfter_1 = require("../../../methods/eachAfter");
const BodyType_1 = require("../../BodyType");
const rndJsonpCallback = () => {
    return `__callback_${(0, helpers_1.rnd)()}`;
};
const getBodyOptions = (method, returnValue) => {
    let placeholders = {};
    let query = {};
    let params = {};
    let onProgress = null;
    let cancel = null;
    let jsonp = null;
    if (returnValue[makeBody_1.makeBodySymbol]) {
        if (returnValue.query) {
            if ((0, helpers_1.isString)(returnValue.query)) {
                query = qs_1.default.parse((returnValue.query));
            }
            else {
                query = returnValue.query || {};
            }
        }
        if (returnValue.params) {
            params = returnValue.params || {};
        }
        if (returnValue.placeholders) {
            placeholders = returnValue.placeholders || {};
        }
        if (returnValue.onProgress) {
            onProgress = returnValue.onProgress || null;
        }
        if (returnValue.cancel) {
            onProgress = returnValue.cancel || null;
        }
        if (returnValue.jsonp) {
            if ((0, helpers_1.isString)(returnValue.jsonp)) {
                jsonp = returnValue.jsonp;
            }
            else {
                jsonp = rndJsonpCallback();
            }
        }
    }
    else if ((0, helpers_1.isArray)(returnValue)) {
        if (method === 'GET') {
            query = returnValue[0];
        }
        else {
            params = returnValue[0];
        }
        placeholders = returnValue[1] || {};
    }
    else {
        if (method === 'GET') {
            query = returnValue;
        }
        else {
            params = returnValue;
        }
    }
    return {
        params,
        query,
        placeholders,
        jsonp,
        onProgress,
        cancel,
    };
};
const fillUrl = (url, placeholder) => {
    return url.split('/').map((chunk) => {
        console.log(chunk);
        if (chunk.indexOf(':') === 0) {
            return placeholder[chunk.substring(1)] || chunk;
        }
        return chunk;
    }).join('/');
};
exports.default = (config) => {
    return (target, propName, desc) => {
        const { method, url, prefix: _prefix, } = config;
        const _fn = target[propName];
        const headers = _fn[Headers_1.headerSymbol];
        const adapter = _fn[Adapter_1.adapterSymbol] || adapter_1.default.curAdapter;
        const before = _fn[Before_1.beforeSymbol];
        const beforeExecSourceFn = _fn[BeforeExecSourceFn_1.beforeExecSourceFnSymbol];
        const after = _fn[After_1.afterSymbol];
        const isJsonp = _fn[JSONP_1.jsonpSymbol];
        const bodyType = _fn[BodyType_1.bodyTypeSymbol];
        const fn = function (...args) {
            return __awaiter(this, void 0, void 0, function* () {
                const prefix = _prefix || target[Prefix_1.prefixSymbol];
                const eachBefore = target[Before_1.beforeSymbol];
                const eachAfter = target[After_1.afterSymbol];
                const eachBeforeExecSourceFn = _fn[BeforeExecSourceFn_1.beforeExecSourceFnSymbol];
                const upperAdapter = target[Adapter_1.adapterSymbol];
                const eachBodyType = target[BodyType_1.bodyTypeSymbol];
                const _adapter = adapter || upperAdapter || adapter_1.default.curAdapter;
                if (beforeExecSourceFn || eachBeforeExecSourceFn || (0, eachBeforeExecSourceFn_1.getCallback)()) {
                    const baseConfig = {
                        url,
                        method,
                        prefix,
                        args,
                    };
                    {
                        const beforeExecValue = yield (0, eachBeforeExecSourceFn_1.getCallback)()(baseConfig);
                        if (beforeExecValue === false) {
                            return;
                        }
                    }
                    if (beforeExecSourceFn) {
                        const beforeExecValue = yield beforeExecSourceFn(baseConfig);
                        if (beforeExecValue === false) {
                            return;
                        }
                    }
                    if (eachBeforeExecSourceFn) {
                        const beforeExecValue = yield eachBeforeExecSourceFn(baseConfig);
                        if (beforeExecValue === false) {
                            return;
                        }
                    }
                }
                const returnValue = (yield _fn(...args)) || {};
                const { params, placeholders, query, onProgress, jsonp, cancel, } = getBodyOptions(method, returnValue);
                const realUrl = fillUrl(url, placeholders);
                const config = {
                    url: `${prefix}${realUrl}`,
                    method,
                    queryString: qs_1.default.stringify(query),
                    query,
                    params,
                    headers: headers || {},
                    onProgress,
                    cancel,
                    jsonp: jsonp || (isJsonp ? rndJsonpCallback() : null),
                    _prefix: prefix,
                    _url: url,
                };
                if (bodyType || eachBodyType) {
                    const eachType = BodyType_1.BodyTypeHeader[eachBodyType];
                    const type = BodyType_1.BodyTypeHeader[bodyType];
                    if (type && !config.headers['Content-Type']) {
                        config.headers['Content-Type'] = type;
                    }
                    else if (eachType && !config.headers['Content-Type']) {
                        config.headers['Content-Type'] = eachType;
                    }
                }
                if ((0, helpers_1.isFunction)(headers)) {
                    config.headers = headers(config) || config.headers;
                }
                if (eachBefore) {
                    const beforeValue = yield eachBefore(config);
                    if (beforeValue === false) {
                        return;
                    }
                }
                if (before) {
                    const beforeValue = yield before(config);
                    if (beforeValue === false) {
                        return;
                    }
                }
                let result = yield _adapter.handler(config);
                if ((0, eachAfter_1.getCallback)()) {
                    const r = (0, eachAfter_1.getCallback)()(result, config);
                    if (r)
                        result = r;
                }
                if (eachAfter) {
                    const r = eachAfter(result, config);
                    if (r)
                        result = r;
                }
                if (after) {
                    const r = after(result, config);
                    if (r)
                        result = r;
                }
                return result;
            });
        };
        desc.value = fn;
    };
};
