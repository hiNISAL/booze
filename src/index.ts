import adapterMgr from './adapter';
export { default as Prefix, prefixSymbol as _prefixSymbol } from './decorators/Prefix';

export const regAdapter = adapterMgr.regAdapter.bind(adapterMgr);
export const setAdapter = adapterMgr.setAdapter.bind(adapterMgr);
