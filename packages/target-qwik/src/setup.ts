// The setup's statements in Qwik (ADR-0045 to ADR-0049):
// - `ref(x)` → `useSignal(x)`, read and written through `.value` as written; a setup `let` →
//   a signal too, whose reads and writes gain `.value` (a plain `let` would be copied into each
//   `$` scope that captures it, so a write would never reach another);
// - `computed(fn)` → `useComputed$(fn)`; a template ref → `useSignal<T>()` and `ref={x}`;
//   `useId()` → `"uf-id-" + useId()`;
// - a `const` → module scope, `useConstant(() => …)` or a plain `const` (./plan.ts);
// - a function → module scope, a plain function, a `$()` QRL, or both (./plan.ts);
// - `watch` → `useTask$` with `{ deferUpdates: false }` (a watcher never holds the render back),
//   tracking its sources, with the previous value in a signal: the callback runs when a source
//   changed by `Object.is`, never on the first run unless `immediate`; a getter source that is
//   more than one read goes through `useComputed$`, so the task reruns, and its `cleanup` runs,
//   only when the getter's value changed (ADR-0048); `flush: "post"` → `useVisibleTask$`;
// - `watchEffect` → `useVisibleTask$` tracking what it reads (its dependencies are static, ADR-0048);
// - `onMounted` → `useVisibleTask$`; `onUnmounted` → a visible task's `cleanup`. Visible tasks run
//   in the browser only, after the DOM has rendered (ADR-0048), once the document is ready
//   (`strategy: "document-ready"`), never on the element's visibility.
// Each `$` scope captures what it reads when it is created, so a statement comes after the
// statements of what it captures: the source's order, but where client code reads a binding
// declared after it (ADR-0045 allows it), that declaration moves up, so tasks keep their order.
import { functionSource, rewriteCode } from "@unframework/codegen";
import type { CodeKind, RewriteSite } from "@unframework/codegen";
import type {
  BindingId,
  Code,
  CodeReference,
  FunctionCode,
  FunctionItem,
  LifecycleItem,
  Parameter,
  SetupItem,
  WatchEffectItem,
  WatchItem,
} from "@unframework/ir";
import { summarizeTracked } from "@unframework/ir";

import { awaitQrlCalls, passElement } from "./calls.ts";
import { inlineCalls } from "./inline.ts";
import type { InlineFunction, Inliner } from "./inline.ts";
import {
  eventCallees,
  inlinedAt,
  isPredicate,
  isReactive,
  referencedIds,
  unreachable,
} from "./plan.ts";
import type { SetupPlan } from "./plan.ts";

/** A statement of the component's body, before its `return`. */
interface Statement {
  code: string;
  /** Whether it is a one-line declaration, which sits with its neighbours without a blank line. */
  declaration: boolean;
}

/** A setup item's statements, with what it declares and what it captures. */
interface Entry {
  index: number;
  statements: Statement[];
  declares: BindingId[];
  captures: Set<BindingId>;
  /** Whether it is an `onUnmounted` hook. */
  unmounted: boolean;
}

/** The output of a component's setup. */
export interface SetupOutput {
  /** Module-level declarations, before the component, in source order. */
  hoisted: string[];
  /** The component body's code before its `return`: empty when there is none. */
  body: string;
}

/** Prints a component's setup (see the module comment). */
export function printSetup(plan: SetupPlan): SetupOutput {
  const hoisted: string[] = [];
  const entries: Entry[] = [];
  for (const [index, item] of plan.component.setup.entries()) {
    const module = moduleCode(plan, item);
    if (module !== undefined) {
      if (module !== "") hoisted.push(module);
      continue;
    }
    const statements = itemStatements(plan, item);
    if (!statements.length) continue;
    entries.push({
      index,
      statements,
      declares: "binding" in item ? [item.binding] : [],
      captures: withCallees(plan, captured(plan, item)),
      unmounted: item.kind === "Lifecycle" && item.hook === "unmounted",
    });
  }
  // The holder of the functions that reference each other, first (./plan.ts `StablePlan`).
  const { holder } = plan.stable;
  if (holder) {
    const members = holder.members
      .map((id) => {
        const name = plan.functions.get(id)!.qrl;
        return `${name}: typeof ${name}`;
      })
      .join("; ");
    entries.unshift({
      index: -1,
      statements: [
        block(
          `// Functions that reference each other: a QRL captures what it reads when it is created, so each\n// reads the other from here once both exist.\nconst ${holder.name} = ${plan.names.core("useConstant")}(() => ({}) as { ${members} });`,
        ),
      ],
      declares: [],
      captures: new Set(),
      unmounted: false,
    });
  }
  // An `onUnmounted` hook is a visible task whose cleanup runs it, and Qwik runs the cleanups of a
  // removed component's visible tasks in their order: the hooks come last, so every watcher's and
  // effect's cleanup runs before them, as the source's do (ADR-0048).
  const ordered = order(entries).toSorted((a, b) => Number(a.unmounted) - Number(b.unmounted));
  let body = "";
  let previous: Statement | undefined;
  for (const statement of ordered.flatMap((entry) => entry.statements)) {
    if (previous) body += previous.declaration && statement.declaration ? "\n" : "\n\n";
    body += statement.code;
    previous = statement;
  }
  return { hoisted, body };
}

/**
 * The entries in source order, each after the entries that declare what it captures: a `$` scope
 * captures its bindings when it is created. A declaration the source writes later than an entry
 * that captures it moves up, before that entry, with what it captures in turn; an entry never
 * moves down, so watchers, effects and hooks keep their source order, which is the order Qwik
 * runs their tasks in (ADR-0048). The analyser rejects recursion, so the captures form no cycle;
 * one would keep the rest in source order.
 */
function order(entries: readonly Entry[]): Entry[] {
  const declaredBy = new Map<BindingId, Entry>();
  for (const entry of entries) for (const id of entry.declares) declaredBy.set(id, entry);
  const placed = new Set<Entry>();
  const visiting = new Set<Entry>();
  const result: Entry[] = [];
  const place = (entry: Entry): void => {
    if (placed.has(entry) || visiting.has(entry)) return;
    visiting.add(entry);
    for (const id of entry.captures) {
      const declaring = declaredBy.get(id);
      if (declaring !== undefined && declaring !== entry) place(declaring);
    }
    visiting.delete(entry);
    placed.add(entry);
    result.push(entry);
  };
  for (const entry of entries) place(entry);
  return result;
}

/**
 * What code captures, with what the local functions it references capture in turn: a call
 * written in place puts the function's body in the code (./inline.ts).
 */
function withCallees(plan: SetupPlan, captures: Set<BindingId>): Set<BindingId> {
  const found = new Set(captures);
  const queue = [...captures];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    const fn = plan.functions.get(id);
    if (!fn) continue;
    for (const next of referencedIds(captures_(plan, fn.item.function.body.refs))) {
      if (!found.has(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return found;
}

/** The references a `$` scope captures: all but those it reads through the holder. */
function captures_(plan: SetupPlan, refs: readonly CodeReference[]): CodeReference[] {
  return refs.filter((reference) => !plan.stable.lazy.has(reference.span.start));
}

/** What an item's code references: the bindings its `$` scopes capture. */
function captured(plan: SetupPlan, item: SetupItem): Set<BindingId> {
  const found = new Set<BindingId>();
  const add = (code: Code | undefined) => {
    if (code) for (const id of referencedIds(captures_(plan, code.refs))) found.add(id);
  };
  switch (item.kind) {
    case "State":
    case "Variable":
      add(item.initial);
      break;
    case "Const":
      add(item.value);
      break;
    case "Derived":
      add(item.getter.body);
      break;
    case "Function":
      add(item.function.body);
      break;
    case "Watch":
      for (const source of item.sources) {
        if (source.kind === "Ref") found.add(source.binding);
        else add(source.getter.body);
      }
      add(item.callback.body);
      break;
    case "WatchEffect":
      add(item.effect.body);
      break;
    case "Lifecycle":
      add(item.callback.body);
      break;
    case "Provide":
      add(item.value);
      break;
    case "Inject":
      add(item.fallback);
      break;
    case "TemplateRef":
    case "Id":
    case "Model":
      break;
    default:
      unreachable(item);
  }
  return found;
}

/** An item that moves to module scope, as the source writes it: `undefined` for any other. */
function moduleCode(plan: SetupPlan, item: SetupItem): string | undefined {
  if (item.kind === "Const" && plan.consts.get(item.binding) === "module") {
    const name = plan.functions.get(item.binding)?.binding.name ?? bindingName(plan, item.binding);
    const type = item.type ? `: ${item.type.code}` : "";
    return `const ${name}${type} = ${rewriteCode(item.value, plan.component, plan.rules(), "pure")};`;
  }
  if (item.kind === "Function" && plan.functions.get(item.binding)?.form === "module") {
    // A function whose whole body moved to its listeners (./handlers.ts) is not declared.
    if (plan.functionCode(item.binding) === null) return "";
    return functionDeclaration(plan, item, "pure");
  }
  return undefined;
}

function bindingName(plan: SetupPlan, id: BindingId): string {
  const binding = plan.component.bindings.find((candidate) => candidate.id === id);
  if (!binding) throw new Error(`Component ${plan.component.name} declares no binding ${id}.`);
  return binding.name;
}

/** An item's statements in the component's body. */
function itemStatements(plan: SetupPlan, item: SetupItem): Statement[] {
  const { names } = plan;
  const pure = (code: Code) => rewriteCode(code, plan.component, plan.rules(), "pure");
  switch (item.kind) {
    case "State":
    case "Variable": {
      const name = bindingName(plan, item.binding);
      const type = item.type ? `<${item.type.code}>` : "";
      const initial = item.initial ? pure(item.initial) : "";
      return [declaration(`const ${name} = ${names.core("useSignal")}${type}(${initial});`)];
    }
    case "TemplateRef": {
      const name = bindingName(plan, item.binding);
      return [
        declaration(
          `const ${name} = ${names.core("useSignal")}<${item.type?.code ?? "Element"}>();`,
        ),
      ];
    }
    case "Id":
      return [
        declaration(
          `const ${bindingName(plan, item.binding)} = "uf-id-" + ${names.core("useId")}();`,
        ),
      ];
    case "Const": {
      const name = bindingName(plan, item.binding);
      const type = item.type ? `: ${item.type.code}` : "";
      const value = pure(item.value);
      return [
        declaration(
          plan.consts.get(item.binding) === "constant"
            ? `const ${name}${type} = ${names.core("useConstant")}(() => ${arrowBody(value)});`
            : `const ${name}${type} = ${value};`,
        ),
      ];
    }
    case "Derived": {
      const name = bindingName(plan, item.binding);
      const type = item.type ? `<${item.type.code}>` : "";
      const getter = printFunction(plan, item.getter, "pure").text;
      return [declaration(`const ${name} = ${names.core("useComputed$")}${type}(${getter});`)];
    }
    case "Function":
      return functionStatements(plan, item);
    case "Watch":
      return watchStatements(plan, item);
    case "WatchEffect":
      return [block(watchEffectCode(plan, item))];
    case "Lifecycle":
      return [block(lifecycleCode(plan, item))];
    // Composition (ADR-0055) is not emitted yet: `emit` reports UF1002 before this runs.
    case "Model":
    case "Provide":
    case "Inject":
      return [];
    default:
      return unreachable(item);
  }
}

const declaration = (code: string): Statement => ({ code, declaration: true });
const block = (code: string): Statement => ({ code, declaration: false });

/** An expression as an arrow's body: an object literal in parentheses. */
function arrowBody(code: string): string {
  return code.trimStart().startsWith("{") ? `(${code})` : code;
}

/** A setup function as the source declares it: `function name(…) {…}` or `const name = …;`. */
function functionDeclaration(plan: SetupPlan, item: FunctionItem, site: RewriteSite): string {
  const { binding } = plan.functions.get(item.binding)!;
  const fn = plan.functionCode(item.binding) ?? item.function;
  if (item.form === "declaration" && site === "pure") {
    return printFunction(plan, fn, site, { name: binding.name }).text;
  }
  return `const ${binding.name} = ${printFunction(plan, fn, site).text};`;
}

/** A setup function in the component: plain, a `$()` QRL, or both (./plan.ts). */
function functionStatements(plan: SetupPlan, item: FunctionItem): Statement[] {
  const fnPlan = plan.functions.get(item.binding)!;
  const fn = plan.functionCode(item.binding);
  // A function whose whole body moved to its listeners (./listeners.ts) is not declared.
  if (fn === null) return [];
  const qrl = () => {
    const created = `${plan.names.core("$")}(${printFunction(plan, fn ?? item.function, "client").text})`;
    if (!plan.stable.functions.has(item.binding)) return `const ${fnPlan.qrl} = ${created};`;
    // One QRL for the instance's life (./plan.ts `StablePlan`), in the holder where it is one.
    const useConstant = plan.names.core("useConstant");
    const holder = plan.stable.holder;
    if (!holder?.members.includes(item.binding)) {
      return `const ${fnPlan.qrl} = ${useConstant}(() => ${created});`;
    }
    const local = plan.names.once("created");
    return `const ${fnPlan.qrl} = ${useConstant}(() => {\nconst ${local} = ${created};\n${holder.name}.${fnPlan.qrl} = ${local};\nreturn ${local};\n});`;
  };
  // A function client code only calls in place (./inline.ts) has no QRL.
  const declared = plan.declared.has(item.binding);
  switch (fnPlan.form) {
    case "render":
      return [block(functionDeclaration(plan, item, "pure"))];
    case "qrl":
      return declared ? [block(qrl())] : [];
    case "both":
      return [block(functionDeclaration(plan, item, "pure")), ...(declared ? [block(qrl())] : [])];
    case "module":
      return [];
    default:
      return unreachable(fnPlan.form);
  }
}

/** How {@link printFunction} prints. */
export interface PrintOptions {
  /** A `function` declaration's name; an arrow otherwise. */
  name?: string;
  /** The parameters to print instead of the function's own. */
  parameters?: readonly Parameter[];
  /** The body to print instead of the function's own (a `Code` with control statements removed). */
  body?: Code;
  /** Whether client code runs its calls of local functions in place (./inline.ts). */
  synchronous?: boolean;
}

/**
 * A function as code for a site, with its references spelled by the plan's rules; in client code
 * each call of a QRL is awaited and makes its function async (./calls.ts), and a return type
 * becomes a `Promise` of it.
 */
export function printFunction(
  plan: SetupPlan,
  fn: FunctionCode,
  site: RewriteSite,
  options: PrintOptions = {},
): { text: string; async: boolean } {
  const parameters = options.parameters ?? fn.parameters;
  const event = parameters.find((parameter) => parameter.event !== undefined)?.name;
  const body = options.body ?? fn.body;
  const kind = fn.expression ? "expression" : "statements";
  const rewritten = passEvent(
    plan,
    rewriteCode(body, plan.component, plan.rules(event), site),
    kind,
    body,
    event,
  );
  const awaited =
    site === "client"
      ? clientCode(plan, rewritten, kind, options.synchronous === true)
      : { code: rewritten, async: false };
  const async = fn.async === true || awaited.async;
  const returnType =
    async && fn.async !== true && fn.returnType
      ? { ...fn.returnType, code: `Promise<${promised(fn)}>` }
      : fn.returnType;
  const printed: FunctionCode = {
    ...fn,
    parameters: [...parameters],
    ...(async ? { async: true as const } : {}),
    ...(returnType ? { returnType } : {}),
  };
  return {
    text: functionSource(
      printed,
      awaited.code,
      options.name === undefined ? {} : { name: options.name },
    ),
    async,
  };
}

/**
 * What a function's promise resolves to once its calls are awaited: its return type, or for a
 * type predicate or an assertion, which no promise carries, `boolean` or `void`.
 */
function promised(fn: FunctionCode): string {
  const type = fn.returnType!.code.trim();
  if (!isPredicate(fn)) return type;
  return type.startsWith("asserts") ? "void" : "boolean";
}

/**
 * Printed client code with its calls of local functions settled: written in place where
 * `synchronous` code or a predicate needs it (./inline.ts), else awaited as QRL calls, but for a
 * call of a function that returns a promise, which is awaited only where the source awaits it
 * (./calls.ts). A call the code keeps of a function it declares is no QRL's. `discarded` is set
 * for a handler's expression body, whose value nothing reads.
 */
export function clientCode(
  plan: SetupPlan,
  code: string,
  kind: CodeKind,
  synchronous: boolean,
  discarded = false,
): { code: string; kind: CodeKind; async: boolean; locals: ReadonlySet<string> } {
  const inlined = inlineCalls(code, kind, inliner(plan, synchronous), { discarded });
  const local = (names: ReadonlySet<string>) =>
    new Set([...names].filter((name) => !inlined.locals.has(name)));
  const awaited = awaitQrlCalls(
    inlined.code,
    inlined.kind,
    local(plan.qrls),
    local(plan.promiseQrls),
  );
  return { code: awaited.code, kind: inlined.kind, async: awaited.async, locals: inlined.locals };
}

const inlineFunctions = new WeakMap<SetupPlan, Map<BindingId, InlineFunction>>();

/** The calls client code writes in place (./inline.ts), as ./plan.ts `inlinedAt` decides. */
export function inliner(plan: SetupPlan, synchronous: boolean): Inliner {
  return {
    target(name, site) {
      const id = plan.qrlFunctions.get(name);
      if (
        id === undefined ||
        !inlinedAt(plan.functions.get(id)!.item.function, site, synchronous)
      ) {
        return undefined;
      }
      let known = inlineFunctions.get(plan);
      if (!known) inlineFunctions.set(plan, (known = new Map()));
      let found = known.get(id);
      if (!found) {
        found = inlineFunction(plan, id);
        known.set(id, found);
      }
      return found;
    },
  };
}

/** A client function as it is written in place: its own calls in place too. */
function inlineFunction(plan: SetupPlan, id: BindingId): InlineFunction {
  const { item } = plan.functions.get(id)!;
  const fn = plan.functionCode(id) ?? item.function;
  const event = fn.parameters.find((parameter) => parameter.event !== undefined)?.name;
  const kind: CodeKind = fn.expression ? "expression" : "statements";
  const rewritten = passEvent(
    plan,
    rewriteCode(fn.body, plan.component, plan.rules(event), "client"),
    kind,
    fn.body,
    event,
  );
  const settled = clientCode(plan, rewritten, kind, true);
  // A body that now awaits a call makes the function async, and its return type a promise.
  const async = settled.async && fn.async !== true;
  const printed: FunctionCode = async
    ? {
        ...fn,
        async: true,
        ...(fn.returnType
          ? { returnType: { ...fn.returnType, code: `Promise<${promised(fn)}>` } }
          : {}),
      }
    : { ...fn };
  if (settled.kind !== kind) delete printed.expression;
  return {
    fn: printed,
    declaration: item.form === "declaration",
    parameters: fn.parameters,
    body: settled.code,
    locals: settled.locals,
  };
}

/**
 * Code of a function that takes an event, with Qwik's element argument passed on to the functions
 * it passes its event to that take it (./calls.ts `passElement`).
 */
export function passEvent(
  plan: SetupPlan,
  code: string,
  kind: CodeKind,
  body: Code,
  event: string | undefined,
): string {
  if (event === undefined) return code;
  const callees = new Set(
    eventCallees(body.refs, plan.eventFunctions).flatMap((id) => {
      if (!plan.eventFunctions.get(id)?.element) return [];
      const fn = plan.functions.get(id)!;
      return [fn.form === "both" ? fn.qrl : fn.binding.name];
    }),
  );
  return passElement(code, kind, callees, event, plan.names.once("element"));
}

/**
 * A function's body as statements for a task's callback, which discards what it returns: a block
 * body's statements, or an expression body as a statement. Awaits QRL calls in client code.
 */
function bodyStatements(
  plan: SetupPlan,
  fn: FunctionCode,
  event?: string,
): { code: string; async: boolean } {
  const rewritten = rewriteCode(fn.body, plan.component, plan.rules(event), "client");
  // A task's calls of local functions run in place: an awaited QRL call would leave the rest of
  // the callback until after the tasks Qwik runs next, out of their source order.
  const awaited = clientCode(
    plan,
    rewritten,
    fn.expression ? "expression" : "statements",
    true,
    true,
  );
  const code =
    awaited.kind === "expression"
      ? `${/^(?:\{|function\b|class\b|let\s*\[)/.test(awaited.code) ? `(${awaited.code})` : awaited.code};`
      : awaited.code.trim().slice(1, -1).trim();
  return { code, async: fn.async === true || awaited.async };
}

/**
 * A name for a local the target declares in a task's body (`value`, `last`): `name` itself when
 * the callback's code and parameters leave it free and no binding of the component takes it.
 */
function localName(plan: SetupPlan, name: string, fn: FunctionCode): string {
  const taken =
    uses(fn, name) ||
    fn.parameters.some(
      (parameter) => parameter.name === name || parameter.pattern?.names.includes(name),
    ) ||
    plan.component.bindings.some((binding) => binding.name === name) ||
    plan.component.propsParameter?.name === name;
  return taken ? plan.names.fresh(name) : name;
}

/** Whether a function's body reads one of its parameters, by the names it holds. */
function uses(fn: FunctionCode, name: string): boolean {
  return new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(fn.body.code);
}

/** `track(count)` for a ref, `track(() => title)` for a prop: what a task tracks. */
function tracked(plan: SetupPlan, id: BindingId, track: string): { tracked: string; read: string } {
  const binding = plan.component.bindings.find((candidate) => candidate.id === id)!;
  switch (binding.kind) {
    case "state":
    case "derived":
      return { tracked: `${track}(${binding.name})`, read: `${binding.name}.value` };
    case "prop": {
      const read =
        plan.component.propsParameter?.form === "object"
          ? `${plan.component.propsParameter.name}.${binding.name}`
          : binding.name;
      return { tracked: `${track}(() => ${read})`, read };
    }
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      // The analyser lets a watcher or `watchEffect` read none of them (UF2010, UF2020).
      throw new Error(`A ${binding.kind} is no reactive value a task can track.`);
    case "model":
    case "slots":
    case "slotScope":
    case "context":
    case "component":
      throw new Error(`A ${binding.kind} is not tracked yet.`);
    default:
      return unreachable(binding.kind);
  }
}

/** The ctx parameter of a task: `{ track, cleanup: onCleanup }`, with only what it uses. */
function taskContext(
  plan: SetupPlan,
  options: { track: boolean; cleanup?: string },
): { parameter: string; track: string } {
  const track = plan.names.once("track");
  const parts: string[] = [];
  if (options.track) parts.push(track === "track" ? "track" : `track: ${track}`);
  if (options.cleanup !== undefined) {
    parts.push(options.cleanup === "cleanup" ? "cleanup" : `cleanup: ${options.cleanup}`);
  }
  return { parameter: parts.length ? `{ ${parts.join(", ")} }` : "", track };
}

/** A watcher's statements: see the module comment. */
function watchStatements(plan: SetupPlan, item: WatchItem): Statement[] {
  const { names } = plan;
  // The task with the computed and the signals it reads, together.
  const statements: string[] = [];
  const track = names.once("track");
  const [valueParameter, previousParameter, cleanupParameter] = item.callback.parameters;
  const valueName = valueParameter?.name;
  // Each source as a tracked expression, and as a read for the previous value's start.
  const sources = item.sources.map((source) => {
    if (source.kind === "Ref") return tracked(plan, source.binding, track);
    const single = singleRead(plan, source.getter);
    if (single !== undefined) return tracked(plan, single, track);
    const name = names.fresh(`${valueName ?? "watched"}Source`);
    const getter = printFunction(plan, source.getter, "pure").text;
    statements.push(`const ${name} = ${names.core("useComputed$")}(${getter});`);
    return { tracked: `${track}(${name})`, read: `${name}.value` };
  });
  const reads = sources.map((source) => source.read);
  // An array source's values are a mutable tuple, as Vue gives them to the callback: a function
  // that takes an array takes them (a readonly tuple would fail TS4104).
  const tuple = `[${reads.map((read) => `typeof ${read}`).join(", ")}]`;
  const value = item.array
    ? `[${sources.map((source) => source.tracked).join(", ")}]`
    : sources[0]!.tracked;
  const usesPrevious =
    previousParameter !== undefined &&
    (previousParameter.name === undefined || uses(item.callback, previousParameter.name));
  const cleanup =
    cleanupParameter?.name !== undefined && uses(item.callback, cleanupParameter.name)
      ? cleanupParameter.name
      : undefined;
  const base = previousBase(plan, item, valueName);
  const local = valueName ?? localName(plan, item.array ? "values" : "value", item.callback);
  const lines: string[] = [];
  const valueType =
    valueName !== undefined && valueParameter?.type
      ? `: ${valueParameter.type.code}`
      : item.array
        ? `: ${tuple}`
        : "";
  lines.push(`const ${local}${valueType} = ${value};`);
  const same = (other: string) =>
    item.array
      ? `${local}.every((item, index) => Object.is(item, ${other}[index]))`
      : `Object.is(${local}, ${other})`;
  // The value at the callback's last run: the source's at creation, or, for an immediate watcher,
  // none until its first run, which always calls back.
  const previous = names.fresh(`previous${capitalized(base)}`);
  const useSignal = names.core("useSignal");
  if (item.immediate) {
    const type = item.array ? tuple : `typeof ${reads[0]}`;
    statements.push(`const ${previous} = ${useSignal}<{ value: ${type} }>();`);
    const last = localName(plan, "last", item.callback);
    lines.push(
      `const ${last} = ${previous}.value;`,
      `if (${last} && ${same(`${last}.value`)}) return;`,
      `${previous}.value = { ${local === "value" ? "value" : `value: ${local}`} };`,
    );
    if (usesPrevious && previousParameter) {
      lines.push(
        `const ${parameterBinding(previousParameter)}${previousType(previousParameter)} = ${last}?.value${item.array ? " ?? []" : ""};`,
      );
    }
  } else {
    statements.push(
      item.array
        ? `const ${previous} = ${useSignal}<${tuple}>(() => [${reads.join(", ")}]);`
        : `const ${previous} = ${useSignal}(() => ${reads[0]});`,
    );
    if (usesPrevious && previousParameter) {
      lines.push(
        `const ${parameterBinding(previousParameter)}${previousType(previousParameter)} = ${previous}.value;`,
      );
    }
    const compared =
      usesPrevious && previousParameter?.name !== undefined
        ? previousParameter.name
        : `${previous}.value`;
    lines.push(`if (${same(compared)}) return;`, `${previous}.value = ${local};`);
  }
  if (valueParameter && valueName === undefined) {
    lines.push(`const ${parameterBinding(valueParameter)} = ${local};`);
  }
  // Qwik runs a task's `cleanup` before each of its runs, one that finds its sources unchanged
  // included (a write and its undoing in one handler): a watcher's `onCleanup` callbacks wait in
  // a list for its next callback, and for the component's unmount (ADR-0048).
  let cleanups: string | undefined;
  if (cleanup !== undefined) {
    cleanups = names.fresh(`${base}Cleanups`);
    const noSerialize = names.core("noSerialize");
    statements.push(
      `const ${cleanups} = ${names.core("useConstant")}(() => ${noSerialize}<(() => void)[]>([]));`,
    );
    lines.push(
      `for (const callback of ${cleanups}?.splice(0) ?? []) callback();`,
      `const ${cleanup} = (callback: () => void) => void ${cleanups}?.push(callback);`,
    );
  }
  const body = bodyStatements(plan, item.callback);
  lines.push(floated(body));
  const context = taskContext(plan, { track: true });
  const fn = `(${context.parameter}) => {\n${lines.join("\n")}\n}`;
  statements.push(
    item.post
      ? `${names.core("useVisibleTask$")}(${fn}, { strategy: "document-ready" });`
      : `${names.core("useTask$")}(${fn}, { deferUpdates: false });`,
  );
  if (cleanups !== undefined) {
    const unmount = names.once("cleanup");
    const parameter = unmount === "cleanup" ? "{ cleanup }" : `{ cleanup: ${unmount} }`;
    statements.push(
      `${names.core("useVisibleTask$")}((${parameter}) => {\n${unmount}(() => {\nfor (const callback of ${cleanups}?.splice(0) ?? []) callback();\n});\n}, { strategy: "document-ready" });`,
    );
  }
  return [block(statements.join("\n"))];
}

/**
 * What a watcher's previous value is named after: its one ref or getter's binding
 * (`previousQuery`, `previousTitle`), the callback's value parameter, or `values` for an array.
 */
function previousBase(plan: SetupPlan, item: WatchItem, valueName: string | undefined): string {
  if (item.array) return "values";
  const [source] = item.sources;
  if (source?.kind === "Ref") return bindingName(plan, source.binding);
  if (source?.kind === "Getter") {
    const single = singleRead(plan, source.getter);
    if (single !== undefined) return bindingName(plan, single);
  }
  return valueName ?? "value";
}

function capitalized(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** A parameter's annotation as a local's: `: number`, `: string | undefined` when optional. */
function previousType(parameter: Parameter): string {
  return parameter.type
    ? `: ${parameter.type.code}${parameter.optional ? " | undefined" : ""}`
    : "";
}

/** A parameter's binding as a declaration's left side: its name, or its pattern. */
function parameterBinding(parameter: Parameter): string {
  return parameter.name ?? parameter.pattern!.code;
}

/**
 * The binding a getter reads, when its body is exactly one read of a prop, a state or a derived
 * value (`() => title`, `() => count.value`): a task tracks it as it is, without a computed.
 */
function singleRead(plan: SetupPlan, getter: FunctionCode): BindingId | undefined {
  if (!getter.expression || getter.body.refs.length !== 1) return undefined;
  const [reference] = getter.body.refs;
  if (reference?.kind !== "Binding") return undefined;
  const code = getter.body.code
    .trim()
    .replace(/^\(([\s\S]*)\)$/, "$1")
    .trim();
  const written = getter.body.code.slice(
    reference.span.start - getter.body.span.start,
    reference.span.end - getter.body.span.start,
  );
  if (code !== written) return undefined;
  const kind = plan.component.bindings.find((binding) => binding.id === reference.binding)?.kind;
  return kind !== undefined && isReactive(kind) ? reference.binding : undefined;
}

/**
 * `watchEffect` as a visible task that tracks, before it runs, each prop, state and derived value
 * its body reads, itself or through the functions it calls (static dependencies, ADR-0048). Qwik
 * 2.0.0-beta.47 runs a visible task twice when a task that ran for the same change writes what it
 * tracks (core `executeTasks` queues every dirty visible task each time it runs for the
 * component, and `executeAfterFlush` runs the queue as it is): so, as a watcher does, the effect
 * keeps the values it last ran for and runs only when one changed by `Object.is`, with its
 * `onCleanup` callbacks in a list it empties before it runs again and at unmount (Qwik's own
 * `cleanup` would run before the skipped run too).
 */
function watchEffectCode(plan: SetupPlan, item: WatchEffectItem): string {
  const { names } = plan;
  const track = names.once("track");
  // What the effect hands on to run later (a timer's callback, marked `later`) is not tracked.
  const summary = summarizeTracked(item.effect.body, plan.component);
  const dependencies = [...summary.reads].filter((id) => {
    const kind = plan.component.bindings.find((binding) => binding.id === id)?.kind;
    return kind !== undefined && isReactive(kind);
  });
  const [cleanupParameter] = item.effect.parameters;
  const cleanup =
    cleanupParameter?.name !== undefined && uses(item.effect, cleanupParameter.name)
      ? cleanupParameter.name
      : undefined;
  const body = bodyStatements(plan, item.effect);
  const visibleTask = names.core("useVisibleTask$");
  if (!dependencies.length) {
    // It runs once: nothing tracked can make it run again.
    const context = taskContext(plan, {
      track: false,
      ...(cleanup === undefined ? {} : { cleanup }),
    });
    return `${visibleTask}((${context.parameter}) => {\n${floated(body)}\n}, { strategy: "document-ready" });`;
  }
  const statements: string[] = [];
  const sources = dependencies.map((id) => tracked(plan, id, track));
  const tuple = `[${sources.map((source) => `typeof ${source.read}`).join(", ")}]`;
  const previous = names.fresh("previousEffect");
  const values = localName(plan, "values", item.effect);
  const last = localName(plan, "last", item.effect);
  statements.push(`const ${previous} = ${names.core("useSignal")}<${tuple}>();`);
  const lines = [
    `const ${values}: ${tuple} = [${sources.map((source) => source.tracked).join(", ")}];`,
    `const ${last} = ${previous}.value;`,
    `if (${last} && ${values}.every((item, index) => Object.is(item, ${last}[index]))) return;`,
    `${previous}.value = ${values};`,
  ];
  let cleanups: string | undefined;
  if (cleanup !== undefined) {
    cleanups = names.fresh("effectCleanups");
    const noSerialize = names.core("noSerialize");
    statements.push(
      `const ${cleanups} = ${names.core("useConstant")}(() => ${noSerialize}<(() => void)[]>([]));`,
    );
    lines.push(
      `for (const callback of ${cleanups}?.splice(0) ?? []) callback();`,
      `const ${cleanup} = (callback: () => void) => void ${cleanups}?.push(callback);`,
    );
  }
  lines.push(floated(body));
  const context = taskContext(plan, { track: true });
  statements.push(
    `${visibleTask}((${context.parameter}) => {\n${lines.join("\n")}\n}, { strategy: "document-ready" });`,
  );
  if (cleanups !== undefined) {
    const unmount = names.once("cleanup");
    const parameter = unmount === "cleanup" ? "{ cleanup }" : `{ cleanup: ${unmount} }`;
    statements.push(
      `${visibleTask}((${parameter}) => {\n${unmount}(() => {\nfor (const callback of ${cleanups}?.splice(0) ?? []) callback();\n});\n}, { strategy: "document-ready" });`,
    );
  }
  return statements.join("\n");
}

/**
 * An async callback's body in a task: it goes on by itself, `void (async () => {…})()`, so the
 * task is done after its synchronous part (its `onCleanup` calls included). Qwik runs a task
 * again only once its last run has settled (core `runTask`), so a task that awaits would queue a
 * new change behind its pending run, where the source runs the cleanup and the callback at once
 * (ADR-0048).
 */
function floated(body: { code: string; async: boolean }): string {
  return body.async ? `void (async () => {\n${body.code}\n})();` : body.code;
}

/** `onMounted` and `onUnmounted` as visible tasks (see the module comment). */
function lifecycleCode(plan: SetupPlan, item: LifecycleItem): string {
  const { names } = plan;
  const visibleTask = names.core("useVisibleTask$");
  if (item.hook === "mounted") {
    const body = bodyStatements(plan, item.callback);
    return `${visibleTask}(${body.async ? "async " : ""}() => {\n${body.code}\n}, { strategy: "document-ready" });`;
  }
  // The cleanup discards what the callback returns: its body as statements, its calls in place.
  const cleanup = names.once("cleanup");
  const body = bodyStatements(plan, item.callback);
  const context = cleanup === "cleanup" ? "{ cleanup }" : `{ cleanup: ${cleanup} }`;
  return `${visibleTask}((${context}) => {\n${cleanup}(${body.async ? "async " : ""}() => {\n${body.code}\n});\n}, { strategy: "document-ready" });`;
}
