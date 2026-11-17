// The inline helpers the setup's lowering prints after the component (P7, D11: an output imports
// only its framework). Solid has the primitives (`createReaction`, `onMount`, `onCleanup`) but not
// Vue's `watch`, `watchEffect` or `nextTick`, whose semantics the contract fixes (ADR-0048): each
// helper puts them together, as a Solid developer would in a utility of their own.
//
// Solid 1.9 runs the computations a write triggers as soon as the write is made, outside `batch`,
// where the contract calls a watcher back once for all the changes of one synchronous run of
// client code. So a watcher is not a Solid computation: it is a job of a scheduler, Vue's. Its
// sources are tracked by `createReaction`, which only queues the watcher when one of them changes;
// once the synchronous code has finished (a microtask), the flush runs each queued watcher once,
// those that run before the DOM updates first. Solid updates the DOM as each write is made, so a
// watcher that runs after the DOM updates sees what the others wrote. Whatever shape the run takes
// (awaits, blocks, guards, loops, a `catch`), its writes coalesce, and the component's code has no
// `batch` (ADR-0046).

/** The watcher helper's name, before the name scope makes it unique (`interactivity`, emulated). */
export const WATCHER_HELPER = "createWatcher";

/** The `watchEffect` helper's name, before the name scope makes it unique. */
export const WATCH_EFFECT_HELPER = "createWatchEffect";

/** The `nextTick` helper's name, before the name scope makes it unique (`next-tick`, emulated). */
export const NEXT_TICK_HELPER = "nextTick";

/** What kinds of watcher one output declares, which decide the helpers' signatures. */
export interface WatcherUses {
  /** A watcher of one source, lazy or immediate. */
  single: { lazy: boolean; immediate: boolean };
  /** A watcher of an array of sources, lazy or immediate. */
  array: { lazy: boolean; immediate: boolean };
  /**
   * A watcher that runs before the DOM updates (Vue's default), or after it (`flush: "post"`,
   * and every `watchEffect`).
   */
  flush: { pre: boolean; post: boolean };
}

/** The names the helpers' code refers to: Solid's imports and the helpers, as the scope took them. */
export interface HelperNames {
  createReaction: string;
  onCleanup: string;
  onMount: string;
  /** The `watch` helper, where the output has a watcher. */
  watcher?: string;
  /** The `watchEffect` helper, where the output has one. */
  watchEffect?: string;
  /** The array helper's type of the values of an array of sources, when arrays are watched. */
  values?: string;
  /** The scheduler's queue (`queuedWatchers`), function (`queueWatcher`) and flag. */
  queue: string;
  schedule: string;
  queued: string;
}

/**
 * Vue's `watch` and `watchEffect` on Solid's primitives (ADR-0048), named `create…` as Solid's
 * own primitives and custom ones are, which `solid/reactivity` reads as tracked scopes for what
 * they are passed:
 *
 * - the scheduler: a queue of watchers whose sources have changed, flushed in a microtask queued
 *   at the first change, which runs each once, in the order they changed, those that run before
 *   the DOM updates first, again until none is queued (a watcher's write queues others);
 * - `createWatcher`: `createReaction` tracks the source (each source of an array) and queues the
 *   watcher when one changes; the flush reads the source again, tracking it again, and calls the
 *   callback where the value differs (by `Object.is`, each value of an array) from the value at
 *   its last callback (or its creation), with that value and a cleanup registrar, whose cleanups
 *   run before the next callback and when the component is removed. An immediate watcher calls
 *   back once at once, during the setup, with no previous value (`[]` for an array of sources);
 * - `createWatchEffect`: Vue's `watchEffect` over the values the effect reads (UF2015 makes them
 *   static): it runs once the component has mounted, and is queued after the DOM updates
 *   whenever one of them is written, as Vue's runs again after a write of a ref it read, even
 *   one written back before the flush.
 *
 * A callback's return value is `unknown`: an async callback's promise is neither awaited nor
 * reported, as on Vue. Only the helpers, signatures, options and timings an output uses are
 * printed: one source watched lazily is the common case, with a helper of its own.
 */
export function watcherHelperCode(uses: WatcherUses, names: HelperNames): string {
  const { createReaction, onCleanup, onMount } = names;
  // Where the output has watchers of both timings, a call says `flush: "post"` as the source does,
  // and the scheduler keeps two queues; where every watcher has one timing, one queue serves.
  const both = uses.flush.post && uses.flush.pre;
  const immediate = uses.single.immediate || uses.array.immediate;
  const arrays = uses.array.lazy || uses.array.immediate;
  const timing = both
    ? 'before the DOM updates (after it, with `flush: "post"`)'
    : uses.flush.post
      ? "after the DOM updates"
      : "before the DOM updates";
  const parts = [schedulerCode(names, both)];
  const effect = names.watchEffect ? [watchEffectCode(names.watchEffect, names, both)] : [];
  if (!names.watcher) return [...parts, ...effect].join("\n\n");
  const name = names.watcher;
  const doc = docComment(
    [
      `Vue's \`watch\`: once ${arrays && !(uses.single.lazy || uses.single.immediate) ? "a value `sources` read has" : "the value `source` reads has"} changed (by \`Object.is\`), calls \`callback\``,
      `back when the code that changed it has finished, ${timing},`,
      "with the value at its last callback and a cleanup registrar, whose cleanups run before the",
      "next callback and when the component is removed.",
      ...(immediate
        ? [
            "With `immediate`, it also calls back at once, during the setup, without a previous value.",
          ]
        : []),
    ].join(" "),
  );
  /** The queue a watcher goes to, and its call of the scheduler. */
  const queueOf = both
    ? `options?.flush === "post" ? ${names.queue}.post : ${names.queue}.pre`
    : names.queue;
  const schedule = both ? `${names.schedule}(queue, run)` : `${names.schedule}(run)`;
  const declareQueue = both ? `\n  const queue = ${queueOf};` : "";
  const dequeue = both ? "queue.delete(run)" : `${names.queue}.delete(run)`;
  const stop = `  ${onMount}(() =>
    ${onCleanup}(() => {
      ${dequeue};
      for (const cleanup of cleanups.splice(0)) cleanup();
    }),
  );`;
  /** The callback's cleanup registrar's type. */
  const registrar = "(cleanup: () => void) => void";
  if (!arrays && !uses.single.immediate) {
    parts.push(`${doc}
function ${name}<T>(
  source: () => T,
  callback: (value: T, previous: T, onCleanup: ${registrar}) => unknown,${both ? `\n  options?: { flush: "post" },` : ""}
): void {
  const cleanups: (() => void)[] = [];${declareQueue}
  const track = ${createReaction}(() => ${schedule});
  let last = read();
${stop}

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
}`);
    return [...parts, ...effect].join("\n\n");
  }
  // The options each overload takes: a lazy watcher's only where some watcher runs before the DOM
  // updates and some after it.
  const lazyOptions = both ? `\n  options?: { flush: "post" },` : "";
  const immediateOptions = both
    ? `\n  options: { immediate: true; flush?: "post" },`
    : `\n  options: { immediate: true },`;
  const optionsType = immediate
    ? both
      ? `{ immediate?: true; flush?: "post" }`
      : `{ immediate: true }`
    : both
      ? `{ flush: "post" }`
      : undefined;
  const values = names.values!;
  const overloads: string[] = [];
  if (uses.single.lazy) {
    overloads.push(
      `function ${name}<T>(\n  source: () => T,\n  callback: (value: T, previous: T, onCleanup: ${registrar}) => unknown,${lazyOptions}\n): void;`,
    );
  }
  if (uses.single.immediate) {
    overloads.push(
      `function ${name}<T>(\n  source: () => T,\n  callback: (value: T, previous: T | undefined, onCleanup: ${registrar}) => unknown,${immediateOptions}\n): void;`,
    );
  }
  if (uses.array.lazy) {
    overloads.push(
      `function ${name}<const S extends readonly (() => unknown)[]>(\n  sources: S,\n  callback: (values: ${values}<S>, previous: ${values}<S>, onCleanup: ${registrar}) => unknown,${lazyOptions}\n): void;`,
    );
  }
  if (uses.array.immediate) {
    overloads.push(
      `function ${name}<const S extends readonly (() => unknown)[]>(\n  sources: S,\n  callback: (\n    values: ${values}<S>,\n    previous: Partial<${values}<S>>,\n    onCleanup: ${registrar},\n  ) => unknown,${immediateOptions}\n): void;`,
    );
  }
  // An immediate watcher's test: its options, where immediate is the only option there is.
  const isImmediate = both ? "options?.immediate" : "options";
  const first = immediate ? `\n  if (${isImmediate}) call(last, undefined);` : "";
  const singles = uses.single.lazy || uses.single.immediate;
  // The single form passes the one value; the array form the values, `[]` before the first call.
  const callback = arrays
    ? singles
      ? `    if (typeof source === "function") {
      callback(values[0] as never, previous?.[0] as never, register);
    } else {
      callback(values as never, (previous ?? []) as never, register);
    }`
      : `    callback(values as never, (previous ?? []) as never, register);`
    : `    callback(values[0] as never, previous?.[0] as never, register);`;
  // The implementation's first parameter: one source, an array, or either.
  const parameter = !arrays
    ? "source: () => unknown"
    : singles
      ? "source: (() => unknown) | readonly (() => unknown)[]"
      : "sources: readonly (() => unknown)[]";
  const sources = !arrays
    ? "\n  const sources = [source];"
    : singles
      ? `\n  // An array of sources changes when one of its values does: one source is an array of one.\n  const sources = typeof source === "function" ? [source] : source;`
      : "";
  parts.push(`${doc}
${overloads.join("\n")}
function ${name}(
  ${parameter},
  callback: (value: never, previous: never, onCleanup: ${registrar}) => unknown,${optionsType ? `\n  options?: ${optionsType},` : ""}
): void {${sources}
  const cleanups: (() => void)[] = [];${declareQueue}
  const track = ${createReaction}(() => ${schedule});
  let last = read();${first}
${stop}

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
${callback}
  }
}`);
  parts.push(...effect);
  if (arrays) {
    parts.push(
      `/** The values of an array of sources, in order, as a tuple the callback may annotate as it is. */
type ${values}<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };`,
    );
  }
  return parts.join("\n\n");
}

/**
 * Vue's `watchEffect` (see `watcherHelperCode`): created once the component has mounted, it runs
 * the effect, tracking its sources, and runs it again, after the DOM updates, at the flush after
 * one is written, with a cleanup registrar whose cleanups run before its next run and when the
 * component is removed.
 */
function watchEffectCode(name: string, names: HelperNames, both: boolean): string {
  const { createReaction, onCleanup, onMount } = names;
  const queue = both ? `${names.queue}.post` : names.queue;
  const schedule = both ? `${names.schedule}(${queue}, run)` : `${names.schedule}(run)`;
  return `/**
 * Vue's \`watchEffect\` over the values it reads (\`sources\`): runs \`effect\` once the component has
 * mounted, then again after the DOM updates once one of them has been written, with a cleanup
 * registrar, whose cleanups run before its next run and when the component is removed.
 */
function ${name}(
  sources: readonly (() => unknown)[],
  effect: (onCleanup: (cleanup: () => void) => void) => unknown,
): void {
  ${onMount}(() => {
    const cleanups: (() => void)[] = [];
    const track = ${createReaction}(() => ${schedule});
    run();
    ${onCleanup}(() => {
      ${queue}.delete(run);
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
}`;
}

/**
 * The scheduler (see `watcherHelperCode`): the queue of watchers whose sources have changed, one
 * per timing where the output has both, and the function that queues one and, at the first, the
 * microtask that flushes them.
 */
function schedulerCode(names: HelperNames, both: boolean): string {
  const { queue, schedule, queued } = names;
  if (!both) {
    return `/** The watchers whose sources have changed since the last flush, in the order they changed. */
const ${queue} = new Set<() => void>();
let ${queued} = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, until none is queued: a Set's iteration
 * visits what a watcher's writes queue while it runs.
 */
function ${schedule}(run: () => void): void {
  ${queue}.add(run);
  if (${queued}) return;
  ${queued} = true;
  queueMicrotask(() => {
    try {
      for (const watcher of ${queue}) {
        ${queue}.delete(watcher);
        watcher();
      }
    } finally {
      ${queued} = false;
    }
  });
}`;
  }
  return `/**
 * The watchers whose sources have changed since the last flush, in the order they changed: those
 * that run before the DOM updates, and those that run after it.
 */
const ${queue} = { pre: new Set<() => void>(), post: new Set<() => void>() };
let ${queued} = false;

/**
 * Vue's scheduler: queues a watcher whose sources have changed and, once the synchronous code that
 * changed them has finished, runs each queued watcher once, those that run before the DOM updates
 * first, until none is queued. Solid updates the DOM as each write is made, so a watcher that runs
 * after the DOM updates sees what the others wrote.
 */
function ${schedule}(queue: Set<() => void>, run: () => void): void {
  queue.add(run);
  if (${queued}) return;
  ${queued} = true;
  queueMicrotask(() => {
    try {
      do {
        for (const watcher of ${queue}.pre) {
          ${queue}.pre.delete(watcher);
          watcher();
        }
        for (const watcher of ${queue}.post) {
          ${queue}.post.delete(watcher);
          watcher();
          if (${queue}.pre.size) break;
        }
      } while (${queue}.pre.size || ${queue}.post.size);
    } finally {
      ${queued} = false;
    }
  });
}`;
}

/** A JSDoc comment of prose, wrapped at 100 columns as the formatter leaves comments. */
function docComment(text: string): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && ` * ${line} ${word}`.length > 100) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return `/**\n${lines.map((each) => ` * ${each}`).join("\n")}\n */`;
}

/**
 * Vue's `nextTick` (`next-tick`, emulated): Solid applies a write to the DOM as it is made, and the
 * watchers' flush is a microtask queued at the first write, so a promise resolved now continues
 * after both. Client code awaits it (`nextTick(callback)` is UF2025).
 */
export function nextTickHelperCode(name: string): string {
  return `/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function ${name}(): Promise<void> {
  return Promise.resolve();
}`;
}
