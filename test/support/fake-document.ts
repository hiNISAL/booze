/**
 * A minimal `document` for JSONP tests. Appending a <script> "loads" it: the reply decides
 * whether to call the callback named in the URL, fail, or never answer.
 */
export type ScriptReply = { data: unknown } | 'error' | 'hang';

export const installFakeDocument = (reply: (url: URL) => ScriptReply = () => ({ data: { ok: true } })) => {
  const loaded: URL[] = [];
  const attached = new Set<object>();
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = globals.document;

  const document = {
    createElement: () => {
      const script = {
        src: '',
        async: false,
        onerror: null as ((event: unknown) => void) | null,
        remove: () => { attached.delete(script); },
      };
      return script;
    },
    head: {
      appendChild: (script: { src: string; onerror: ((event: unknown) => void) | null }) => {
        attached.add(script);
        const url = new URL(script.src);
        loaded.push(url);

        setTimeout(() => {
          const result = reply(url);
          if (result === 'hang') return;
          if (result === 'error') {
            script.onerror?.(new Event('error'));
            return;
          }
          (globals[url.searchParams.get('callback') ?? url.searchParams.get('cb') ?? ''] as (data: unknown) => void)(result.data);
        }, 0);
      },
    },
  };

  globals.document = document;

  return {
    loaded,
    /** Scripts still in the document. */
    get attached() { return attached.size; },
    restore() {
      if (previous === undefined) delete globals.document;
      else globals.document = previous;
    },
  };
};
