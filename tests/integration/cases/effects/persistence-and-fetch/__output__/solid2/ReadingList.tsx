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
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface ReadingListProps {
  shelves: string[];
}

export interface ReadingListEvents {
  onRequested?: (url: string) => void;
  onCancelled?: (query: string) => void;
  onFound?: (query: string, count: number) => void;
  onStarted?: () => void;
  onChecked?: (count: number) => void;
  onRefreshed?: (total: number) => void;
}

export default function ReadingList(
  props: ReadingListProps &
    ReadingListEvents &
    Omit<ComponentProps<"section">, "shelves" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(
    props,
    "shelves",
    "onRequested",
    "onCancelled",
    "onFound",
    "onStarted",
    "onChecked",
    "onRefreshed",
    "class",
  );

  const [query, setQuery] = createState("");
  const [books, setBooks] = createState<string[]>([]);
  const [searching, setSearching] = createState(false);
  const [failure, setFailure] = createState("");
  const [shelf, setShelf] = createState("all");
  const [checking, setChecking] = createState(false);
  const [checks, setChecks] = createState(0);
  const [counts, setCounts] = createState<Record<string, number>>({});
  const [refreshing, setRefreshing] = createState(false);
  let checker: ReturnType<typeof setInterval> | undefined;

  createWatcher(shelf, (value) => {
    localStorage.setItem("reading-list:shelf", value);
  });

  createWatcher(query, async (value, previous, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    if (value === "") {
      setBooks([]);
      setSearching(false);
      return;
    }
    const url = `/api/books?${new URLSearchParams({ q: value, shelf: shelf() })}`;
    setSearching(true);
    setFailure("");
    props.onRequested?.(url);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const found = (await response.json()) as string[];
      setBooks(found);
      setSearching(false);
      props.onFound?.(value, found.length);
    } catch (error) {
      if (controller.signal.aborted) {
        props.onCancelled?.(value);
        return;
      }
      setSearching(false);
      setFailure(error instanceof Error ? error.message : "The search failed");
    }
  });

  createWatchEffect([checking], (onCleanup) => {
    if (!checking()) return;
    const check = () => {
      setChecks(checks() + 1);
      props.onChecked?.(checks());
    };
    checker = setInterval(check, 1000);
    props.onStarted?.();
    onCleanup(() => clearInterval(checker));
  });

  async function countShelf(name: string) {
    const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
    const list = (await response.json()) as string[];
    setCounts({ ...counts(), [name]: list.length });
  }

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all(props.shelves.map(countShelf));
    setRefreshing(false);
    props.onRefreshed?.(
      props.shelves.reduce((total, name) => untrack(() => total + (counts()[name] ?? 0)), 0),
    );
  }

  return (
    <section
      class={props.class ? `reading-list ${props.class}` : "reading-list"}
      aria-label="Reading list"
      {...others}
    >
      <label>
        Search
        <input
          type="search"
          name="query"
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p role="status">
        {searching() ? "Searching" : `${books().length} found`}
        {failure() === "" ? "" : `: ${failure()}`}
      </p>
      <ul aria-label="Books">
        <KeyedFor each={books()} by={(book) => book}>
          {(book) => <li>{book.value}</li>}
        </KeyedFor>
      </ul>
      <div role="group" aria-label="Shelf">
        <button
          type="button"
          aria-pressed={enumeratedValue(shelf() === "all")}
          onClick={() => setShelf("all")}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={enumeratedValue(shelf() === "unread")}
          onClick={() => setShelf("unread")}
        >
          Unread
        </button>
      </div>
      <button
        type="button"
        aria-pressed={enumeratedValue(checking())}
        onClick={() => setChecking(!checking())}
      >
        Check for new books
      </button>
      <p>Checks: {checks()}</p>
      <button type="button" onClick={refreshAll}>
        Refresh shelves
      </button>
      <ul aria-label="Shelves">
        <KeyedFor each={props.shelves} by={(name) => name}>
          {(name) => (
            <li>
              {name.value}: {counts()[name.value] ?? "not counted"}
            </li>
          )}
        </KeyedFor>
      </ul>
      <p>{refreshing() ? "Refreshing" : "Up to date"}</p>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
