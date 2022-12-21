export { default as Adapter, adapterSymbol as _adapterSymbol } from './decorators/Adapter';
export { default as After, afterSymbol as _afterSymbol } from './decorators/After';
export { default as Before, beforeSymbol as _beforeSymbol } from './decorators/Before';
export { default as Delete } from './decorators/HTTPMethods/Delete';
export { default as Get } from './decorators/HTTPMethods/Get';
export { default as Head } from './decorators/HTTPMethods/Head';
export { default as Options } from './decorators/HTTPMethods/Options';
export { default as Patch } from './decorators/HTTPMethods/Patch';
export { default as Post } from './decorators/HTTPMethods/Post';
export { default as Put } from './decorators/HTTPMethods/Put';
export { default as Request } from './decorators/HTTPMethods/Request';
export { default as Headers, headerSymbol as _headerSymbol } from './decorators/Headers';
export { default as JSONP, jsonpSymbol as _jsonpSymbol } from './decorators/JSONP';
export { default as Prefix, prefixSymbol as _prefixSymbol } from './decorators/Prefix';

export { makeBody } from './methods/makeBody';

import adapterMgr from './adapter';

export const regAdapter = adapterMgr.regAdapter.bind(adapterMgr);
export const setAdapter = adapterMgr.setAdapter.bind(adapterMgr);
