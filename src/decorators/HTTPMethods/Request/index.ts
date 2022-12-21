import qs from 'qs';
import adapterMgr from "../../../adapter";
import { isArray, isFunction, isPromise, isString, rnd } from "../../../helpers/";
import { adapterSymbol } from "../../Adapter";
import { headerSymbol } from "../../Headers";
import { prefixSymbol } from "../../Prefix";
import { Obj, BoozeRequestMethodReturnValue, MakeBodyOptions, BoozeRequestConfig, RequestMethod, BoozeRequestConfigBase } from '../../../types';
import { makeBodySymbol } from "../../../methods/makeBody";
import { beforeSymbol } from "../../Before";
import { jsonpSymbol } from '../../JSONP';
import { afterSymbol } from '../../After';
import { beforeExecSourceFnSymbol } from '../../BeforeExecSourceFn';
import { getCallback } from '../../../methods/beforeEachExecSourceFnGlobal';

const rndJsonpCallback = () => {
  return `__callback_${rnd()}`;
}

interface RequestOptions {
  method: RequestMethod;
  url: string;
  prefix?: string;
}

const getBodyOptions = (method: string, returnValue: BoozeRequestMethodReturnValue) => {
  let placeholders: Obj = {};
  let query: Obj = {};
  let params: Obj = {};
  let onProgress = null;
  let cancel = null;
  let jsonp = null;

  if ((returnValue as any)[makeBodySymbol]) {
    if ((returnValue as MakeBodyOptions).query) {
      if (isString((returnValue as MakeBodyOptions).query)) {
        query = qs.parse(((returnValue as MakeBodyOptions).query) as string);
      } else {
        query = (returnValue as any).query || {};
      }
    }

    if ((returnValue as MakeBodyOptions).params) {
      params = (returnValue as MakeBodyOptions).params || {};
    }

    if ((returnValue as MakeBodyOptions).placeholders) {
      placeholders = (returnValue as MakeBodyOptions).placeholders || {};
    }

    if ((returnValue as MakeBodyOptions).onProgress) {
      onProgress = (returnValue as MakeBodyOptions).onProgress || null;
    }

    if ((returnValue as MakeBodyOptions).cancel) {
      onProgress = (returnValue as MakeBodyOptions).cancel || null;
    }

    if ((returnValue as MakeBodyOptions).jsonp) {
      if (isString((returnValue as MakeBodyOptions).jsonp)) {
        jsonp = (returnValue as MakeBodyOptions).jsonp as string;
      } else {
        jsonp = rndJsonpCallback();
      }
    }
  } else if (isArray(returnValue as Obj[])) {
    if (method === 'GET') {
      query = (returnValue as [Obj, Obj])[0];
    } else {
      params = (returnValue as [Obj, Obj])[0];
    }
    placeholders = (returnValue as [Obj, Obj])[1] || {};
  } else {
    if (method === 'GET') {
      query = returnValue;
    } else {
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

const fillUrl = (url: string, placeholder: Obj) => {
  return url.split('/').map((chunk) => {
    console.log(chunk)
    if (chunk.indexOf(':') === 0) {
      return placeholder[chunk.substring(1)] || chunk;
    }

    return chunk;
  }).join('/');
}

export default (config: RequestOptions) => {
  return (target: any, propName: string, desc: PropertyDescriptor) => {
    const {
      method,
      url,
      prefix: _prefix,
    } = config;

    const _fn = target[propName];
    const headers = _fn[headerSymbol];
    const adapter =  _fn[adapterSymbol] || adapterMgr.curAdapter;
    const before = _fn[beforeSymbol];
    const beforeExecSourceFn = _fn[beforeExecSourceFnSymbol];
    const after = _fn[afterSymbol];
    const isJsonp = _fn[jsonpSymbol];

    const fn = async function(...args: any[]) {
      const prefix = _prefix || target[prefixSymbol];
      const eachBefore = target[beforeSymbol];
      const eachAfter = target[afterSymbol];
      const eachBeforeExecSourceFn = _fn[beforeExecSourceFnSymbol];
      const upperAdapter = target[adapterSymbol];

      const _adapter = adapter || upperAdapter || adapterMgr.curAdapter;

      if (beforeExecSourceFn || eachBeforeExecSourceFn || getCallback()) {
        const baseConfig: BoozeRequestConfigBase = {
          url,
          method,
          prefix,
          args,
        };

        {
          const beforeExecValue = await getCallback()!(baseConfig);

          if (beforeExecValue === false) {
            return;
          }
        }

        if (beforeExecSourceFn) {
          const beforeExecValue = await beforeExecSourceFn(baseConfig);

          if (beforeExecValue === false) {
            return;
          }
        }

        if (eachBeforeExecSourceFn) {
          const beforeExecValue = await eachBeforeExecSourceFn(baseConfig);

          if (beforeExecValue === false) {
            return;
          }
        }
      }

      const returnValue: BoozeRequestMethodReturnValue = (await _fn(...args)) || {};

      const {
        params,
        placeholders,
        query,
        onProgress,
        jsonp,
        cancel,
      } = getBodyOptions(method, returnValue);

      const realUrl = fillUrl(url, placeholders);

      const config: BoozeRequestConfig = {
        url: `${prefix}${realUrl}`,
        method,
        queryString: qs.stringify(query),
        query,
        params,
        headers,
        onProgress,
        cancel,
        jsonp: jsonp || (isJsonp ? rndJsonpCallback() : null),
        _prefix: prefix,
        _url: url,
      };

      if (isFunction(headers)) {
        config.headers = headers(config) || config.headers;
      }

      if (eachBefore) {
        const beforeValue = await eachBefore(config);

        if (beforeValue === false) {
          return;
        }
      }

      if (before) {
        const beforeValue = await before(config);

        if (beforeValue === false) {
          return;
        }
      }

      const result = await _adapter.handler(config);

      if (eachAfter) {
        eachAfter(config, result);
      }

      if (after) {
        after(config, result);
      }

      return result;
    };

    desc.value = fn;
  };
};
