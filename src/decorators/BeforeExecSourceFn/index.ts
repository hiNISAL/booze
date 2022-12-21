import { setTag } from "../../helpers/";
import { BoozeRequestConfig } from "../../types";

export const beforeExecSourceFnSymbol = Symbol('beforeExec');

export default (callback: (config: BoozeRequestConfig) => boolean|null|undefined|void|Promise<boolean|null|undefined|void>) => {
  return setTag(beforeExecSourceFnSymbol, callback);
};
