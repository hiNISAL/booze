import { createSymbol, setTag } from "../../helpers/";
import { BoozeRequestConfig } from "../../types";

export const afterSymbol = createSymbol('after');

export default <T>(callback: (response: T, config: BoozeRequestConfig) => any) => {
  return setTag(afterSymbol, callback);
};
