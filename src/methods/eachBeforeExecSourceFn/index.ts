import { BoozeRequestConfigBase } from "../../types";

type Callback = (config: BoozeRequestConfigBase) => boolean|null|undefined|void|Promise<boolean|null|undefined|void>;

let callback: Callback|null = null;

export const getCallback = () => {
  return callback;
};

export const eachBeforeExecSourceFn = (cb: Callback|null)  => {
  callback = cb;
};
