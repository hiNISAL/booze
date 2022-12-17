import { isString, setTag } from "../../helpers/decorators";

export const headerSymbol = Symbol('headerSymbol');

export default (headerKey: string|Record<string, string>|(() => Record<string, string>), headerValue?: string) => {
  if (isString(headerKey)) {
    headerKey = {
      [headerKey as string]: headerValue as string,
    };
  }

  return setTag(headerSymbol, headerKey);
};
