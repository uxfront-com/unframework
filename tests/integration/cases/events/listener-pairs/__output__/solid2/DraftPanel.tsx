import { KeyedFor } from "./_unframework/KeyedFor";
import { clearedRef } from "./_unframework/clearedRef";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import {
  Show,
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  omit,
  onSettled,
  runWithOwner,
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
