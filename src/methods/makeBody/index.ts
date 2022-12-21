import { createSymbol } from "../../helpers";
import { MakeBodyOptions } from "../../types";

export const makeBodySymbol = createSymbol('body');

export const makeBody = (options: MakeBodyOptions) => {
  return {
    ...options,
    [makeBodySymbol]: true,
  };
};
