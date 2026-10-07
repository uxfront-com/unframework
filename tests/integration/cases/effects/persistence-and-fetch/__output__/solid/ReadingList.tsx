import { For, createReaction, createSignal, onCleanup, onMount, untrack } from "solid-js";

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

export default function ReadingList(props: ReadingListProps & ReadingListEvents) {
  const [query, setQuery] = createSignal("");
  const [books, setBooks] = createSignal<string[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const [shelf, setShelf] = createSignal("all");
  const [checking, setChecking] = createSignal(false);
  const [checks, setChecks] = createSignal(0);
  const [counts, setCounts] = createSignal<Record<string, number>>({});
  const [refreshing, setRefreshing] = createSignal(false);
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
    <section class="reading-list" aria-label="Reading list">
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
        <For each={books()}>{(book) => <li>{book}</li>}</For>
      </ul>
      <div role="group" aria-label="Shelf">
        <button type="button" aria-pressed={shelf() === "all"} onClick={() => setShelf("all")}>
          All
        </button>
        <button
          type="button"
          aria-pressed={shelf() === "unread"}
          onClick={() => setShelf("unread")}
        >
          Unread
        </button>
      </div>
      <button type="button" aria-pressed={checking()} onClick={() => setChecking(!checking())}>
        Check for new books
      </button>
      <p>Checks: {checks()}</p>
      <button type="button" onClick={refreshAll}>
        Refresh shelves
      </button>
      <ul aria-label="Shelves">
        <For each={props.shelves}>
          {(name) => (
            <li>
              {name}: {counts()[name] ?? "not counted"}
            </li>
          )}
        </For>
      </ul>
      <p>{refreshing() ? "Refreshing" : "Up to date"}</p>
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
 * first, until none is queued. Solid updates the DOM as each write is made, so a watcher that runs
 * after the DOM updates sees what the others wrote.
 */
function queueWatcher(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      do {
        for (const watcher of queuedWatchers.pre) {
          queuedWatchers.pre.delete(watcher);
          watcher();
        }
        for (const watcher of queuedWatchers.post) {
          queuedWatchers.post.delete(watcher);
          watcher();
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
  const track = createReaction(() => queueWatcher(queue, run));
  let last = read();
  onMount(() =>
    onCleanup(() => {
      queue.delete(run);
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

/**
 * Vue's `watchEffect` over the values it reads (`sources`): runs `effect` once the component has
 * mounted, then again after the DOM updates once one of them has been written, with a cleanup
 * registrar, whose cleanups run before its next run and when the component is removed.
 */
function createWatchEffect(
  sources: readonly (() => unknown)[],
  effect: (onCleanup: (cleanup: () => void) => void) => unknown,
): void {
  onMount(() => {
    const cleanups: (() => void)[] = [];
    const track = createReaction(() => queueWatcher(queuedWatchers.post, run));
    run();
    onCleanup(() => {
      queuedWatchers.post.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    });

    function run(): void {
      track(() => {
        for (const source of sources) source();
      });
      for (const cleanup of cleanups.splice(0)) cleanup();
      effect((cleanup) => cleanups.push(cleanup));
    }
  });
}
