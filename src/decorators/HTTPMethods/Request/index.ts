import adapterMgr from "../../../adapter";
import { adapterSymbol } from "../../Adapter";
import { headerSymbol } from "../../Headers";
import { prefixSymbol } from "../../Prefix";

interface RequestOptions {
  method: string;
  url: string;
  prefix?: string;
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
    const prefix = _prefix || target[prefixSymbol];

    const fn = function(...args: any[]) {


      const returnValue = _fn(...args);

    };

    // fn.name = _fn.name;

    desc.value = fn;
  };
};
