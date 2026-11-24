import type { ComponentProps, JSX } from "@solidjs/web";
import {
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  omit,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface AsyncRunsEvents {
  onPair?: (low: number, high: number) => void;
  onGone?: (what: string) => void;
  onStopped?: (low: number) => void;
}

export default function AsyncRuns(
  props: AsyncRunsEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onPair", "onGone", "onStopped");

  const [low, setLow] = createState(0);
  const [high, setHigh] = createState(0);
  const [limit] = createState(3);
  const [items, setItems] = createState<number[]>([]);
  let stop: (() => void) | undefined = undefined;

  onSettled(() => () => {
    props.onGone?.("last");
  });

  onSettled(() => () => {
    props.onGone?.("first");
  });

  createWatcher([low, high], ([a, b]) => {
    props.onPair?.(a, b);
  });

  createWatcher(
    limit,
    (value, previous, onCleanup) => {
      onCleanup(() => props.onGone?.(`watch ${value}`));
    },
    { immediate: true },
  );

  createWatchEffect([limit], (onCleanup) => {
    const value = limit();
    onCleanup(() => props.onGone?.(`effect ${value}`));
  });

  async function fetched() {
    setLow(1);
    setHigh(await Promise.resolve(10));
    setLow(2);
  }

  async function tried(fail: boolean) {
    setLow(3);
    try {
      const value = await (fail ? Promise.reject(new Error("no")) : Promise.resolve(30));
      setHigh(value);
    } catch {
      setHigh(-1);
    }
    setLow(4);
  }

  async function guarded(skip: boolean) {
    setLow(5);
    if (skip) {
      setHigh(50);
      return;
    }
    setHigh(51);
    await Promise.resolve();
    setLow(6);
  }

  async function twice() {
    const bump = () => {
      setLow(low() + 1);
    };
    bump();
    bump();
    await Promise.resolve();
    bump();
    setHigh(high() + 1);
  }

  function filtered() {
    void Promise.resolve([1, 2, 3, 4, 5]).then((list) =>
      untrack(() => {
        setItems(list.filter((value) => value < limit()));
        setHigh(items().length);
      }),
    );
  }

  function arm() {
    stop = () =>
      untrack(() => {
        props.onStopped?.(low());
      });
  }

  function halt() {
    stop?.();
    stop = undefined;
  }

  return (
    <section aria-label="Async runs" {...others}>
      <p role="status">
        {low()}/{high()}
      </p>
      <button type="button" onClick={fetched}>
        Fetched
      </button>
      <button type="button" onClick={() => tried(false)}>
        Tried
      </button>
      <button type="button" onClick={() => tried(true)}>
        Failed
      </button>
      <button type="button" onClick={() => guarded(true)}>
        Skipped
      </button>
      <button type="button" onClick={() => guarded(false)}>
        Guarded
      </button>
      <button type="button" onClick={twice}>
        Twice
      </button>
      <button type="button" onClick={filtered}>
        Filtered
      </button>
      <button type="button" onClick={arm}>
        Arm
      </button>
      <button type="button" onClick={halt}>
        Halt
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
 * first, until none is queued.
 */
function queueWatcher(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  requestWatcherFlush();
}

/** Queues the flush of the watchers, once, in a microtask. */
function requestWatcherFlush(): void {
  if (flushQueued) {
    return;
  }
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
          if (queuedWatchers.pre.size) {
            break;
          }
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
 * the next callback and when the component is removed. With `immediate`, it also calls back at
 * once, during the setup, without a previous value.
 */
function createWatcher<T>(
  source: () => T,
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options: { immediate: true; flush?: "post" },
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
  options?: { immediate?: true; flush?: "post" },
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
  const cleanups: (() => void)[] = [];
  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;
  const [track, dispose] = runWithOwner(null, () =>
    createRoot((stop) => [createReaction(() => queueWatcher(queue, run)), stop] as const),
  );
  let last = read();
  if (options?.immediate) {
    untrack(() => call(last, undefined));
  }
  onSettled(() => () => {
    queue.delete(run);
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
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
    if (values.every((value, index) => Object.is(value, last[index]))) {
      return;
    }
    const previous = last;
    last = values;
    call(values, previous);
  }

  function call(values: unknown[], previous: unknown[] | undefined): void {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
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
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
      dispose();
    };
  });

  function run(): void {
    track(() => {
      for (const source of sources) {
        source();
      }
    });
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    effect((cleanup) => cleanups.push(cleanup));
  }
}

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };

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
    if (getObserver()) {
      tracked();
    }
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) {
      return;
    }
    current = value;
    notify((version) => version + 1);
    requestWatcherFlush();
  }
  return [read, write];
}
