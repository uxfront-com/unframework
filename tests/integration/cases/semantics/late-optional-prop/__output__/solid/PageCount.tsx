import { createMemo, createReaction, mergeProps, onCleanup, onMount } from "solid-js";

export interface PageCountProps {
  page?: number;
  total: number;
}

export interface PageCountEvents {
  onPageChange?: (page: number, previous: number) => void;
}

export default function PageCount(rawProps: PageCountProps & PageCountEvents) {
  const props = mergeProps({ page: 1 } satisfies Partial<PageCountProps>, rawProps);
  const label = createMemo(() => `Page ${props.page} of ${props.total}`);

  createWatcher(
    () => props.page,
    (next, previous) => {
      props.onPageChange?.(next, previous);
    },
  );

  return (
    <nav class="page-count" aria-label="Pages">
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
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      for (const watcher of queuedWatchers) {
        queuedWatchers.delete(watcher);
        watcher();
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
  const track = createReaction(() => queueWatcher(run));
  let last = read();
  onMount(() =>
    onCleanup(() => {
      queuedWatchers.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    }),
  );

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
