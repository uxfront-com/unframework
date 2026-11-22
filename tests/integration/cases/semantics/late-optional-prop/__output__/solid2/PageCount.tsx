import type { ComponentProps, JSX } from "@solidjs/web";
import { createReaction, createRoot, flush, merge, omit, onSettled, runWithOwner } from "solid-js";

export interface PageCountProps {
  page?: number;
  total: number;
}

export interface PageCountEvents {
  onPageChange?: (page: number, previous: number) => void;
}

export default function PageCount(
  rawProps: PageCountProps &
    PageCountEvents &
    Omit<ComponentProps<"nav">, "page" | "total" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get page() {
      return rawProps.page === undefined ? 1 : rawProps.page;
    },
  });
  const others = omit(props, "page", "total", "onPageChange", "class");

  const label = () => `Page ${props.page} of ${props.total}`;

  createWatcher(
    () => props.page,
    (next, previous) => {
      props.onPageChange?.(next, previous);
    },
  );

  return (
    <nav
      class={props.class ? `page-count ${props.class}` : "page-count"}
      aria-label="Pages"
      {...others}
    >
      <p role="status">{label()}</p>
      <p>Direct: {props.page}</p>
    </nav>
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
