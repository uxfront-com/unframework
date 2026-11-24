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
} from "solid-js";

export interface NameSorterEvents {
  onStarted?: (text: string) => void;
  onFirstSeen?: (text: string) => void;
  onSecondSeen?: (count: number) => void;
  onTotal?: (letters: number) => void;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export default function NameSorter(
  props: NameSorterEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onStarted", "onFirstSeen", "onSecondSeen", "onTotal", "class");

  const [names, setNames] = createState(["Cy", "Al"].toSorted((a, b) => compare(a, b)));
  const [count, setCount] = createState(0);

  onSettled(() => {
    props.onStarted?.(`first ${describe()}`);
  });

  onSettled(() => {
    props.onStarted?.("second");
  });

  createWatcher(count, () => {
    props.onFirstSeen?.(describe());
  });

  createWatcher(count, (value) => {
    props.onSecondSeen?.(value);
  });

  const doubled = () => count() * 2;
  const letters = () => names().join("").length;

  function describe(): string {
    return `doubled ${doubled()}`;
  }

  function add(name: string) {
    setNames([...names(), name].toSorted(compare));
    setCount(count() + 1);
  }

  function report() {
    props.onTotal?.(letters());
  }

  return (
    <section
      class={props.class ? `name-sorter ${props.class}` : "name-sorter"}
      aria-label="Names"
      {...others}
    >
      <p>Names: {names().join(", ")}</p>
      <p>Added: {count()}</p>
      <button type="button" onClick={() => add("Bo")}>
        Add Bo
      </button>
      <button type="button" onClick={report}>
        Report
      </button>
    </section>
  );
}

/** The watchers whose sources have changed since the last flush, in the order they changed. */
const queuedWatchers = new Set<() => void>();
let flushQueued = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, until none is queued: a Set's iteration
 * visits what a watcher's writes queue while it runs.
 */
function queueWatcher(run: () => void): void {
  queuedWatchers.add(run);
  requestWatcherFlush();
}

/** Queues the flush of the watchers, once, in a microtask. */
function requestWatcherFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      flush();
      for (const watcher of queuedWatchers) {
        queuedWatchers.delete(watcher);
        watcher();
        flush();
      }
    } finally {
      flushQueued = false;
    }
  });
}

/**
 * Vue's `watch`: once the value `source` reads has changed (by `Object.is`), calls `callback` back
 * when the code that changed it has finished, before the DOM updates, with the value at its last
 * callback and a cleanup registrar, whose cleanups run before the next callback and when the
 * component is removed.
 */
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
): void {
  const cleanups: (() => void)[] = [];
  const [track, dispose] = runWithOwner(null, () =>
    createRoot((stop) => [createReaction(() => queueWatcher(run)), stop] as const),
  );
  let last = read();
  onSettled(() => () => {
    queuedWatchers.delete(run);
    for (const cleanup of cleanups.splice(0)) cleanup();
    dispose();
  });

  function read(): T {
    let value!: T;
    track(() => {
      value = source();
    });
    return value;
  }

  function run(): void {
    const value = read();
    if (Object.is(value, last)) return;
    const previous = last;
    last = value;
    for (const cleanup of cleanups.splice(0)) cleanup();
    callback(value, previous, (cleanup) => cleanups.push(cleanup));
  }
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
