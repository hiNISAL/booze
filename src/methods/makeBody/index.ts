import { MakeBodyOptions } from "../../types";

export const makeBodySymbol = Symbol('body');

export const makeBody = (options: MakeBodyOptions) => {
  return {
    ...options,
    [makeBodySymbol]: true,
  };
};
