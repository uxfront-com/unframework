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

export interface SearchPagerEvents {
  onQueryRun?: (value: string, previous: string) => void;
  onPageRun?: (value: number, previous: number) => void;
  onCleanedUp?: (watcher: string) => void;
}

export default function SearchPager(
  props: SearchPagerEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onQueryRun", "onPageRun", "onCleanedUp", "class");

  const [query, setQuery] = createState("");
  const [page, setPage] = createState(1);

  createWatcher(query, (value, previous, onCleanup) => {
    props.onQueryRun?.(value, previous);
    onCleanup(() => {
      props.onCleanedUp?.("query");
    });
  });

  createWatcher(page, (value, previous) => {
    props.onPageRun?.(value, previous);
  });

  function search(term: string) {
    setQuery(term);
    setQuery(query().toLowerCase());
    setPage(1);
  }

  function nextPage() {
    setPage(page() + 1);
  }

  function skipTwoPages() {
    setPage(page() + 1);
    setPage(page() + 1);
  }

  return (
    <section
      class={props.class ? `search-pager ${props.class}` : "search-pager"}
      aria-label="Search"
      {...others}
    >
      <p role="status">
        {query() === "" ? "All results" : `Results for ${query()}`}, page {page()}
      </p>
      <button type="button" onClick={() => search("Boots")}>
        Search boots
      </button>
      <button type="button" onClick={() => search("Sandals")}>
        Search sandals
      </button>
      <button type="button" onClick={nextPage}>
        Next page
      </button>
      <button type="button" onClick={skipTwoPages}>
        Skip two pages
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
