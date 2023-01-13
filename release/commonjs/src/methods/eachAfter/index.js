"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eachAfter = exports.getCallback = void 0;
let callback = null;
const getCallback = () => {
    return callback;
};
exports.getCallback = getCallback;
const eachAfter = (cb) => {
    callback = cb;
};
exports.eachAfter = eachAfter;
