import { createReaction, createSignal, onCleanup, onMount, untrack } from "solid-js";

export interface MailboxProps {
  folder: string;
}

export interface MailboxEvents {
  onLoaded?: (name: string, unread: number) => void;
  onProgress?: (status: string, attempts: number) => void;
  onSeen?: (text: string) => void;
  onNoted?: (text: string) => void;
}

export default function Mailbox(props: MailboxProps & MailboxEvents) {
  const [name, setName] = createSignal("Loading");
  const [unread, setUnread] = createSignal(0);
  const [status, setStatus] = createSignal("idle");
  const [attempts, setAttempts] = createSignal(0);
  const [summary, setSummary] = createSignal("No messages");
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() =>
    onCleanup(() => {
      clearInterval(timer);
    }),
  );

  createWatcher([name, unread], ([nextName, nextUnread]) => {
    props.onLoaded?.(nextName, nextUnread);
  });

  createWatcher([status, attempts], ([nextStatus, nextAttempts]) => {
    props.onProgress?.(nextStatus, nextAttempts);
  });

  createWatcher(unread, async (value) => {
    const text = await Promise.resolve(`${value} unread`);
    setSummary(text);
  });

  createWatchEffect([status, attempts], async () => {
    const text = `${status()} after ${attempts()}`;
    await Promise.resolve();
    props.onSeen?.(text);
  });

  onMount(async () => {
    await Promise.resolve();
    setName(props.folder);
    setUnread(3);
  });

  async function save() {
    const label = name().trim();
    setStatus(`saving ${label}`);
    setAttempts(attempts() + 1);
    await nextTick();
    setStatus("saved");
  }

  function refreshEverySecond() {
    clearInterval(timer);
    timer = setInterval(() => {
      setName(`${props.folder} (refreshed)`);
      setUnread(unread() + 1);
    }, 1000);
  }

  function markAllRead() {
    queueMicrotask(() =>
      untrack(() => {
        setUnread(0);
        setName(`${props.folder}, all read`);
      }),
    );
  }

  function note() {
    void Promise.resolve().then(() =>
      untrack(() => {
        props.onNoted?.(`${name()}: ${unread()}`);
      }),
    );
  }

  return (
    <section class="mailbox" aria-label="Mailbox">
      <h2>{name()}</h2>
      <p role="status">{summary()}</p>
      <p>Status: {status()}</p>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={refreshEverySecond}>
        Refresh every second
      </button>
      <button type="button" onClick={markAllRead}>
        Mark all read
      </button>
      <button type="button" onClick={note}>
        Note
      </button>
    </section>
  );
}

/**
 * The watchers whose sources have changed since the last flush, in the order they changed: those
 * that run before the DOM updates, and those that run after it.
 */
const queuedWatchers = { pre: new Set<() => void>(), post: new Set<() => void>() };
let flushQueued = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, those that run before the DOM updates
 * first, until none is queued. Solid updates the DOM as each write is made, so a watcher that runs
 * after the DOM updates sees what the others wrote.
 */
function queueWatcher(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      do {
        for (const watcher of queuedWatchers.pre) {
          queuedWatchers.pre.delete(watcher);
          watcher();
        }
        for (const watcher of queuedWatchers.post) {
          queuedWatchers.post.delete(watcher);
          watcher();
          if (queuedWatchers.pre.size) break;
        }
      } while (queuedWatchers.pre.size || queuedWatchers.post.size);
    } finally {
      flushQueued = false;
    }
  });
}

/**
 * Vue's `watch`: once the value `source` reads has changed (by `Object.is`), calls `callback` back
 * when the code that changed it has finished, before the DOM updates (after it, with `flush:
 * "post"`), with the value at its last callback and a cleanup registrar, whose cleanups run before
 * the next callback and when the component is removed.
 */
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { flush: "post" },
): void;
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: WatchedValues<S>,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options?: { flush: "post" },
): void;
function createWatcher(
  source: (() => unknown) | readonly (() => unknown)[],
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { flush: "post" },
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
  const cleanups: (() => void)[] = [];
  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;
  const track = createReaction(() => queueWatcher(queue, run));
  let last = read();
  onMount(() =>
    onCleanup(() => {
      queue.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    }),
  );

  function read(): unknown[] {
    let values: unknown[] = [];
    track(() => {
      values = sources.map((each) => each());
    });
    return values;
  }

  function run(): void {
    const values = read();
    if (values.every((value, index) => Object.is(value, last[index]))) return;
    const previous = last;
    last = values;
    call(values, previous);
  }

  function call(values: unknown[], previous: unknown[] | undefined): void {
    for (const cleanup of cleanups.splice(0)) cleanup();
    const register = (cleanup: () => void) => cleanups.push(cleanup);
    if (typeof source === "function") {
      callback(values[0] as never, previous?.[0] as never, register);
    } else {
      callback(values as never, (previous ?? []) as never, register);
    }
  }
}

/**
 * Vue's `watchEffect` over the values it reads (`sources`): runs `effect` once the component has
 * mounted, then again after the DOM updates once one of them has been written, with a cleanup
 * registrar, whose cleanups run before its next run and when the component is removed.
 */
function createWatchEffect(
  sources: readonly (() => unknown)[],
  effect: (onCleanup: (cleanup: () => void) => void) => unknown,
): void {
  onMount(() => {
    const cleanups: (() => void)[] = [];
    const track = createReaction(() => queueWatcher(queuedWatchers.post, run));
    run();
    onCleanup(() => {
      queuedWatchers.post.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    });

    function run(): void {
      track(() => {
        for (const source of sources) source();
      });
      for (const cleanup of cleanups.splice(0)) cleanup();
      effect((cleanup) => cleanups.push(cleanup));
    }
  });
}

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
