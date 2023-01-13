"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eachBeforeExecSourceFn = exports.getCallback = void 0;
let callback = null;
const getCallback = () => {
    return callback;
};
exports.getCallback = getCallback;
const eachBeforeExecSourceFn = (cb) => {
    callback = cb;
};
exports.eachBeforeExecSourceFn = eachBeforeExecSourceFn;
