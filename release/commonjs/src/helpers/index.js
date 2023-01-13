"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSymbol = exports.rnd = exports.isUndefined = exports.isString = exports.isPromise = exports.isArray = exports.isObject = exports.isFunction = exports.setTag = exports.setClassTag = exports.setMethodTag = void 0;
const setMethodTag = (tag, value) => {
    return (target, methodName) => {
        target[methodName][tag] = value;
    };
};
exports.setMethodTag = setMethodTag;
const setClassTag = (tag, value) => {
    return (target) => {
        target.prototype[tag] = value;
    };
};
exports.setClassTag = setClassTag;
const setTag = (tag, value) => {
    return (target, name) => {
        if (name) {
            target[name][tag] = value;
            return;
        }
        target.prototype[tag] = value;
    };
};
exports.setTag = setTag;
const getType = (value) => {
    return Object.prototype.toString.call(value).slice(8, -1);
};
const isFunction = (target) => {
    return getType(target) === 'Function';
};
exports.isFunction = isFunction;
const isObject = (target) => {
    return getType(target) === 'Object';
};
exports.isObject = isObject;
const isArray = (target) => {
    return getType(target) === 'Array';
};
exports.isArray = isArray;
const isPromise = (target) => {
    return getType(target) === 'Promise';
};
exports.isPromise = isPromise;
const isString = (target) => {
    return getType(target) === 'String';
};
exports.isString = isString;
const isUndefined = (target) => {
    return (typeof (target) === 'undefined');
};
exports.isUndefined = isUndefined;
const rnd = () => {
    return Math.random().toString(16).substring(2);
};
exports.rnd = rnd;
const supportSymbol = (() => {
    try {
        Symbol();
        return true;
    }
    catch (_a) {
        return false;
    }
})();
const createSymbol = (key) => {
    return supportSymbol ? Symbol(key) : `$$__symbol__${key}`;
};
exports.createSymbol = createSymbol;
