import { createSymbol, setTag } from "../../helpers/";
import { BoozeRequestConfig } from "../../types";

export const afterSymbol = createSymbol('after');

export default <T>(callback: (response: T, config: BoozeRequestConfig) => T|void) => {
  return setTag(afterSymbol, callback);
};
