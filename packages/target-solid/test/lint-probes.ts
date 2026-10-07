// M1's constructs in this target's shapes, written by hand: `mergeProps` over `rawProps` and
// `props.x`, `<Switch>`/`<Match>` and `<Show>`, keyed where a branch reads what its test narrows
// (as M1 wrote it: M2 writes a non-keyed callback there, ADR-0046), `<For>` with `index()`, a
// class helper and `classList`, kebab-case style objects (number literals as strings). The same
// three components on every target: a badge (props with defaults, a conditional chain, class and
// style bindings, bound attributes, SVG), a list (nested keyed lists, conditionals inside and
// around them, a root fragment) and a card (the `props` form, a typed spread written out key by
// key, a static style). lint.test.ts pins the L5 configuration against them (ADR-0042): a rule that
// rejects one of them would force an emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.tsx": `import { Match, mergeProps, Switch } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
  gap?: string;
  quiet?: boolean;
}

export default function Badge(rawProps: BadgeProps) {
  const props = mergeProps({ tone: "info", pill: false } satisfies Partial<BadgeProps>, rawProps);
  return (
    <span
      id="badge"
      class={cx("badge", { pill: props.pill }, \`tone-\${props.tone}\`)}
      style={{ color: "red", "line-height": "1.5", "margin-top": props.gap, "--gap": props.gap }}
      aria-hidden={props.quiet}
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
              <li classList={{ done: Boolean(todo.done) }}>
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

// What this target emits for M2's constructs (ADR-0045 to ADR-0049), in the shapes src/setup.ts,
// src/listeners.ts and src/helpers.ts print: signals with their setters, `createMemo`, client code
// with no `batch`, `untrack` for what the setup reads once, the events' interface beside the
// props', `props.onChange?.(…)`, the watchers' scheduler and the watcher helper in each of its
// signatures, `createWatchEffect` over what it reads, `onMount` and a cleanup registered from it,
// template refs as a `let` a `ref` callback sets and empties, listeners as event props and, with
// an option, native listeners (`on:click={{ … }}`), a second listener of an event added from the
// `ref` callback, `createUniqueId`, the `nextTick` helper, and what captures nothing hoisted to
// module scope. lint.test.ts pins the L5 configuration against them.
export const M2_SHAPES: Readonly<Record<string, string>> = {
  "Counter.tsx": `import { createMemo, createSignal, mergeProps, Show, untrack } from "solid-js";

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
  const props = mergeProps({ initial: 0, step: 1 } satisfies Partial<CounterProps>, rawProps);
  const [count, setCount] = createSignal(untrack(() => props.initial));
  const [label] = createSignal("Count");
  const doubled = createMemo(() => count() * 2);
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
`,
  "Watchers.tsx": `import { createReaction, createSignal, onCleanup, onMount } from "solid-js";

export interface WatchersProps {
  label: string;
}

export interface WatchersEvents {
  onQueryRun?: (value: string, previous: string) => void;
  onLabelled?: (value: string, previous?: string) => void;
  onSpan?: (low: number, high: number) => void;
}

export default function Watchers(props: WatchersProps & WatchersEvents) {
  const [query, setQuery] = createSignal("");
  const [low, setLow] = createSignal(10);
  const [high, setHigh] = createSignal(50);

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
      <input
        name="query"
        onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
      />
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
 * Vue's \`watch\`: once the value \`source\` reads has changed (by \`Object.is\`), calls \`callback\` back
 * when the code that changed it has finished, before the DOM updates (after it, with \`flush:
 * "post"\`), with the value at its last callback and a cleanup registrar, whose cleanups run before
 * the next callback and when the component is removed. With \`immediate\`, it also calls back at
 * once, during the setup, without a previous value.
 */
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => void,
  options?: { flush: "post" },
): void;
function createWatcher<T>(
  source: () => T,
  callback: (value: T, previous: T | undefined, onCleanup: (cleanup: () => void) => void) => void,
  options: { immediate: true; flush?: "post" },
): void;
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: WatchedValues<S>,
    onCleanup: (cleanup: () => void) => void,
  ) => void,
  options?: { flush: "post" },
): void;
function createWatcher<const S extends readonly (() => unknown)[]>(
  sources: S,
  callback: (
    values: WatchedValues<S>,
    previous: Partial<WatchedValues<S>>,
    onCleanup: (cleanup: () => void) => void,
  ) => void,
  options: { immediate: true; flush?: "post" },
): void;
function createWatcher(
  source: (() => unknown) | readonly (() => unknown)[],
  callback: (value: never, previous: never, onCleanup: (cleanup: () => void) => void) => void,
  options?: { immediate?: true; flush?: "post" },
): void {
  // An array of sources changes when one of its values does: one source is an array of one.
  const sources = typeof source === "function" ? [source] : source;
  const cleanups: (() => void)[] = [];
  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;
  const track = createReaction(() => queueWatcher(queue, run));
  let last = read();
  if (options?.immediate) call(last, undefined);
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
 * Vue's \`watchEffect\` over the values it reads (\`sources\`): runs \`effect\` once the component has
 * mounted, then after the DOM updates once one of them has changed, with a cleanup registrar, whose
 * cleanups run before its next run and when the component is removed.
 */
function createWatchEffect(
  sources: readonly (() => unknown)[],
  effect: (onCleanup: (cleanup: () => void) => void) => void,
): void {
  onMount(() =>
    createWatcher(sources, (_values, _previous, register) => effect(register), {
      immediate: true,
      flush: "post",
    }),
  );
}

/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };
`,
  "Panel.tsx": `import { createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";

export interface PanelEvents {
  onReady?: (length: number) => void;
  onToggled?: (items: number) => void;
}

export default function Panel(props: PanelEvents) {
  const id = \`uf-id-\${createUniqueId()}\`;
  const [open, setOpen] = createSignal(false);
  const [log, setLog] = createSignal<string[]>([]);
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

  onMount(() => {
    props.onReady?.(heading?.textContent?.length ?? 0);
    timer = setInterval(() => record("tick"), 1000);
  });

  onMount(() =>
    onCleanup(() => {
      clearInterval(timer);
    }),
  );

  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        ref={(element) => {
          heading = element;
          onCleanup(() => {
            heading = null;
          });
        }}
      >
        Panel
      </h2>
      <div
        role="presentation"
        ref={(element) =>
          element.addEventListener("click", () => record("capture"), { capture: true })
        }
        on:click={() => record("bubble")}
      >
        <button type="button" on:click={{ handleEvent: () => record("once"), once: true }}>
          Once
        </button>
        <button type="button" on:click={toggle}>
          Details
        </button>
      </div>
      <div role="group" aria-label="Volume" on:wheel={{ handleEvent: () => record("wheel"), passive: true }}>
        <input name="note" onKeyDown={(event) => event.key === "Enter" && record("enter")} />
      </div>
      <Show when={open()}>
        <ul
          ref={(element) => {
            details = element;
            onCleanup(() => {
              details = null;
            });
          }}
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
`,
};
