import type { JSX } from "@solidjs/web";
import {
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  onSettled,
  runWithOwner,
} from "solid-js";

export interface PriceRangeProps {
  currency: string;
}

export interface PriceRangeEvents {
  onSpanUpdate?: (span: number) => void;
  onRangeUpdate?: (low: number, high: number) => void;
  onCurrencyUpdate?: (currency: string) => void;
}

export default function PriceRange(
  props: PriceRangeProps & PriceRangeEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [low, setLow] = createState(10);
  const [high, setHigh] = createState(50);

  createWatcher(
    () => high() - low(),
    (span) => {
      props.onSpanUpdate?.(span);
    },
  );

  createWatcher([low, high], ([minimum, maximum]) => {
    props.onRangeUpdate?.(minimum, maximum);
  });

  createWatcher(
    () => props.currency,
    (value) => {
      props.onCurrencyUpdate?.(value);
    },
  );

  return (
    <section
      class={props.class ? `price-range ${props.class}` : "price-range"}
      aria-label="Price range"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">
        {low()} to {high()} {props.currency}
      </p>
      <button
        type="button"
        onClick={() => {
          setLow(low() + 10);
          setHigh(high() + 10);
        }}
      >
        Shift up
      </button>
      <button type="button" onClick={() => setHigh(high() + 10)}>
        Widen
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
): void;
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: WatchedValues<S>,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
): void;
function createWatcher(
  source: (() => unknown) | readonly (() => unknown)[],
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
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
