import { setTag } from "../../helpers/decorators";

export const beforeSymbol = Symbol('before');

export default (callback: (config: BoozeConfig) => boolean) => {
  return setTag(beforeSymbol, callback);
};
