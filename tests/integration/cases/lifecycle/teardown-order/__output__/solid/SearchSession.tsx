import { For, createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface SearchSessionEvents {
  onUnmounted?: () => void;
  onEffectCleaned?: (query: string) => void;
  onWatchCleaned?: (query: string) => void;
  onSearched?: (query: string, count: number) => void;
  onSearchCleaned?: (query: string) => void;
  onSummary?: (text: string) => void;
}

export default function SearchSession(props: SearchSessionEvents) {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<string[]>([]);

  onMount(() =>
    onCleanup(() => {
      props.onUnmounted?.();
    }),
  );

  createWatchEffect([query], (onCleanup) => {
    const value = query();
    onCleanup(() => {
      props.onEffectCleaned?.(value);
    });
  });

  createWatcher(
    query,
    (value, previous, onCleanup) => {
      onCleanup(() => {
        props.onWatchCleaned?.(value);
      });
    },
    { immediate: true },
  );

  createWatcher(query, (value) => {
    setResults(value === "" ? [] : [value, `${value} docs`]);
  });

  createWatcher(
    query,
    (value, previous, onCleanup) => {
      props.onSearched?.(value, results().length);
      onCleanup(() => {
        props.onSearchCleaned?.(value);
      });
    },
    { flush: "post" },
  );

  createWatchEffect([results, query], () => {
    props.onSummary?.(`${results().length} results for "${query()}"`);
  });

  return (
    <section class="search-session" aria-label="Search">
      <label>
        Query
        <input
          name="query"
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <ul aria-label="Results">
        <For each={results()}>{(result) => <li>{result}</li>}</For>
      </ul>
      <button type="button" onClick={() => setResults([])}>
        Clear results
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
 * the next callback and when the component is removed. With `immediate`, it also calls back at
 * once, during the setup, without a previous value.
 */
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { flush: "post" },
): void;
function createWatcher<T>(
  source: () => T,
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options: { immediate: true; flush?: "post" },
): void;
function createWatcher(
  source: () => unknown,
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { immediate?: true; flush?: "post" },
): void {
  const sources = [source];
  const cleanups: (() => void)[] = [];
  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;
  const track = createReaction(() => queueWatcher(queue, run));
  let last = read();
  if (options?.immediate) call(last, undefined);
  onMount(() =>
    onCleanup(() => {
      queue.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
    }),
  );

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
    callback(values[0] as never, previous?.[0] as never, register);
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
