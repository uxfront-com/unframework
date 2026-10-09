// The rules judged once a component's setup and render tree are lowered (ADR-0045 to ADR-0049):
// those that need every local function's summary (`summarize` from `@unframework/ir`, which the
// invariants and the targets read too), with what the walks noted that needs the source's syntax
// (`CodeFacts`).
// Each reports at the exact place: the call of a function, the read, the write.

import type { Fix } from "@unframework/diagnostics";
import {
  BROWSER_GLOBALS,
  codeOf,
  createComponent,
  createFragment,
  expressionsOf,
  readsDom,
  SCHEDULING_GLOBALS,
  summarize,
  summarizeCode,
  summarizeTracked,
} from "@unframework/ir";
import type {
  Binding,
  BindingId,
  Code,
  CodeReference,
  CodeSummary,
  FunctionCode,
  FunctionSummary,
  Span,
  UfComponent,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import type { AuthoringApi } from "./authoring.ts";
import { AUTHORING_TYPES } from "./authoring.ts";
import { checkClientRules } from "./client-rules.ts";
import { closure } from "./declarations.ts";
import type { PropsAnalysis } from "./props.ts";
import type { RenderContext, SetupBinding } from "./render.ts";
import type { ItemSource, Setup } from "./setup.ts";
import { deferredFunctions, isLater, laterRegions, markLater } from "./suspension.ts";
import type { FunctionNode } from "./suspension.ts";
import { checkTypeQueries } from "./type-queries.ts";
import { has } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/** What the rules read of a component: its lowered parts and its source. */
export interface RulesInput {
  readonly name: string;
  readonly span: Span;
  readonly render: RenderContext;
  readonly setup: Setup;
  readonly props: PropsAnalysis;
  readonly root: UfComponent["render"] | undefined;
  readonly program: AST.Program;
  /** Whether the component's lowering reported an error: the fixes that need every read wait. */
  readonly failed: boolean;
}

/** The type declarations of each module whose erased references are reported (UF2019). */
const REPORTED_TYPES = new WeakMap<AST.Program, Set<number>>();

/** The globals that read the clock, chance or the machine (UF3019), and how. */
const NONDETERMINISTIC: ReadonlyMap<string, string> = new Map([
  ["Date", "reads the clock (`Date`)"],
  ["Intl", "formats by the machine's locale (`Intl`)"],
  ["crypto", "reads chance (`crypto`)"],
  ["performance", "reads the clock (`performance`)"],
]);

/** Judges a lowered component by the rules that need every function's summary. */
export function checkRules(input: RulesInput): void {
  const rules = new Rules(input);
  rules.calls();
  rules.effects();
  rules.watchers();
  rules.setupOrder();
  rules.localCalls();
  rules.conditionalReads();
  rules.setupOnce();
  rules.erasedTypes();
  checkClientRules({
    input,
    component: rules.component,
    summaries: rules.summaries,
    deferred: rules.deferred,
  });
  checkTypeQueries(input.render);
}

class Rules {
  readonly #input: RulesInput;
  readonly #component: UfComponent;
  readonly #summaries: ReadonlyMap<BindingId, FunctionSummary>;
  readonly #bindings: ReadonlyMap<BindingId, Binding>;
  /** The setup's bindings as the analyser reads them, by id. */
  readonly #setup: ReadonlyMap<BindingId, SetupBinding>;
  /** The constants whose value reads no binding: what a getter's function may read (UF2014). */
  readonly #static = new Set<BindingId>();
  /** The functions client code hands on to run later (ADR-0048). */
  readonly #deferred: ReadonlySet<FunctionNode>;

  constructor(input: RulesInput) {
    this.#input = input;
    const { render, setup, props, root, name, span } = input;
    this.#component = createComponent(
      name,
      root ?? createFragment([], span),
      span,
      props.props,
      props.propsParameter,
      [],
      render.bindings.toSorted((a, b) => a.span.start - b.span.start),
      setup.items,
      setup.emits,
    );
    // What runs later is marked in the IR first: the rules and the targets track only the rest.
    this.#deferred = deferredFunctions(render);
    markLater(this.#component, render, this.#deferred);
    this.#summaries = summarize(this.#component);
    this.#bindings = new Map(this.#component.bindings.map((binding) => [binding.id, binding]));
    this.#setup = new Map(
      [...render.setup.bindings.values()].map((binding) => [binding.id, binding]),
    );
    for (const item of setup.items) {
      if (item.kind === "Const" && !item.value.refs.some((ref) => ref.kind === "Binding")) {
        this.#static.add(item.binding);
      }
    }
  }

  /** The component as the rules read it, and its local functions' summaries. */
  get component(): UfComponent {
    return this.#component;
  }

  /** The functions client code hands on to run later (ADR-0048). */
  get deferred(): ReadonlySet<FunctionNode> {
    return this.#deferred;
  }

  get summaries(): ReadonlyMap<BindingId, FunctionSummary> {
    return this.#summaries;
  }

  get #reporter() {
    return this.#input.render.reporter;
  }

  #name(id: BindingId): string {
    return this.#bindings.get(id)?.name ?? id.split("@")[0]!;
  }

  #kind(id: BindingId): Binding["kind"] | undefined {
    return this.#bindings.get(id)?.kind;
  }

  #refValue(id: BindingId): boolean {
    return refValue(id, this.#bindings, this.#input);
  }

  /**
   * What makes a local function's result depend on time, chance or the machine, itself or
   * through the functions it calls (UF3019), or `undefined`.
   */
  #nondeterministic(id: BindingId): string | undefined {
    const summary = this.#summaries.get(id);
    if (!summary) return undefined;
    for (const reached of [id, ...summary.reaches]) {
      const reason = this.#setup.get(reached)?.nondeterministic;
      if (reason) return reason;
    }
    for (const global of summary.clientGlobals) {
      const reason = NONDETERMINISTIC.get(global);
      if (reason) return reason;
    }
    return undefined;
  }

  /**
   * Why a local function's summary is not pure, other than what UF3019 says (UF2014): it writes,
   * emits, calls `nextTick`, is asynchronous, reads a template ref or a setup `let`, or a global
   * only client code may.
   */
  #impurity(summary: CodeSummary): string | undefined {
    const [write] = summary.writes;
    if (write !== undefined) {
      return `it writes \`${this.#name(write)}${this.#kind(write) === "state" || this.#kind(write) === "model" ? ".value" : ""}\``;
    }
    const [event] = summary.emits;
    if (event !== undefined) return `it emits "${event}"`;
    if (summary.api) return "it calls `nextTick`";
    if (summary.async) return "it is asynchronous";
    if (summary.readsTemplateRef) return "it reads a template ref";
    if (summary.readsLocalVar) return "it reads a setup `let`, which is not reactive";
    const global = [...summary.clientGlobals].find((name) => !NONDETERMINISTIC.has(name));
    if (global !== undefined) return `it reads \`${global}\`, which only client code may`;
    return undefined;
  }

  /**
   * The calls of local functions in templates, getters and initial values (UF2014, UF3019): only
   * of pure ones, which read nothing nondeterministic; a getter's only of functions that read
   * nothing but static constants, which Qwik hoists with them out of the component.
   */
  calls(): void {
    const sites: { refs: readonly CodeReference[]; where: string; getter: boolean }[] = [
      ...expressionsOf(this.#component).map(({ expression }) => ({
        refs: expression.refs,
        where: "a template expression",
        getter: false,
      })),
      ...codeOf(this.#component)
        .filter(({ context }) => context === "pure")
        .map(({ code, path }) => {
          const getter = path.endsWith("/getter/body");
          return {
            refs: code.refs,
            where: getter ? "a getter" : "an initial value",
            getter,
          };
        }),
    ];
    for (const { refs, where, getter } of sites) {
      for (const ref of refs) {
        if (ref.kind !== "Binding" || !ref.call || this.#kind(ref.binding) !== "localFn") continue;
        const summary = this.#summaries.get(ref.binding);
        if (!summary) continue;
        const name = this.#name(ref.binding);
        const random = this.#nondeterministic(ref.binding);
        if (random) {
          this.#reporter.report(
            "UF3019",
            ref.span,
            `\`${name}\` ${random}, and ${where} calls it: ${where === "a template expression" ? "the server's render and the browser's" : "the server's setup and the browser's"} would differ.`,
            {
              help: "Pass the value in as a prop, or set it from client code (`onMounted`, a handler).",
            },
          );
        }
        const impure = this.#impurity(summary);
        if (impure) {
          this.#reporter.report(
            "UF2014",
            ref.span,
            `${where === "a template expression" ? "A template expression" : where === "a getter" ? "A getter" : "An initial value"} calls \`${name}\`, and ${impure}: ${where === "a template expression" ? "rendering" : "the setup's pure code"} must not change or read what only client code may, and a framework runs it when it decides to.`,
            {
              help: "Call it from client code (a handler, a watcher's callback, a lifecycle hook), or compute the value without it.",
            },
          );
          continue;
        }
        if (!getter || random) continue;
        const read = [...summary.reads].find((id) => !this.#static.has(id));
        if (read !== undefined) {
          this.#reporter.report(
            "UF2014",
            ref.span,
            `A getter calls \`${name}\`, which reads \`${this.#name(read)}\`: a getter calls only functions that read nothing but constants that read nothing themselves, which Qwik hoists with them out of the component, where its getter's closure can reach them.`,
            {
              help: `Pass what \`${name}\` reads as its arguments (\`${name}(${this.#name(read)}${this.#kind(read) === "state" || this.#kind(read) === "derived" || this.#kind(read) === "model" ? ".value" : ""})\`), or compute it in the getter.`,
            },
          );
        }
      }
    }
  }

  /**
   * `watchEffect` reads only reactive values while it runs (UF2010): no setup `let` and no
   * template ref, itself or through a local function it calls. What it hands on to run later (a
   * timer's callback, `onCleanup`'s, marked `later`) is tracked by no target, and may read them:
   * the handle of the timer it starts, the element it measures in a frame.
   */
  effects(): void {
    for (const item of this.#component.setup) {
      if (item.kind !== "WatchEffect") continue;
      for (const ref of item.effect.body.refs) {
        if (ref.kind !== "Binding" || ref.later) continue;
        const kind = this.#kind(ref.binding);
        if (!ref.call && (kind === "localVar" || kind === "templateRef")) {
          const name = this.#name(ref.binding);
          this.#reporter.report(
            "UF2010",
            ref.span,
            kind === "localVar"
              ? `\`${name}\` is a setup \`let\`, which is not reactive, read in \`watchEffect\`: what reads it would never see it change.`
              : `\`${name}\` is a template ref, which is never a reactive dependency on every target, read in \`watchEffect\`.`,
            {
              help:
                kind === "localVar"
                  ? "Hold a value the effect reads in a `ref`; or keep a handle in a local and read it in what runs later: `const id = setTimeout(…); onCleanup(() => clearTimeout(id));`."
                  : 'Read the element from `watch(sources, …, { flush: "post" })`, `onMounted` or a handler.',
            },
          );
          continue;
        }
        if (!ref.call || kind !== "localFn") continue;
        const callee = this.#component.setup.find(
          (candidate) => candidate.kind === "Function" && candidate.binding === ref.binding,
        );
        if (callee?.kind !== "Function") continue;
        const summary = summarizeTracked(callee.function.body, this.#component);
        if (!(summary.readsLocalVar || summary.readsTemplateRef)) continue;
        this.#reporter.report(
          "UF2010",
          ref.span,
          `\`watchEffect\` calls \`${this.#name(ref.binding)}\`, which reads ${summary.readsLocalVar ? "a setup `let`, which is not reactive" : "a template ref, which is never a reactive dependency on every target"}: what the effect reads, the targets track.`,
          {
            help: 'Read only refs, `computed` values and props in `watchEffect`, and the rest in what it hands on to run later; read an element from `watch(sources, …, { flush: "post" })` or `onMounted`.',
          },
        );
      }
    }
  }

  /**
   * Watchers' callbacks (ADR-0048): an immediate one is safe on the server (UF2013), and one that
   * reads the DOM runs with `flush: "post"` (UF2018, whose likely fix adds it).
   */
  watchers(): void {
    for (const item of this.#component.setup) {
      if (item.kind !== "Watch") continue;
      const { callback } = item;
      if (item.immediate) {
        this.#serverSafe(callback);
      } else if (!item.post) {
        this.#domTiming(item, this.#input.setup.sources.get(item));
      }
    }
  }

  /** Reports what makes an immediate watcher's callback unsafe on the server (UF2013). */
  #serverSafe(callback: FunctionCode): void {
    const reporter = this.#reporter;
    const report = (at: Span, what: string) =>
      reporter.report(
        "UF2013",
        at,
        `An immediate watcher's callback ${what}: Vue runs its first callback during the setup, on the server too, where the server render must not depend on it, and must not fail.`,
        {
          help: "Derive the value with `computed`, or write it from `onMounted` and a watcher without `immediate`.",
        },
      );
    if (callback.async) {
      report({ start: callback.span.start, end: callback.span.start + 5 }, "is asynchronous");
    }
    for (const ref of callback.body.refs) {
      switch (ref.kind) {
        case "Write":
          if (this.#kind(ref.binding) === "state" || this.#kind(ref.binding) === "model") {
            report(ref.span, `writes \`${this.#name(ref.binding)}.value\``);
          }
          break;
        case "Binding": {
          const kind = this.#kind(ref.binding);
          if (!ref.call) {
            if (kind === "templateRef") report(ref.span, "reads a template ref");
            break;
          }
          const summary = this.#summaries.get(ref.binding);
          const problem = summary && this.#serverProblem(summary);
          if (problem) report(ref.span, `calls \`${this.#name(ref.binding)}\`, which ${problem}`);
          break;
        }
        case "Global":
          if (BROWSER_GLOBALS.has(ref.name) || SCHEDULING_GLOBALS.has(ref.name)) {
            report(
              ref.span,
              `reads \`${ref.name}\`, ${BROWSER_GLOBALS.has(ref.name) ? "one of the browser's globals" : "which schedules code past the request"}`,
            );
          }
          break;
        case "Api":
          report(ref.span, "calls `nextTick`");
          break;
        case "Emit":
        case "Event":
          break;
      }
    }
  }

  /** What a local function does that an immediate watcher's callback may not (UF2013). */
  #serverProblem(summary: CodeSummary): string | undefined {
    const state = [...summary.writes].find(
      (id) => this.#kind(id) === "state" || this.#kind(id) === "model",
    );
    if (state !== undefined) return `writes \`${this.#name(state)}.value\``;
    if (summary.readsTemplateRef) return "reads a template ref";
    const global = [...summary.clientGlobals].find(
      (name) => BROWSER_GLOBALS.has(name) || SCHEDULING_GLOBALS.has(name),
    );
    if (global !== undefined) return `reads \`${global}\``;
    if (summary.async) return "is asynchronous";
    if (summary.api) return "calls `nextTick`";
    return undefined;
  }

  /**
   * Reports a watcher that reads the DOM before it updates (UF2018), once, with its fix. What the
   * callback reads after `await nextTick()` reads the updated DOM on every target (ADR-0007), and
   * is not reported.
   */
  #domTiming(
    item: Extract<UfComponent["setup"][number], { kind: "Watch" }>,
    source: ItemSource | undefined,
  ): void {
    const { render } = this.#input;
    // `nextTick`'s callback is UF2025, which awaits it instead.
    const callbacks = new Set<object>(render.facts.tickCallbacks.flatMap((call) => call.arguments));
    const regions = source?.callback
      ? laterRegions(source.callback, {
          awaits: (node) => this.#isTick(node.argument),
          deferred: (node: FunctionNode) => callbacks.has(node),
        })
      : [];
    let found: { span: Span; what: string } | undefined;
    for (const ref of item.callback.body.refs) {
      if (isLater(ref.span.start, regions)) continue;
      if (ref.kind === "Binding" && !ref.call && this.#kind(ref.binding) === "templateRef") {
        found = { span: ref.span, what: `reads the template ref \`${this.#name(ref.binding)}\`` };
      } else if (ref.kind === "Global" && this.#readsDom(ref)) {
        found = { span: ref.span, what: `reads \`${ref.name}\`` };
      } else if (ref.kind === "Binding" && ref.call) {
        const summary = this.#summaries.get(ref.binding);
        const dom = summary && this.#domGlobal(ref.binding, summary);
        if (summary?.readsTemplateRef || dom !== undefined) {
          found = {
            span: ref.span,
            what: `calls \`${this.#name(ref.binding)}\`, which reads ${summary?.readsTemplateRef ? "a template ref" : `\`${dom}\``}`,
          };
        }
      }
      if (found) break;
    }
    if (!found) return;
    const call = source?.call;
    const handler = call?.arguments[1];
    const fix: Fix | undefined =
      call && handler && call.arguments.length === 2
        ? {
            title: 'Add `{ flush: "post" }`',
            confidence: "likely",
            edits: [
              { span: { start: handler.end, end: handler.end }, text: ', { flush: "post" }' },
            ],
          }
        : undefined;
    this.#reporter.report(
      "UF2018",
      found.span,
      `A watcher's callback ${found.what}, and runs before the DOM updates: Vue and Svelte would read the DOM as it was, React and Solid as it is now.`,
      {
        help: 'Run it after the DOM updates: `watch(source, callback, { flush: "post" })`.',
        ...(fix ? { fixes: [fix] } : {}),
      },
    );
  }

  /**
   * Whether a global's read sees the DOM a render changes (`readsDom`): `document`, `window`'s
   * layout and scroll, `getComputedStyle`; not storage, `history` or `document.title`.
   */
  #readsDom(ref: Extract<CodeReference, { kind: "Global" }>): boolean {
    const { source } = this.#input.render;
    return readsDom(ref.name, source.slice(ref.span.end, ref.span.end + 80));
  }

  /** The first global a local function reads that sees the rendered DOM, itself or deeper. */
  #domGlobal(id: BindingId, summary: FunctionSummary): string | undefined {
    for (const item of this.#component.setup) {
      if (item.kind !== "Function" || (item.binding !== id && !summary.reaches.has(item.binding))) {
        continue;
      }
      for (const ref of item.function.body.refs) {
        if (ref.kind === "Global" && this.#readsDom(ref)) return ref.name;
      }
    }
    return undefined;
  }

  /** Whether an expression calls `nextTick` (`nextTick()`, as UF2025 has it written). */
  #isTick(node: AST.Expression): boolean {
    if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return false;
    const { render } = this.#input;
    const resolution = render.scopes.resolve(node.callee);
    return (
      resolution.kind === "import" &&
      render.setup.authoring.get(resolution.declaration) === ("nextTick" satisfies AuthoringApi)
    );
  }

  /**
   * Code the setup runs reads only what is declared before its item (UF2023): initial values,
   * getters, watchers' sources and an immediate watcher's first callback, and what the local
   * functions they call read, call and emit. A `function` declaration is hoisted, so a call of one
   * is judged by what it reads and reaches alone; an arrow `const` is not until it is declared.
   */
  setupOrder(): void {
    const { emits } = this.#component;
    const hoisted = new Set<BindingId>();
    for (const item of this.#component.setup) {
      if (item.kind === "Function" && item.form === "declaration") hoisted.add(item.binding);
    }
    for (const item of this.#component.setup) {
      const start = item.span.start;
      const codes: Code[] = [];
      switch (item.kind) {
        case "State":
        case "Variable":
          if (item.initial) codes.push(item.initial);
          break;
        case "Const":
          codes.push(item.value);
          break;
        case "Derived":
          codes.push(item.getter.body);
          break;
        case "Watch":
          for (const source of item.sources) {
            if (source.kind === "Getter") codes.push(source.getter.body);
            else this.#declaredBefore(source.binding, source.span, start, undefined);
          }
          if (item.immediate) codes.push(item.callback.body);
          break;
        // What a key is provided, or an injection falls back to, is read as the setup runs.
        case "Provide":
          codes.push(item.value);
          break;
        case "Inject":
          if (item.fallback) codes.push(item.fallback);
          break;
        default:
          break;
      }
      for (const code of codes) {
        for (const ref of code.refs) {
          if (ref.kind === "Binding") {
            if (
              !hoisted.has(ref.binding) &&
              this.#declaredBefore(ref.binding, ref.span, start, undefined)
            ) {
              continue;
            }
            const summary = ref.call ? this.#summaries.get(ref.binding) : undefined;
            if (!summary) continue;
            const late = [...summary.reads, ...summary.reaches].find(
              (id) => !hoisted.has(id) && this.#isAfter(id, start),
            );
            if (late !== undefined) {
              this.#declaredBefore(late, ref.span, start, this.#name(ref.binding));
            } else if (summary.emits.size && emits && this.#isAfter(emits.binding, start)) {
              this.#declaredBefore(emits.binding, ref.span, start, this.#name(ref.binding));
            }
          } else if (ref.kind === "Emit" && emits) {
            this.#declaredBefore(emits.binding, ref.span, start, undefined);
          }
        }
      }
    }
  }

  /** Whether a binding the setup declares comes at or after `start` (a prop never does). */
  #isAfter(id: BindingId, start: number): boolean {
    const binding = this.#bindings.get(id);
    return Boolean(binding && binding.kind !== "prop" && binding.span.start >= start);
  }

  /** Reports a read of a binding declared at or after `start` (UF2023); returns whether it did. */
  #declaredBefore(id: BindingId, at: Span, start: number, through: string | undefined): boolean {
    if (!this.#isAfter(id, start)) return false;
    const name = this.#name(id);
    this.#reporter.report(
      "UF2023",
      at,
      `${through ? `\`${through}\` reads \`${name}\`, which is` : `\`${name}\` is`} declared after the code that reads it here, which the setup runs where it is: React's and Solid's outputs evaluate it in source order, before \`${name}\` exists.`,
      { help: `Declare \`${name}\` before what reads it.` },
    );
    return true;
  }

  /**
   * Calls of local functions that touch state (UF2024): only directly in a function's body, in
   * an `async` arrow function or in a callback that runs later; and no local function calls
   * itself, directly or through others (Qwik's QRLs). A function that returns a promise (`async`,
   * or annotated `Promise<…>`) may be called or passed anywhere: a QRL's call gives a promise of
   * the same value, so `await Promise.all(items.map(load))` collects the same results.
   */
  localCalls(): void {
    const reported = new Set<string>();
    const promising = new Set<BindingId>();
    for (const item of this.#component.setup) {
      if (item.kind !== "Function") continue;
      const { async, returnType } = item.function;
      if (async || /^Promise\s*</.test(returnType?.code.trim() ?? "")) promising.add(item.binding);
    }
    const functions = functionNodes(this.#input.render.component);
    for (const call of this.#input.render.facts.nestedCalls) {
      const key = `${call.span.start}`;
      if (promising.has(call.binding)) continue;
      if (reported.has(key) || !this.#touchesState(call.binding, new Set())) continue;
      const name = this.#name(call.binding);
      const passed =
        this.#input.render.source.slice(call.span.start, call.span.end) === name &&
        !this.#isCalled(call.span);
      // A call in a function the code hands on to run later, by name (`const tick = () => …;
      // setInterval(tick, 1000)`) as written in place, is that function's own (ADR-0048).
      const holder = innermost(functions, call.span);
      if (!passed && holder && this.#deferred.has(holder)) continue;
      reported.add(key);
      const to = call.passedTo === undefined ? "a call" : `\`${call.passedTo}\``;
      // A function passed to a call that is neither an array method nor known to run it later
      // or never: the call may run it at once, which is all the rule can say of it.
      const message = !passed
        ? "is called in a function that runs at once, whose result counts (an array method's callback, a comparator): Qwik's output calls such a local function as a QRL, which it awaits, and the callback cannot."
        : call.arrayMethod
          ? `is passed to ${to}, an array method that calls it at once and uses its result: Qwik's output calls such a local function as a QRL, which it awaits, and the array method cannot.`
          : `is passed to ${to}, which may call it at once: Qwik's output calls such a local function as a QRL, which it awaits, and a call that runs it at once cannot. Only the timers, \`queueMicrotask\`, \`requestAnimationFrame\`, \`requestIdleCallback\`, a promise's \`then\`, \`catch\` and \`finally\`, \`addEventListener\`, an observer's constructor and \`onCleanup\` are known to call a function later, and \`removeEventListener\` and the functions that clear a timer or cancel a frame never call it.`;
      this.#reporter.report(
        "UF2024",
        call.span,
        `\`${name}\` touches the component's state, and ${message}`,
        {
          help:
            passed && !call.arrayMethod
              ? "Pass it only to a call that runs it later or never, or call it directly in the body of the handler or the function."
              : "Call it directly in the body of the handler or the function, or compute the new state at once and write it.",
        },
      );
    }
    for (const item of this.#component.setup) {
      if (item.kind !== "Function") continue;
      const summary = this.#summaries.get(item.binding);
      if (!summary?.reaches.has(item.binding)) continue;
      for (const ref of item.function.body.refs) {
        if (ref.kind !== "Binding" || !ref.call) continue;
        const callee = this.#summaries.get(ref.binding);
        if (ref.binding !== item.binding && !callee?.reaches.has(item.binding)) continue;
        this.#reporter.report(
          "UF2024",
          ref.span,
          `\`${this.#name(item.binding)}\` calls ${ref.binding === item.binding ? "itself" : `itself through \`${this.#name(ref.binding)}\``}: Qwik's output makes a local function a QRL, which cannot call itself.`,
          { help: "Write the repetition as a loop." },
        );
      }
    }
  }

  /** Whether a span is the callee of a call (`name(`). */
  #isCalled(at: Span): boolean {
    const { source } = this.#input.render;
    return /^\s*(?:\?\.)?\(/.test(source.slice(at.end, at.end + 8));
  }

  /**
   * Whether a local function touches the component's state (UF2024): writes, emits, reads a
   * binding other than a static constant, reads a template ref or calls `nextTick`.
   */
  #touchesState(id: BindingId, seen: Set<BindingId>): boolean {
    const summary = this.#summaries.get(id);
    if (!summary || seen.has(id)) return false;
    seen.add(id);
    if (summary.writes.size || summary.emits.size || summary.api || summary.readsTemplateRef) {
      return true;
    }
    return [...summary.reads].some((read) =>
      this.#kind(read) === "localFn" ? this.#touchesState(read, seen) : !this.#static.has(read),
    );
  }

  /**
   * `watchEffect` reads its reactive values unconditionally (UF2015), and so does a watcher's
   * getter, or a `computed` a watcher's source reaches, whose value may be an object or an array.
   */
  conditionalReads(): void {
    const reads = new ConditionalReads(this.#input, this.#component, this.#bindings);
    const derived = new Map<BindingId, FunctionCode>();
    for (const item of this.#component.setup) {
      if (item.kind === "Derived") derived.set(item.binding, item.getter);
    }
    const reached = new Set<BindingId>();
    const reach = (id: BindingId) => {
      if (reached.has(id) || !derived.has(id)) return;
      reached.add(id);
      for (const read of summarizeCode(derived.get(id)!.body, this.#component).reads) reach(read);
    };
    for (const item of this.#component.setup) {
      const source = this.#input.setup.sources.get(item);
      if (item.kind === "WatchEffect" && source) {
        reads.check(item.effect, source.statement, "`watchEffect`");
      } else if (item.kind === "Watch" && source) {
        for (const watched of item.sources) {
          if (watched.kind === "Ref") {
            reach(watched.binding);
            continue;
          }
          for (const read of summarizeCode(watched.getter.body, this.#component).reads) reach(read);
          if (objectish(this.#input.render.facts.getterKinds.get(watched.getter))) {
            reads.check(
              watched.getter,
              source.statement,
              "A watcher's getter whose value may be an object or an array",
            );
          }
        }
      }
    }
    for (const item of this.#component.setup) {
      if (item.kind !== "Derived" || !reached.has(item.binding)) continue;
      if (!objectish(this.#setup.get(item.binding)?.kinds)) continue;
      const source = this.#input.setup.sources.get(item);
      if (source) {
        reads.check(
          item.getter,
          source.statement,
          `\`${this.#name(item.binding)}\`'s getter, which a watcher's source reaches and whose value may be an object or an array,`,
        );
      }
    }
  }

  /**
   * A setup `const` that reads a prop, a ref or a `computed` keeps its first value (UF2007, a
   * warning), with the likely fix that makes it a `computed`.
   */
  setupOnce(): void {
    const once = new Set<BindingId>();
    const reasons = new Map<BindingId, string>();
    for (const item of this.#component.setup) {
      if (item.kind !== "Const") continue;
      const summary = summarizeCode(item.value, this.#component);
      const read = [...summary.reads].find(
        (id) => this.#kind(id) === "prop" || this.#refValue(id) || once.has(id),
      );
      if (read === undefined) continue;
      once.add(item.binding);
      const kind = this.#kind(read);
      const name = this.#name(read);
      reasons.set(
        item.binding,
        kind === "prop"
          ? `the prop \`${name}\``
          : kind === "state" || kind === "model" || kind === "context"
            ? `the ref \`${name}\`'s value`
            : kind === "derived"
              ? `the computed value \`${name}\``
              : `\`${name}\`, which keeps its own first value,`,
      );
    }
    // Where `computed` must be imported, one fix imports it: with several, none is offered, so
    // that each fix stays whole on its own.
    const imported = [...this.#input.render.setup.authoring.values()].includes("computed");
    const fixable = !this.#input.failed && (imported || once.size === 1);
    for (const item of this.#component.setup) {
      if (item.kind !== "Const" || !once.has(item.binding)) continue;
      const name = this.#name(item.binding);
      // A getter calls only functions over static constants (UF2014): the fix waits otherwise.
      const getter = [...summarizeCode(item.value, this.#component).reaches].every((id) =>
        [...(this.#summaries.get(id)?.reads ?? [])].every((read) => this.#static.has(read)),
      );
      const fix = fixable && getter ? this.#computedFix(item) : undefined;
      this.#reporter.report(
        "UF2007",
        this.#bindings.get(item.binding)!.span,
        `\`${name}\` reads ${reasons.get(item.binding)!} when the setup runs, once, and keeps that value when it changes later.`,
        {
          help: `Make it a \`computed\` to follow it (\`const ${name} = computed(() => …)\`, read as \`${name}.value\`), or keep the snapshot on purpose.`,
          ...(fix ? { fixes: [fix] } : {}),
        },
      );
    }
  }

  /** UF2007's fix: the constant as a `computed`, every read of it as `.value`. */
  #computedFix(item: Extract<UfComponent["setup"][number], { kind: "Const" }>): Fix | undefined {
    const { source, setup } = this.#input.render;
    const name = this.#name(item.binding);
    // The local name `computed` is imported as, or where to import it.
    let callee: string | undefined;
    for (const [declaration, api] of setup.authoring) {
      if (api === ("computed" satisfies AuthoringApi))
        callee = (declaration as { name: string }).name;
    }
    const edits: Fix["edits"] = [];
    if (callee === undefined) {
      if (/(?<![\w$])computed(?![\w$])/.test(source)) return undefined;
      const declaration = this.#input.program.body.find(
        (statement): statement is AST.ImportDeclaration =>
          statement.type === "ImportDeclaration" &&
          statement.source.value === "unframework" &&
          statement.importKind !== "type" &&
          statement.specifiers.some((specifier) => specifier.type === "ImportSpecifier"),
      );
      const last = declaration?.specifiers.at(-1);
      if (declaration && last) {
        edits.push({ span: { start: last.end, end: last.end }, text: ", computed" });
      } else {
        const first = this.#input.program.body[0];
        const at = first?.start ?? 0;
        edits.push({
          span: { start: at, end: at },
          text: 'import { computed } from "unframework";\n',
        });
      }
      callee = "computed";
    }
    const value = item.value;
    const object = /^\s*\{/.test(value.code);
    if (item.type) {
      const binding = this.#bindings.get(item.binding)!;
      edits.push({ span: { start: binding.span.end, end: item.type.span.end }, text: "" });
    }
    const typeArgument = item.type ? `<${item.type.code}>` : "";
    edits.push(
      {
        span: { start: value.span.start, end: value.span.start },
        text: `${callee}${typeArgument}(() => ${object ? "(" : ""}`,
      },
      { span: { start: value.span.end, end: value.span.end }, text: object ? "))" : ")" },
    );
    const reads = [
      ...expressionsOf(this.#component).flatMap(({ expression }) => expression.refs),
      ...codeOf(this.#component).flatMap(({ code }) => code.refs),
    ];
    for (const ref of reads) {
      if (ref.kind !== "Binding" || ref.binding !== item.binding) continue;
      edits.push({
        span: ref.span,
        text: ref.shorthand ? `${name}: ${name}.value` : `${name}.value`,
      });
    }
    return { title: `Make \`${name}\` a \`computed\``, confidence: "likely", edits };
  }

  /**
   * A copied annotation names an authoring type (UF2019): the compiler erases its import, so no
   * output declares it. The likely fix removes the annotation where TypeScript infers the type:
   * a callback's parameter, and a `const` with an initial value.
   */
  erasedTypes(): void {
    const { render, program } = this.#input;
    const erased = new Set<object>();
    for (const statement of program.body) {
      if (statement.type !== "ImportDeclaration" || statement.source.value !== "unframework") {
        continue;
      }
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;
        const imported =
          specifier.imported.type === "Identifier"
            ? specifier.imported.name
            : specifier.imported.value;
        if (AUTHORING_TYPES.has(imported)) erased.add(specifier.local);
      }
    }
    if (!erased.size) return;
    const slots = render.slots?.type.span;
    const found: { reference: AST.TSTypeReference; annotation: AST.Node | undefined }[] = [];
    const visit = (node: unknown, annotation: AST.Node | undefined): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item, annotation);
        return;
      }
      const typed = node as AST.Node;
      if (typeof typed.type !== "string") return;
      // What a slot returns is the slot's content, which no output copies: each writes its own
      // type for it (ADR-0054). Its props are copied.
      if (
        (typed.type === "TSMethodSignature" || typed.type === "TSFunctionType") &&
        slots &&
        typed.start >= slots.start &&
        typed.end <= slots.end
      ) {
        visit(typed.params, annotation);
        return;
      }
      if (typed.type === "TSTypeReference" && typed.typeName.type === "Identifier") {
        const resolution = render.scopes.resolve(
          typed.typeName as unknown as AST.IdentifierReference,
        );
        if (resolution.kind === "import" && erased.has(resolution.declaration)) {
          found.push({ reference: typed, annotation });
        }
      }
      for (const key of visitorKeys[typed.type] ?? []) {
        const child = (typed as unknown as Record<string, unknown>)[key];
        visit(
          child,
          key === "typeAnnotation" && child && (child as AST.Node).type === "TSTypeAnnotation"
            ? (typed as AST.Node)
            : annotation,
        );
      }
    };
    visit(render.component, undefined);
    // The module's types the component reaches are copied too; each is reported once, whatever
    // component reaches it.
    const reported = REPORTED_TYPES.get(program) ?? new Set<number>();
    REPORTED_TYPES.set(program, reported);
    for (const name of closure(render.component, render.types)) {
      const declaration = render.types.declaration(name);
      if (!declaration || reported.has(declaration.node.start)) continue;
      reported.add(declaration.node.start);
      visit(declaration.node, undefined);
    }
    const fixed = new Set<object>();
    for (const { reference, annotation } of found) {
      const name = (reference.typeName as AST.IdentifierReference).name;
      const removal = annotation && !fixed.has(annotation) ? this.#inferred(annotation) : undefined;
      if (removal) fixed.add(annotation!);
      this.#reporter.report(
        "UF2019",
        reference,
        `\`${name}\` is an authoring type, which the compiler erases with its import from "unframework": an output that copied this annotation would name a type nothing declares.`,
        {
          help: "Leave the annotation out where TypeScript infers the type, or write the type itself.",
          ...(removal
            ? {
                fixes: [
                  {
                    title: "Remove the annotation",
                    confidence: "likely" as const,
                    edits: [{ span: removal, text: "" }],
                  },
                ],
              }
            : {}),
        },
      );
    }
  }

  /**
   * Where an annotation can go because TypeScript infers the type there (UF2019's fix): the
   * parameter of an arrow function passed to a call (a watcher's callback), and a `const`'s with
   * an initial value. The span runs from the end of the name to the end of the annotation.
   */
  #inferred(holder: AST.Node): Span | undefined {
    const { render } = this.#input;
    const annotation = (holder as { typeAnnotation?: AST.TSTypeAnnotation }).typeAnnotation;
    if (!annotation || holder.type !== "Identifier") return undefined;
    const parents = ancestors(holder, render.component);
    const parent = parents.at(-2);
    const grand = parents.at(-3);
    const contextual =
      (parent?.type === "ArrowFunctionExpression" &&
        parent.params.includes(holder as AST.ParamPattern) &&
        grand?.type === "CallExpression" &&
        grand.arguments.includes(parent)) ||
      (parent?.type === "VariableDeclarator" &&
        parent.id === holder &&
        parent.init !== null &&
        grand?.type === "VariableDeclaration" &&
        grand.kind === "const");
    if (!contextual || (holder as AST.BindingIdentifier).optional) return undefined;
    const name = (holder as AST.BindingIdentifier).name;
    return { start: holder.start + name.length, end: annotation.end };
  }
}

/**
 * Where a function's reactive reads lie (UF2015): the straight-line start of its body, before
 * the first statement that branches, loops, returns, throws or awaits (that `if`'s test, that
 * `switch`'s, `return`'s or `throw`'s value and that loop's head included), into plain blocks
 * and the start of a `try` block up to its first call (whose callee and arguments it reads
 * first), outside the right side of `&&`, `||`, `??` and `?:`, after no `?.`, and outside the
 * functions in it.
 */
class ConditionalReads {
  readonly #input: RulesInput;
  readonly #component: UfComponent;
  readonly #bindings: ReadonlyMap<BindingId, Binding>;
  /** Whether each local function reads a reactive value under a condition, itself or deeper. */
  readonly #conditional = new Map<BindingId, boolean>();

  constructor(
    input: RulesInput,
    component: UfComponent,
    bindings: ReadonlyMap<BindingId, Binding>,
  ) {
    this.#input = input;
    this.#component = component;
    this.#bindings = bindings;
  }

  /** Reports the reactive reads of a function that are not unconditional (UF2015). */
  check(fn: FunctionCode, statement: AST.Node, what: string): void {
    const node = functionNode(fn, statement);
    if (!node) return;
    for (const problem of this.#problems(fn.body.refs, node)) {
      this.#input.render.reporter.report(
        "UF2015",
        problem.span,
        `${what} reads ${problem.what} ${problem.why}: React's effect and Qwik's \`track\` list a function's reactive reads statically, so each lies in the straight-line start of its body.`,
        {
          help: "Read every value first, into locals (`const enabled = live.value;`), or watch explicit sources with `watch`.",
        },
      );
    }
  }

  /** The reads of a function's references that are not unconditional, and why. */
  #problems(
    refs: readonly CodeReference[],
    node: AST.ArrowFunctionExpression | AST.Function,
  ): { span: Span; what: string; why: string }[] {
    const regions = conditionalRegions(node);
    const problems: { span: Span; what: string; why: string }[] = [];
    for (const ref of refs) {
      // What a function the code hands on reads, it reads later, which no target tracks.
      if (ref.kind !== "Binding" || ref.later) continue;
      const name = this.#bindings.get(ref.binding)?.name ?? ref.binding;
      const region = regions.find(
        (item) => ref.span.start >= item.span.start && ref.span.start < item.span.end,
      );
      if (ref.call) {
        if (this.#bindings.get(ref.binding)?.kind !== "localFn") continue;
        if (this.#readsConditionally(ref.binding)) {
          problems.push({
            span: ref.span,
            what: `through \`${name}\``,
            why: "values that it reads only under a condition",
          });
        } else if (region && this.#readsReactively(ref.binding)) {
          problems.push({ span: ref.span, what: `through \`${name}\`,`, why: region.why });
        }
        continue;
      }
      if (!region || !this.#reactive(ref.binding)) continue;
      problems.push({
        span: ref.span,
        what: `\`${name}${refValue(ref.binding, this.#bindings, this.#input) ? ".value" : ""}\``,
        why: region.why,
      });
    }
    return problems;
  }

  #reactive(id: BindingId): boolean {
    return this.#bindings.get(id)?.kind === "prop" || refValue(id, this.#bindings, this.#input);
  }

  /** Whether a local function reads a reactive value while it runs, itself or through a call. */
  #readsReactively(id: BindingId): boolean {
    const item = this.#input.setup.items.find(
      (candidate) => candidate.kind === "Function" && candidate.binding === id,
    );
    if (item?.kind !== "Function") return false;
    const { reads } = summarizeTracked(item.function.body, this.#component);
    return [...reads].some((read) => this.#reactive(read));
  }

  /** Whether a local function reads a reactive value under a condition, itself or through a call. */
  #readsConditionally(id: BindingId): boolean {
    const known = this.#conditional.get(id);
    if (known !== undefined) return known;
    this.#conditional.set(id, false);
    const item = this.#input.setup.items.find(
      (candidate) => candidate.kind === "Function" && candidate.binding === id,
    );
    const binding = [...this.#input.render.setup.bindings.values()].find(
      (other) => other.id === id,
    );
    const node = binding?.function;
    const result =
      item?.kind === "Function" && node
        ? this.#problems(item.function.body.refs, node).length > 0
        : false;
    this.#conditional.set(id, result);
    return result;
  }
}

/**
 * Whether a binding is a ref whose value code reads as `x.value`, which stays reactive: state, a
 * computed value, a model, or an injected ref (ADR-0054).
 */
function refValue(
  id: BindingId,
  bindings: ReadonlyMap<BindingId, Binding>,
  input: RulesInput,
): boolean {
  const kind = bindings.get(id)?.kind;
  if (kind === "state" || kind === "derived" || kind === "model") return true;
  return (
    kind === "context" &&
    [...input.render.setup.bindings.values()].some((each) => each.id === id && each.ref === true)
  );
}

/** Whether a value may be an object or an array, whose identity React compares (UF2015). */
function objectish(kinds: Kinds | undefined): boolean {
  return !kinds || has(kinds, "object") || has(kinds, "array") || has(kinds, "unknown");
}

/** The parts of a function's body that run only under a condition, with why. */
function conditionalRegions(
  fn: AST.ArrowFunctionExpression | AST.Function,
): { span: Span; why: string }[] {
  const regions: { span: Span; why: string }[] = [];
  const body = fn.body;
  if (!body) return regions;
  const scan = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) scan(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    switch (typed.type) {
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        regions.push({ span: typed, why: "inside a function in it, which runs when it is called" });
        return;
      case "LogicalExpression":
        scan(typed.left);
        regions.push({ span: typed.right, why: `on the right side of \`${typed.operator}\`` });
        return;
      case "AssignmentExpression":
        scan(typed.left);
        if (typed.operator === "||=" || typed.operator === "&&=" || typed.operator === "??=") {
          regions.push({ span: typed.right, why: `on the right side of \`${typed.operator}\`` });
        } else {
          scan(typed.right);
        }
        return;
      case "AssignmentPattern":
        scan(typed.left);
        regions.push({
          span: typed.right,
          why: "in a default, which applies only when the value is `undefined`",
        });
        return;
      case "ChainExpression": {
        // `?.` short-circuits the whole chain: everything after the first optional link, the
        // later links' keys and arguments included, runs only when it does not.
        const first = firstOptionalLink(typed.expression);
        if (!first) break;
        const base = first.type === "MemberExpression" ? first.object : first.callee;
        scan(base);
        regions.push({ span: { start: base.end, end: typed.end }, why: "after `?.`" });
        return;
      }
      case "ConditionalExpression":
        scan(typed.test);
        regions.push({
          span: { start: typed.consequent.start, end: typed.end },
          why: "in a branch of `?:`",
        });
        return;
      case "MemberExpression":
        scan(typed.object);
        if (typed.optional) {
          regions.push({ span: { start: typed.object.end, end: typed.end }, why: "after `?.`" });
        } else if (typed.computed) {
          scan(typed.property);
        }
        return;
      case "CallExpression":
        scan(typed.callee);
        if (typed.optional) {
          regions.push({ span: { start: typed.callee.end, end: typed.end }, why: "after `?.`" });
        } else {
          scan(typed.arguments);
        }
        return;
      case "AwaitExpression":
        scan(typed.argument);
        regions.push({ span: { start: typed.end, end: body.end }, why: "after an `await`" });
        return;
      default:
        break;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      scan((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  if (body.type !== "BlockStatement") {
    scan(body);
    return regions;
  }
  const rest = (start: number, why: string) =>
    regions.push({ span: { start, end: body.end }, why });
  /**
   * Walks a straight-line run of statements: returns whether one ended it, after pushing the
   * region from where it ends to the end of the body. A plain block and a `try` block continue
   * the run; a `catch`, a `finally` and a loop's body stay conditional. In a `try` block
   * (`guarded`), the run ends where its first call (or `new`, or `await`) has run, which may
   * throw into the `catch`: what that call reads runs on every run, what follows it only where
   * it returns.
   */
  const straight = (statements: readonly AST.Statement[], guarded: boolean): boolean => {
    for (const statement of statements) {
      switch (statement.type) {
        case "ExpressionStatement":
        case "VariableDeclaration": {
          scan(statement);
          const thrown = guarded ? firstThrowPoint(statement) : undefined;
          if (thrown === undefined) continue;
          rest(thrown, "in a `try` block after a call that may throw");
          return true;
        }
        case "EmptyStatement":
          continue;
        case "BlockStatement":
          if (straight(statement.body, guarded)) return true;
          continue;
        case "TryStatement":
          // Pushed first, so that what follows the block reads as its own.
          rest(statement.block.end, "in a `catch` or a `finally`, or after a `try`");
          straight(statement.block.body, true);
          return true;
        // A loop evaluates its head on every run that reaches it: a `for…of`'s or a `for…in`'s
        // iterable, a `for`'s init and first test, a `while`'s first test. Its body may never run.
        case "ForOfStatement":
        case "ForInStatement":
          regions.push({
            span: { start: statement.start, end: statement.right.start },
            why: "in a loop's variable, which takes each item",
          });
          scan(statement.right);
          rest(statement.right.end, "in or after a loop");
          return true;
        case "ForStatement": {
          if (statement.init) scan(statement.init);
          if (statement.test) scan(statement.test);
          const head = statement.test ?? statement.init;
          rest(head ? head.end : statement.start, "in or after a loop");
          return true;
        }
        case "WhileStatement":
          scan(statement.test);
          rest(statement.test.end, "in or after a loop");
          return true;
        default: {
          // The statement that ends the straight-line start still evaluates its head on every run
          // that reaches it: an `if`'s test, and the value a `switch`, a `return` or a `throw`
          // takes. Only what follows the head may be skipped (a `return`'s and a `throw`'s never
          // runs).
          const head =
            statement.type === "IfStatement"
              ? statement.test
              : statement.type === "SwitchStatement"
                ? statement.discriminant
                : statement.type === "ReturnStatement" || statement.type === "ThrowStatement"
                  ? statement.argument
                  : null;
          if (head) scan(head);
          const why =
            statement.type === "IfStatement"
              ? "in or after an `if`"
              : statement.type === "SwitchStatement"
                ? "in or after a `switch`"
                : statement.type === "ReturnStatement" || statement.type === "ThrowStatement"
                  ? `after a \`${statement.type === "ReturnStatement" ? "return" : "throw"}\``
                  : "in or after a loop";
          rest(head ? head.end : statement.start, why);
          return true;
        }
      }
    }
    return false;
  };
  straight(body.body, false);
  return regions;
}

/**
 * Where a statement may first throw, in the order it runs: the end of the call, `new` or
 * `await` that completes first (an argument's call before its callee's), outside the functions
 * in it; `undefined` where it calls nothing.
 */
function firstThrowPoint(statement: AST.Statement): number | undefined {
  let first: number | undefined;
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration"
    ) {
      return;
    }
    if (
      typed.type === "CallExpression" ||
      typed.type === "NewExpression" ||
      typed.type === "AwaitExpression" ||
      typed.type === "TaggedTemplateExpression"
    ) {
      first = first === undefined ? typed.end : Math.min(first, typed.end);
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(statement);
  return first;
}

/**
 * The first link of an optional chain that is optional, in evaluation order: the innermost
 * member or call marked `?.` along the chain's objects and callees.
 */
function firstOptionalLink(
  node: AST.Expression,
): AST.MemberExpression | AST.CallExpression | undefined {
  let first: AST.MemberExpression | AST.CallExpression | undefined;
  let cursor: AST.Expression | AST.Super = node;
  for (;;) {
    if (cursor.type === "TSNonNullExpression") {
      cursor = cursor.expression;
    } else if (cursor.type === "MemberExpression" || cursor.type === "CallExpression") {
      if (cursor.optional) first = cursor;
      cursor = cursor.type === "MemberExpression" ? cursor.object : cursor.callee;
    } else {
      return first;
    }
  }
}

/** The function node a lowered function was lowered from, inside the statement that holds it. */
function functionNode(
  fn: FunctionCode,
  statement: AST.Node,
): AST.ArrowFunctionExpression | AST.Function | undefined {
  let found: AST.ArrowFunctionExpression | AST.Function | undefined;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      (typed.type === "ArrowFunctionExpression" || typed.type === "FunctionExpression") &&
      typed.start === fn.span.start &&
      typed.end === fn.span.end
    ) {
      found = typed;
      return;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(statement);
  return found;
}

/** The functions written in a component's body, outermost first. */
function functionNodes(root: FunctionNode): FunctionNode[] {
  const found: FunctionNode[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const node = value as AST.Node;
    if (typeof node.type !== "string") return;
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration"
    ) {
      found.push(node);
    }
    for (const key of visitorKeys[node.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(root.body);
  return found;
}

/** The innermost of the functions that holds a span, if any. */
function innermost(functions: readonly FunctionNode[], at: Span): FunctionNode | undefined {
  let found: FunctionNode | undefined;
  for (const fn of functions) {
    if (fn.start <= at.start && at.end <= fn.end) found = fn;
  }
  return found;
}

/** The nodes from `root` down to `target`, both included. */
function ancestors(target: AST.Node, root: AST.Node): AST.Node[] {
  const path: AST.Node[] = [];
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (!value || typeof value !== "object" || typeof (value as AST.Node).type !== "string") {
      return false;
    }
    const node = value as AST.Node;
    if (node.start > target.start || node.end < target.end) return false;
    path.push(node);
    if (node === target) return true;
    for (const key of visitorKeys[node.type] ?? []) {
      if (visit((node as unknown as Record<string, unknown>)[key])) return true;
    }
    path.pop();
    return false;
  };
  visit(root);
  return path;
}
