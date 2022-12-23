import { BoozeRequestConfig, BoozeRequestConfigBase } from "../../types";

type Callback = <T>(response: T, config: BoozeRequestConfig) => T|void;

let callback: Callback|null = null;

export const getCallback = () => {
  return callback;
};

export const eachAfter = (cb: Callback|null)  => {
  callback = cb;
};
