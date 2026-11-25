// M1's constructs in this target's shapes, written by hand: `merge` over `rawProps` with a getter
// per default and `props.x`, `<Switch>`/`<Match>` and `<Show>`, keyed where a branch reads what its
// test narrows (as M1 wrote it: M2 writes a non-keyed callback there, ADR-0046), `<For>` with
// `index()`, a class helper and `class`'s object form, kebab-case style objects (number literals as
// strings), an ARIA value through `enumeratedValue`. The same three components on every target: a badge
// (props with defaults, a conditional chain, class and style bindings, bound attributes, SVG), a
// list (nested keyed lists, conditionals inside and around them, a root fragment) and a card (the
// `props` form, a typed spread written out key by key, a static style). lint.test.ts pins the L5
// configuration against them (ADR-0042, ADR-0102): a rule that rejects one of them would force an
// emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
	"Badge.tsx": `import { Match, merge, Switch } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

export default function Badge(rawProps: BadgeProps) {
  const props = merge(rawProps, {
    get tone() {
      return rawProps.tone === undefined ? "info" : rawProps.tone;
    },
    get pill() {
      return rawProps.pill === undefined ? false : rawProps.pill;
    },
  });
  return (
    <span
      id="badge"
      class={cx("badge", { pill: props.pill }, \`tone-\${props.tone}\`)}
      style={{ color: "red", "line-height": "1.5", "margin-top": props.gap, "--gap": props.gap }}
      aria-hidden={enumeratedValue(props.quiet)}
      data-tone={props.tone}
      title={props.label}
    >
      <Switch>
        <Match when={props.count !== undefined && props.count > 0}>
          <strong>{props.count}</strong>
        </Match>
        <Match when={props.tone === "warn"}>!</Match>
      </Switch>
      {props.label}{" "}
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <title>Icon</title>
        <circle cx="8" cy="8" r="4" stroke-width="2" />
        <path d="M0 0h16" />
      </svg>
      <input id="count" type="number" disabled={props.quiet} tabindex="0" maxlength="10" readonly />
      <label for="count">Count</label>
    </span>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}

/** An enumerated attribute's value: a boolean as \`"true"\` or \`"false"\`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? \`\${T}\` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? \`\${T}\` : T;
}
`,
	"LinkCard.tsx": `interface LinkAttrs {
  href: string;
  title?: string;
  class?: string;
}

export interface LinkCardProps {
  label: string;
  link: LinkAttrs;
  extra?: { id?: string; role?: string };
  accent?: string;
}

export default function LinkCard(props: LinkCardProps) {
  return (
    <div class={cx("card", props.accent)} style={{ padding: "4px", border: "1px solid" }}>
      <a href={props.link.href} title={props.link.title} class={cx("card-link", props.link.class)}>
        {props.label}
      </a>
      <p id={props.extra?.id} role={props.extra?.role}>
        More
      </p>
    </div>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
`,
	"TodoList.tsx": `import { For, Show } from "solid-js";

interface Todo {
  id: string;
  title: string;
  done?: boolean;
  tags: string[];
  owner?: { name: string };
}

export interface TodoListProps {
  todos: Todo[];
  heading?: string;
}

export default function TodoList(props: TodoListProps) {
  return (
    <>
      <Show when={props.heading}>
        <h2>{props.heading}</h2>
      </Show>
      <Show when={props.todos.length > 0} fallback={<p>Nothing to do.</p>}>
        <ol class="todos">
          <For each={props.todos}>
            {(todo, index) => (
              <li class={{ done: Boolean(todo.done) }}>
                {index() + 1}. {todo.title}
                <Show keyed when={todo.owner}>
                  {(owner) => <i>{owner.name}</i>}
                </Show>
                <Show when={todo.tags.length > 0}>
                  <ul>
                    <For each={todo.tags}>{(tag) => <li>{tag}</li>}</For>
                  </ul>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </>
  );
}
`,
};

// What this target emits for M2's constructs (ADR-0045 to ADR-0049, ADR-0102), in the shapes
// src/setup.ts, src/listeners.ts and src/helpers.ts print: state through the `createState` helper
// with its setters, a derived value as a derived function, client code with no `batch`, `untrack`
// for what the setup reads once, the events' interface beside the props', `props.onChange?.(…)`, the
// watchers' scheduler and the watcher helper in each of its signatures, over `createReaction` in a
// detached root, `createWatchEffect` over what it reads, `onSettled` and the cleanup it returns,
// template refs as a `let` a `clearedRef` callback sets and empties, listeners as event props and,
// with an option or beside one, native listeners added from the `ref` callback, `createUniqueId`,
// the `nextTick` helper, and what captures nothing hoisted to module scope. lint.test.ts pins the
// L5 configuration against them.
export const M2_SHAPES: Readonly<Record<string, string>> = {
	"Counter.tsx": `import { createSignal, getObserver, merge, Show, untrack } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
  onReset?: () => void;
}

const limits = { low: 0, high: 10 };

function clamp(value: number): number {
  return Math.min(limits.high, Math.max(limits.low, value));
}

export default function Counter(rawProps: CounterProps & CounterEvents) {
  const props = merge(rawProps, {
    get initial() {
      return rawProps.initial === undefined ? 0 : rawProps.initial;
    },
    get step() {
      return rawProps.step === undefined ? 1 : rawProps.step;
    },
  });
  const [count, setCount] = createState(untrack(() => props.initial));
  const [label] = createState("Count");
  const doubled = () => count() * 2;
  const start = untrack(() => props.initial + 1);

  function increment() {
    setCount(clamp(count() + props.step));
    props.onChange?.(count());
  }

  return (
    <div class="counter">
      <output>
        {label()} {count()} {start}
      </output>
      <Show when={doubled() > 10}>
        <span>Big</span>
      </Show>
      <button type="button" onClick={increment}>
        +{props.step}
      </button>
      <button type="button" onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  );
}

/**
 * Vue's \`ref\`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: \`createSignal\` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
`,
	"Watchers.tsx": `import {
  createReaction,
  createRoot,
  createSignal,
  flush,
  getObserver,
  onSettled,
  runWithOwner,
  untrack,
} from "solid-js";

export interface WatchersProps {
  label: string;
}

export interface WatchersEvents {
  onQueryRun?: (value: string, previous: string) => void;
  onLabelled?: (value: string, previous?: string) => void;
  onSpan?: (low: number, high: number) => void;
}

export default function Watchers(props: WatchersProps & WatchersEvents) {
  const [query, setQuery] = createState("");
  const [low, setLow] = createState(10);
  const [high, setHigh] = createState(50);

  createWatcher(query, (value, previous, onCleanup) => {
    props.onQueryRun?.(value, previous);
    onCleanup(() => {
      props.onQueryRun?.("", value);
    });
  });

  createWatcher(
    () => props.label,
    (value, previous) => {
      props.onLabelled?.(value, previous);
    },
    { immediate: true },
  );

  createWatcher([low, high], ([minimum, maximum]) => {
    props.onSpan?.(minimum, maximum);
  });

  createWatchEffect([query, () => props.label], (onCleanup) => {
    const title = \`\${query()} \${props.label}\`;
    onCleanup(() => {
      props.onLabelled?.(title);
    });
  });

  function shift() {
    setLow(low() + 10);
    setHigh(high() + 10);
  }

  return (
    <section aria-label="Watchers">
      <input name="query" onInput={(event) => setQuery(event.currentTarget.value)} />
      <button type="button" onClick={shift}>
        Shift
      </button>
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
 * Vue's \`watch\`: once the value \`source\` reads has changed (by \`Object.is\`), calls \`callback\` back
 * when the code that changed it has finished, before the DOM updates (after it, with \`flush:
 * "post"\`), with the value at its last callback and a cleanup registrar, whose cleanups run before
 * the next callback and when the component is removed. With \`immediate\`, it also calls back at
 * once, during the setup, without a previous value.
 */
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
  options?: { flush: "post" },
): void;
function createWatcher<T>(
  source: () => T,
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: () => void) => void,
  ) => unknown,
  options: { immediate: true; flush?: "post" },
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
  options?: { immediate?: true; flush?: "post" },
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
  const cleanups: (() => void)[] = [];
  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;
  const [track, dispose] = runWithOwner(null, () =>
    createRoot((stop) => [createReaction(() => queueWatcher(queue, run)), stop] as const),
  );
  let last = read();
  if (options?.immediate) untrack(() => call(last, undefined));
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
 * Vue's \`watchEffect\` over the values it reads (\`sources\`): runs \`effect\` once the component has
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
 * Vue's \`ref\`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: \`createSignal\` would take a function for a computation.
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
`,
	"Panel.tsx": `import {
  createSignal,
  createUniqueId,
  For,
  getObserver,
  onCleanup,
  onSettled,
  Show,
} from "solid-js";

export interface PanelEvents {
  onReady?: (length: number) => void;
  onToggled?: (items: number) => void;
}

export default function Panel(props: PanelEvents) {
  const id = \`uf-id-\${createUniqueId()}\`;
  const [open, setOpen] = createState(false);
  const [log, setLog] = createState<string[]>([]);
  let heading: HTMLHeadingElement | null = null;
  let details: HTMLUListElement | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  function record(line: string) {
    setLog([...log(), line]);
  }

  async function toggle() {
    setOpen(!open());
    await nextTick();
    props.onToggled?.(details?.childElementCount ?? 0);
  }

  onSettled(() => {
    props.onReady?.(heading?.textContent?.length ?? 0);
    timer = setInterval(() => record("tick"), 1000);
  });

  onSettled(() => () => {
    clearInterval(timer);
  });

  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        ref={clearedRef(
          (element) => {
            heading = element;
          },
          () => {
            heading = null;
          },
        )}
      >
        Panel
      </h2>
      <div
        role="presentation"
        ref={(element) => {
          element.addEventListener("click", () => record("capture"), { capture: true });
          element.addEventListener("click", () => record("bubble"));
        }}
      >
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("once"), { once: true })}
        >
          Once
        </button>
        <button type="button" ref={(element) => element.addEventListener("click", toggle)}>
          Details
        </button>
      </div>
      <div
        role="group"
        aria-label="Volume"
        ref={(element) => element.addEventListener("wheel", () => record("wheel"), { passive: true })}
      >
        <input name="note" onKeyDown={(event) => event.key === "Enter" && record("enter")} />
      </div>
      <Show when={open()}>
        <ul
          ref={clearedRef(
            (element) => {
              details = element;
            },
            () => {
              details = null;
            },
          )}
        >
          <For each={log()}>{(entry) => <li>{entry}</li>}</For>
        </ul>
      </Show>
    </section>
  );
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}

/** A \`ref\` that calls \`callback\` with its element, and \`clear\` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}

/**
 * Vue's \`ref\`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: \`createSignal\` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
`,
};
