import { For, createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface SearchResultsEvents {
  onReady?: (text: string) => void;
  onRendered?: (count: number) => void;
  onShown?: (text: string) => void;
}

export default function SearchResults(props: SearchResultsEvents) {
  const [status, setStatus] = createSignal("Loading");
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<string[]>([]);
  const [count, setCount] = createSignal(0);
  const [doubled, setDoubled] = createSignal(0);
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

  onMount(async () => {
    setStatus("Ready");
    await nextTick();
    props.onReady?.(banner?.textContent ?? "");
  });

  async function addOne() {
    setCount(count() + 1);
    await nextTick();
    props.onShown?.(total?.textContent ?? "");
  }

  return (
    <section class="search-results" aria-label="Search">
      <p
        ref={(element) => {
          banner = element;
          onCleanup(() => {
            banner = null;
          });
        }}
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
        ref={(element) => {
          list = element;
          onCleanup(() => {
            list = null;
          });
        }}
        aria-label="Results"
      >
        <For each={results()}>{(result) => <li>{result}</li>}</For>
      </ul>
      <output
        ref={(element) => {
          total = element;
          onCleanup(() => {
            total = null;
          });
        }}
      >
        {doubled()}
      </output>
      <button type="button" onClick={addOne}>
        Add one
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
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
