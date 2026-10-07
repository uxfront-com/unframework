import { createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface ShortcutTipEvents {
  onDismissed?: () => void;
  onShortcut?: (key: string, count: number) => void;
}

export default function ShortcutTip(props: ShortcutTipEvents) {
  const [open, setOpen] = createSignal(true);
  const [enabled, setEnabled] = createSignal(false);
  const [count, setCount] = createSignal(0);

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      props.onDismissed?.();
    }
  }

  function onShortcut(event: KeyboardEvent) {
    if (event.key === "k") {
      setCount(count() + 1);
      props.onShortcut?.(event.key, count());
    }
  }

  function toggle() {
    setEnabled(!enabled());
  }

  onMount(() =>
    onCleanup(() => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", onShortcut);
    }),
  );

  createWatcher(enabled, (on) => {
    if (on) {
      document.addEventListener("keydown", onShortcut);
    } else {
      document.removeEventListener("keydown", onShortcut);
    }
  });

  onMount(() => {
    document.addEventListener("keydown", onEscape);
  });

  return (
    <section class="shortcut-tip" aria-label="Shortcuts">
      <p>{open() ? "Press Escape to hide this tip." : "Tip hidden."}</p>
      <button type="button" aria-pressed={enabled()} onClick={toggle}>
        Shortcut K
      </button>
      <p role="status">Used: {count()}</p>
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
 * when the code that changed it has finished, after the DOM updates, with the value at its last
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
