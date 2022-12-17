import { Adapter } from "../../adapter";
import { setTag } from "../../helpers/decorators";

export const adapterSymbol = Symbol('adapter');

export default (adapter: Adapter|string) => {
  return setTag(adapterSymbol, adapter);
};
