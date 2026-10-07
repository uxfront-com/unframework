import { For, createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

export interface BookShelfEvents {
  onMoved?: (title: string, previous: string) => void;
  onCounted?: (summary: string) => void;
  onToggled?: (open: boolean) => void;
  onBusy?: (label: string, loading: boolean) => void;
  onSummed?: (total: number) => void;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export default function BookShelf(props: BookShelfProps & BookShelfEvents) {
  const [focused, setFocused] = createSignal<Book | null>(null);
  const [reads, setReads] = createSignal(new Map<number, number>());
  const [open, setOpen] = createSignal(false);
  const [label, setLabel] = createSignal("Idle");
  const [loading, setLoading] = createSignal(false);
  const [low] = createSignal(1);
  const [high, setHigh] = createSignal(5);

  createWatcher(focused, (book, previous) => {
    props.onMoved?.(book?.title ?? "none", previous?.title ?? "none");
  });

  createWatcher(reads, (next) => {
    props.onCounted?.([...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
  });

  createWatcher(
    open,
    (value) => {
      props.onToggled?.(value);
    },
    { immediate: true },
  );

  createWatcher([label, loading], ([nextLabel, nextLoading]) => {
    props.onBusy?.(nextLabel, nextLoading);
  });

  createWatcher([low, high], (values) => {
    props.onSummed?.(sum(values));
  });

  function focus(book: Book) {
    setFocused(book);
  }

  function peek(book: Book) {
    const before = focused();
    setFocused(book);
    setFocused(before);
  }

  function read(book: Book) {
    const next = new Map(reads());
    next.set(book.id, (next.get(book.id) ?? 0) + 1);
    setReads(next);
  }

  function reread() {
    const before = reads();
    setReads(new Map());
    setReads(before);
  }

  function start() {
    setLabel("Loading");
    setLoading(true);
  }

  return (
    <section class="book-shelf" aria-label="Books">
      <ul aria-label="Shelf">
        <For each={props.books}>
          {(book) => (
            <li>
              <span>{book.title}</span>
              <button type="button" onClick={() => focus(book)}>{`Focus ${book.title}`}</button>
              <button type="button" onClick={() => peek(book)}>{`Peek ${book.title}`}</button>
              <button type="button" onClick={() => read(book)}>{`Read ${book.title}`}</button>
            </li>
          )}
        </For>
      </ul>
      <p>Focused: {focused()?.title ?? "none"}</p>
      <p>Books read: {reads().size}</p>
      <button type="button" onClick={reread}>
        Count again
      </button>
      <button type="button" aria-expanded={open()} onClick={() => setOpen(!open())}>
        Details
      </button>
      <button type="button" onClick={start}>
        Start
      </button>
      <p role="status">
        {label()}: {loading() ? "busy" : "idle"}
      </p>
      <button type="button" onClick={() => setHigh(high() + 1)}>
        Raise the limit
      </button>
      <p>
        Range: {low()} to {high()}
      </p>
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
 * component is removed. With `immediate`, it also calls back at once, during the setup, without a
 * previous value.
 */
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
): void;
function createWatcher<T>(
  source: () => T,
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options: { immediate: true },
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
  options?: { immediate: true },
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
  const cleanups: (() => void)[] = [];
  const track = createReaction(() => queueWatcher(run));
  let last = read();
  if (options) call(last, undefined);
  onMount(() =>
    onCleanup(() => {
      queuedWatchers.delete(run);
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

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };
