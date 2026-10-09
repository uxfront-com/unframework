// Rules over client code that the targets run in different orders (ADR-0047 to ADR-0049): the
// one form of `nextTick` (UF2025), code that runs while a component is torn down (UF2026), a
// `watchEffect` that writes what it reads (UF2027), and `preventDefault()` in a passive listener
// (UF3034). Each is judged once the setup and the render tree are lowered, with every local
// function's summary, and reported at the exact place.

import type { Fix, TextEdit } from "@unframework/diagnostics";
import { codeOf, expressionsOf, summarizeCode, walk } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  CodeReference,
  EventAttribute,
  FunctionCode,
  FunctionSummary,
  Span,
  UfComponent,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import { arrowBodySpan, patternNames } from "./code.ts";
import { setupBindingOf } from "./render.ts";
import type { RenderContext } from "./render.ts";
import type { RulesInput } from "./rules.ts";
import { isLater, laterRegions } from "./suspension.ts";
import type { FunctionNode } from "./suspension.ts";

/** What the client rules read of a component. */
export interface ClientRulesContext {
  readonly input: RulesInput;
  /** The component as the rules read it: its setup and its render tree. */
  readonly component: UfComponent;
  readonly summaries: ReadonlyMap<BindingId, FunctionSummary>;
  /** The functions client code hands on to run later (`deferredFunctions`, ADR-0048). */
  readonly deferred: ReadonlySet<FunctionNode>;
}

/** Judges a lowered component's client code by UF2025, UF2026, UF2027 and UF3034. */
export function checkClientRules(context: ClientRulesContext): void {
  const bindings = new Map(context.component.bindings.map((binding) => [binding.id, binding]));
  nextTickCallbacks(context);
  teardown(context, bindings);
  selfTriggeringEffects(context, bindings);
  passivePrevention(context, bindings);
}

/**
 * `nextTick(callback)` (UF2025): `await nextTick()` is its one form (ADR-0007), and React's,
 * Angular's and Qwik's `nextTick` takes no callback. The safe fix awaits it where the call is the
 * last statement of a function that can become `async` and change nothing for a caller.
 */
function nextTickCallbacks(context: ClientRulesContext): void {
  const { render } = context.input;
  for (const call of render.facts.tickCallbacks) {
    const name = render.source.slice(call.callee.start, call.callee.end);
    const fix = awaitFix(call, context);
    render.reporter.report(
      "UF2025",
      call,
      `\`${name}\` is given a callback: \`await ${name}()\` is its one form, and React's, Angular's and Qwik's \`nextTick\` take no callback, which would never run.`,
      {
        help: `Make the function \`async\`, \`await ${name}()\`, and write the callback's code after it.`,
        ...(fix ? { fixes: [fix] } : {}),
      },
    );
  }
}

/**
 * UF2025's safe fix: the function made `async`, and the call replaced by `await nextTick();` and
 * the callback's statements. Only where the call is the last statement of a handler, an
 * `onMounted` callback, a watcher's callback that is not immediate, or a local function nothing
 * calls; where the callback is an arrow without parameters whose names the function does not
 * use; and where no comment or event control would move.
 */
function awaitFix(call: AST.CallExpression, context: ClientRulesContext): Fix | undefined {
  const { render } = context.input;
  const { source } = render;
  const path = ancestors(call, render.component);
  const statement = path.at(-2);
  const block = path.at(-3);
  const fn = path.at(-4);
  if (statement?.type !== "ExpressionStatement" || statement.expression !== call) return undefined;
  if (block?.type !== "BlockStatement") return undefined;
  if (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionDeclaration") {
    return undefined;
  }
  if (block.body.filter((each) => each.type !== "EmptyStatement").at(-1) !== statement) {
    return undefined;
  }
  const [callback, ...rest] = call.arguments;
  if (
    rest.length ||
    callback?.type !== "ArrowFunctionExpression" ||
    callback.params.length ||
    callback.async
  ) {
    return undefined;
  }
  const written = source.slice(callback.start, callback.end);
  if (/(?<![\w$])(?:preventDefault|stopPropagation)(?![\w$])/.test(written)) return undefined;
  if (!canBecomeAsync(fn, path, callback, context)) return undefined;
  // The callback's own declarations join the function's body: no name of theirs may be used there.
  const outside = source.slice(fn.start, callback.start) + " " + source.slice(callback.end, fn.end);
  if (callback.body.type === "BlockStatement") {
    for (const each of callback.body.body) {
      if (each.type !== "VariableDeclaration") continue;
      for (const declarator of each.declarations) {
        for (const name of patternNames(declarator.id)) {
          if (new RegExp(`(?<![\\w$])${name.name.replace(/\$/g, "\\$")}(?![\\w$])`).test(outside)) {
            return undefined;
          }
        }
      }
    }
  }
  // What moves: a block's statements, or an expression body with its parentheses.
  const body =
    callback.body.type === "BlockStatement"
      ? { start: callback.body.start + 1, end: callback.body.end - 1 }
      : arrowBodySpan(callback, source);
  const dropped = (comment: AST.Comment) =>
    comment.start >= call.start &&
    comment.end <= statement.end &&
    !(comment.start >= body.start && comment.end <= body.end);
  if (render.comments.some(dropped)) return undefined;
  const lineStart = source.lastIndexOf("\n", statement.start - 1) + 1;
  const before = source.slice(lineStart, statement.start);
  const ownLine = /^\s*$/.test(before);
  const indent = ownLine ? before : "";
  const tail =
    callback.body.type === "BlockStatement"
      ? dedented(source.slice(body.start, body.end))
      : [`${source.slice(body.start, body.end)};`];
  const name = source.slice(call.callee.start, call.callee.end);
  const text = [`await ${name}();`, ...tail]
    .map((line, index) => (index && ownLine && line ? `${indent}${line}` : line))
    .join(ownLine ? "\n" : " ");
  const edits: TextEdit[] = [];
  if (!fn.async) edits.push({ span: { start: fn.start, end: fn.start }, text: "async " });
  edits.push({ span: { start: call.start, end: statement.end }, text });
  return { title: `Await \`${name}()\` in an \`async\` function`, confidence: "safe", edits };
}

/**
 * Whether a function can become `async` without changing what a caller sees (UF2025's fix): a
 * handler, an `onMounted` callback, a watcher's callback that is not immediate (Vue runs an
 * immediate one during the setup), or a local function that no code calls.
 */
function canBecomeAsync(
  fn: AST.ArrowFunctionExpression | AST.Function,
  path: readonly AST.Node[],
  callback: AST.ArrowFunctionExpression,
  context: ClientRulesContext,
): boolean {
  const { input, component } = context;
  const { render } = input;
  const parent = path.at(-5);
  if (fn.type === "ArrowFunctionExpression" && parent?.type === "JSXExpressionContainer") {
    return path.at(-6)?.type === "JSXAttribute";
  }
  if (parent?.type === "CallExpression" && parent.callee.type === "Identifier") {
    const resolution = render.scopes.resolve(parent.callee);
    const api =
      resolution.kind === "import" ? render.setup.authoring.get(resolution.declaration) : undefined;
    if (api === "onMounted") return parent.arguments[0] === fn;
    if (api !== "watch" || parent.arguments[1] !== fn) return false;
    const watcher = component.setup.find(
      (item) => item.kind === "Watch" && item.callback.span.start === fn.start,
    );
    // `onCleanup` is called before any `await` (UF1002 after one).
    const cleanup = fn.params[2];
    const name = cleanup?.type === "Identifier" ? cleanup.name : undefined;
    const text = render.source.slice(callback.start, callback.end);
    return (
      watcher?.kind === "Watch" &&
      !watcher.immediate &&
      (name === undefined || !new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(text))
    );
  }
  // A local function: a function declaration or an arrow `const` of the setup that no code calls.
  if (input.failed) return false;
  const identifier =
    fn.type === "FunctionDeclaration"
      ? parent === render.component.body
        ? fn.id
        : undefined
      : parent?.type === "VariableDeclarator" &&
          path.at(-7) === render.component.body &&
          parent.id.type === "Identifier"
        ? parent.id
        : undefined;
  const binding = identifier ? render.setup.bindings.get(identifier) : undefined;
  if (binding?.kind !== "localFn") return false;
  const refs = [
    ...expressionsOf(component).flatMap(({ expression }) => expression.refs),
    ...codeOf(component).flatMap(({ code }) => code.refs),
  ];
  return !refs.some((ref) => ref.kind === "Binding" && ref.binding === binding.id && ref.call);
}

/** A block's inner text as lines without their common indentation, blank lines at its ends gone. */
function dedented(inner: string): string[] {
  const lines = inner.split("\n").map((line) => line.trimEnd());
  if (lines.length === 1) return lines[0]!.trim() ? [lines[0]!.trim()] : [];
  const first = lines.shift()!.trim();
  while (lines.length && !lines.at(-1)) lines.pop();
  while (lines.length && !lines[0]) lines.shift();
  const indents = lines.filter(Boolean).map((line) => /^\s*/.exec(line)![0].length);
  const least = indents.length ? Math.min(...indents) : 0;
  return [...(first ? [first] : []), ...lines.map((line) => line.slice(least))];
}

/**
 * Whether a reference to a local function runs it: a call, or the function passed to a call
 * that may run it, now or later (UF2026, UF2027). A call that never runs what it is given
 * (`removeEventListener`, `clearTimeout`) only compares it or forgets it.
 */
function runsFunction(
  ref: Extract<CodeReference, { kind: "Binding" }>,
  bindings: ReadonlyMap<BindingId, Binding>,
  render: RenderContext,
): boolean {
  return (
    bindings.get(ref.binding)?.kind === "localFn" &&
    (ref.call === true || render.facts.passed.get(ref.span.start) !== "never")
  );
}

/** The local functions' code by binding, as the IR holds it and as the source writes it. */
function localFunctions(
  component: UfComponent,
  render: RenderContext,
): {
  code: ReadonlyMap<BindingId, { body: { refs: readonly CodeReference[] } }>;
  nodes: ReadonlyMap<BindingId, FunctionNode>;
} {
  const code = new Map(
    component.setup.flatMap((item) =>
      item.kind === "Function" ? [[item.binding, item.function] as const] : [],
    ),
  );
  const nodes = new Map<BindingId, FunctionNode>();
  for (const binding of render.setup.bindings.values()) {
    if (binding.function) nodes.set(binding.id, binding.function);
  }
  return { code, nodes };
}

/**
 * Code that runs while a component is torn down (UF2026): an `onUnmounted` callback, an
 * `onCleanup` callback of a watcher or `watchEffect`, and the local functions they run (call, or
 * pass to a call that runs them), read no template ref (Vue empties one before `onUnmounted`
 * runs, React before an effect's cleanup; Svelte, Angular and Qwik still hold the element); and
 * an `onUnmounted` callback is not `async` and calls no `async` function (Vue drops an emit once
 * the component is unmounted). A listener teardown removes (`removeEventListener(type, fn)`) does
 * not run: it reads the element when its event fires, while the component is mounted.
 */
function teardown(context: ClientRulesContext, bindings: ReadonlyMap<BindingId, Binding>): void {
  const { input, component, summaries } = context;
  const { render } = input;
  const { reporter, source } = render;
  const name = (id: BindingId) => bindings.get(id)?.name ?? id.split("@")[0]!;
  const reported = new Set<number>();
  const { code } = localFunctions(component, render);
  const readsElement = new Map<BindingId, boolean>();
  /** Whether running a local function reads a template ref, itself or through what it runs. */
  const readsRef = (id: BindingId): boolean => {
    const known = readsElement.get(id);
    if (known !== undefined) return known;
    readsElement.set(id, false);
    const found = (code.get(id)?.body.refs ?? []).some(
      (ref) =>
        (ref.kind === "Binding" &&
          !ref.call &&
          bindings.get(ref.binding)?.kind === "templateRef") ||
        (ref.kind === "Binding" && runsFunction(ref, bindings, render) && readsRef(ref.binding)),
    );
    readsElement.set(id, found);
    return found;
  };
  const elementHelp =
    "Read the element in the callback that sets up the work (`onMounted`, the watcher's callback), and keep it in a local or a setup `let` for the teardown.";
  const why =
    "Vue empties a template ref before `onUnmounted` runs and React before an effect's cleanup, while Svelte, Angular and Qwik still hold the element.";
  const asyncWhy =
    "Vue drops an emit once the component is unmounted, and the other targets deliver it.";
  const asyncHelp = "Do the async work before the component unmounts: the teardown runs at once.";
  /** Judges the references of code that runs at teardown, from `from` to `to`. */
  const judge = (refs: readonly CodeReference[], what: string, unmount: boolean, within?: Span) => {
    for (const ref of refs) {
      if (ref.kind !== "Binding" || reported.has(ref.span.start)) continue;
      if (within && (ref.span.start < within.start || ref.span.end > within.end)) continue;
      const kind = bindings.get(ref.binding)?.kind;
      if (!ref.call && kind === "templateRef") {
        reported.add(ref.span.start);
        reporter.report(
          "UF2026",
          ref.span,
          `${what} reads the template ref \`${name(ref.binding)}\`: ${why}`,
          { help: elementHelp },
        );
        continue;
      }
      if (!runsFunction(ref, bindings, render)) continue;
      const summary = summaries.get(ref.binding);
      if (!summary) continue;
      if (readsRef(ref.binding)) {
        reported.add(ref.span.start);
        reporter.report(
          "UF2026",
          ref.span,
          `${what} ${ref.call ? "calls" : "runs"} \`${name(ref.binding)}\`, which reads a template ref: ${why}`,
          { help: elementHelp },
        );
      } else if (unmount && summary.async) {
        reported.add(ref.span.start);
        reporter.report(
          "UF2026",
          ref.span,
          `${what} ${ref.call ? "calls" : "runs"} \`${name(ref.binding)}\`, which is \`async\`: ${asyncWhy}`,
          { help: asyncHelp },
        );
      }
    }
  };
  for (const item of component.setup) {
    if (item.kind === "Lifecycle" && item.hook === "unmounted") {
      const { callback } = item;
      if (callback.async) {
        const at = { start: callback.span.start, end: callback.span.start + "async".length };
        // Without an `await`, `async` changes nothing but the returned promise: the fix drops it.
        const node = input.setup.sources.get(item)?.callback;
        const awaits = node ? containsAwait(node.body) : true;
        const end = at.end + (/^\s*/.exec(source.slice(at.end))![0].length || 0);
        reporter.report("UF2026", at, `An \`onUnmounted\` callback is \`async\`: ${asyncWhy}`, {
          help: asyncHelp,
          ...(awaits
            ? {}
            : {
                fixes: [
                  {
                    title: "Remove `async`",
                    confidence: "safe" as const,
                    edits: [{ span: { start: at.start, end }, text: "" }],
                  },
                ],
              }),
        });
      }
      judge(callback.body.refs, "An `onUnmounted` callback", true);
      continue;
    }
    if (item.kind !== "Watch" && item.kind !== "WatchEffect") continue;
    const fn = item.kind === "Watch" ? item.callback : item.effect;
    const node = input.setup.sources.get(item)?.callback;
    const parameter = node?.params[item.kind === "Watch" ? 2 : 0];
    if (!node || parameter?.type !== "Identifier") continue;
    for (const registered of cleanupCallbacks(node, parameter, render, new Set())) {
      if (registered.type === "ArrowFunctionExpression") {
        // The callback's references are the watcher's own, where it is written.
        if (registered.start >= fn.body.span.start && registered.end <= fn.body.span.end) {
          judge(fn.body.refs, "An `onCleanup` callback", false, registered);
        } else {
          const holder = localFunctionHolding(registered, component);
          if (holder) judge(holder.body.refs, "An `onCleanup` callback", false, registered);
        }
      } else {
        // A local function passed whole runs at teardown itself.
        const binding = setupBindingOf(registered, render);
        if (binding?.kind !== "localFn") continue;
        const ref: CodeReference = {
          kind: "Binding",
          binding: binding.id,
          span: { start: registered.start, end: registered.end },
        };
        judge([ref], "An `onCleanup` callback", false);
      }
    }
  }
}

/**
 * The callbacks code registers with `onCleanup` (`parameter`, the parameter that receives it), in
 * the function `fn` and in the local functions it passes `onCleanup` on to: arrow functions, and
 * local functions passed by name.
 */
function cleanupCallbacks(
  fn: AST.ArrowFunctionExpression | AST.Function,
  parameter: AST.BindingIdentifier,
  render: RenderContext,
  seen: Set<object>,
): (AST.ArrowFunctionExpression | AST.IdentifierReference)[] {
  seen.add(fn);
  const found: (AST.ArrowFunctionExpression | AST.IdentifierReference)[] = [];
  const isParameter = (node: AST.Node) => {
    if (node.type !== "Identifier") return false;
    const resolution = render.scopes.resolve(node as AST.IdentifierReference);
    return resolution.kind === "parameter" && resolution.declaration === parameter;
  };
  visit(fn.body, (node) => {
    if (node.type !== "CallExpression") return;
    if (isParameter(node.callee)) {
      for (const argument of node.arguments) {
        if (argument.type === "ArrowFunctionExpression" || argument.type === "Identifier") {
          found.push(argument);
        }
      }
      return;
    }
    // `onCleanup` passed on to a local function, whose parameter receives it.
    if (node.callee.type !== "Identifier") return;
    const callee = setupBindingOf(node.callee, render);
    const target = callee?.function;
    if (!target || seen.has(target)) return;
    for (const [index, argument] of node.arguments.entries()) {
      const received = target.params[index];
      if (isParameter(argument) && received?.type === "Identifier") {
        found.push(...cleanupCallbacks(target, received, render, seen));
      }
    }
  });
  return found;
}

/** The body of the local function whose code holds a span, as the IR has it. */
function localFunctionHolding(
  at: Span,
  component: UfComponent,
): { body: { refs: readonly CodeReference[] } } | undefined {
  for (const item of component.setup) {
    if (item.kind !== "Function") continue;
    const { body } = item.function;
    if (at.start >= body.span.start && at.end <= body.span.end) return item.function;
  }
  return undefined;
}

/**
 * A `watchEffect` that writes a state it reads (UF2027): Vue ignores what an effect writes while
 * it runs, and the targets that track an effect's reads run it again after its own write. Only
 * what runs while the effect runs counts, as only that is tracked or ignored: its own code up to
 * where it gives control back (an `await`; a function it hands to a timer, `then`,
 * `addEventListener` or `onCleanup`, written in place, held in a local `const` or a local
 * function's name, which runs later), the same part of the local functions it runs at once, and
 * the `computed` values it reads. A compound write (`count.value++`) reads too.
 */
function selfTriggeringEffects(
  context: ClientRulesContext,
  bindings: ReadonlyMap<BindingId, Binding>,
): void {
  const { input, component } = context;
  const { render } = input;
  const { reporter } = render;
  const name = (id: BindingId) => bindings.get(id)?.name ?? id.split("@")[0]!;
  const { code, nodes } = localFunctions(component, render);
  const getters = new Map(
    component.setup.flatMap((item) =>
      item.kind === "Derived" ? [[item.binding, item.getter] as const] : [],
    ),
  );
  const suspensions = {
    awaits: () => true,
    deferred: (node: FunctionNode) => context.deferred.has(node),
  };
  /**
   * Whether a reference to a local function runs it while the code runs: a call, or the function
   * passed to a call that may run it at once (`forEach(bump)`). One handed to a timer, `then`,
   * `addEventListener` or `onCleanup` runs later, by name as written in place.
   */
  const runsNow = (ref: Extract<CodeReference, { kind: "Binding" }>) =>
    bindings.get(ref.binding)?.kind === "localFn" &&
    (ref.call === true || !render.facts.passed.has(ref.span.start));
  /** The references of a function that run while a call of it runs, before it gives control back. */
  const synchronous = (refs: readonly CodeReference[], node: FunctionNode | undefined) => {
    if (!node) return refs;
    const regions = laterRegions(node, suspensions);
    // A write happens once its value is computed, where its span ends.
    return refs.filter(
      (ref) => !isLater(ref.kind === "Write" ? ref.span.end - 1 : ref.span.start, regions),
    );
  };
  /** What references read and write as they run, through the local functions they run at once. */
  const runFacts = (
    refs: readonly CodeReference[],
    seen: Set<BindingId>,
  ): { reads: Set<BindingId>; writes: Set<BindingId> } => {
    const reads = new Set<BindingId>();
    const writes = new Set<BindingId>();
    for (const ref of refs) {
      if (ref.kind === "Write") {
        writes.add(ref.binding);
        if (ref.operator !== "=") reads.add(ref.binding);
      } else if (ref.kind === "Binding" && runsNow(ref)) {
        if (seen.has(ref.binding)) continue;
        seen.add(ref.binding);
        const inner = functionFacts(ref.binding, seen);
        for (const id of inner.reads) reads.add(id);
        for (const id of inner.writes) writes.add(id);
      } else if (ref.kind === "Binding" && (!ref.call || !code.has(ref.binding))) {
        reads.add(ref.binding);
      }
    }
    return { reads, writes };
  };
  const functionFacts = (id: BindingId, seen: Set<BindingId>) =>
    runFacts(synchronous(code.get(id)?.body.refs ?? [], nodes.get(id)), seen);
  for (const item of component.setup) {
    if (item.kind !== "WatchEffect") continue;
    const own = synchronous(item.effect.body.refs, input.setup.sources.get(item)?.callback);
    const { reads } = runFacts(own, new Set());
    // A `computed` the effect reads is read through: its getter's reads are the effect's too.
    for (const id of reads) {
      const getter = getters.get(id);
      if (getter) for (const read of summarizeCode(getter.body, component).reads) reads.add(read);
    }
    const state = (id: BindingId) =>
      (bindings.get(id)?.kind === "state" || bindings.get(id)?.kind === "model") && reads.has(id);
    const reported = new Set<BindingId>();
    const why =
      "Vue ignores what an effect writes while it runs, and Svelte, Solid, Angular, Qwik and React run it again after its own write, without end.";
    const help =
      "Watch the sources with `watch(sources, callback)`, whose callback is untracked, and write the state there.";
    for (const ref of own) {
      if (ref.kind === "Write" && state(ref.binding) && !reported.has(ref.binding)) {
        reported.add(ref.binding);
        reporter.report(
          "UF2027",
          ref.span,
          `\`watchEffect\` writes \`${name(ref.binding)}.value\`, which it also reads: ${why}`,
          { help },
        );
      } else if (ref.kind === "Binding" && runsNow(ref)) {
        const written = [...functionFacts(ref.binding, new Set([ref.binding])).writes].find(
          (id) => state(id) && !reported.has(id),
        );
        if (written === undefined) continue;
        reported.add(written);
        reporter.report(
          "UF2027",
          ref.span,
          `\`watchEffect\` ${ref.call ? "calls" : "runs"} \`${name(ref.binding)}\`, which writes \`${name(written)}.value\`, which the effect also reads: ${why}`,
          { help },
        );
      }
    }
  }
}

/**
 * `preventDefault()` in what a passive listener runs (UF3034): its handler, and the local
 * functions it passes its event to. The browser ignores the call there, so it prevents nothing on
 * any target; and Angular runs an element's listeners of one event in one listener, which is not
 * passive beside one that is not, where the call would prevent. Each call is reported once, at the
 * call. The safe fix removes a call a handler written in place makes as a statement of its own,
 * with the event parameter nothing else reads; or the listener, where the call is all it does.
 */
function passivePrevention(
  context: ClientRulesContext,
  bindings: ReadonlyMap<BindingId, Binding>,
): void {
  const { input, component } = context;
  const { render } = input;
  const { reporter, source } = render;
  if (!component.render) return;
  const functions = new Map(
    component.setup.flatMap((item) =>
      item.kind === "Function" ? [[item.binding, item.function] as const] : [],
    ),
  );
  const { nodes } = localFunctions(component, render);
  const reported = new Set<number>();
  /** The `preventDefault()` calls code makes on its event `event`, itself or through a callee. */
  const preventions = (
    fn: FunctionCode,
    event: string | undefined,
    seen: Set<BindingId>,
  ): Extract<CodeReference, { kind: "Event" }>[] => {
    const found: Extract<CodeReference, { kind: "Event" }>[] = [];
    if (event === undefined) return found;
    for (const ref of fn.body.refs) {
      if (ref.kind === "Event" && ref.member === "preventDefault" && ref.call) {
        found.push(ref);
        continue;
      }
      if (ref.kind !== "Binding" || !ref.call || seen.has(ref.binding)) continue;
      if (bindings.get(ref.binding)?.kind !== "localFn") continue;
      const node = nodes.get(ref.binding);
      const parameter = node ? render.setup.eventParameters.get(node) : undefined;
      const callee = functions.get(ref.binding);
      if (!parameter || !callee || !passesEvent(ref.span, parameter.index, event, render)) continue;
      seen.add(ref.binding);
      found.push(...preventions(callee, callee.parameters[parameter.index]?.name, seen));
    }
    return found;
  };
  const listeners: EventAttribute[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" && attribute.passive) listeners.push(attribute);
      }
    },
  });
  for (const listener of listeners) {
    const { handler } = listener;
    const fn = handler.kind === "Inline" ? handler.function : functions.get(handler.binding);
    if (!fn) continue;
    const parameter =
      handler.kind === "Inline"
        ? 0
        : render.setup.eventParameters.get(nodes.get(handler.binding)!)?.index;
    const event = parameter === undefined ? undefined : fn.parameters[parameter]?.name;
    for (const call of preventions(fn, event, new Set())) {
      if (reported.has(call.span.start)) continue;
      reported.add(call.span.start);
      const path = pathTo(call.span, render.component);
      const whole = path.at(-2);
      const at = whole?.type === "CallExpression" ? whole : call.span;
      const fix =
        handler.kind === "Inline" && whole?.type === "CallExpression"
          ? removalFix(listener, handler.function, call, path, source)
          : undefined;
      reporter.report(
        "UF3034",
        { start: at.start, end: at.end },
        `\`${source.slice(at.start, at.end)}\` runs in a passive \`${listener.event}\` listener, which the browser never lets prevent anything; Angular, which runs an element's listeners of one event together, would run it in a listener that is not passive.`,
        {
          help: `Remove the call, or make the listener not passive (\`on${listener.event.charAt(0).toUpperCase()}${listener.event.slice(1)}\`) where it must prevent the default.`,
          ...(fix ? { fixes: [fix] } : {}),
        },
      );
    }
  }
}

/**
 * UF3034's safe fix in a handler written in place: the listener removed where the call is all it
 * does; else the call's statement removed, and the event parameter where nothing else reads it.
 */
function removalFix(
  listener: EventAttribute,
  fn: FunctionCode,
  call: Extract<CodeReference, { kind: "Event" }>,
  path: readonly AST.Node[],
  source: string,
): Fix | undefined {
  const arrow = path.findLast(
    (node): node is AST.ArrowFunctionExpression => node.type === "ArrowFunctionExpression",
  );
  if (!arrow || arrow.start !== fn.span.start) return undefined;
  const statement = path.at(-3);
  const body = arrow.body;
  const statements =
    body.type === "BlockStatement"
      ? body.body.filter((each) => each.type !== "EmptyStatement")
      : [];
  const alone =
    body === path.at(-2) ||
    (statement?.type === "ExpressionStatement" &&
      path.at(-4) === body &&
      statements.length === 1 &&
      statements[0] === statement);
  if (alone) {
    // The listener does nothing else: it goes, with the whitespace before it.
    const start =
      listener.span.start - /\s*$/.exec(source.slice(0, listener.span.start))![0].length;
    return {
      title: "Remove the listener, which does nothing else",
      confidence: "safe",
      edits: [{ span: { start, end: listener.span.end }, text: "" }],
    };
  }
  if (statement?.type !== "ExpressionStatement" || path.at(-4) !== body) return undefined;
  const lineStart = source.lastIndexOf("\n", statement.start - 1) + 1;
  const ownLine = /^\s*$/.test(source.slice(lineStart, statement.start));
  const start = ownLine
    ? lineStart - 1
    : statement.start - /\s*$/.exec(source.slice(0, statement.start))![0].length;
  const edits: TextEdit[] = [{ span: { start, end: statement.end }, text: "" }];
  // The event parameter nothing else reads goes too, or it would be reported unread (UF3024).
  const others = fn.body.refs.some((ref) => ref.kind === "Event" && ref !== call);
  const parameter = arrow.params[0];
  if (!others && arrow.params.length === 1 && parameter) {
    const parenthesised = source.slice(arrow.start, parameter.start).includes("(");
    edits.unshift({
      span: { start: parameter.start, end: parameter.end },
      text: parenthesised ? "" : "()",
    });
  }
  return {
    title: "Remove `preventDefault()`, which prevents nothing here",
    confidence: "safe",
    edits,
  };
}

/** Whether a call, by its callee's span, passes the event named `event` at `index`. */
function passesEvent(callee: Span, index: number, event: string, render: RenderContext): boolean {
  const path = pathTo(callee, render.component);
  const call = path.at(-2);
  if (call?.type !== "CallExpression" || call.callee !== path.at(-1)) return false;
  const argument = call.arguments[index];
  return argument?.type === "Identifier" && argument.name === event;
}

/** The nodes from `root` down to the innermost node that spans exactly `at`, or nothing. */
function pathTo(at: Span, root: AST.Node): AST.Node[] {
  const path: AST.Node[] = [];
  let found: AST.Node[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object" || typeof (value as AST.Node).type !== "string") {
      return;
    }
    const node = value as AST.Node;
    if (node.start > at.start || node.end < at.end) return;
    path.push(node);
    if (node.start === at.start && node.end === at.end) found = [...path];
    for (const key of visitorKeys[node.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
    path.pop();
  };
  visit(root);
  return found;
}

/** Whether a function's body awaits, outside the functions in it. */
function containsAwait(node: unknown): boolean {
  let found = false;
  const walk = (value: unknown): void => {
    if (found || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const typed = value as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration"
    ) {
      return;
    }
    if (typed.type === "AwaitExpression" || (typed.type === "ForOfStatement" && typed.await)) {
      found = true;
      return;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      walk((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  walk(node);
  return found;
}

/** Visits every node in a tree, depth first. */
function visit(node: unknown, enter: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  enter(typed);
  for (const key of visitorKeys[typed.type] ?? []) {
    visit((typed as unknown as Record<string, unknown>)[key], enter);
  }
}

/** The nodes from `root` down to `target`, both included. */
function ancestors(target: AST.Node, root: AST.Node): AST.Node[] {
  const path: AST.Node[] = [];
  const walk = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(walk);
    if (!value || typeof value !== "object" || typeof (value as AST.Node).type !== "string") {
      return false;
    }
    const node = value as AST.Node;
    if (node.start > target.start || node.end < target.end) return false;
    path.push(node);
    if (node === target) return true;
    for (const key of visitorKeys[node.type] ?? []) {
      if (walk((node as unknown as Record<string, unknown>)[key])) return true;
    }
    path.pop();
    return false;
  };
  walk(root);
  return path;
}
