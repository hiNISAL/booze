import { setTag } from "../../helpers/decorators";

export const prefixSymbol = Symbol('prefixPropKey');

export default (prefix: string) => {
  return setTag(prefixSymbol, prefix);
};
