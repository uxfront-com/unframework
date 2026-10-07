import { createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface ChannelPickerEvents {
  onJoin?: (channel: string) => void;
  onLeave?: (channel: string) => void;
}

export default function ChannelPicker(props: ChannelPickerEvents) {
  const [channel, setChannel] = createSignal("general");

  createWatcher(
    () => channel().toLowerCase(),
    (name, previous, onCleanup) => {
      props.onJoin?.(name);
      onCleanup(() => {
        props.onLeave?.(name);
      });
    },
    { immediate: true },
  );

  return (
    <section class="channel-picker" aria-label="Channels">
      <p role="status">Channel: #{channel()}</p>
      <button type="button" onClick={() => setChannel("random")}>
        Join #random
      </button>
      <button type="button" onClick={() => setChannel("General")}>
        Join #General
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
 * component is removed. With `immediate`, it also calls back at once, during the setup, without a
 * previous value.
 */
function createWatcher<T>(
  source: () => T,
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options: { immediate: true },
): void;
function createWatcher(
  source: () => unknown,
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { immediate: true },
): void {
  const sources = [source];
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
    callback(values[0] as never, previous?.[0] as never, register);
  }
}
