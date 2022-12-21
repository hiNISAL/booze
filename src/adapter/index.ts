import { isArray } from "../helpers";
import { BoozeRequestConfig } from "../types";

export type Adapter = {
  handler: (config: BoozeRequestConfig) => Promise<any>,
  name: string,
};

class AdapterManager {
  public adapterList: Record<string, Adapter> = {};

  public curAdapter: Adapter|null = null;

  public regAdapter(adapter: (Adapter[])|Adapter) {
    if (!isArray(adapter)) {
      adapter = [adapter as Adapter];
    }

    this.adapterList = (adapter as Adapter[]).reduce((r, adapter) => {
      r[adapter.name] = adapter;

      return r;
    }, {} as Record<string, Adapter>);

    this.curAdapter = (adapter as Adapter[])[0];
  }

  public setAdapter(adapter: string|Adapter) {
    if (typeof adapter === 'string') {
      const a = this.adapterList[adapter];

      if (a) {
        this.curAdapter = a;
      }

      return;
    }

    this.adapterList[adapter.name] = adapter;
    this.curAdapter = adapter;
  }
}

const adapterMgr = new AdapterManager();

export default adapterMgr;
