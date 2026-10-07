import { createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface CoalescedEvents {
  onState?: (step: string, count: number, busy: boolean) => void;
  onSaved?: (name: string) => void;
}

function parse(text: string): number {
  const value = Number(text);
  if (Number.isNaN(value)) throw new Error("Not a number");
  return value;
}

export default function Coalesced(props: CoalescedEvents) {
  const [step, setStep] = createSignal("idle");
  const [count, setCount] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [name, setName] = createSignal("");
  const [input, setInput] = createSignal("x");
  const [cached, setCached] = createSignal<number[] | null>(null);

  createWatcher([step, count, busy], ([nextStep, nextCount, nextBusy]) => {
    props.onState?.(nextStep, nextCount, nextBusy);
  });

  async function persist(value: string) {
    setBusy(true);
    await Promise.resolve(value);
    setBusy(false);
  }

  async function withBusy(task: () => void) {
    setBusy(true);
    await Promise.resolve();
    task();
    setBusy(false);
  }

  async function load() {
    setStep("user");
    setCount(await Promise.resolve(1));
    setStep("posts");
    setCount(await Promise.resolve(2));
    setStep("done");
  }

  async function save() {
    setStep("");
    if (!name()) return;
    await persist(name());
    props.onSaved?.(name());
  }

  async function submit() {
    setStep("");
    const payload = name().trim();
    await persist(payload);
    props.onSaved?.(payload);
  }

  async function cachedLoad() {
    setBusy(true);
    const data = cached() ?? (await Promise.resolve([1, 2, 3]));
    setCached(data);
    setCount(data.length);
    setBusy(false);
  }

  async function checked() {
    try {
      setStep("checking");
      setCount(parse(input()));
      await Promise.resolve();
      setStep("checked");
    } catch {
      setStep("invalid");
    }
  }

  function busyLoad() {
    void withBusy(() => {
      setCount(7);
    });
  }

  async function notify(loud: boolean) {
    const handlers = {
      loud: (text: string) => {
        setStep(text.toUpperCase());
      },
      quiet: (text: string) => {
        setStep(text);
      },
    };
    await Promise.resolve();
    (loud ? handlers.loud : handlers.quiet)("done");
    setCount(count() + 1);
  }

  async function report(fail: boolean): Promise<boolean> {
    setBusy(true);
    try {
      setCount(await (fail ? Promise.reject(new Error("no")) : Promise.resolve(3)));
    } catch (caught) {
      setStep(String(caught));
      setBusy(false);
      return false;
    }
    setBusy(false);
    props.onSaved?.(String(count()));
    return true;
  }

  async function validate() {
    setStep("");
    if (!name()) {
      setStep("Name is required");
      return;
    }
    const payload = name();
    setBusy(true);
    await Promise.resolve(payload);
    setBusy(false);
    props.onSaved?.(payload);
  }

  async function sum() {
    setStep("summing");
    setCount((await Promise.resolve(1)) + (await Promise.resolve(2)));
    setStep("summed");
  }

  return (
    <section aria-label="Coalesced">
      <p role="status">
        {step()} {count()} {busy() ? "busy" : "idle"}
      </p>
      <button type="button" onClick={load}>
        Load
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <button type="button" onClick={submit}>
        Submit
      </button>
      <button type="button" onClick={() => setName("Ada")}>
        Name
      </button>
      <button type="button" onClick={cachedLoad}>
        Cached
      </button>
      <button type="button" onClick={() => setCount(0)}>
        Clear
      </button>
      <button type="button" onClick={checked}>
        Check
      </button>
      <button type="button" onClick={() => setInput("5")}>
        Fix
      </button>
      <button type="button" onClick={busyLoad}>
        Busy
      </button>
      <button type="button" onClick={() => notify(true)}>
        Loud
      </button>
      <button type="button" onClick={() => notify(false)}>
        Quiet
      </button>
      <button type="button" onClick={() => report(false)}>
        Report
      </button>
      <button type="button" onClick={() => report(true)}>
        Fail
      </button>
      <button type="button" onClick={validate}>
        Validate
      </button>
      <button type="button" onClick={sum}>
        Sum
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
 * Vue's `watch`: once a value `sources` read has changed (by `Object.is`), calls `callback` back
 * when the code that changed it has finished, before the DOM updates, with the value at its last
 * callback and a cleanup registrar, whose cleanups run before the next callback and when the
 * component is removed.
 */
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: WatchedValues<S>,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
): void;
function createWatcher(
  sources: readonly (() => unknown)[],
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => unknown,
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
    callback(values as never, (previous ?? []) as never, register);
  }
}

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };
