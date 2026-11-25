import type { ComponentProps, JSX } from "@solidjs/web";
import {
  For,
  createMemo,
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  omit,
  onCleanup,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface RunsProps {
  label: string;
}

export interface RunsEvents {
  onMoved?: (low: number, high: number) => void;
  onRendered?: (count: number) => void;
  onSaved?: (text: string) => void;
}

export default function Runs(
  props: RunsProps &
    RunsEvents &
    Omit<ComponentProps<"section">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "onMoved", "onRendered", "onSaved");

  const [low, setLow] = createState(0);
  const [high, setHigh] = createState(10);
  const [query, setQuery] = createState("");
  const [results, setResults] = createState<string[]>([]);
  const [notes, setNotes] = createState<string[]>([]);
  let list: HTMLUListElement | null = null;

  createWatcher([low, high], ([a, b]) => {
    props.onMoved?.(a, b);
  });

  createWatcher(query, (value) => {
    setResults(value === "" ? [] : [value, `${value}!`]);
  });

  createWatcher(
    query,
    () => {
      props.onRendered?.(list?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  createWatchEffect([() => props.label, query], async () => {
    const text = `${props.label} ${query()}`;
    await Promise.resolve();
    props.onSaved?.(text);
  });

  onSettled(() => {
    void start();
  });

  async function start() {
    await Promise.resolve();
    setLow(1);
    setHigh(11);
  }

  function later() {
    setTimeout(() => {
      setLow(low() + 1);
      setHigh(high() + 1);
    }, 0);
  }

  function chained() {
    void Promise.resolve(5).then((step) =>
      untrack(() => {
        setLow(low() + step);
        setHigh(high() + step);
        props.onSaved?.(`${props.label} ${low()}`);
      }),
    );
  }

  function update(change: (entries: string[]) => string[]) {
    setNotes(change(notes()));
  }

  function note() {
    update((entries) => untrack(() => [...entries, `${props.label} ${query()}`]));
  }

  async function save() {
    const before = low();
    setLow(before + 1);
    const next = high() + 1;
    setHigh(next);
    await Promise.resolve();
    setLow(next);
    setHigh(next + before);
  }

  return (
    <section aria-label="Runs" {...others}>
      <p role="status">
        {low()}-{high()}
      </p>
      <ul
        ref={clearedRef(
          (element) => {
            list = element;
          },
          () => {
            list = null;
          },
        )}
      >
        <KeyedFor each={results()} by={(item) => item}>
          {(item) => <li>{item.value}</li>}
        </KeyedFor>
      </ul>
      <button type="button" onClick={() => setQuery("a")}>
        Search
      </button>
      <button type="button" onClick={later}>
        Later
      </button>
      <button type="button" onClick={chained}>
        Chained
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={note}>
        Note {notes().length}
      </button>
    </section>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
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

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
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
