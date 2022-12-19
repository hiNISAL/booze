import { setTag } from "../../helpers/";
import { BoozeRequestConfig } from "../../types";

export const afterSymbol = Symbol('after');

export default <T>(callback: (config: BoozeRequestConfig, response: T) => void) => {
  return setTag(afterSymbol, callback);
};
