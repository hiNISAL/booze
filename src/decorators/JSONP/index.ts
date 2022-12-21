import { createSymbol, setTag } from "../../helpers/";

export const jsonpSymbol = createSymbol('jsonp');

export default () => {
  return setTag(jsonpSymbol, true);
};
