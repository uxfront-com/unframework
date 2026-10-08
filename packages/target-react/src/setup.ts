// The setup in React (ADR-0046, ADR-0048): each item in source order, as React's hooks. State is
// `useState` with a mirror ref where client code writes it; a `computed` is `useMemo` with every
// dependency, and a live getter where client code reads it; a template ref and a setup `let` are
// `useRef`; an id is `useId` with the `uf-id-` prefix; a setup `const` evaluates once
// (`useState`), or moves to module scope with the functions that capture nothing of the
// component. Watchers, `watchEffect` and lifecycle hooks are effects that call an effect event
// (`useEffectEvent`), which runs the author's code with the latest values; each runs only in the
// browser, after React has rendered (ADR-0048).
import { parseCodeSource, pascalCase } from "@unframework/codegen";
import type { RewriteSite } from "@unframework/codegen";
import { codeOf, summarizeCode, summarizeTracked } from "@unframework/ir";
import type {
  BindingId,
  Code,
  DerivedItem,
  FunctionCode,
  FunctionItem,
  LifecycleItem,
  Parameter,
  SetupItem,
  StateItem,
  WatchEffectItem,
  WatchItem,
  WatchSource,
} from "@unframework/ir";

import { reactEventType } from "./events.ts";
import { reactive } from "./plan.ts";
import type { ListenerMode, ReactPlan } from "./plan.ts";
import type { ReactCode } from "./rules.ts";

/** The setup's statements: at module scope, and in the component's body before its return. */
export interface PrintedSetup {
  module: string[];
  body: BodyStatement[];
}

/**
 * A statement of the component's body, with what it belongs to: a blank line separates two
 * statements of different groups, unless both are compact (one-line declarations), as a person
 * lays out a component: its state together, then each function and effect apart.
 */
export interface BodyStatement {
  text: string;
  group: number;
  compact: boolean;
}

/** The type of the `onCleanup` a watcher's callback or an effect receives. */
const ON_CLEANUP_TYPE = "(cleanup: () => void) => void";

/** Prints the setup of a planned component. */
export function printSetup(plan: ReactPlan, code: ReactCode): PrintedSetup {
  const printed: PrintedSetup = { module: [], body: [] };
  const hook = (name: string) => plan.names.add("react", name);
  let group = 0;

  // Props deferred code reads: a mirror each, synced after every render, before any effect.
  const mirrors: [string, string][] = [];
  for (const prop of plan.component.props) {
    const mirror = prop.binding && plan.propMirrors.get(prop.binding);
    if (mirror) mirrors.push([mirror, propRead(plan, prop.binding!)]);
  }
  for (const event of plan.events.values()) {
    if (event.mirror) mirrors.push([event.mirror, event.local]);
  }
  if (mirrors.length) {
    const useRef = hook("useRef");
    for (const [mirror, value] of mirrors) {
      printed.body.push({ text: `const ${mirror} = ${useRef}(${value});`, group, compact: false });
    }
    const sync = mirrors.map(([mirror, value]) => `${mirror}.current = ${value};`).join("\n");
    printed.body.push({
      text: `${hook("useLayoutEffect")}(() => {\n${sync}\n});`,
      group,
      compact: false,
    });
  }

  for (const item of declarationOrder(plan)) {
    // `nextTick` after the state its `settled` reads, before what calls it: React Compiler and
    // `react/immutability` reject a read before a declaration.
    if (item === NEXT_TICK) {
      group++;
      printed.body.push({ text: nextTickDeclaration(plan), group, compact: true });
      continue;
    }
    let previous: string | undefined;
    for (const [scope, text, part = "main"] of printItem(plan, code, item)) {
      if (scope === "module") {
        printed.module.push(text);
        continue;
      }
      if (part !== previous) group++;
      previous = part;
      printed.body.push({ text, group, compact: COMPACT.has(item.kind) && part === "main" });
    }
  }
  return printed;
}

/**
 * The setup's items in the order the component declares them: the source's, but for an item
 * that reads a binding declared after it (a call of a `function` declared further down, which
 * the source may make, declarations being hoisted), which follows that declaration. React
 * Compiler and `react/immutability` reject a read before the declaration, in a nested
 * function too. Watchers, effects and hooks keep their source order among themselves.
 */
function declarationOrder(plan: ReactPlan): (SetupItem | typeof NEXT_TICK)[] {
  const items = plan.component.setup;
  // What moves to module scope is declared before the component.
  const declared = new Map<BindingId, number>();
  for (const [index, item] of items.entries()) {
    if ("binding" in item && !plan.hoisted.has(item.binding)) declared.set(item.binding, index);
  }
  // `nextTick`'s declaration is one more item: it reads the state its `settled` compares, and
  // every item that calls it reads it.
  const tick = items.length;
  const needs = [...items, undefined].map(() => new Set<number>());
  const need = (index: number, binding: BindingId) => {
    const at = declared.get(binding);
    if (at !== undefined && at !== index) needs[index]!.add(at);
  };
  for (const id of tickStates(plan)) need(tick, id);
  for (const { code, path } of codeOf(plan.component)) {
    const index = /^\/setup\/(\d+)\//.exec(path)?.[1];
    if (index === undefined) continue;
    for (const reference of code.refs) {
      if (reference.kind === "Binding" || reference.kind === "Write") {
        need(Number(index), reference.binding);
      } else if (reference.kind === "Api") {
        needs[Number(index)]!.add(tick);
      }
    }
  }
  // Where a pre watcher writes state, post watchers and `watchEffect` wait for its writes to
  // render (`settled`): their effects, and `onMounted`'s among them in source order, follow every
  // pre watcher's, as Vue runs pre watchers during the setup and before each render, and post
  // effects and hooks after it. `onUnmounted` follows every other effect: Vue stops the watchers
  // and effects, running their cleanups, before it calls the hook. Otherwise effects keep their
  // source order.
  const settles = unrenderedWrites(plan).length > 0;
  const unmounted = (item: SetupItem) => item.kind === "Lifecycle" && item.hook === "unmounted";
  const post = (item: SetupItem) =>
    settles &&
    ((item.kind === "Watch" && item.post === true) ||
      item.kind === "WatchEffect" ||
      (item.kind === "Lifecycle" && !unmounted(item)));
  const chains = new Map<string, number>();
  const pre: number[] = [];
  const effects: number[] = [];
  for (const [index, item] of items.entries()) {
    if (item.kind === "Watch") {
      for (const source of item.sources) if (source.kind === "Ref") need(index, source.binding);
    }
    if (item.kind === "Watch" || item.kind === "WatchEffect" || item.kind === "Lifecycle") {
      const chain = unmounted(item) ? "unmounted" : post(item) ? "post" : "pre";
      const after = chains.get(chain);
      if (after !== undefined) needs[index]!.add(after);
      chains.set(chain, index);
      if (item.kind === "Watch" && !post(item)) pre.push(index);
      if (!unmounted(item)) effects.push(index);
    }
  }
  for (const [index, item] of items.entries()) {
    if (post(item)) for (const other of pre) needs[index]!.add(other);
    if (unmounted(item)) for (const other of effects) needs[index]!.add(other);
  }
  // The functions of a cycle are declared together (`functionCycles`): after what any of them
  // reads, and before what reads any of them.
  const groups = new Map<number, number[]>();
  for (const members of new Set(functionCycles(plan).values())) {
    const indices = members.map((id) => declared.get(id)!);
    const combined = new Set(indices.flatMap((index) => [...needs[index]!]));
    for (const index of indices) combined.delete(index);
    for (const index of indices) {
      needs[index] = new Set(combined);
      groups.set(index, indices);
    }
  }
  const order: (SetupItem | typeof NEXT_TICK)[] = [];
  const done = new Set<number>();
  // `nextTick` as early as it can be, then the items in source order.
  const candidates = [...(plan.nextTick ? [tick] : []), ...items.keys()];
  while (done.size < candidates.length) {
    const ready = (index: number) => [...needs[index]!].every((other) => done.has(other));
    let next = candidates.find((index) => !done.has(index) && ready(index));
    // A cycle (local functions do not call each other in a loop, UF2024) keeps the source's order.
    next ??= candidates.find((index) => !done.has(index))!;
    const group = groups.get(next) ?? [next];
    for (const index of group) done.add(index);
    order.push(next === tick ? NEXT_TICK : items[Math.min(...group)]!);
  }
  return order;
}

/**
 * The local functions that refer to each other in a cycle, each by member, in source order: a
 * function passed as a value, which is one function for the instance's life (`useState`), and
 * those that refer back to it, such as a listener that removes itself through a helper. React
 * Compiler and `react/immutability` reject a read before its declaration, in a nested function
 * too, and no order of a cycle avoids one: its functions are declared in one `useState`
 * initializer, which returns them (`printCycle`). The function passed as a value reaches each of
 * them, so they read what changes through mirrors already (ADR-0046), and keeping the first
 * render's is right. A cycle with a function a template calls keeps its order.
 */
function functionCycles(plan: ReactPlan): Map<BindingId, BindingId[]> {
  const functions = new Map<BindingId, FunctionItem>();
  for (const item of plan.component.setup) {
    if (item.kind === "Function" && !plan.hoisted.has(item.binding)) {
      functions.set(item.binding, item);
    }
  }
  const edges = new Map<BindingId, BindingId[]>();
  for (const [id, item] of functions) {
    const fn = item.function;
    const refs = [fn.body, ...fn.parameters.flatMap((parameter) => parameter.default ?? [])];
    edges.set(id, [
      ...new Set(
        refs.flatMap((code) =>
          code.refs.flatMap((reference) =>
            reference.kind === "Binding" && functions.has(reference.binding)
              ? [reference.binding]
              : [],
          ),
        ),
      ),
    ]);
  }
  // Tarjan's strongly connected components, visited in source order (P8).
  const found = new Map<BindingId, BindingId[]>();
  const index = new Map<BindingId, number>();
  const low = new Map<BindingId, number>();
  const stack: BindingId[] = [];
  const connect = (id: BindingId): void => {
    index.set(id, index.size);
    low.set(id, index.get(id)!);
    stack.push(id);
    for (const next of edges.get(id)!) {
      if (!index.has(next)) {
        connect(next);
        low.set(id, Math.min(low.get(id)!, low.get(next)!));
      } else if (stack.includes(next)) {
        low.set(id, Math.min(low.get(id)!, index.get(next)!));
      }
    }
    if (low.get(id) !== index.get(id)) return;
    const members: BindingId[] = [];
    for (let member = stack.pop()!; ; member = stack.pop()!) {
      members.push(member);
      if (member === id) break;
    }
    const kept = members.every(
      (member) => !plan.renderFunctions.has(member) && !plan.clientVariants.has(member),
    );
    if (members.length < 2 || !kept) return;
    const ordered = [...functions.keys()].filter((member) => members.includes(member));
    for (const member of ordered) found.set(member, ordered);
  };
  for (const id of functions.keys()) if (!index.has(id)) connect(id);
  return found;
}

/** Where `nextTick`'s declaration goes among the setup's items. */
const NEXT_TICK = Symbol("nextTick");

/**
 * The state the component's effects write (watchers, `watchEffect`, lifecycle hooks, and the
 * functions they call), which client code writes through a mirror: React renders such a write in
 * a later task than the code that triggered the effect, and `nextTick` waits for it.
 */
function tickStates(plan: ReactPlan): BindingId[] {
  if (!plan.nextTick) return [];
  const written = new Set<BindingId>();
  for (const item of plan.component.setup) {
    const fn =
      item.kind === "Watch" || item.kind === "Lifecycle"
        ? item.callback
        : item.kind === "WatchEffect"
          ? item.effect
          : undefined;
    if (!fn) continue;
    for (const id of summarizeCode(fn.body, plan.component).writes) {
      if (plan.state.get(id)?.mirror) written.add(id);
    }
  }
  return plan.component.bindings.flatMap((binding) =>
    written.has(binding.id) ? [binding.id] : [],
  );
}

/**
 * `const nextTick = useNextTick();`, with what tells it the effects' writes have rendered:
 * `useNextTick(() => Object.is(resultsRef.current, results))`.
 */
function nextTickDeclaration(plan: ReactPlan): string {
  const rendered = tickStates(plan).map((id) => {
    const state = plan.state.get(id)!;
    return `Object.is(${state.mirror!}.current, ${state.name})`;
  });
  const argument = rendered.length ? `() => ${rendered.join(" && ")}` : "";
  return `const ${plan.nextTick!} = ${plan.helpers.nextTick!}(${argument});`;
}

/**
 * The state pre watchers write, themselves or through the functions they call: a post watcher
 * or a `watchEffect` waits while one of their mirrors holds a value React has not rendered.
 */
function unrenderedWrites(plan: ReactPlan): BindingId[] {
  const items = plan.component.setup;
  if (!items.some((item) => (item.kind === "Watch" && item.post) || item.kind === "WatchEffect")) {
    return [];
  }
  const written = new Set<BindingId>();
  for (const item of items) {
    if (item.kind !== "Watch" || item.post) continue;
    for (const id of summarizeCode(item.callback.body, plan.component).writes) {
      if (plan.state.get(id)?.mirror) written.add(id);
    }
  }
  return plan.component.bindings.flatMap((binding) =>
    written.has(binding.id) ? [binding.id] : [],
  );
}

/**
 * The first statements of a post watcher's or a `watchEffect`'s effect where a pre watcher writes
 * state, and its dependencies: while a write has not rendered, it asks for a render of its own and
 * returns, and runs again once the state, or its count of waits, has rendered, as Vue runs post
 * effects after the render that holds what pre watchers wrote. The render of its own makes that
 * commit certain: a pre watcher's writes may end where they were (a flag set around an `await`),
 * and React then commits nothing for them. A comparison with the values of its last call keeps the
 * extra runs from calling back, and its cleanups wait in a ref for its next call or the unmount
 * (`gatedCall`). The first gated effect declares the count (`const [waits, setWaits] =
 * useState(0);`).
 */
function settled(
  plan: ReactPlan,
  printed: Printed,
): { lines: string[]; deps: string[] } | undefined {
  const written = unrenderedWrites(plan);
  if (!written.length) return undefined;
  let waits = WAITS.get(plan);
  if (!waits) {
    waits = { value: plan.names.claim("waits"), setter: plan.names.claim("setWaits") };
    WAITS.set(plan, waits);
    const useState = plan.names.add("react", "useState");
    printed.push(["body", `const [${waits.value}, ${waits.setter}] = ${useState}(0);`]);
  }
  const pairs = written.map((id) => {
    const state = plan.state.get(id)!;
    return { mirror: `${state.mirror!}.current`, value: state.name };
  });
  const differs = pairs.map(({ mirror, value }) => `!Object.is(${mirror}, ${value})`).join(" || ");
  return {
    lines: [`if (${differs}) {`, `${waits.setter}(${waits.value} + 1);`, "return;", "}"],
    deps: [...pairs.map(({ value }) => value), waits.value],
  };
}

/** The count of waits of each component with gated effects, once it is declared. */
const WAITS = new WeakMap<ReactPlan, { value: string; setter: string }>();

/** The items whose declaration is one line: they sit together, without blank lines. */
const COMPACT = new Set<SetupItem["kind"]>([
  "State",
  "Derived",
  "TemplateRef",
  "Id",
  "Const",
  "Variable",
]);

/**
 * Where a printed statement goes, its text, and the part of its item it is: a live getter or a
 * client variant stands apart from the declaration it goes with.
 */
type Printed = ["module" | "body", string, string?][];

function printItem(plan: ReactPlan, code: ReactCode, item: SetupItem): Printed {
  const hook = (name: string) => plan.names.add("react", name);
  const name = (id: BindingId) => plan.bindings.get(id)!.name;
  switch (item.kind) {
    case "State":
      return printState(plan, code, item);
    case "Derived":
      return printDerived(plan, code, item);
    case "TemplateRef": {
      const type = templateRefType(plan, item.binding);
      return [["body", `const ${name(item.binding)} = ${hook("useRef")}<${type}>(null);`]];
    }
    case "Id":
      return [["body", `const ${name(item.binding)} = \`uf-id-\${${hook("useId")}()}\`;`]];
    case "Const": {
      const value = code.code(item.value, "pure");
      if (plan.hoisted.has(item.binding)) {
        const type = item.type ? `: ${item.type.code}` : "";
        return [["module", `const ${name(item.binding)}${type} = ${value};`]];
      }
      // Evaluated once, when the component first renders (ADR-0046), as `useState`'s initial value.
      const type = item.type ? `<${item.type.code}>` : "";
      return [
        ["body", `const [${name(item.binding)}] = ${hook("useState")}${type}(${once(value)});`],
      ];
    }
    case "Variable": {
      const initial = item.initial ? code.code(item.initial, "pure") : "undefined";
      const type = item.type
        ? `<${item.initial || /\bundefined\b/.test(item.type.code) ? item.type.code : `${item.type.code} | undefined`}>`
        : "";
      return [["body", `const ${name(item.binding)} = ${hook("useRef")}${type}(${initial});`]];
    }
    case "Function": {
      const cycle = functionCycles(plan).get(item.binding);
      return cycle ? printCycle(plan, code, cycle) : printFunction(plan, code, item);
    }
    case "Watch":
      return printWatch(plan, code, item);
    case "WatchEffect":
      return printWatchEffect(plan, code, item);
    case "Lifecycle":
      return printLifecycle(plan, code, item);
    // Composition (ADR-0055) is not emitted yet: `emit` reports UF1002 before this runs.
    case "Model":
    case "Provide":
    case "Inject":
      return [];
    default:
      return item satisfies never;
  }
}

function printState(plan: ReactPlan, code: ReactCode, item: StateItem): Printed {
  const state = plan.state.get(item.binding)!;
  const useState = plan.names.add("react", "useState");
  const type = item.type ? `<${item.type.code}>` : "";
  const initial = item.initial ? once(code.code(item.initial, "pure")) : "";
  const pattern = state.setter ? `[${state.name}, ${state.setter}]` : `[${state.name}]`;
  const printed: Printed = [["body", `const ${pattern} = ${useState}${type}(${initial});`]];
  if (state.mirror) {
    const useRef = plan.names.add("react", "useRef");
    printed.push(["body", `const ${state.mirror} = ${useRef}(${state.name});`]);
  }
  return printed;
}

function printDerived(plan: ReactPlan, code: ReactCode, item: DerivedItem): Printed {
  const derived = plan.derived.get(item.binding)!;
  const printed: Printed = [];
  // The memo only where render code reads it: client code calls the live getter.
  if (derived.memo) {
    const useMemo = plan.names.add("react", "useMemo");
    const type = item.type ? `<${item.type.code}>` : "";
    const getter = code.fn(item.getter, "pure");
    const deps = dependencies(plan, item.getter.body).join(", ");
    printed.push(["body", `const ${derived.name} = ${useMemo}${type}(${getter}, [${deps}]);`]);
  }
  if (derived.current) {
    // What client code reads: the getter over the mirrors, so a read right after a write sees it
    // (ADR-0046), before React renders the memo again.
    const typed =
      item.type && !item.getter.returnType
        ? { ...item.getter, returnType: { code: item.type.code, span: item.type.span } }
        : item.getter;
    printed.push(["body", code.fn(typed, "client", { name: derived.current }), "current"]);
  }
  return printed;
}

function printFunction(plan: ReactPlan, code: ReactCode, item: FunctionItem): Printed {
  const { name } = plan.bindings.get(item.binding)!;
  const fn = withEventTypes(plan, item.function, plan.eventModes.get(item.binding));
  const hoisted = plan.hoisted.has(item.binding);
  const scope = hoisted ? "module" : "body";
  const site: RewriteSite = plan.renderFunctions.has(item.binding) ? "pure" : "client";
  const variant = plan.clientVariants.get(item.binding);
  // A function passed as a value (a listener added and removed, a timer's callback) is one
  // function for the instance's life, as the setup's are on Vue: declared once (`useState`), it
  // keeps the first render's closure, and reads what changes through mirrors (ADR-0046).
  const once = !hoisted && plan.summaries.get(item.binding)?.escapes === true;
  const print = (local: string, at: RewriteSite, stable = false) =>
    stable
      ? `const [${local}] = ${plan.names.add("react", "useState")}(() => ${code.fn(fn, at)});`
      : item.form === "declaration"
        ? code.fn(fn, at, { name: local })
        : `const ${local} = ${code.fn(fn, at)};`;
  const printed: Printed = [[scope, print(name, site, once && !variant)]];
  if (variant) printed.push(["body", print(variant, "client", once), "variant"]);
  return printed;
}

/**
 * The functions of a cycle (`functionCycles`), declared in one `useState` initializer for the
 * instance's life: `const [{ close, onEscape }] = useState(() => { … return { close, onEscape };
 * });`.
 */
function printCycle(plan: ReactPlan, code: ReactCode, members: readonly BindingId[]): Printed {
  const names = members.map((id) => plan.bindings.get(id)!.name);
  const declarations = members.map((id, at) => {
    const item = plan.component.setup.find(
      (entry): entry is FunctionItem => entry.kind === "Function" && entry.binding === id,
    )!;
    const fn = withEventTypes(plan, item.function, plan.eventModes.get(id));
    return item.form === "declaration"
      ? code.fn(fn, "client", { name: names[at]! })
      : `const ${names[at]!} = ${code.fn(fn, "client")};`;
  });
  const useState = plan.names.add("react", "useState");
  const returned = `return { ${names.join(", ")} };`;
  return [
    [
      "body",
      `const [{ ${names.join(", ")} }] = ${useState}(() => {\n${[...declarations, returned].join("\n\n")}\n});`,
    ],
  ];
}

/** One watch source: the value React compares, what names it, and its type. */
interface Source {
  value: string;
  base: string;
}

function printWatch(plan: ReactPlan, code: ReactCode, item: WatchItem): Printed {
  const hook = (name: string) => plan.names.add("react", name);
  const printed: Printed = [];
  const callback = item.callback;
  const sources = item.sources.map((source, index) =>
    watchSource(plan, code, source, callback, item.array ? index : undefined, printed),
  );
  const values = sources.map((source) => source.value);
  const base = pascalCase(sources.map((source) => source.base).join("-"));
  const value = item.array ? `[${values.join(", ")}]` : values[0]!;
  const valueType = item.array
    ? `[${values.map((entry) => `typeof ${entry}`).join(", ")}]`
    : `typeof ${values[0]!}`;
  const previousType = item.immediate
    ? item.array
      ? `${valueType} | []`
      : `${valueType} | undefined`
    : valueType;

  // The callback's parameters that the source leaves to inference are typed from its sources:
  // an effect event has no context to infer them from (TS7006).
  const typed = typedParameters(callback, [valueType, previousType, ON_CLEANUP_TYPE]);

  // A post watcher is never immediate (UF2013): its comparison keeps the gate's extra runs from
  // calling back.
  const settle = item.post ? settled(plan, printed) : undefined;
  // The value at the watcher's last callback, or when it was created (ADR-0048).
  const count = callback.parameters.length;
  const keepsPrevious = !item.immediate || count >= 2;
  const previousRef = keepsPrevious ? plan.names.claim(`previous${base}`) : undefined;
  if (previousRef) {
    const initial = item.immediate ? (item.array ? "[]" : "undefined") : value;
    const type = item.immediate || item.array ? `<${previousType}>` : "";
    printed.push(["body", `const ${previousRef} = ${hook("useRef")}${type}(${initial});`]);
  }
  const cleanupsRef = settle && count >= 3 ? plan.names.claim(`${camel(base)}Cleanups`) : undefined;
  if (cleanupsRef) printed.push(["body", cleanupsDeclaration(plan, cleanupsRef)]);
  const event = plan.names.claim(`on${base}Change`);
  printed.push([
    "body",
    `const ${event} = ${hook("useEffectEvent")}(${code.fn(typed, "client")});`,
  ]);

  const local = locals(
    [...values, event, previousRef ?? "", cleanupsRef ?? "", "Object"],
    ["previous", "cleanups", "cleanup"],
  );
  const lines: string[] = [];
  if (settle) lines.push(...settle.lines);
  if (previousRef) {
    lines.push(`const ${local.previous} = ${previousRef}.current;`);
    if (!item.immediate) {
      // On mount the value is the one it was created with: no callback, as on Vue.
      const same = item.array
        ? values
            .map((entry, index) => `Object.is(${local.previous}[${index}], ${entry})`)
            .join(" && ")
        : `Object.is(${local.previous}, ${value})`;
      lines.push(`if (${same}) return;`);
    }
    lines.push(`${previousRef}.current = ${value};`);
  }
  const deps = `, [${[...new Set([...values, ...(settle?.deps ?? [])])].join(", ")}]`;
  if (cleanupsRef) {
    lines.push(...gatedCall(event, [value, local.previous, ""], cleanupsRef, local));
    printed.push(["body", `${hook("useEffect")}(() => {\n${lines.join("\n")}\n}${deps});`]);
    printed.push(["body", unmountEffect(plan, [], cleanupsRef, local)]);
    return printed;
  }
  const args = [
    value,
    local.previous,
    `(${local.cleanup}) => void ${local.cleanups}.push(${local.cleanup})`,
  ];
  lines.push(...callWithCleanup(event, args.slice(0, count), count >= 3, local));
  printed.push(["body", `${hook("useEffect")}(() => {\n${lines.join("\n")}\n}${deps});`]);
  return printed;
}

/**
 * A watch source as the value React compares: a state, a derived value or a prop as it is (a
 * getter that only reads one), and any other getter through a memo, which React recomputes when
 * what it reads changes, as Vue re-runs the getter.
 */
function watchSource(
  plan: ReactPlan,
  code: ReactCode,
  source: WatchSource,
  callback: FunctionCode,
  index: number | undefined,
  printed: Printed,
): Source {
  if (source.kind === "Ref") {
    const binding = plan.bindings.get(source.binding)!;
    return { value: renderRead(plan, source.binding), base: binding.name };
  }
  const { getter } = source;
  const [only] = getter.body.refs;
  if (
    getter.expression &&
    getter.body.refs.length === 1 &&
    only?.kind === "Binding" &&
    only.span.start === getter.body.span.start &&
    only.span.end === getter.body.span.end
  ) {
    const binding = plan.bindings.get(only.binding)!;
    if (reactive(binding.kind)) {
      return { value: code.code(getter.body, "pure"), base: binding.name };
    }
  }
  const [first] = callback.parameters;
  const base = index === undefined && first?.name ? first.name : "value";
  const memo = plan.names.claim(`watched${pascalCase(base)}`);
  const deps = dependencies(plan, getter.body).join(", ");
  printed.push([
    "body",
    `const ${memo} = ${plan.names.add("react", "useMemo")}(${code.fn(getter, "pure")}, [${deps}]);`,
  ]);
  return { value: memo, base };
}

function printWatchEffect(plan: ReactPlan, code: ReactCode, item: WatchEffectItem): Printed {
  const hook = (name: string) => plan.names.add("react", name);
  const { effect } = item;
  // Its dependencies are what it reads, unconditionally (UF2015): React runs it after the first
  // render and again when one changes, as an immediate watcher of them (ADR-0048).
  const reads = reactiveReads(plan, effect.body);
  const base = reads.length
    ? pascalCase(reads.map((id) => plan.bindings.get(id)!.name).join("-"))
    : "";
  const event = plan.names.claim(reads.length ? `on${base}Change` : "onEffect");
  // The effect event takes the values it reads, which the effect passes: its body reads them as
  // its parameters, so the effect lists exactly what it reads. A value only a function it calls
  // reads is passed too, so the effect still reads it (`exhaustive-effect-dependencies` rejects
  // a dependency the effect does not read), under a name that says the body leaves it (`_unit`).
  const own = ownReads(plan, effect.body);
  const overrides = new Map<BindingId, string>();
  const parameters: Parameter[] = reads.map((id) => {
    const { name } = plan.bindings.get(id)!;
    const local = plan.names.claim(own.has(id) ? `${name}Value` : `_${name}`);
    if (own.has(id)) overrides.set(id, local);
    return {
      name: local,
      type: { code: `typeof ${renderRead(plan, id)}`, span: effect.span },
      span: effect.span,
    };
  });
  const [cleanup] = effect.parameters;
  const typed: FunctionCode = {
    ...effect,
    parameters: [
      ...parameters,
      ...(cleanup
        ? [
            cleanup.type
              ? cleanup
              : { ...cleanup, type: { code: ON_CLEANUP_TYPE, span: cleanup.span } },
          ]
        : []),
    ],
  };
  const values = reads.map((id) => renderRead(plan, id));
  const printed: Printed = [];
  // Where a pre watcher writes state, it waits for the writes to render, as a post watcher does,
  // and calls back only with values other than its last call's.
  const settle = settled(plan, printed);
  const name = reads.length ? base : "Effect";
  const previousRef = settle ? plan.names.claim(`previous${name}`) : undefined;
  if (previousRef) {
    const type = `[${values.map((value) => `typeof ${value}`).join(", ")}] | undefined`;
    printed.push(["body", `const ${previousRef} = ${hook("useRef")}<${type}>(undefined);`]);
  }
  const cleanupsRef = settle && cleanup ? plan.names.claim(`${camel(name)}Cleanups`) : undefined;
  if (cleanupsRef) printed.push(["body", cleanupsDeclaration(plan, cleanupsRef)]);
  printed.push([
    "body",
    `const ${event} = ${hook("useEffectEvent")}(${code.fn(typed, "client", {}, overrides)});`,
  ]);
  const local = locals(
    [...values, event, previousRef ?? "", cleanupsRef ?? "", "Object"],
    ["previous", "cleanups", "cleanup"],
  );
  if (settle && previousRef) {
    const same = values.map((value, index) => `Object.is(${local.previous}[${index}], ${value})`);
    const lines = [
      ...settle.lines,
      `const ${local.previous} = ${previousRef}.current;`,
      `if (${[local.previous, ...same].join(" && ")}) return;`,
      `${previousRef}.current = [${values.join(", ")}];`,
      ...gatedCall(event, [...values, ...(cleanup ? [""] : [])], cleanupsRef, local),
    ];
    const deps = [...new Set([...values, ...settle.deps])].join(", ");
    printed.push(["body", `${hook("useEffect")}(() => {\n${lines.join("\n")}\n}, [${deps}]);`]);
    if (cleanupsRef) {
      const resets = [`${previousRef}.current = undefined;`];
      printed.push(["body", unmountEffect(plan, resets, cleanupsRef, local)]);
    }
    return printed;
  }
  const args = [
    ...values,
    ...(cleanup ? [`(${local.cleanup}) => void ${local.cleanups}.push(${local.cleanup})`] : []),
  ];
  const lines = callWithCleanup(event, args, cleanup !== undefined, local);
  printed.push([
    "body",
    `${hook("useEffect")}(() => {\n${lines.join("\n")}\n}, [${values.join(", ")}]);`,
  ]);
  return printed;
}

function printLifecycle(plan: ReactPlan, code: ReactCode, item: LifecycleItem): Printed {
  const hook = (name: string) => plan.names.add("react", name);
  const mounted = item.hook === "mounted";
  const event = plan.names.claim(mounted ? "onMount" : "onUnmount");
  const effect = mounted ? `() => {\n${event}();\n}` : `() => () => ${event}()`;
  return [
    ["body", `const ${event} = ${hook("useEffectEvent")}(${code.fn(item.callback, "client")});`],
    ["body", `${hook("useEffect")}(${effect}, []);`],
  ];
}

/**
 * The call of an effect event from its effect, with the cleanups its callback registers run
 * before the next call and when the component unmounts (ADR-0048).
 */
function callWithCleanup(
  event: string,
  args: string[],
  cleans: boolean,
  local: Record<"cleanups" | "cleanup", string>,
): string[] {
  if (!cleans) return [`${event}(${args.join(", ")});`];
  return [
    `const ${local.cleanups}: (() => void)[] = [];`,
    `${event}(${args.join(", ")});`,
    `return () => {\nfor (const ${local.cleanup} of ${local.cleanups}) ${local.cleanup}();\n};`,
  ];
}

/**
 * The call of a gated effect's event (`settled`): the cleanups its last call registered, kept in
 * a ref, run right before it, as Vue runs them before the callback runs again. The effect returns
 * nothing: React runs an effect's cleanup before every run, the gated ones that call nothing too.
 */
function gatedCall(
  event: string,
  args: string[],
  cleanups: string | undefined,
  local: Record<"cleanups" | "cleanup", string>,
): string[] {
  if (!cleanups) return [`${event}(${args.join(", ")});`];
  const onCleanup = `(${local.cleanup}) => void ${cleanups}.current.push(${local.cleanup})`;
  return [
    `for (const ${local.cleanup} of ${cleanups}.current.splice(0)) ${local.cleanup}();`,
    `${event}(${[...args.slice(0, -1), onCleanup].join(", ")});`,
  ];
}

/** The ref of a gated effect's cleanups, `const queryCleanups = useRef<(() => void)[]>([]);`. */
function cleanupsDeclaration(plan: ReactPlan, name: string): string {
  return `const ${name} = ${plan.names.add("react", "useRef")}<(() => void)[]>([]);`;
}

/**
 * The effect that runs a gated effect's cleanups when the component unmounts, after `resets`,
 * which forget its last call, so StrictMode's second mount calls back as the first did.
 */
function unmountEffect(
  plan: ReactPlan,
  resets: string[],
  cleanups: string,
  local: Record<"cleanup", string>,
): string {
  const lines = [
    ...resets,
    `for (const ${local.cleanup} of ${cleanups}.current.splice(0)) ${local.cleanup}();`,
  ];
  const useEffect = plan.names.add("react", "useEffect");
  return `${useEffect}(\n() => () => {\n${lines.join("\n")}\n},\n[],\n);`;
}

/** `queryCleanups` from `Query`. */
function camel(base: string): string {
  return base.charAt(0).toLowerCase() + base.slice(1);
}

/** The callback's parameters, each the source leaves untyped typed with `types` in order. */
function typedParameters(fn: FunctionCode, types: readonly string[]): FunctionCode {
  return {
    ...fn,
    parameters: fn.parameters.map((parameter, index) => {
      const type = types[index];
      return parameter.type || type === undefined
        ? parameter
        : { ...parameter, type: { code: type, span: parameter.span } };
    }),
  };
}

/**
 * A function with its event parameter typed as React passes it: React's synthetic event type for
 * a listener React dispatches (a DOM annotation fails L4, TS2322), the DOM's for a native one,
 * and both for a function that handles both.
 */
export function withEventTypes(
  plan: ReactPlan,
  fn: FunctionCode,
  modes: ReadonlySet<ListenerMode> | undefined,
  inline = false,
): FunctionCode {
  // A handler written in place is typed by its prop, or by `listen`, where the source leaves it.
  const typed = (parameter: Parameter) => parameter.event && !(inline && !parameter.type);
  if (!fn.parameters.some(typed)) return fn;
  return {
    ...fn,
    parameters: fn.parameters.map((parameter) => {
      if (!typed(parameter)) return parameter;
      const type = eventParameterType(plan, parameter, modes ?? new Set(["synthetic"]));
      const span = parameter.type?.span ?? parameter.span;
      return type === parameter.type?.code
        ? parameter
        : { ...parameter, type: { code: type, span } };
    }),
  };
}

/** The annotation of an event parameter for the ways its events reach it. */
export function eventParameterType(
  plan: ReactPlan,
  parameter: Parameter,
  modes: ReadonlySet<ListenerMode>,
): string {
  const dom = parameter.type?.code ?? parameter.event!;
  const react = () => {
    const name = reactEventType(parameter.event!);
    // A DOM type the output still names keeps its name: React's is imported as `ReactKeyboardEvent`.
    const local = plan.names.scope.has(name) ? `React${name}` : name;
    return plan.names.add("react", name, { type: true, local });
  };
  if (!modes.has("native")) return react();
  if (!modes.has("synthetic")) return dom;
  return `${dom} | ${react()}`;
}

/** How render code reads a binding: React's state, memo or prop. */
function renderRead(plan: ReactPlan, id: BindingId): string {
  const binding = plan.bindings.get(id)!;
  switch (binding.kind) {
    case "state":
      return plan.state.get(id)!.name;
    case "derived":
      return plan.derived.get(id)!.name;
    case "prop":
      return propRead(plan, id);
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
    case "model":
    case "slots":
    case "slotScope":
    case "context":
    case "component":
      return binding.name;
    default:
      return binding.kind satisfies never;
  }
}

/** A prop as code reads it: its destructured name, or `props.label` in the object form. */
function propRead(plan: ReactPlan, id: BindingId): string {
  const parameter = plan.component.propsParameter;
  const { name } = plan.bindings.get(id)!;
  return parameter?.form === "object" ? `${parameter.name!}.${name}` : name;
}

/**
 * The dependencies of a memo over code a template's site evaluates: the props, state, derived
 * values and setup values it reads (not those at module scope), in the order it reads them.
 */
function dependencies(plan: ReactPlan, body: Code): string[] {
  const found: string[] = [];
  for (const reference of body.refs) {
    if (reference.kind !== "Binding") continue;
    const binding = plan.bindings.get(reference.binding)!;
    switch (binding.kind) {
      case "prop":
        found.push(propRead(plan, reference.binding));
        break;
      case "state":
      case "derived":
        found.push(renderRead(plan, reference.binding));
        break;
      case "localConst":
      case "localFn":
        if (!plan.hoisted.has(reference.binding)) found.push(binding.name);
        break;
      case "loopVar":
      case "templateRef":
      case "localVar":
      case "emit":
      case "model":
      case "slots":
      case "slotScope":
      case "context":
      case "component":
        break;
      default:
        binding.kind satisfies never;
    }
  }
  return [...new Set(found)];
}

/**
 * The props, state and derived values `watchEffect` reads, itself and through the functions it
 * calls: in the order its own code reads them, then the others in declaration order.
 */
function reactiveReads(plan: ReactPlan, body: Code): BindingId[] {
  const own = ownReads(plan, body);
  // What the effect hands on to run later (a timer's callback, marked `later`) is no dependency.
  const all = summarizeTracked(body, plan.component).reads;
  const others = plan.component.bindings.flatMap((binding) =>
    all.has(binding.id) && reactive(binding.kind) && !own.has(binding.id) ? [binding.id] : [],
  );
  return [...own, ...others];
}

/** The props, state and derived values code reads itself, in the order it reads them. */
function ownReads(plan: ReactPlan, body: Code): Set<BindingId> {
  return new Set(
    body.refs.flatMap((reference) =>
      reference.kind === "Binding" &&
      !reference.call &&
      !reference.later &&
      reactive(plan.bindings.get(reference.binding)!.kind)
        ? [reference.binding]
        : [],
    ),
  );
}

/**
 * The element type of a template ref: its annotation, or, where the source leaves it untyped,
 * the interface of the one element it is on (UF3027), as the authoring types infer it.
 */
export function templateRefType(plan: ReactPlan, id: BindingId): string {
  const item = plan.component.setup.find(
    (entry) => entry.kind === "TemplateRef" && entry.binding === id,
  );
  if (item?.kind === "TemplateRef" && item.type) return item.type.code;
  for (const [attribute, type] of plan.refInterfaces) if (attribute.binding === id) return type;
  return "Element";
}

/**
 * Whether code does work: a call, or a `new`. A state's or a `const`'s initial value that does is
 * passed as a function, so React evaluates it on the first render only.
 */
function once(value: string): string {
  const { root } = parseCodeSource(value, "expression");
  let works = false;
  const visit = (node: unknown): void => {
    if (works || typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const type = (node as { type?: unknown }).type;
    if (type === "CallExpression" || type === "NewExpression") {
      works = true;
      return;
    }
    for (const [key, child] of Object.entries(node)) if (key !== "parent") visit(child);
  };
  visit(root);
  if (!works) return value;
  return value.trimStart().startsWith("{") ? `() => (${value})` : `() => ${value}`;
}

/**
 * Local names for code the target writes inside a function of its own (an effect): each the first
 * of `name`, `name_1`… that the code around it does not read, so it captures nothing.
 */
export function locals<const K extends string>(
  reads: readonly string[],
  bases: readonly K[],
): Record<K, string> {
  const taken = new Set(reads.flatMap((code) => code.match(/[A-Za-z_$][\w$]*/g) ?? []));
  const result = {} as Record<K, string>;
  for (const base of bases) {
    let local: string = base;
    for (let suffix = 1; taken.has(local); suffix++) local = `${base}_${suffix}`;
    taken.add(local);
    result[base] = local;
  }
  return result;
}
