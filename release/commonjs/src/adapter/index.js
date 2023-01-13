"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../helpers");
class AdapterManager {
    constructor() {
        this.adapterList = {};
        this.curAdapter = null;
    }
    regAdapter(adapter) {
        if (!(0, helpers_1.isArray)(adapter)) {
            adapter = [adapter];
        }
        this.adapterList = adapter.reduce((r, adapter) => {
            r[adapter.name] = adapter;
            return r;
        }, {});
        this.curAdapter = adapter[0];
    }
    setAdapter(adapter) {
        if (typeof adapter === 'string') {
            const a = this.adapterList[adapter];
            if (a) {
                this.curAdapter = a;
            }
            return;
        }
        this.adapterList[adapter.name] = adapter;
        this.curAdapter = adapter;
    }
}
const adapterMgr = new AdapterManager();
exports.default = adapterMgr;
