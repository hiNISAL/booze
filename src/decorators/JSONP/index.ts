import { setTag } from "../../helpers/decorators";

export const jsonpSymbol = Symbol('jsonp');

export default () => {
  return setTag(jsonpSymbol, true);
};
