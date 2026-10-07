import { For, Show, createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface DraftPanelEvents {
  onSave?: (count: number) => void;
  onStatus?: (value: string) => void;
  onClosed?: (reason: string) => void;
  onKey?: (key: string) => void;
}

export default function DraftPanel(props: DraftPanelEvents) {
  const [open, setOpen] = createSignal(false);
  const [status, setStatus] = createSignal("draft");
  const [saves, setSaves] = createSignal(0);
  const [log, setLog] = createSignal<string[]>([]);
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

  onMount(() => onCleanup(() => stop()));

  createWatcher(status, (value) => {
    props.onStatus?.(value);
  });

  onMount(() => {
    handleElement = handle;
    handleElement?.addEventListener("click", onHandleClick);
  });

  return (
    <section class="draft-panel" aria-label="Draft">
      <button type="button" aria-expanded={open()} onClick={show}>
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
        ref={(element) => {
          handle = element;
          onCleanup(() => {
            handle = null;
          });
        }}
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
        <For each={log()}>{(line) => <li>{line}</li>}</For>
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
