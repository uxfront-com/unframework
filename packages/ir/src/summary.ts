// What setup code does, read from its references (ADR-0045): the analyser, `checkInvariants` and
// every target judge a call of a local function by the same summary, so they cannot drift. The IR
// holds no summary of its own, so a plugin cannot lie about one. What needs the source's syntax
// (nondeterminism, mutation, conditional reads) is the analyser's to add.

import { PURE_GLOBALS } from "./names.ts";
import type { Binding, BindingId, Code, CodeReference, UfComponent } from "./types.ts";
import { codeOf, expressionsOf } from "./visit.ts";

/** What a piece of code does, itself and through the local functions it calls. */
export interface CodeSummary {
  /** The local functions it calls itself, by binding, in source order, each once. */
  calls: readonly BindingId[];
  /** Every local function it reaches through calls, transitively. */
  reaches: ReadonlySet<BindingId>;
  /** The bindings it and what it reaches read, other than as the callee of a call. */
  reads: ReadonlySet<BindingId>;
  /** The `state` and `localVar` bindings it and what it reaches write. */
  writes: ReadonlySet<BindingId>;
  /** The events it and what it reaches emit. */
  emits: ReadonlySet<string>;
  /** Whether it or what it reaches calls `nextTick`. */
  api: boolean;
  /** Whether a function it reaches is `async` (and, in a function's summary, the function). */
  async: boolean;
  /** Whether it or what it reaches reads a `templateRef` binding. */
  readsTemplateRef: boolean;
  /** Whether it or what it reaches reads a `localVar` binding. */
  readsLocalVar: boolean;
  /** The globals it and what it reaches read beyond `PURE_GLOBALS`, which only client code may. */
  clientGlobals: ReadonlySet<string>;
}

/** What a local function does, and how the component uses it. */
export interface FunctionSummary extends CodeSummary {
  /**
   * Whether the component reads the function other than by calling it or naming it as a
   * handler: as a call's argument in client code (`setTimeout(tick, 100)`), so it runs later.
   */
  escapes: boolean;
  /** Whether the function makes a `preventDefault()` or `stopPropagation()` call. */
  eventControls: boolean;
}

/** What one piece of code does itself, before the functions it calls are followed. */
interface Facts {
  calls: BindingId[];
  reads: Set<BindingId>;
  writes: Set<BindingId>;
  emits: Set<string>;
  api: boolean;
  globals: Set<string>;
}

/** What references say, each kind read exhaustively. */
function factsOf(refs: readonly CodeReference[]): Facts {
  const facts: Facts = {
    calls: [],
    reads: new Set(),
    writes: new Set(),
    emits: new Set(),
    api: false,
    globals: new Set(),
  };
  for (const ref of refs) {
    switch (ref.kind) {
      case "Binding":
        if (!ref.call) facts.reads.add(ref.binding);
        else if (!facts.calls.includes(ref.binding)) facts.calls.push(ref.binding);
        break;
      case "Global":
        facts.globals.add(ref.name);
        break;
      case "Write":
        facts.writes.add(ref.binding);
        break;
      case "Emit":
        facts.emits.add(ref.event);
        break;
      case "Api":
        facts.api = true;
        break;
      // A slot's presence reads no binding: the parent's fill is the slot's.
      case "Event":
      case "Slot":
        break;
      default:
        unreachable(ref);
    }
  }
  return facts;
}

/**
 * The summary of each local function of a component (each `localFn` binding a `Function` item
 * declares), by binding: what it does itself and through every function it reaches, so a call
 * can be judged where it is (ADR-0045). A call of a binding that is not a local function counts
 * as a read of it.
 */
export function summarize(component: UfComponent): ReadonlyMap<BindingId, FunctionSummary> {
  const kinds = new Map(component.bindings.map((binding) => [binding.id, binding]));
  const own = new Map<BindingId, { facts: Facts; async: boolean; controls: boolean }>();
  for (const item of component.setup) {
    if (item.kind !== "Function") continue;
    const fn = item.function;
    own.set(item.binding, {
      facts: factsOf(fn.body.refs),
      async: fn.async === true,
      controls: (fn.eventControls?.length ?? 0) > 0,
    });
  }
  const escaping = new Set<BindingId>();
  const located = [
    ...expressionsOf(component).map(({ expression }) => expression.refs),
    ...codeOf(component).map(({ code }) => code.refs),
  ];
  for (const refs of located) {
    for (const ref of refs) {
      if (ref.kind === "Binding" && !ref.call && own.has(ref.binding)) escaping.add(ref.binding);
    }
  }
  const summaries = new Map<BindingId, FunctionSummary>();
  for (const [id, { facts, async, controls }] of own) {
    const summary = close(facts, kinds, own);
    summaries.set(id, {
      ...summary,
      async: summary.async || async,
      escapes: escaping.has(id),
      eventControls: controls,
    });
  }
  return summaries;
}

/**
 * What a piece of code of a component does, itself and through the local functions it calls:
 * an initial value, a getter's or a callback's body.
 */
export function summarizeCode(code: Code, component: UfComponent): CodeSummary {
  const kinds = new Map(component.bindings.map((binding) => [binding.id, binding]));
  const own = new Map<BindingId, { facts: Facts; async: boolean }>();
  for (const item of component.setup) {
    if (item.kind === "Function") {
      own.set(item.binding, {
        facts: factsOf(item.function.body.refs),
        async: item.function.async === true,
      });
    }
  }
  return close(factsOf(code.refs), kinds, own);
}

/**
 * What a `watchEffect`'s code does while it runs (ADR-0048), itself and through the local
 * functions it calls: as {@link summarizeCode}, without the references marked `later`, which lie
 * in a function the code hands to a timer, a promise's `then`, `addEventListener` or `onCleanup`
 * and run after it. Its `reads` are what every target tracks: React lists them as the effect's
 * dependencies, Qwik `track`s them, and Vue, Svelte, Solid and Angular read nothing else while
 * the effect runs.
 */
export function summarizeTracked(code: Code, component: UfComponent): CodeSummary {
  const kinds = new Map(component.bindings.map((binding) => [binding.id, binding]));
  const own = new Map<BindingId, { facts: Facts; async: boolean }>();
  for (const item of component.setup) {
    if (item.kind === "Function") {
      own.set(item.binding, {
        facts: factsOf(now(item.function.body.refs)),
        async: item.function.async === true,
      });
    }
  }
  return close(factsOf(now(code.refs)), kinds, own);
}

/** The references code makes while it runs: all but those marked `later`. */
function now(refs: readonly CodeReference[]): CodeReference[] {
  return refs.filter((ref) => ref.kind !== "Binding" || ref.later !== true);
}

/** Follows the calls from `facts` through the local functions, and merges what each does. */
function close(
  facts: Facts,
  kinds: ReadonlyMap<BindingId, Binding>,
  functions: ReadonlyMap<BindingId, { facts: Facts; async: boolean }>,
): CodeSummary {
  const reaches = new Set<BindingId>();
  const reads = new Set(facts.reads);
  const writes = new Set(facts.writes);
  const emits = new Set(facts.emits);
  const globals = new Set(facts.globals);
  let { api } = facts;
  let async = false;
  const pending = [...facts.calls];
  while (pending.length) {
    const id = pending.shift()!;
    const callee = functions.get(id);
    if (!callee) {
      reads.add(id);
      continue;
    }
    if (reaches.has(id)) continue;
    reaches.add(id);
    for (const read of callee.facts.reads) reads.add(read);
    for (const write of callee.facts.writes) writes.add(write);
    for (const event of callee.facts.emits) emits.add(event);
    for (const name of callee.facts.globals) globals.add(name);
    api ||= callee.facts.api;
    async ||= callee.async;
    pending.push(...callee.facts.calls);
  }
  const readsKind = (kind: Binding["kind"]) =>
    [...reads].some((id) => kinds.get(id)?.kind === kind);
  return {
    calls: facts.calls.filter((id) => functions.has(id)),
    reaches,
    reads,
    writes,
    emits,
    api,
    async,
    readsTemplateRef: readsKind("templateRef"),
    readsLocalVar: readsKind("localVar"),
    clientGlobals: new Set([...globals].filter((name) => !PURE_GLOBALS.has(name))),
  };
}

/**
 * Why code with this summary is not pure, or `undefined` when it is as far as references tell:
 * it writes, emits, calls `nextTick`, awaits, reads a template ref or a setup `let`, or a global
 * only client code may. A template, an initial value or a getter calls only pure functions
 * (ADR-0045); the analyser also rejects what needs the syntax to see (UF2014).
 */
export function impurity(summary: CodeSummary): string | undefined {
  const [write] = summary.writes;
  if (write !== undefined) return `it writes "${write}"`;
  const [event] = summary.emits;
  if (event !== undefined) return `it emits "${event}"`;
  if (summary.api) return "it calls `nextTick`";
  if (summary.async) return "it is asynchronous";
  if (summary.readsTemplateRef) return "it reads a template ref";
  if (summary.readsLocalVar) return "it reads a setup `let`";
  const [global] = summary.clientGlobals;
  if (global !== undefined) return `it reads \`${global}\`, which only client code may`;
  return undefined;
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
