import { setTag } from "../../helpers/";
import { BoozeRequestConfig } from "../../types";

export const beforeSymbol = Symbol('before');

export default (callback: (config: BoozeRequestConfig) => boolean|null|undefined|void|Promise<boolean|null|undefined|void>) => {
  return setTag(beforeSymbol, callback);
};
