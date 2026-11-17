import type { JSX } from "@solidjs/web";
import {
  For,
  createMemo,
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  onCleanup,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface SearchResultsEvents {
  onReady?: (text: string) => void;
  onRendered?: (count: number) => void;
  onShown?: (text: string) => void;
}

export default function SearchResults(
  props: SearchResultsEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [status, setStatus] = createState("Loading");
  const [query, setQuery] = createState("");
  const [results, setResults] = createState<string[]>([]);
  const [count, setCount] = createState(0);
  const [doubled, setDoubled] = createState(0);
  let banner: HTMLParagraphElement | null = null;
  let list: HTMLUListElement | null = null;
  let total: HTMLOutputElement | null = null;

  createWatcher(query, (value) => {
    setResults(value === "" ? [] : [value, `${value} docs`]);
  });

  createWatcher(
    query,
    () => {
      props.onRendered?.(list?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  createWatcher(count, (value) => {
    setDoubled(value * 2);
  });

  onSettled(() => {
    (async () => {
      setStatus("Ready");
      await nextTick();
      props.onReady?.(banner?.textContent ?? "");
    })();
  });

  async function addOne() {
    setCount(count() + 1);
    await nextTick();
    props.onShown?.(total?.textContent ?? "");
  }

  return (
    <section
      class={props.class ? `search-results ${props.class}` : "search-results"}
      aria-label="Search"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p
        ref={clearedRef(
          (element) => {
            banner = element;
          },
          () => {
            banner = null;
          },
        )}
      >
        {status()}
      </p>
      <label>
        Query
        <input
          name="query"
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <ul
        ref={clearedRef(
          (element) => {
            list = element;
          },
          () => {
            list = null;
          },
        )}
        aria-label="Results"
      >
        <KeyedFor each={results()} by={(result) => result}>
          {(result) => <li>{result.value}</li>}
        </KeyedFor>
      </ul>
      <output
        ref={clearedRef(
          (element) => {
            total = element;
          },
          () => {
            total = null;
          },
        )}
      >
        {doubled()}
      </output>
      <button type="button" onClick={addOne}>
        Add one
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
): void {
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
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}

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
