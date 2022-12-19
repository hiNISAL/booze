import { Adapter } from "../../adapter";
import { setTag } from "../../helpers/";

export const adapterSymbol = Symbol('adapter');

export default (adapter: Adapter|string) => {
  return setTag(adapterSymbol, adapter);
};
