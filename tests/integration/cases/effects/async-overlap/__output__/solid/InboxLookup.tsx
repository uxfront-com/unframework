import { For, createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface InboxLookupEvents {
  onLooked?: (sender: string) => void;
  onDropped?: (sender: string) => void;
  onSorted?: (order: string) => void;
  onScaled?: (order: string) => void;
  onBusy?: (count: number, loading: boolean) => void;
  onFailed?: (message: string, loading: boolean) => void;
  onCounted?: (count: number) => void;
}

export default function InboxLookup(props: InboxLookupEvents) {
  const [sender, setSender] = createSignal("");
  const [order, setOrder] = createSignal("newest");
  const [answers, setAnswers] = createSignal<string[]>([]);
  const [ordering, setOrdering] = createSignal("none");
  const [messages, setMessages] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const [unread, setUnread] = createSignal(0);
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
    <section class="inbox-lookup" aria-label="Inbox">
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
        <For each={answers()}>{(line) => <li>{line}</li>}</For>
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

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
