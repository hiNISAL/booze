import { Adapter } from "../../adapter";
import { createSymbol, setTag } from "../../helpers/";

export const adapterSymbol = createSymbol('adapter');

export default (adapter: Adapter|string) => {
  return setTag(adapterSymbol, adapter);
};
