// The setup of a Solid component (ADR-0045, ADR-0046, ADR-0048): what the source's body declares
// and runs before its return, in source order, as a Solid developer writes it.
//
// - `ref` is a signal, `const [count, setCount] = createSignal(…)`, read `count()` and written
//   through its setter (`count.value += step` → `setCount(count() + props.step)`), which Solid
//   applies synchronously: a read after a write sees it, in the same function and after an
//   `await` alike. `computed` is `createMemo`, which Solid recomputes as each write is made.
// - Client code is copied as written, with no `batch`: Solid applies each write at once, and the
//   watchers coalesce a synchronous run's writes through their scheduler (src/helpers.ts).
// - What the component evaluates once (an initial value, a constant) reads props and state in
//   `untrack`: the component's body runs untracked already, and `solid/reactivity` asks for it to
//   be said (L5); so does a callback the rule would report (src/untracked.ts).
// - Watchers go through an inline helper, `createWatcher`, and `watchEffect` through
//   `createWatchEffect` over the values it reads (src/helpers.ts); `onMounted` is `onMount`;
//   `onUnmounted` is a cleanup registered from `onMount` (ADR-0048), so neither runs on the
//   server.
// - A template ref is a `let`, which the element's `ref` callback sets and clears on cleanup
//   (src/listeners.ts); `useId()` is `uf-id-` and `createUniqueId()`.
// - Constants and functions that capture nothing of the component are hoisted to module scope
//   (ADR-0045, `unicorn/consistent-function-scoping`).
import { functionSource, functionText, rewriteCode, writtenValue } from "@unframework/codegen";
import type { ImportSet, Placeholders, RewriteRules } from "@unframework/codegen";
import { summarizeCode, summarizeTracked } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  Code,
  CodeReference,
  FunctionCode,
  SetupItem,
  Span,
  UfComponent,
  WatchEffectItem,
  WatchItem,
} from "@unframework/ir";

import { assertedCode, assertedFunction, assertedWhole } from "./asserted.ts";
import {
  NEXT_TICK_HELPER,
  nextTickHelperCode,
  WATCH_EFFECT_HELPER,
  WATCHER_HELPER,
  watcherHelperCode,
} from "./helpers.ts";
import type { WatcherUses } from "./helpers.ts";
import { eventProp, listIndexes } from "./props.ts";
import type { SolidProps } from "./props.ts";
import { edited, untrackEdits } from "./untracked.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Statement = ReturnType<Placeholders["statements"]>;

/** How one output prints its component's code: the rewrite rules and the client functions. */
export class SolidCode {
  readonly component: UfComponent;
  /** How every reference is spelled, writes and emits included. */
  readonly rules: RewriteRules;
  readonly #imports: ImportSet;
  readonly #props: SolidProps;
  readonly #bindings: ReadonlyMap<BindingId, Binding>;
  readonly #setters = new Map<BindingId, string>();
  readonly #uses: WatcherUses = {
    single: { lazy: false, immediate: false },
    array: { lazy: false, immediate: false },
    flush: { pre: false, post: false },
  };
  /** The local functions whose call reads a prop, state or a derived value, as `untrack` sees. */
  readonly #reading = new Set<BindingId>();
  #watcher: string | undefined;
  #watchEffect: string | undefined;
  #nextTick: string | undefined;

  constructor(component: UfComponent, imports: ImportSet, props: SolidProps) {
    this.component = component;
    this.#imports = imports;
    this.#props = props;
    this.#bindings = new Map(component.bindings.map((binding) => [binding.id, binding]));
    // The setters of the state client code writes, claimed in source order; state nothing writes
    // takes none (an unused setter fails L5).
    const written = new Set<BindingId>();
    for (const item of component.setup) {
      for (const code of itemCode(item)) {
        for (const ref of code.refs) if (ref.kind === "Write") written.add(ref.binding);
      }
    }
    for (const handler of inlineHandlers(component)) {
      for (const ref of handler.body.refs) if (ref.kind === "Write") written.add(ref.binding);
    }
    for (const item of component.setup) {
      if (item.kind === "State" && written.has(item.binding)) {
        const { name } = this.#binding(item.binding);
        this.#setters.set(item.binding, imports.claim(`set${capitalised(name)}`));
      }
    }
    // Whether watchers run before the DOM updates, after it, or both, which decides whether a
    // call names its timing (src/helpers.ts): a `watchEffect` runs after it.
    for (const item of component.setup) {
      if (item.kind === "WatchEffect" || (item.kind === "Watch" && item.post)) {
        this.#uses.flush.post = true;
      } else if (item.kind === "Watch") this.#uses.flush.pre = true;
    }
    for (const item of component.setup) {
      if (item.kind !== "Function") continue;
      // What it reads in what it hands on to run later is that code's, not the call's.
      const { reads, emits } = summarizeTracked(item.function.body, component);
      if (emits.size || [...reads].some((id) => tracked(this.#binding(id).kind))) {
        this.#reading.add(item.binding);
      }
    }
    const indexes = listIndexes(component);
    this.rules = {
      binding: (reference, binding, text) => {
        // A read a condition narrows, where Solid's spelling loses it (src/asserted.ts).
        const asserted = assertedWhole(reference, binding) ? "!" : "";
        switch (binding.kind) {
          case "prop":
            return `${props.read(binding, text)}${asserted}`;
          case "loopVar":
            // `<For>` passes the index as an accessor.
            return indexes.has(binding.id) ? `${text}()` : text;
          case "state":
          case "derived":
            return `${binding.name}()${asserted}`;
          case "templateRef":
            return binding.name;
          case "localConst":
          case "localFn":
          case "localVar":
          case "emit":
            return text;
          // Composition (ADR-0055) is not emitted yet: `emit` reports UF1002 before this runs.
          case "model":
          case "slots":
          case "slotScope":
          case "context":
          case "component":
            return text;
          default:
            return unreachable(binding.kind);
        }
      },
      write: (write, binding, parts) => {
        switch (binding.kind) {
          case "state":
            return `${this.#setters.get(binding.id)!}(${writtenValue(write, parts)})`;
          case "localVar":
            return undefined;
          case "prop":
          case "loopVar":
          case "derived":
          case "templateRef":
          case "localConst":
          case "localFn":
          case "emit":
            throw new Error(`A write of the ${binding.kind} ${binding.name}: invalid IR.`);
          case "model":
          case "slots":
          case "slotScope":
          case "context":
          case "component":
            return undefined;
          default:
            return unreachable(binding.kind);
        }
      },
      emit: (emit, _binding, parts) =>
        `${props.object!}.${eventProp(emit.event)}?.(${parts.arguments.join(", ")})`,
      api: () => (this.#nextTick ??= this.#imports.claim(NEXT_TICK_HELPER)),
    };
  }

  /** The setter of a state binding client code writes: none for one nothing writes. */
  setter(id: BindingId): string | undefined {
    return this.#setters.get(id);
  }

  /** A Solid import's local name. */
  solid(name: string): string {
    return this.#imports.add("solid-js", name);
  }

  /**
   * Code the setup evaluates once (an initial value, a constant's value), for the `pure` site, in
   * `untrack` where it reads a prop, state or a derived value, itself or through what it calls.
   */
  value(code: Code): string {
    const text = rewriteCode(this.#asserted(code), this.component, this.rules, "pure");
    if (!this.#readsReactive(code)) return text;
    return `${this.solid("untrack")}(() => ${arrowBody(text)})`;
  }

  /** A getter (`computed`, a watch source) as an arrow, for the `pure` site. */
  getter(fn: FunctionCode): string {
    return functionText(this.#assertedFunction(fn), this.component, this.rules, "pure");
  }

  /**
   * A function client code runs (a setup function, an inline handler): an arrow, or with `name`
   * a declaration. `tracked` where `solid/reactivity` reads it as a handler (an inline handler of
   * an `on…` prop or `addEventListener`); it reads a setup function as neither, so an arrow that
   * one hands to a function says `untrack` (src/untracked.ts).
   */
  client(fn: FunctionCode, name?: string, tracked = false): string {
    return functionSource(fn, this.body(fn, tracked), name === undefined ? {} : { name });
  }

  /**
   * A callback the rule reads as tracked or called later: a watcher's, a `watchEffect`'s, a
   * hook's (`onMount`'s and `onCleanup`'s argument).
   */
  callback(fn: FunctionCode): string {
    return functionSource(fn, this.body(fn, true));
  }

  /** `createWatcher(source, callback, options)` for a watcher (see src/helpers.ts). */
  watcher(item: WatchItem): string {
    const { sources, callback: fn } = item;
    const array = Boolean(item.array);
    const immediate = Boolean(item.immediate);
    const post = Boolean(item.post);
    const uses = array ? this.#uses.array : this.#uses.single;
    if (immediate) uses.immediate = true;
    else uses.lazy = true;
    this.#watcher ??= this.#imports.claim(WATCHER_HELPER);
    const printed = sources.map((source) => {
      switch (source.kind) {
        // A ref's accessor is a source as it is: `count`, a memo's `total`.
        case "Ref":
          return this.#binding(source.binding).name;
        case "Getter":
          return this.getter(source.getter);
        default:
          return unreachable(source);
      }
    });
    const source = array ? `[${printed.join(", ")}]` : printed[0]!;
    // A call names its timing where the helper runs watchers of both kinds.
    const both = this.#uses.flush.pre && this.#uses.flush.post;
    const options = [
      ...(immediate ? ["immediate: true"] : []),
      ...(post && both ? ['flush: "post"'] : []),
    ];
    const optionsText = options.length ? `, { ${options.join(", ")} }` : "";
    return `${this.#watcher}(${source}, ${this.callback(fn)}${optionsText});`;
  }

  /**
   * `createWatchEffect(sources, effect)` for a `watchEffect` (see src/helpers.ts): its sources are
   * the props, state and derived values it reads, which UF2015 keeps to its straight-line start,
   * its own reads first, in order, then those of the functions it calls; never a read in what it
   * hands on to run later (a timer's or a `then`'s callback, `onCleanup`'s), as Vue tracks none.
   */
  watchEffect(item: WatchEffectItem): string {
    const { effect } = item;
    this.#watchEffect ??= this.#imports.claim(WATCH_EFFECT_HELPER);
    const own = effect.body.refs.flatMap((ref) =>
      ref.kind === "Binding" && !ref.call && !ref.later && tracked(this.#binding(ref.binding).kind)
        ? [ref.binding]
        : [],
    );
    const { reads } = summarizeTracked(effect.body, this.component);
    const sources = [...new Set([...own, ...reads])].flatMap((id) => {
      const binding = this.#binding(id);
      switch (binding.kind) {
        case "state":
        case "derived":
          return [binding.name];
        case "prop": {
          const object = this.#props.object;
          return [
            `() => ${this.#props.read(binding, object ? `${object}.${binding.name}` : binding.name)}`,
          ];
        }
        default:
          return [];
      }
    });
    return `${this.#watchEffect}([${sources.join(", ")}], ${this.callback(effect)});`;
  }

  /** The inline helpers the code printed so far calls. */
  helpers(): string[] {
    const helpers: string[] = [];
    if (this.#watcher || this.#watchEffect) {
      const arrays = this.#uses.array.lazy || this.#uses.array.immediate;
      helpers.push(
        watcherHelperCode(this.#uses, {
          createReaction: this.solid("createReaction"),
          onCleanup: this.solid("onCleanup"),
          onMount: this.solid("onMount"),
          ...(this.#watcher ? { watcher: this.#watcher } : {}),
          ...(this.#watchEffect ? { watchEffect: this.#watchEffect } : {}),
          ...(arrays ? { values: this.#imports.claim("WatchedValues") } : {}),
          queue: this.#imports.claim("queuedWatchers"),
          schedule: this.#imports.claim("queueWatcher"),
          queued: this.#imports.claim("flushQueued"),
        }),
      );
    }
    if (this.#nextTick) helpers.push(nextTickHelperCode(this.#nextTick));
    return helpers;
  }

  #binding(id: BindingId): Binding {
    const binding = this.#bindings.get(id);
    if (!binding) throw new Error(`No binding ${id}: invalid IR.`);
    return binding;
  }

  /** Whether code reads a prop, state or a derived value, itself or through what it calls. */
  #readsReactive(code: Code): boolean {
    const { reads } = summarizeCode(code, this.component);
    return [...reads].some((id) => tracked(this.#binding(id).kind));
  }

  /**
   * A function's body, rewritten, the callbacks `solid/reactivity` would report in `untrack`
   * (src/untracked.ts). `tracked` where the rule reads the function itself as tracked.
   */
  body(fn: FunctionCode, tracked: boolean): string {
    const asserted = this.#assertedFunction(fn);
    const edits = untrackEdits(asserted, {
      reactive: this.#reactive(asserted.body.refs),
      tracked,
      untrack: () => this.solid("untrack"),
    });
    const body = edits.length ? edited(asserted.body, edits) : asserted.body;
    return rewriteCode(body, this.component, this.rules, "client");
  }

  /** Code with a `!` after each narrowed member path Solid's spelling loses (src/asserted.ts). */
  #asserted(code: Code): Code {
    return assertedCode(code, (reference) => this.#binding(reference.binding));
  }

  #assertedFunction(fn: FunctionCode): FunctionCode {
    return assertedFunction(fn, (reference) => this.#binding(reference.binding));
  }

  /**
   * Where code reads what Solid tracks: a prop, state, a derived value; an emit reads a prop; and
   * a call of a local function that reads one, which the rule reads as a derived signal.
   */
  #reactive(refs: readonly CodeReference[]): Span[] {
    return refs.flatMap((ref) => {
      switch (ref.kind) {
        case "Binding":
          return tracked(this.#binding(ref.binding).kind) ||
            (ref.call && this.#reading.has(ref.binding))
            ? [ref.span]
            : [];
        case "Write":
          // `count.value += 1` reads `count()`.
          return ref.operator !== "=" && tracked(this.#binding(ref.binding).kind) ? [ref.span] : [];
        case "Emit":
          return [ref.span];
        case "Global":
        case "Event":
        case "Api":
        case "Slot":
          return [];
        default:
          return unreachable(ref);
      }
    });
  }
}

/** Whether Solid tracks a read of a binding of a kind: what `untrack` is for. */
function tracked(kind: Binding["kind"]): boolean {
  switch (kind) {
    case "prop":
    case "state":
    case "derived":
      return true;
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return false;
    case "model":
    case "slots":
    case "slotScope":
    case "context":
    case "component":
      return false;
    default:
      return unreachable(kind);
  }
}

/** What the setup prints: module-level declarations, and the component body's statements. */
export interface SolidSetup {
  /** Constants and functions that capture nothing of the component, at module scope (ADR-0045). */
  hoisted: Statement[];
  /** The setup's statements, in source order. */
  statements: Statement[];
}

/** The setup's statements, in source order, and those hoisted out of the component. */
export function solidSetup(code: SolidCode, placeholders: Placeholders): SolidSetup {
  const { component } = code;
  const hoisted = hoistable(component);
  const module: Statement[] = [];
  const body: Statement[] = [];
  const bindingOf = (id: BindingId) => component.bindings.find((binding) => binding.id === id)!;
  // Printed in source order, so names are claimed in it.
  const texts = new Map(component.setup.map((item) => [item, itemText(item, code, bindingOf)]));
  for (const item of component.setup) {
    if ("binding" in item && hoisted.has(item.binding)) {
      // A blank line after each: a module's declarations stand apart.
      module.push(placeholders.statements(`${texts.get(item)!}\n`));
    }
  }
  const kept = teardownFirst(
    component.setup.filter((item) => !("binding" in item && hoisted.has(item.binding))),
  );
  for (const [index, item] of kept.entries()) {
    // A blank line around a block (a function, a watcher, an effect, a hook) and before the
    // return, as the source sets them apart: oxfmt keeps one blank line and adds none.
    const before = index > 0 && (BLOCKS.has(item.kind) || BLOCKS.has(kept[index - 1]!.kind));
    const after = index === kept.length - 1;
    body.push(
      placeholders.statements(`${before ? "\n" : ""}${texts.get(item)!}${after ? "\n" : ""}`),
    );
  }
  return { hoisted: module, statements: body };
}

/**
 * The setup's items with the `onUnmounted` hooks before the first watcher or `watchEffect`, in
 * reverse order (ADR-0048): Solid disposes a component's computations in the reverse of their
 * creation (solid-js 1.9 `cleanNode`), and each hook is a cleanup of an `onMount` computation,
 * so every watcher's and effect's cleanup then runs before the hooks, which run in source order,
 * as Vue stops a component's effects before it calls its `onUnmounted` hooks.
 */
function teardownFirst(items: readonly SetupItem[]): SetupItem[] {
  const hooks = items.filter(unmounted);
  if (!hooks.length) return [...items];
  const anchor = items.findIndex(
    (item) => item.kind === "Watch" || item.kind === "WatchEffect" || unmounted(item),
  );
  const rest = items.filter((item) => !unmounted(item));
  const at = rest.indexOf(items.slice(anchor).find((item) => !unmounted(item))!);
  const position = at < 0 ? rest.length : at;
  return [...rest.slice(0, position), ...hooks.toReversed(), ...rest.slice(position)];
}

/** Whether a setup item is an `onUnmounted` hook. */
function unmounted(item: SetupItem): boolean {
  return item.kind === "Lifecycle" && item.hook === "unmounted";
}

/** The setup items that print as blocks, set apart by blank lines. */
const BLOCKS: ReadonlySet<SetupItem["kind"]> = new Set([
  "Function",
  "Watch",
  "WatchEffect",
  "Lifecycle",
]);

/** A type as a call's type argument, `<T>`, or nothing. */
function typeArgument(type: { code: string } | undefined): string {
  return type ? `<${type.code}>` : "";
}

/** A type as a declaration's annotation, `: T`, or nothing. */
function annotation(type: { code: string } | undefined): string {
  return type ? `: ${type.code}` : "";
}

/** One setup item as Solid code. */
function itemText(item: SetupItem, code: SolidCode, bindingOf: (id: BindingId) => Binding): string {
  switch (item.kind) {
    case "State": {
      const { name } = bindingOf(item.binding);
      const setter = code.setter(item.binding);
      const pattern = setter ? `[${name}, ${setter}]` : `[${name}]`;
      const initial = item.initial ? code.value(item.initial) : "";
      return `const ${pattern} = ${code.solid("createSignal")}${typeArgument(item.type)}(${initial});`;
    }
    case "Derived": {
      const { name } = bindingOf(item.binding);
      return `const ${name} = ${code.solid("createMemo")}${typeArgument(item.type)}(${code.getter(item.getter)});`;
    }
    case "TemplateRef": {
      // Empty until its element is created, and again once it is removed (src/listeners.ts):
      // `null`, as the source's `useTemplateRef` value is.
      const { name } = bindingOf(item.binding);
      return `let ${name}: ${item.type ? `${item.type.code} | null` : "unknown"} = null;`;
    }
    case "Id": {
      const { name } = bindingOf(item.binding);
      return `const ${name} = \`uf-id-\${${code.solid("createUniqueId")}()}\`;`;
    }
    case "Const": {
      const { name } = bindingOf(item.binding);
      return `const ${name}${annotation(item.type)} = ${code.value(item.value)};`;
    }
    case "Variable": {
      const { name } = bindingOf(item.binding);
      const initial = item.initial ? ` = ${code.value(item.initial)}` : "";
      return `let ${name}${annotation(item.type)}${initial};`;
    }
    case "Function": {
      const { name } = bindingOf(item.binding);
      return item.form === "declaration"
        ? code.client(item.function, name)
        : `const ${name} = ${code.client(item.function)};`;
    }
    case "Watch":
      return code.watcher(item);
    case "WatchEffect":
      return code.watchEffect(item);
    case "Lifecycle": {
      const onMount = code.solid("onMount");
      const callback = code.callback(item.callback);
      // `onCleanup` alone would also run when the server disposes its render (ADR-0048).
      return item.hook === "mounted"
        ? `${onMount}(${callback});`
        : `${onMount}(() => ${code.solid("onCleanup")}(${callback}));`;
    }
    case "Model":
    case "Provide":
    case "Inject":
      return "";
    default:
      return unreachable(item);
  }
}

/**
 * The constants and functions that capture nothing of the component (ADR-0045): their code reads no
 * binding but other such constants and functions, so they move to module scope, where
 * `unicorn/consistent-function-scoping` (L5) wants a function that captures nothing. An id is
 * per instance, never hoisted.
 */
function hoistable(component: UfComponent): Set<BindingId> {
  const candidates = new Map<BindingId, Code[]>();
  for (const item of component.setup) {
    if (item.kind === "Const") candidates.set(item.binding, [item.value]);
    if (item.kind === "Function") {
      const fn = item.function;
      candidates.set(item.binding, [fn.body]);
    }
  }
  const hoisted = new Set(candidates.keys());
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, codes] of candidates) {
      if (!hoisted.has(id)) continue;
      const captures = codes.some((piece) =>
        piece.refs.some((ref) => {
          switch (ref.kind) {
            case "Binding":
            case "Write":
            case "Emit":
              return !hoisted.has(ref.binding);
            case "Global":
            case "Event":
            case "Api":
            case "Slot":
              return false;
            default:
              return unreachable(ref);
          }
        }),
      );
      if (captures) {
        hoisted.delete(id);
        changed = true;
      }
    }
  }
  return hoisted;
}

/** The code of a setup item, in source order. */
function itemCode(item: SetupItem): Code[] {
  switch (item.kind) {
    case "State":
    case "Variable":
      return item.initial ? [item.initial] : [];
    case "Const":
      return [item.value];
    case "Derived":
      return [item.getter.body];
    case "Function":
      return [item.function.body];
    case "Watch":
      return [
        ...item.sources.flatMap((source) => (source.kind === "Getter" ? [source.getter.body] : [])),
        item.callback.body,
      ];
    case "WatchEffect":
      return [item.effect.body];
    case "Lifecycle":
      return [item.callback.body];
    case "TemplateRef":
    case "Id":
      return [];
    case "Model":
      return [];
    case "Provide":
      return [item.value];
    case "Inject":
      return item.fallback ? [item.fallback] : [];
    default:
      return unreachable(item);
  }
}

/** The functions of a component's inline handlers, in document order. */
function inlineHandlers(component: UfComponent): FunctionCode[] {
  const found: FunctionCode[] = [];
  const visit = (node: UfComponent["render"] | UfComponent["render"]["children"][number]) => {
    switch (node.kind) {
      case "Element":
        for (const attribute of node.attributes) {
          if (attribute.kind === "Event" && attribute.handler.kind === "Inline") {
            found.push(attribute.handler.function);
          }
        }
        node.children.forEach(visit);
        return;
      case "Fragment":
        node.children.forEach(visit);
        return;
      case "If":
        for (const branch of node.branches) branch.children.forEach(visit);
        return;
      case "For":
        visit(node.body);
        return;
      case "Text":
      case "Interpolation":
        return;
      case "Component":
      case "SlotOutlet":
      case "Dynamic":
        return;
      default:
        unreachable(node);
    }
  };
  visit(component.render);
  return found;
}

/** An arrow's expression body: an object literal in parentheses. */
function arrowBody(code: string): string {
  return code.trimStart().startsWith("{") ? `(${code})` : code;
}

function capitalised(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
