import { createMemo, createReaction, createSignal, onCleanup, onMount, untrack } from "solid-js";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default function PriceTag(props: PriceTagProps) {
  const [quantity, setQuantity] = createSignal(1);
  const [unit, setUnit] = createSignal(untrack(() => formatCents(props.price)));
  const [summary, setSummary] = createSignal(untrack(() => describe()));
  const total = createMemo(() => formatCents(props.price * quantity()));
  const [last, setLast] = createSignal("none");

  createWatcher(quantity, () => {
    setLast(describe());
  });

  function add() {
    setQuantity(quantity() + 1);
    setSummary(describe());
  }

  function describe(): string {
    return `${quantity()} at ${formatCents(props.price)}`;
  }

  return (
    <section class="price-tag" aria-label="Price">
      <p>Unit: {unit()}</p>
      <p role="status">{summary()}</p>
      <p>Total: {total()}</p>
      <p>Last change: {last()}</p>
      <button type="button" onClick={add}>
        Add one
      </button>
      <button type="button" onClick={() => setUnit(formatCents(props.price * 2))}>
        Price two
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
