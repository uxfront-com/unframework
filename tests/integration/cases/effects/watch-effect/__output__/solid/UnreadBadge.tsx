import { createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface UnreadBadgeProps {
  appName: string;
}

export interface UnreadBadgeEvents {
  onTitleChange?: (title: string) => void;
  onTitleRelease?: (title: string) => void;
}

export default function UnreadBadge(props: UnreadBadgeProps & UnreadBadgeEvents) {
  const [unread, setUnread] = createSignal(0);

  createWatchEffect([unread, () => props.appName], (onCleanup) => {
    const title = `(${unread()}) ${props.appName}`;
    props.onTitleChange?.(title);
    onCleanup(() => {
      props.onTitleRelease?.(title);
    });
  });

  return (
    <section class="unread-badge" aria-label="Inbox">
      <p role="status">{unread()} unread</p>
      <button type="button" onClick={() => setUnread(unread() + 1)}>
        Receive a message
      </button>
      <button type="button" onClick={() => setUnread(0)}>
        Mark all read
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
    const track = createReaction(() => queueWatcher(run));
    run();
    onCleanup(() => {
      queuedWatchers.delete(run);
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
