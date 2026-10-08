// Which bindings printed code reads (ADR-0045): a target declares a destructured prop
// or a list's index only where something it prints reads it (an unused one fails L5), and one a
// handler alone reads must still be declared (or the output throws a ReferenceError). Both walks
// read the IR's own visitors (`expressionsOf`, `codeOf`), so a kind added to the IR is seen here.
import { codeOf, expressionsOf, walk } from "@unframework/ir";
import type {
  Attribute,
  BindingId,
  Code,
  ComponentAttribute,
  EventAttribute,
  FragmentNode,
  ListenerAttribute,
  RefAttribute,
  Expression,
  FunctionCode,
  RenderNode,
  SetupItem,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { typeNames } from "./names.ts";
import { parseStatementsSource } from "./parse.ts";
import { codeKind, codeNames, collectNames } from "./rewrite.ts";

/** What {@link referencedBindings} counts besides the template's expressions. */
export interface ReferencedOptions {
  /**
   * Whether the lists' keys count: `false` for a target that does not print keys (Solid's
   * `<For>`), so an index used only as a key is not declared. Default `true`.
   */
  includeKeys?: boolean;
  /**
   * Whether what runs only in the browser counts: handlers, template refs, the setup's
   * functions, watchers, `watchEffect` and lifecycle hooks. Default `true`; `false` for a target
   * that prints none of it (Astro, whose handlers are inert), which reads `liveBindings` for the
   * setup it keeps.
   */
  includeClient?: boolean;
}

/**
 * The bindings that the printed code of a component (or of one render node) references: its
 * template's expressions and props' defaults, the values its setup evaluates (initial values,
 * `const` values, `computed` getters), and, unless `includeClient` is `false`, everything that
 * runs in the browser: listeners (a named handler's function, an inline handler's code),
 * template refs, the setup's functions, watchers and their sources, effects and hooks. A target
 * leaves out a destructured prop or a list's index parameter outside this set, which would
 * otherwise be an unused variable (L5).
 */
export function referencedBindings(
  scope: UfComponent | RenderNode,
  options: ReferencedOptions = {},
): Set<BindingId> {
  const includeKeys = options.includeKeys ?? true;
  const includeClient = options.includeClient ?? true;
  const component = "bindings" in scope ? scope : nodeComponent(scope);
  const found = new Set<BindingId>();
  for (const { expression, path } of expressionsOf(component)) {
    if (!includeKeys && path.endsWith("/key")) continue;
    readsOf(expression, found);
  }
  if (!includeClient) {
    for (const item of component.setup) {
      for (const code of serverCode(item)) readsOf(code, found);
    }
    return found;
  }
  for (const { code } of codeOf(component)) readsOf(code, found);
  for (const item of component.setup) {
    if (item.kind !== "Watch") continue;
    for (const source of item.sources) if (source.kind === "Ref") found.add(source.binding);
  }
  walk(component.render, {
    enter(node) {
      for (const attribute of clientAttributes(node)) {
        if (attribute.kind === "Ref") found.add(attribute.binding);
        else if (attribute.handler.kind === "Function") found.add(attribute.handler.binding);
      }
    },
  });
  return found;
}

/**
 * The attributes of a render node that only the browser runs: an element's listeners and template
 * ref, and a component's listeners and ref (ADR-0053).
 */
function clientAttributes(
  node: RenderNode | FragmentNode,
): (RefAttribute | EventAttribute | ListenerAttribute)[] {
  if (node.kind !== "Element" && node.kind !== "Component") return [];
  const attributes: readonly (Attribute | ComponentAttribute)[] = node.attributes;
  return attributes.filter(
    (attribute): attribute is RefAttribute | EventAttribute | ListenerAttribute =>
      attribute.kind === "Ref" || attribute.kind === "Event" || attribute.kind === "Listener",
  );
}

/** What {@link liveBindings} and {@link liveTypes} start from besides the template. */
export interface LiveOptions {
  /** Whether what runs in the browser counts: listeners, template refs, watchers, effects, hooks. */
  client: boolean;
  /**
   * Whether the lists' keys count, as {@link ReferencedOptions.includeKeys}: `false` for a target
   * that prints no keys (Astro). Default `true`.
   */
  includeKeys?: boolean;
}

/**
 * The bindings a component's output needs, from what it prints: the template's expressions,
 * and with `client`, its listeners, template refs, watchers, effects and lifecycle hooks;
 * then, transitively, the setup declarations those read (a `computed` reads the state its
 * getter reads, a called function what its body reads). Props and loop variables read on the
 * way are in the set too. A target that prints no client code (Astro) prints only the setup
 * items whose binding is in `liveBindings(component, { client: false })`, and declares only
 * those props: what only inert code reads would be unused (L5). Every other target prints the
 * author's setup as written, live or not. With `includeKeys: false` (a target that prints no list
 * keys: Astro), what only a list's key reads is not live either.
 */
export function liveBindings(component: UfComponent, options: LiveOptions): Set<BindingId> {
  const declarations = new Map<BindingId, SetupItem>();
  for (const item of component.setup) {
    if ("binding" in item) declarations.set(item.binding, item);
  }
  const live = new Set<BindingId>();
  const pending: BindingId[] = [];
  const reach = (id: BindingId) => {
    if (live.has(id)) return;
    live.add(id);
    pending.push(id);
  };
  const read = (code: Expression | Code | undefined) => {
    if (!code) return;
    const found = new Set<BindingId>();
    readsOf(code, found);
    for (const id of found) reach(id);
  };
  const readFunction = (fn: FunctionCode) => {
    read(fn.body);
    for (const parameter of fn.parameters) read(parameter.default);
  };
  for (const { expression, path } of expressionsOf(component)) {
    if (options.includeKeys === false && path.endsWith("/key")) continue;
    read(expression);
  }
  if (options.client) {
    walk(component.render, {
      enter(node) {
        for (const attribute of clientAttributes(node)) {
          if (attribute.kind === "Ref") reach(attribute.binding);
          else if (attribute.handler.kind === "Function") reach(attribute.handler.binding);
          else readFunction(attribute.handler.function);
        }
      },
    });
    for (const item of component.setup) {
      switch (item.kind) {
        case "Watch":
          for (const source of item.sources) {
            if (source.kind === "Ref") reach(source.binding);
            else readFunction(source.getter);
          }
          readFunction(item.callback);
          break;
        case "WatchEffect":
          readFunction(item.effect);
          break;
        case "Lifecycle":
          readFunction(item.callback);
          break;
        case "Provide":
          read(item.value);
          break;
        case "State":
        case "Derived":
        case "TemplateRef":
        case "Id":
        case "Const":
        case "Variable":
        case "Function":
        case "Model":
        case "Inject":
          break;
        default:
          unreachable(item);
      }
    }
  }
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const item = declarations.get(id);
    if (!item) continue;
    switch (item.kind) {
      case "State":
      case "Variable":
        read(item.initial);
        break;
      case "Const":
        read(item.value);
        break;
      case "Derived":
        readFunction(item.getter);
        break;
      case "Function":
        readFunction(item.function);
        break;
      case "Inject":
        read(item.fallback);
        break;
      case "TemplateRef":
      case "Id":
      case "Watch":
      case "WatchEffect":
      case "Lifecycle":
      case "Model":
      case "Provide":
        break;
      default:
        unreachable(item);
    }
  }
  return live;
}

/**
 * The type declarations a component's output declares (`component.types`, in source order), as
 * far as what it prints reaches them: its props' types, the annotations and code of the setup
 * items in `liveBindings(component, options)`, and with `client` its events' payloads and its
 * listeners', watchers', effects' and hooks' code; then, transitively, the declarations those
 * declarations name. A declaration the source exports is always kept: consumers may import it.
 * Astro, whose handlers are inert, copies only these, so a type only dropped code used is not
 * left unused (L5). `includeKeys: false` leaves out what only a list's key reaches, as
 * {@link liveBindings} does.
 */
export function liveTypes(
  component: UfComponent,
  module: UfModule,
  options: LiveOptions,
): TypeDeclaration[] {
  const declared = new Map(
    module.types
      .filter((declaration) => component.types.includes(declaration.name))
      .map((declaration) => [declaration.name, declaration]),
  );
  const reached = new Set<string>();
  const pending: string[] = [];
  const reach = (names: Iterable<string>) => {
    for (const name of names) {
      if (!declared.has(name) || reached.has(name)) continue;
      reached.add(name);
      pending.push(name);
    }
  };
  const type = (text: TypeText | undefined) => {
    if (text) reach(typeNames(text));
  };
  const code = (piece: Code) => reach(codeNames(piece.code, codeKind(piece, component)));
  const fn = (written: FunctionCode) => {
    for (const parameter of written.parameters) type(parameter.type);
    type(written.returnType);
    code(written.body);
  };
  if (component.propsParameter) type(component.propsParameter.type);
  for (const prop of component.props) type(prop.type);
  // A slot's props are its public type, as a prop's is (ADR-0054).
  for (const slot of component.slots?.slots ?? []) type(slot.props);
  for (const declaration of declared.values()) {
    if (declaration.exported) reach([declaration.name]);
  }
  const live = liveBindings(component, options);
  for (const item of component.setup) {
    const runs = "binding" in item ? live.has(item.binding) : options.client;
    if (!runs) continue;
    if ("type" in item) type(item.type);
    switch (item.kind) {
      case "State":
      case "Variable":
        if (item.initial) code(item.initial);
        break;
      case "Const":
        code(item.value);
        break;
      case "Derived":
        fn(item.getter);
        break;
      case "Function":
        fn(item.function);
        break;
      case "Watch":
        for (const source of item.sources) if (source.kind === "Getter") fn(source.getter);
        fn(item.callback);
        break;
      case "WatchEffect":
        fn(item.effect);
        break;
      case "Lifecycle":
        fn(item.callback);
        break;
      case "Provide":
        code(item.value);
        break;
      case "Inject":
        if (item.fallback) code(item.fallback);
        break;
      case "TemplateRef":
      case "Id":
      case "Model":
        break;
      default:
        unreachable(item);
    }
  }
  if (options.client) {
    if (component.emits) {
      type(component.emits.type);
      for (const event of component.emits.events) {
        for (const parameter of event.parameters) type(parameter.type);
      }
    }
    walk(component.render, {
      enter(node) {
        for (const attribute of clientAttributes(node)) {
          if (attribute.kind !== "Ref" && attribute.handler.kind === "Inline") {
            fn(attribute.handler.function);
          }
        }
      },
    });
  }
  for (const { expression, path } of expressionsOf(component)) {
    if (options.includeKeys === false && path.endsWith("/key")) continue;
    reach(codeNames(expression.code));
  }
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    const [statement] = parseStatementsSource(declared.get(name)!.code).statements;
    const names = new Set<string>();
    collectNames(statement, names);
    names.delete(name);
    reach(names);
  }
  return [...declared.values()].filter((declaration) => reached.has(declaration.name));
}

/** Adds to `found` the bindings code references: read, called, written or emitted through. */
function readsOf(code: Expression | Code, found: Set<BindingId>): void {
  for (const reference of code.refs) {
    switch (reference.kind) {
      case "Binding":
      case "Write":
      case "Emit":
        found.add(reference.binding);
        break;
      case "Global":
      case "Event":
      case "Api":
      case "Slot":
        break;
      default:
        unreachable(reference);
    }
  }
}

/**
 * The code of a setup item that the setup evaluates where the component renders, the server
 * included: initial values, a `const`'s value and a `computed`'s getter. Functions, watchers,
 * effects and hooks run in the browser.
 */
function serverCode(item: SetupItem): Code[] {
  switch (item.kind) {
    case "State":
    case "Variable":
      return item.initial ? [item.initial] : [];
    case "Const":
      return [item.value];
    case "Derived":
      return [item.getter.body];
    case "Provide":
      return [item.value];
    case "Inject":
      return item.fallback ? [item.fallback] : [];
    case "TemplateRef":
    case "Id":
    case "Function":
    case "Watch":
    case "WatchEffect":
    case "Lifecycle":
    case "Model":
      return [];
    default:
      return unreachable(item);
  }
}

/**
 * A component made of one render node, for the IR's visitors, which walk a component: no props
 * and no setup, so only the node's expressions and handlers are found.
 */
function nodeComponent(node: RenderNode): UfComponent {
  return {
    name: "Node",
    span: node.span,
    props: [],
    types: [],
    bindings: [],
    setup: [],
    // The visitors walk any render node from the root; the type names the roots a component has.
    render: node as UfComponent["render"],
  };
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
