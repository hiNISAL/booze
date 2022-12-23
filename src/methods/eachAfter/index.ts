import { BoozeRequestConfig, BoozeRequestConfigBase } from "../../types";

type Callback = <T>(response: T, config: BoozeRequestConfig) => any;

let callback: Callback|null = null;

export const getCallback = () => {
  return callback;
};

export const eachAfter = (cb: Callback|null)  => {
  callback = cb;
};
