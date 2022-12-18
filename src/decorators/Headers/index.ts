import { isString, setTag } from "../../helpers/decorators";
import { BoozeRequestConfig } from "../../types";

export const headerSymbol = Symbol('headerSymbol');

export default (headerKey: string|Record<string, string>|((config: BoozeRequestConfig) => Record<string, any>), headerValue?: string) => {
  if (isString(headerKey)) {
    headerKey = {
      [headerKey as string]: headerValue as string,
    };
  }

  return setTag(headerSymbol, headerKey);
};
