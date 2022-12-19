import { setTag } from "../../helpers/";

export const jsonpSymbol = Symbol('jsonp');

export default () => {
  return setTag(jsonpSymbol, true);
};
