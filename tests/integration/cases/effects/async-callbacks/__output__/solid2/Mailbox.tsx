import type { JSX } from "@solidjs/web";
import {
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface MailboxProps {
  folder: string;
}

export interface MailboxEvents {
  onLoaded?: (name: string, unread: number) => void;
  onProgress?: (status: string, attempts: number) => void;
  onSeen?: (text: string) => void;
  onNoted?: (text: string) => void;
}

export default function Mailbox(
  props: MailboxProps & MailboxEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [name, setName] = createState("Loading");
  const [unread, setUnread] = createState(0);
  const [status, setStatus] = createState("idle");
  const [attempts, setAttempts] = createState(0);
  const [summary, setSummary] = createState("No messages");
  let timer: ReturnType<typeof setInterval> | undefined;

  onSettled(() => () => {
    clearInterval(timer);
  });

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

  onSettled(() => {
    (async () => {
      await Promise.resolve();
      setName(props.folder);
      setUnread(3);
    })();
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
    <section
      class={props.class ? `mailbox ${props.class}` : "mailbox"}
      aria-label="Mailbox"
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
 * first, until none is queued.
 */
function queueWatcher(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  requestWatcherFlush();
}

/** Queues the flush of the watchers, once, in a microtask. */
function requestWatcherFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      flush();
      do {
        for (const watcher of queuedWatchers.pre) {
          queuedWatchers.pre.delete(watcher);
          watcher();
        }
        flush();
        for (const watcher of queuedWatchers.post) {
          queuedWatchers.post.delete(watcher);
          watcher();
          flush();
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
  const [track, dispose] = runWithOwner(null, () =>
    createRoot((stop) => [createReaction(() => queueWatcher(queue, run)), stop] as const),
  );
  let last = read();
  onSettled(() => () => {
    queue.delete(run);
    for (const cleanup of cleanups.splice(0)) cleanup();
    dispose();
  });

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
  const cleanups: (() => void)[] = [];
  const [track, dispose] = runWithOwner(null, () =>
    createRoot(
      (stop) => [createReaction(() => queueWatcher(queuedWatchers.post, run)), stop] as const,
    ),
  );
  onSettled(() => {
    run();
    return () => {
      queuedWatchers.post.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
      dispose();
    };
  });

  function run(): void {
    track(() => {
      for (const source of sources) source();
    });
    for (const cleanup of cleanups.splice(0)) cleanup();
    effect((cleanup) => cleanups.push(cleanup));
  }
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

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
    requestWatcherFlush();
  }
  return [read, write];
}
