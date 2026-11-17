import type { JSX } from "@solidjs/web";
import {
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  onCleanup,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

export interface SyncDeskEvents {
  onChecked?: (email: string) => void;
  onSummary?: (text: string) => void;
  onFocused?: (name: string) => void;
  onProgress?: (step: string, owner: string) => void;
  onSaveState?: (error: string, name: string) => void;
  onSavedName?: (name: string) => void;
  onImportState?: (status: string, count: number) => void;
  onSettled?: (note: string) => void;
  onSending?: (busy: boolean, outcome: string) => void;
  onSent?: (count: number) => void;
  onClamped?: (level: number) => void;
}

async function validate(value: string): Promise<boolean> {
  return value.includes("@");
}

export default function SyncDesk(
  props: SyncDeskProps & SyncDeskEvents & { class?: string; style?: JSX.CSSProperties },
) {
  let waiting: Waiting[] = [];

  function ask(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      waiting = [...waiting, { resolve, reject }];
    });
  }

  function answer(text: string) {
    const [first, ...rest] = waiting;
    waiting = rest;
    first?.resolve(text);
  }

  function fail() {
    const [first, ...rest] = waiting;
    waiting = rest;
    first?.reject(new Error("offline"));
  }

  const [email, setEmail] = createState("ada@example.com");
  const [checking, setChecking] = createState(false);
  const [valid, setValid] = createState(true);
  let confirm: HTMLButtonElement | null = null;

  createWatcher(email, async (value) => {
    setChecking(true);
    const ok = await validate(value);
    setChecking(false);
    setValid(ok);
  });

  createWatcher(
    email,
    (value) => {
      props.onChecked?.(value);
    },
    { flush: "post" },
  );

  createWatchEffect([email, valid], () => {
    props.onSummary?.(`${email()} is ${valid() ? "valid" : "invalid"}`);
  });

  async function suggest() {
    setEmail("ada@lovelace.dev");
    await nextTick();
    confirm?.focus();
    props.onFocused?.(document.activeElement?.textContent ?? "none");
  }

  const [step, setStep] = createState("idle");
  const [owner, setOwner] = createState("nobody");
  const [editor, setEditor] = createState("nobody");

  createWatcher([step, owner], ([current, who]) => {
    props.onProgress?.(current, who);
  });

  async function load() {
    setStep("owner");
    setOwner(await ask());
    setStep("editor");
    setEditor(await ask());
    setStep("done");
  }

  const [name, setName] = createState("");
  const [error, setError] = createState("");
  const [saving, setSaving] = createState("");

  createWatcher([error, saving], ([message, current]) => {
    props.onSaveState?.(message, current);
  });

  async function persist(value: string) {
    setSaving(value);
    await ask();
    setSaving("");
  }

  async function save() {
    setError("");
    const payload = name().trim();
    if (!payload) {
      setError("Name required");
      return;
    }
    await persist(payload);
    props.onSavedName?.(payload);
  }

  const [status, setStatus] = createState("idle");
  const [imported, setImported] = createState(0);

  createWatcher([status, imported], ([text, count]) => {
    props.onImportState?.(text, count);
  });

  async function importAll() {
    setImported(0);
    setStatus("starting");
    for (const file of props.files) {
      setStatus(`importing ${file}`);
      await ask();
      setImported(imported() + 1);
    }
    setStatus("done");
  }

  const [note, setNote] = createState("idle");

  function refresh() {
    setNote("refreshing");
    void ask()
      .then((text) => {
        setNote(`refreshed by ${text}`);
      })
      .finally(() =>
        untrack(() => {
          props.onSettled?.(note());
        }),
      );
  }

  async function prefetch() {
    const pending = ask();
    setNote("waiting");
    const text = await pending;
    setNote(`prefetched by ${text}`);
  }

  const [sendBusy, setSendBusy] = createState(false);
  const [outcome, setOutcome] = createState("");
  const [total, setTotal] = createState(0);

  createWatcher([sendBusy, outcome], ([sendingNow, text]) => {
    props.onSending?.(sendingNow, text);
  });

  async function send() {
    setSendBusy(true);
    setOutcome("");
    try {
      const reply = await ask();
      if (reply === "") {
        setOutcome("Declined");
        setSendBusy(false);
        return;
      }
      setTotal(total() + 1);
    } catch (failure) {
      setOutcome(failure instanceof Error ? failure.message : "Failed");
      setSendBusy(false);
      return;
    }
    setSendBusy(false);
    setOutcome(`Sent ${total()}`);
    props.onSent?.(total());
  }

  const [volume, setVolume] = createState(4);
  const [level, setLevel] = createState(4);

  function apply(value: number) {
    if (value > 10) value = 10;
    setLevel(value);
    props.onClamped?.(value);
  }

  createWatcher(volume, (next) => {
    apply(next * 2);
  });

  return (
    <section
      class={props.class ? `sync-desk ${props.class}` : "sync-desk"}
      aria-label="Sync desk"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={suggest}>
        Suggest
      </button>
      <button
        type="button"
        ref={clearedRef(
          (element) => {
            confirm = element;
          },
          () => {
            confirm = null;
          },
        )}
      >
        Use this email
      </button>
      <p>
        {email()}: {checking() ? "checking" : valid() ? "valid" : "invalid"}
      </p>
      <button type="button" onClick={load}>
        Load
      </button>
      <p>
        Step: {step()}, owner {owner()}, editor {editor()}
      </p>
      <label>
        Name
        <input
          name="name"
          onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>{saving() === "" ? error() || "Not saving" : `Saving ${saving()}`}</p>
      <button type="button" onClick={importAll}>
        Import
      </button>
      <p>
        Import: {status()}, {imported()} imported
      </p>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
      <button type="button" onClick={prefetch}>
        Prefetch
      </button>
      <p>Note: {note()}</p>
      <button type="button" onClick={send}>
        Send
      </button>
      <p>Send: {sendBusy() ? "sending" : outcome() === "" ? "not sent" : outcome()}</p>
      <button type="button" onClick={() => setVolume(volume() + 3)}>
        Louder
      </button>
      <p>Level: {level()}</p>
      <div role="group" aria-label="Server">
        <button type="button" onClick={() => answer("Ada")}>
          Reply
        </button>
        <button type="button" onClick={() => answer("")}>
          Decline
        </button>
        <button type="button" onClick={fail}>
          Fail
        </button>
      </div>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
