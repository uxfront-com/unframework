import type { ComponentProps, JSX } from "@solidjs/web";
import {
  For,
  Show,
  createMemo,
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  omit,
  onCleanup,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface DraftPanelEvents {
  onSave?: (count: number) => void;
  onStatus?: (value: string) => void;
  onClosed?: (reason: string) => void;
  onKey?: (key: string) => void;
}

export default function DraftPanel(
  props: DraftPanelEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onSave", "onStatus", "onClosed", "onKey", "class");

  const [open, setOpen] = createState(false);
  const [status, setStatus] = createState("draft");
  const [saves, setSaves] = createState(0);
  const [log, setLog] = createState<string[]>([]);
  let handle: HTMLButtonElement | null = null;
  let handleElement: HTMLButtonElement | null = null;

  function record(line: string) {
    setLog([...log(), line]);
  }

  function onKey(event: KeyboardEvent) {
    record(`key ${event.key}`);
    props.onKey?.(event.key);
  }

  function close(reason: string) {
    setOpen(false);
    document.removeEventListener("keydown", onEscape);
    props.onClosed?.(reason);
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") close("escape");
  }

  function show() {
    setOpen(true);
    document.addEventListener("keydown", onEscape);
  }

  function onHandleClick() {
    record("handle");
  }

  function save() {
    setSaves(saves() + 1);
    setStatus("saved");
    props.onSave?.(saves());
  }

  function stop() {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onKey);
    handleElement?.removeEventListener("click", onHandleClick);
  }

  onSettled(() => () => stop());

  createWatcher(status, (value) => {
    props.onStatus?.(value);
  });

  onSettled(() => {
    handleElement = handle;
    handleElement?.addEventListener("click", onHandleClick);
  });

  return (
    <section
      class={props.class ? `draft-panel ${props.class}` : "draft-panel"}
      aria-label="Draft"
      {...others}
    >
      <button type="button" aria-expanded={enumeratedValue(open())} onClick={show}>
        Options
      </button>
      <Show when={open()}>
        <div class="options" role="group" aria-label="Draft options">
          <button type="button" onClick={() => close("button")}>
            Close
          </button>
        </div>
      </Show>
      <button type="button" onClick={() => document.addEventListener("keydown", onKey)}>
        Listen
      </button>
      <button type="button" onClick={() => document.removeEventListener("keydown", onKey)}>
        Stop listening
      </button>
      <button
        type="button"
        ref={clearedRef(
          (element) => {
            handle = element;
          },
          () => {
            handle = null;
          },
        )}
      >
        Handle
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p role="status">
        {open() ? "Options open" : "Options closed"}, {status()}
      </p>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(line, index) => index}>
          {(line) => <li>{line.value}</li>}
        </KeyedFor>
      </ol>
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
  requestWatcherFlush();
}

/** Queues the flush of the watchers, once, in a microtask. */
function requestWatcherFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      flush();
      for (const watcher of queuedWatchers) {
        queuedWatchers.delete(watcher);
        watcher();
        flush();
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
  const [track, dispose] = runWithOwner(null, () =>
    createRoot((stop) => [createReaction(() => queueWatcher(run)), stop] as const),
  );
  let last = read();
  onSettled(() => () => {
    queuedWatchers.delete(run);
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
