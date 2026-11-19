import { createClient, type Adapter, type AdapterRequest, type BoozeResponse, type ClientOptions } from '../../src';

type Reply = Partial<BoozeResponse> | ((req: AdapterRequest) => Partial<BoozeResponse> | Promise<Partial<BoozeResponse>>);

/** An adapter that records what booze hands it and replies without touching the network. */
export const createRecorder = (name = 'recorder', reply: Reply = { data: { ok: true } }) => {
  const calls: AdapterRequest[] = [];

  const adapter: Adapter = {
    name,
    async send(req) {
      calls.push(req);
      const partial = typeof reply === 'function' ? await reply(req) : reply;

      return { status: 200, headers: {}, data: undefined, raw: null, ...partial };
    },
  };

  return {
    adapter,
    calls,
    get last(): AdapterRequest {
      const last = calls.at(-1);
      if (!last) throw new Error(`adapter "${name}" was never called`);
      return last;
    },
    reset() {
      calls.length = 0;
    },
  };
};

/** A client whose adapter is a fresh recorder. */
export const recordingClient = (options: ClientOptions = {}, reply?: Reply) => {
  const recorder = createRecorder('recorder', reply);
  const client = createClient({ ...options, adapter: recorder.adapter });

  return { client, recorder };
};
