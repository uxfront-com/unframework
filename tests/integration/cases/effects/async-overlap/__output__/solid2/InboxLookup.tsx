import type { ComponentProps, JSX } from "@solidjs/web";
import {
  For,
  createMemo,
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  omit,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface InboxLookupEvents {
  onLooked?: (sender: string) => void;
  onDropped?: (sender: string) => void;
  onSorted?: (order: string) => void;
  onScaled?: (order: string) => void;
  onBusy?: (count: number, loading: boolean) => void;
  onFailed?: (message: string, loading: boolean) => void;
  onCounted?: (count: number) => void;
}

export default function InboxLookup(
  props: InboxLookupEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(
    props,
    "onLooked",
    "onDropped",
    "onSorted",
    "onScaled",
    "onBusy",
    "onFailed",
    "onCounted",
    "class",
  );

  const [sender, setSender] = createState("");
  const [order, setOrder] = createState("newest");
  const [answers, setAnswers] = createState<string[]>([]);
  const [ordering, setOrdering] = createState("none");
  const [messages, setMessages] = createState<string[]>([]);
  const [loading, setLoading] = createState(false);
  const [failure, setFailure] = createState("");
  const [unread, setUnread] = createState(0);
  let lookupReplies: ((text: string) => void)[] = [];
  let orderReply: ((text: string) => void) | undefined;
  let respond: ((list: string[]) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;

  function lookupReply(): Promise<string> {
    return new Promise<string>((resolve) => {
      lookupReplies = [...lookupReplies, resolve];
    });
  }

  function answerLookups() {
    const waiting = lookupReplies;
    lookupReplies = [];
    waiting.forEach((resolve) => resolve("found"));
  }

  function request(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      respond = resolve;
      fail = reject;
    });
  }

  createWatcher(sender, async (value, previous, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      props.onDropped?.(value);
    });
    props.onLooked?.(value);
    const text = await lookupReply();
    if (!cancelled) {
      setAnswers([...answers(), `${value}: ${text}`]);
    }
  });

  createWatchEffect([order], async (onCleanup) => {
    const current = order();
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    props.onSorted?.(current);
    const text = await new Promise<string>((resolve) => {
      orderReply = resolve;
    });
    if (!cancelled) {
      setOrdering(`${current} ${text}`);
      props.onScaled?.(current);
    }
  });

  createWatcher([messages, loading], ([list, busy]) => {
    props.onBusy?.(list.length, busy);
  });

  createWatcher([failure, loading], ([message, busy]) => {
    props.onFailed?.(message, busy);
  });

  createWatcher(unread, (value) => {
    props.onCounted?.(value);
  });

  async function load() {
    setLoading(true);
    setFailure("");
    try {
      const list = await request();
      setMessages(list);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "unknown");
    }
    setLoading(false);
  }

  async function refresh() {
    setLoading(true);
    setMessages(await request());
    setLoading(false);
  }

  async function markTwice() {
    const bump = () => {
      setUnread(unread() + 1);
    };
    bump();
    bump();
    await nextTick();
    bump();
    bump();
  }

  return (
    <section
      class={props.class ? `inbox-lookup ${props.class}` : "inbox-lookup"}
      aria-label="Inbox"
      {...others}
    >
      <button type="button" onClick={() => setSender("Ann")}>
        Find Ann
      </button>
      <button type="button" onClick={() => setSender("Anna")}>
        Find Anna
      </button>
      <button type="button" onClick={answerLookups}>
        Answer lookups
      </button>
      <ol aria-label="Answers">
        <KeyedFor each={answers()} by={(line, index) => index}>
          {(line) => <li>{line.value}</li>}
        </KeyedFor>
      </ol>
      <button type="button" onClick={() => setOrder(order() === "newest" ? "oldest" : "newest")}>
        Switch order
      </button>
      <button type="button" onClick={() => orderReply?.("ready")}>
        Answer order
      </button>
      <p>Order: {ordering()}</p>
      <button type="button" onClick={load}>
        Load
      </button>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
      <button type="button" onClick={() => respond?.(["Hello", "Welcome"])}>
        Reply
      </button>
      <button type="button" onClick={() => fail?.(new Error("offline"))}>
        Fail
      </button>
      <p role="status">
        {loading() ? "Loading" : `${messages().length} messages`}
        {failure() === "" ? "" : `, ${failure()}`}
      </p>
      <button type="button" onClick={markTwice}>
        Mark twice
      </button>
      <p>Unread: {unread()}</p>
    </section>
  );
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

/**
 * The watchers whose sources have changed since the last flush, in the order they changed: those
 * that run before the DOM updates, and those that run after it.
 */
const queuedWatchers = { pre: new Set<() => void>(), post: new Set<() => void>() };
let flushQueued = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, those that run before the DOM updates
 * first, until none is queued.
 */
function queueWatcher(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  requestWatcherFlush();
}

/** Queues the flush of the watchers, once, in a microtask. */
function requestWatcherFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    try {
      flush();
      do {
        for (const watcher of queuedWatchers.pre) {
          queuedWatchers.pre.delete(watcher);
          watcher();
        }
        flush();
        for (const watcher of queuedWatchers.post) {
          queuedWatchers.post.delete(watcher);
          watcher();
          flush();
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
  const [track, dispose] = runWithOwner(null, () =>
    createRoot((stop) => [createReaction(() => queueWatcher(queue, run)), stop] as const),
  );
  let last = read();
  onSettled(() => () => {
    queue.delete(run);
    for (const cleanup of cleanups.splice(0)) cleanup();
    dispose();
  });

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
  const cleanups: (() => void)[] = [];
  const [track, dispose] = runWithOwner(null, () =>
    createRoot(
      (stop) => [createReaction(() => queueWatcher(queuedWatchers.post, run)), stop] as const,
    ),
  );
  onSettled(() => {
    run();
    return () => {
      queuedWatchers.post.delete(run);
      for (const cleanup of cleanups.splice(0)) cleanup();
      dispose();
    };
  });

  function run(): void {
    track(() => {
      for (const source of sources) source();
    });
    for (const cleanup of cleanups.splice(0)) cleanup();
    effect((cleanup) => cleanups.push(cleanup));
  }
}

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes on a microtask
 * queued at the first write, which queues the watchers of a write the component didn't make.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
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
