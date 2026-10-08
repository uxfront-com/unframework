import { For, createReaction, createSignal, onCleanup, onMount, untrack } from "solid-js";

export interface RunsProps {
  label: string;
}

export interface RunsEvents {
  onMoved?: (low: number, high: number) => void;
  onRendered?: (count: number) => void;
  onSaved?: (text: string) => void;
}

export default function Runs(props: RunsProps & RunsEvents) {
  const [low, setLow] = createSignal(0);
  const [high, setHigh] = createSignal(10);
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<string[]>([]);
  const [notes, setNotes] = createSignal<string[]>([]);
  let list: HTMLUListElement | null = null;

  createWatcher([low, high], ([a, b]) => {
    props.onMoved?.(a, b);
  });

  createWatcher(query, (value) => {
    setResults(value === "" ? [] : [value, `${value}!`]);
  });

  createWatcher(
    query,
    () => {
      props.onRendered?.(list?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  createWatchEffect([() => props.label, query], async () => {
    const text = `${props.label} ${query()}`;
    await Promise.resolve();
    props.onSaved?.(text);
  });

  onMount(() => {
    void start();
  });

  async function start() {
    await Promise.resolve();
    setLow(1);
    setHigh(11);
  }

  function later() {
    setTimeout(() => {
      setLow(low() + 1);
      setHigh(high() + 1);
    }, 0);
  }

  function chained() {
    void Promise.resolve(5).then((step) =>
      untrack(() => {
        setLow(low() + step);
        setHigh(high() + step);
        props.onSaved?.(`${props.label} ${low()}`);
      }),
    );
  }

  function update(change: (entries: string[]) => string[]) {
    setNotes(change(notes()));
  }

  function note() {
    update((entries) => untrack(() => [...entries, `${props.label} ${query()}`]));
  }

  async function save() {
    const before = low();
    setLow(before + 1);
    const next = high() + 1;
    setHigh(next);
    await Promise.resolve();
    setLow(next);
    setHigh(next + before);
  }

  return (
    <section aria-label="Runs">
      <p role="status">
        {low()}-{high()}
      </p>
      <ul
        ref={(element) => {
          list = element;
          onCleanup(() => {
            list = null;
          });
        }}
      >
        <For each={results()}>{(item) => <li>{item}</li>}</For>
      </ul>
      <button type="button" onClick={() => setQuery("a")}>
        Search
      </button>
      <button type="button" onClick={later}>
        Later
      </button>
      <button type="button" onClick={chained}>
        Chained
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={note}>
        Note {notes().length}
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
): void;
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: WatchedValues<S>,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options?: { flush: "post" },
): void;
function createWatcher(
  source: (() => unknown) | readonly (() => unknown)[],
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { flush: "post" },
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
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

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };
