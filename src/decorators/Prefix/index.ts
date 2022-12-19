import { setTag } from "../../helpers/";

export const prefixSymbol = Symbol('prefixPropKey');

export default (prefix: string) => {
  return setTag(prefixSymbol, prefix);
};
