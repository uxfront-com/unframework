import type {
  Attribute,
  BindingKind,
  Code,
  CodeReference,
  ComponentAttribute,
  EventAttribute,
  Expression,
  FragmentNode,
  FunctionCode,
  Handler,
  ListenerAttribute,
  Parameter,
  RenderNode,
  SetupItem,
  SlotFill,
  Span,
  UfComponent,
  UfModule,
  WatchSource,
} from "./types.ts";

/** An attribute of an element or of a component: what a `Dynamic` node may hold. */
type AnyAttribute = Attribute | ComponentAttribute;

// Records rather than arrays: `satisfies` rejects a missing or an unknown kind, so a kind added
// to the unions cannot be left out of the lists the coverage gate iterates.
const renderNodeKinds = {
  Element: true,
  Text: true,
  Interpolation: true,
  If: true,
  For: true,
  Component: true,
  SlotOutlet: true,
  Dynamic: true,
} satisfies Record<RenderNode["kind"], true>;
const attributeKinds = {
  Static: true,
  Bound: true,
  Class: true,
  Style: true,
  Spread: true,
  Event: true,
  Ref: true,
  Model: true,
  Prop: true,
  Listener: true,
  ModelBinding: true,
} satisfies Record<AnyAttribute["kind"], true>;
const bindingKinds = {
  prop: true,
  loopVar: true,
  state: true,
  derived: true,
  templateRef: true,
  localConst: true,
  localFn: true,
  localVar: true,
  emit: true,
  model: true,
  slots: true,
  slotScope: true,
  context: true,
  component: true,
} satisfies Record<BindingKind, true>;
const setupItemKinds = {
  State: true,
  Derived: true,
  TemplateRef: true,
  Id: true,
  Const: true,
  Variable: true,
  Function: true,
  Watch: true,
  WatchEffect: true,
  Lifecycle: true,
  Model: true,
  Provide: true,
  Inject: true,
} satisfies Record<SetupItem["kind"], true>;
const handlerKinds = { Function: true, Inline: true } satisfies Record<Handler["kind"], true>;
const watchSourceKinds = { Ref: true, Getter: true } satisfies Record<WatchSource["kind"], true>;
const codeReferenceKinds = {
  Binding: true,
  Global: true,
  Write: true,
  Emit: true,
  Api: true,
  Event: true,
  Slot: true,
} satisfies Record<CodeReference["kind"], true>;

/**
 * Every kind of render node. The coverage gate requires a corpus case for each. A root
 * `Fragment` is not a render node; the `fragment` capability covers it.
 */
export const RENDER_NODE_KINDS: readonly RenderNode["kind"][] = Object.keys(
  renderNodeKinds,
) as RenderNode["kind"][];

/**
 * Every kind of attribute, an element's or a component's. The coverage gate requires a corpus case
 * for each.
 */
export const ATTRIBUTE_KINDS: readonly AnyAttribute["kind"][] = Object.keys(
  attributeKinds,
) as AnyAttribute["kind"][];

/** Every kind of binding. The coverage gate requires a corpus case for each. */
export const BINDING_KINDS: readonly BindingKind[] = Object.keys(bindingKinds) as BindingKind[];

/** Every kind of setup item. The coverage gate requires a corpus case for each. */
export const SETUP_ITEM_KINDS: readonly SetupItem["kind"][] = Object.keys(
  setupItemKinds,
) as SetupItem["kind"][];

/** Every kind of event handler. The coverage gate requires a corpus case for each. */
export const HANDLER_KINDS: readonly Handler["kind"][] = Object.keys(
  handlerKinds,
) as Handler["kind"][];

/** Every kind of watch source. The coverage gate requires a corpus case for each. */
export const WATCH_SOURCE_KINDS: readonly WatchSource["kind"][] = Object.keys(
  watchSourceKinds,
) as WatchSource["kind"][];

/**
 * Every kind of reference in setup code, and in render expressions, whose kinds are among them.
 * The coverage gate requires a corpus case for each.
 */
export const CODE_REFERENCE_KINDS: readonly CodeReference["kind"][] = Object.keys(
  codeReferenceKinds,
) as CodeReference["kind"][];

/** A node {@link walk} visits: a render node, or a component's root fragment. */
export type VisitedNode = RenderNode | FragmentNode;

/**
 * Callbacks for {@link walk}. Returning `false` from `enter` skips the node's children. The
 * parent is the node whose children hold this one: an element, the root fragment, the `If`
 * whose branch holds it, the `For` whose body it is, the component or `Dynamic` whose fill holds
 * it, or the slot outlet whose fallback it is.
 */
export interface Visitor {
  enter?(node: VisitedNode, parent: VisitedNode | undefined): void | false;
  leave?(node: VisitedNode, parent: VisitedNode | undefined): void;
}

/**
 * The child nodes of a node, in document order: an element's or a fragment's children, every
 * branch's children of an `If` in order, a `For`'s body, every fill's children of a component in
 * order, a slot outlet's fallback, a `Dynamic` node's children then its fills', and nothing for
 * text.
 */
export function childrenOf(node: VisitedNode): readonly RenderNode[] {
  switch (node.kind) {
    case "Element":
    case "Fragment":
      return node.children;
    case "If":
      return node.branches.flatMap((branch) => branch.children);
    case "For":
      return [node.body];
    case "Component":
      return node.fills.flatMap((fill) => fill.children);
    case "SlotOutlet":
      return node.fallback;
    case "Dynamic":
      return [...node.children, ...(node.fills ?? []).flatMap((fill) => fill.children)];
    case "Text":
    case "Interpolation":
      return [];
    default:
      return unreachable(node);
  }
}

/** Walks a render tree depth-first, in document order. */
export function walk(node: VisitedNode, visitor: Visitor, parent?: VisitedNode): void {
  if (visitor.enter?.(node, parent) === false) return;
  for (const child of childrenOf(node)) walk(child, visitor, node);
  visitor.leave?.(node, parent);
}

/** What a module uses, by kind: the input of capability checks and of the coverage gate. */
export interface ModuleFeatures {
  nodeKinds: Set<RenderNode["kind"]>;
  attributeKinds: Set<AnyAttribute["kind"]>;
  bindingKinds: Set<BindingKind>;
  setupItemKinds: Set<SetupItem["kind"]>;
  handlerKinds: Set<Handler["kind"]>;
  watchSourceKinds: Set<WatchSource["kind"]>;
  codeReferenceKinds: Set<CodeReference["kind"]>;
}

/**
 * Collects the kinds that a module's components use: render nodes, attributes, bindings, setup
 * items, handlers, watch sources and the references of setup code (render expressions' own
 * references are setup code's `Binding` and `Global` kinds, so they count too).
 */
export function collectFeatures(module: UfModule): ModuleFeatures {
  const features: ModuleFeatures = {
    nodeKinds: new Set(),
    attributeKinds: new Set(),
    bindingKinds: new Set(),
    setupItemKinds: new Set(),
    handlerKinds: new Set(),
    watchSourceKinds: new Set(),
    codeReferenceKinds: new Set(),
  };
  for (const component of module.components) {
    for (const binding of component.bindings) features.bindingKinds.add(binding.kind);
    for (const item of component.setup) {
      features.setupItemKinds.add(item.kind);
      if (item.kind === "Watch") {
        for (const source of item.sources) features.watchSourceKinds.add(source.kind);
      }
    }
    walk(component.render, {
      enter(node) {
        if (node.kind === "Fragment") return;
        features.nodeKinds.add(node.kind);
        for (const attribute of attributesOf(node)) {
          features.attributeKinds.add(attribute.kind);
          if (attribute.kind === "Event" || attribute.kind === "Listener") {
            features.handlerKinds.add(attribute.handler.kind);
          }
        }
      },
    });
    for (const { expression } of expressionsOf(component)) {
      for (const ref of expression.refs) features.codeReferenceKinds.add(ref.kind);
    }
    for (const { code } of codeOf(component)) {
      for (const ref of code.refs) features.codeReferenceKinds.add(ref.kind);
    }
  }
  return features;
}

/** The attributes of a node: an element's, a component's or a `Dynamic` node's, or none. */
function attributesOf(node: VisitedNode): readonly AnyAttribute[] {
  switch (node.kind) {
    case "Element":
    case "Component":
    case "Dynamic":
      return node.attributes;
    case "Fragment":
    case "Text":
    case "Interpolation":
    case "If":
    case "For":
    case "SlotOutlet":
      return [];
    default:
      return unreachable(node);
  }
}

/** An expression of a component, with where it is. */
export interface LocatedExpression {
  expression: Expression;
  /** A JSON Pointer to the expression: from the component, after `base`. */
  path: string;
}

/**
 * Every render expression of a component, in document order: the props' defaults and the
 * models', then the render tree's interpolations, conditions, list sources and keys, attribute
 * values (bound attributes, class parts, style declarations, spreads, props and models), slot
 * outlets' props, `Dynamic` nodes' choices and scoped fills' parameter defaults. `base` prefixes
 * each path, such as `/components/0`. Setup code and handlers are {@link codeOf}'s: a template
 * reads only these (ADR-0045).
 */
export function expressionsOf(component: UfComponent, base = ""): LocatedExpression[] {
  const found: LocatedExpression[] = [];
  const add = (expression: Expression, path: string) => found.push({ expression, path });
  for (const [index, prop] of component.props.entries()) {
    if (prop.default) add(prop.default, `${base}/props/${index}/default`);
  }
  for (const [index, item] of component.setup.entries()) {
    if (item.kind === "Model" && item.default) add(item.default, `${base}/setup/${index}/default`);
  }
  const attributes = (node: { attributes: readonly AnyAttribute[] }, path: string) => {
    for (const [index, attribute] of node.attributes.entries()) {
      attributeExpressions(attribute, `${path}/attributes/${index}`, add);
    }
  };
  const fills = (list: readonly SlotFill[], path: string) => {
    for (const [index, fill] of list.entries()) {
      const at = `${path}/${index}`;
      if (fill.parameter?.default) add(fill.parameter.default, `${at}/parameter/default`);
      for (const [child, nested] of fill.children.entries()) {
        visit(nested, `${at}/children/${child}`);
      }
    }
  };
  const visit = (node: VisitedNode, path: string): void => {
    switch (node.kind) {
      case "Element":
        attributes(node, path);
        for (const [index, child] of node.children.entries()) {
          visit(child, `${path}/children/${index}`);
        }
        return;
      case "Component":
        attributes(node, path);
        fills(node.fills, `${path}/fills`);
        return;
      case "SlotOutlet":
        if (node.props) add(node.props, `${path}/props`);
        for (const [index, child] of node.fallback.entries()) {
          visit(child, `${path}/fallback/${index}`);
        }
        return;
      case "Dynamic":
        add(node.is, `${path}/is`);
        attributes(node, path);
        for (const [index, child] of node.children.entries()) {
          visit(child, `${path}/children/${index}`);
        }
        fills(node.fills ?? [], `${path}/fills`);
        return;
      case "Fragment":
        for (const [index, child] of node.children.entries()) {
          visit(child, `${path}/children/${index}`);
        }
        return;
      case "Interpolation":
        add(node.value, `${path}/value`);
        return;
      case "If":
        for (const [index, branch] of node.branches.entries()) {
          const at = `${path}/branches/${index}`;
          if (branch.condition) add(branch.condition, `${at}/condition`);
          for (const [child, nested] of branch.children.entries()) {
            visit(nested, `${at}/children/${child}`);
          }
        }
        return;
      case "For":
        add(node.source, `${path}/source`);
        add(node.key, `${path}/key`);
        visit(node.body, `${path}/body`);
        return;
      case "Text":
        return;
      default:
        unreachable(node);
    }
  };
  visit(component.render, `${base}/render`);
  return found;
}

function attributeExpressions(
  attribute: AnyAttribute,
  path: string,
  add: (expression: Expression, path: string) => void,
): void {
  switch (attribute.kind) {
    case "Static":
      return;
    case "Bound":
    case "Spread":
    case "Model":
    case "Prop":
    case "ModelBinding":
      add(attribute.value, `${path}/value`);
      return;
    case "Class":
      for (const [index, item] of attribute.items.entries()) {
        const at = `${path}/items/${index}`;
        if (item.kind === "Toggle") add(item.condition, `${at}/condition`);
        else if (item.kind === "Dynamic") add(item.value, `${at}/value`);
      }
      return;
    case "Style":
      for (const [index, declaration] of attribute.declarations.entries()) {
        if (declaration.kind === "Bound") {
          add(declaration.value, `${path}/declarations/${index}/value`);
        }
      }
      return;
    case "Event":
    case "Ref":
    case "Listener":
      return;
    default:
      unreachable(attribute);
  }
}

/**
 * Where code runs (ADR-0045): `render` for the template's expressions, `pure` for what the setup
 * evaluates (the initial values of `ref`, `const` and `let`, the getters of `computed` and of
 * watch sources, a provided value and an `inject`'s fallback), and `client` for what runs in the
 * browser (handlers, watch callbacks, `watchEffect`, lifecycle hooks and the setup's functions).
 */
export type CodeContext = "render" | "pure" | "client";

/**
 * What a function is for: a getter (of a `computed` or of a watch source), a setup function, a
 * watch callback, an effect, a lifecycle hook or a handler written in place.
 */
export type FunctionRole =
  | "getter"
  | "function"
  | "watch"
  | "watchEffect"
  | "lifecycle"
  | "handler";

/** A function of a component, with where it is, the context its body runs in and its role. */
export interface LocatedFunction {
  function: FunctionCode;
  /** A JSON Pointer to the function: from the component, after `base`. */
  path: string;
  context: Exclude<CodeContext, "render">;
  role: FunctionRole;
}

/**
 * Every function a component's source writes, in source order: the setup's getters, functions,
 * watch sources and callbacks, effects and hooks, then the handlers written in the render tree,
 * in document order. A setup function's body is client code: what a template or a getter may
 * call of it, its summary says (`summarize`).
 */
export function functionsOf(component: UfComponent, base = ""): LocatedFunction[] {
  return partsOf(component, base).flatMap((part) => ("function" in part ? [part] : []));
}

/**
 * A setup item's value: the code of a `ref`'s, a `const`'s or a `let`'s initial value, a provided
 * value or an `inject`'s fallback.
 */
interface LocatedValue {
  value: Code;
  path: string;
}

/** The values and functions of a component, in source order, then its inline handlers. */
function partsOf(component: UfComponent, base: string): (LocatedValue | LocatedFunction)[] {
  const parts: (LocatedValue | LocatedFunction)[] = [];
  const add = (
    fn: FunctionCode,
    path: string,
    context: LocatedFunction["context"],
    role: FunctionRole,
  ) => parts.push({ function: fn, path, context, role });
  for (const [index, item] of component.setup.entries()) {
    const path = `${base}/setup/${index}`;
    switch (item.kind) {
      case "State":
      case "Variable":
        if (item.initial) parts.push({ value: item.initial, path: `${path}/initial` });
        break;
      case "Const":
        parts.push({ value: item.value, path: `${path}/value` });
        break;
      case "Derived":
        add(item.getter, `${path}/getter`, "pure", "getter");
        break;
      case "Function":
        add(item.function, `${path}/function`, "client", "function");
        break;
      case "Watch":
        for (const [position, source] of item.sources.entries()) {
          if (source.kind === "Getter") {
            add(source.getter, `${path}/sources/${position}/getter`, "pure", "getter");
          }
        }
        add(item.callback, `${path}/callback`, "client", "watch");
        break;
      case "WatchEffect":
        add(item.effect, `${path}/effect`, "client", "watchEffect");
        break;
      case "Lifecycle":
        add(item.callback, `${path}/callback`, "client", "lifecycle");
        break;
      case "Provide":
        parts.push({ value: item.value, path: `${path}/value` });
        break;
      case "Inject":
        if (item.fallback) parts.push({ value: item.fallback, path: `${path}/fallback` });
        break;
      case "TemplateRef":
      case "Id":
      case "Model":
        break;
      default:
        unreachable(item);
    }
  }
  walkHandlers(component.render, `${base}/render`, (attribute, path) => {
    if (attribute.handler.kind === "Inline") {
      add(attribute.handler.function, `${path}/handler/function`, "client", "handler");
    }
  });
  return parts;
}

/**
 * Calls `visit` for each listener of a render tree, an element's or a component's, in document
 * order, with its path.
 */
function walkHandlers(
  node: VisitedNode,
  path: string,
  visit: (attribute: EventAttribute | ListenerAttribute, path: string) => void,
): void {
  const attributes = (list: readonly AnyAttribute[]) => {
    for (const [index, attribute] of list.entries()) {
      if (attribute.kind === "Event" || attribute.kind === "Listener") {
        visit(attribute, `${path}/attributes/${index}`);
      }
    }
  };
  const fills = (list: readonly SlotFill[]) => {
    for (const [index, fill] of list.entries()) {
      for (const [child, nested] of fill.children.entries()) {
        walkHandlers(nested, `${path}/fills/${index}/children/${child}`, visit);
      }
    }
  };
  switch (node.kind) {
    case "Element":
      attributes(node.attributes);
      for (const [index, child] of node.children.entries()) {
        walkHandlers(child, `${path}/children/${index}`, visit);
      }
      return;
    case "Component":
      attributes(node.attributes);
      fills(node.fills);
      return;
    case "SlotOutlet":
      for (const [index, child] of node.fallback.entries()) {
        walkHandlers(child, `${path}/fallback/${index}`, visit);
      }
      return;
    case "Dynamic":
      attributes(node.attributes);
      for (const [index, child] of node.children.entries()) {
        walkHandlers(child, `${path}/children/${index}`, visit);
      }
      fills(node.fills ?? []);
      return;
    case "Fragment":
      for (const [index, child] of node.children.entries()) {
        walkHandlers(child, `${path}/children/${index}`, visit);
      }
      return;
    case "If":
      for (const [index, branch] of node.branches.entries()) {
        for (const [child, nested] of branch.children.entries()) {
          walkHandlers(nested, `${path}/branches/${index}/children/${child}`, visit);
        }
      }
      return;
    case "For":
      walkHandlers(node.body, `${path}/body`, visit);
      return;
    case "Text":
    case "Interpolation":
      return;
    default:
      unreachable(node);
  }
}

/** A piece of setup code of a component, with where it is and the context it runs in. */
export interface LocatedCode {
  code: Code;
  /** A JSON Pointer to the code: from the component, after `base`. */
  path: string;
  context: Exclude<CodeContext, "render">;
}

/**
 * Every piece of code of a component outside its template's expressions, in source order: the
 * setup's initial values and values, the bodies of its functions ({@link functionsOf}), and after
 * each body the conditions of its `preventDefault()` and `stopPropagation()` calls, which repeat
 * a part of it. `base` prefixes each path.
 */
export function codeOf(component: UfComponent, base = ""): LocatedCode[] {
  return partsOf(component, base).flatMap((part): LocatedCode[] => {
    if ("value" in part) return [{ code: part.value, path: part.path, context: "pure" }];
    const { function: fn, path, context } = part;
    return [
      { code: fn.body, path: `${path}/body`, context },
      ...(fn.eventControls ?? []).flatMap((control, index) =>
        control.condition
          ? [{ code: control.condition, path: `${path}/eventControls/${index}/condition`, context }]
          : [],
      ),
    ];
  });
}

/** A span of a module, with where it is. */
export interface LocatedSpan {
  span: Span;
  /** A JSON Pointer to the span. */
  path: string;
}

/** Adds a span found at a JSON Pointer. */
type AddSpan = (span: Span, path: string) => void;

/**
 * Every span of a module, each with a JSON Pointer to it: components, exports, type
 * declarations, imports and their names, injection keys, props, events, slots and their types,
 * what a component exposes, bindings, setup items, functions, parameters, every node, branch,
 * attribute, handler, fill, class part, style declaration and spread key, and every expression,
 * piece of code and reference, with a write's target and value and an emit's arguments. A child's
 * API points into another file, so it has none. What points into the source (diagnostics, a
 * plugin's module) is checked span by span with it.
 */
export function spansOf(module: UfModule): LocatedSpan[] {
  const found: LocatedSpan[] = [];
  const at: AddSpan = (span, path) => found.push({ span, path });
  const add: AddSpan = (span, path) => at(span, `${path}/span`);
  for (const [index, component] of module.components.entries()) {
    const base = `/components/${index}`;
    add(component.span, base);
    if (component.propsParameter) {
      add(component.propsParameter.span, `${base}/propsParameter`);
      add(component.propsParameter.type.span, `${base}/propsParameter/type`);
    }
    for (const [prop, { span, type }] of component.props.entries()) {
      add(span, `${base}/props/${prop}`);
      add(type.span, `${base}/props/${prop}/type`);
    }
    if (component.emits) {
      const { emits } = component;
      add(emits.type.span, `${base}/emits/type`);
      for (const [event, declaration] of emits.events.entries()) {
        const path = `${base}/emits/events/${event}`;
        for (const [member, { span, type }] of declaration.parameters.entries()) {
          add(type.span, `${path}/parameters/${member}/type`);
          add(span, `${path}/parameters/${member}`);
        }
        add(declaration.span, path);
      }
      add(emits.span, `${base}/emits`);
    }
    if (component.slots) {
      const { slots } = component;
      add(slots.type.span, `${base}/slots/type`);
      for (const [slot, declaration] of slots.slots.entries()) {
        const path = `${base}/slots/slots/${slot}`;
        if (declaration.props) add(declaration.props.span, `${path}/props`);
        add(declaration.span, path);
      }
      add(slots.span, `${base}/slots`);
    }
    if (component.exposes) add(component.exposes.span, `${base}/exposes`);
    for (const [binding, { span }] of component.bindings.entries()) {
      add(span, `${base}/bindings/${binding}`);
    }
    for (const [position, item] of component.setup.entries()) {
      const path = `${base}/setup/${position}`;
      if ("type" in item && item.type) add(item.type.span, `${path}/type`);
      if (item.kind === "Watch") {
        for (const [source, { span }] of item.sources.entries()) {
          add(span, `${path}/sources/${source}`);
        }
      }
      add(item.span, path);
    }
    walkSpans(component.render, `${base}/render`, add);
    for (const located of expressionsOf(component, base)) {
      expressionSpans(located.expression, located.path, add);
    }
    for (const located of functionsOf(component, base)) {
      functionSpans(located.function, located.path, add);
    }
    for (const located of codeOf(component, base)) codeSpans(located.code, located.path, at);
  }
  for (const [index, entry] of module.exports.entries()) add(entry.span, `/exports/${index}`);
  for (const [index, declaration] of module.types.entries()) {
    add(declaration.span, `/types/${index}`);
  }
  for (const [index, entry] of (module.imports ?? []).entries()) {
    for (const [name, { span }] of entry.names.entries()) {
      add(span, `/imports/${index}/names/${name}`);
    }
    add(entry.span, `/imports/${index}`);
  }
  for (const [index, key] of (module.keys ?? []).entries()) {
    add(key.type.span, `/keys/${index}/type`);
    add(key.span, `/keys/${index}`);
  }
  return found;
}

/** The spans of an expression and of its references. */
function expressionSpans(value: Expression, path: string, add: AddSpan): void {
  add(value.span, path);
  for (const [index, ref] of value.refs.entries()) add(ref.span, `${path}/refs/${index}`);
}

/** The spans of a piece of code and of its references, a write's and an emit's parts included. */
function codeSpans(code: Code, path: string, at: AddSpan): void {
  at(code.span, `${path}/span`);
  for (const [index, ref] of code.refs.entries()) {
    const pointer = `${path}/refs/${index}`;
    at(ref.span, `${pointer}/span`);
    if (ref.kind === "Write") {
      at(ref.target, `${pointer}/target`);
      if (ref.value) at(ref.value, `${pointer}/value`);
    } else if (ref.kind === "Emit") {
      for (const [argument, span] of ref.arguments.entries()) {
        at(span, `${pointer}/arguments/${argument}`);
      }
    }
  }
}

/**
 * The spans of a function, its parameters (their types, patterns and static defaults), its return
 * type and its event controls. Its body and the controls' conditions are code ({@link codeOf}).
 */
function functionSpans(fn: FunctionCode, path: string, add: AddSpan): void {
  for (const [index, parameter] of fn.parameters.entries()) {
    parameterSpans(parameter, `${path}/parameters/${index}`, add);
  }
  if (fn.returnType) add(fn.returnType.span, `${path}/returnType`);
  for (const [index, control] of (fn.eventControls ?? []).entries()) {
    add(control.span, `${path}/eventControls/${index}`);
  }
  add(fn.span, path);
}

/**
 * The spans of a parameter: its pattern, its type, its static default and its expression's
 * references, and itself.
 */
function parameterSpans(parameter: Parameter, at: string, add: AddSpan): void {
  if (parameter.pattern) add(parameter.pattern.span, `${at}/pattern`);
  if (parameter.type) add(parameter.type.span, `${at}/type`);
  if (parameter.default) expressionSpans(parameter.default, `${at}/default`, add);
  add(parameter.span, at);
}

/** The spans of an attribute and of its parts: class parts, style declarations, keys, handler. */
function attributeSpans(attribute: AnyAttribute, at: string, add: AddSpan): void {
  add(attribute.span, at);
  switch (attribute.kind) {
    case "Static":
    case "Bound":
    case "Ref":
    case "Model":
    case "Prop":
    case "ModelBinding":
      return;
    case "Class":
      for (const [item, { span }] of attribute.items.entries()) {
        add(span, `${at}/items/${item}`);
      }
      return;
    case "Style":
      for (const [item, { span }] of attribute.declarations.entries()) {
        add(span, `${at}/declarations/${item}`);
      }
      return;
    case "Spread":
      for (const [item, { span }] of attribute.keys.entries()) add(span, `${at}/keys/${item}`);
      return;
    case "Event":
    case "Listener":
      add(attribute.handler.span, `${at}/handler`);
      return;
    default:
      unreachable(attribute);
  }
}

/**
 * The spans of fills: each fill, its parameter (a default's expression is
 * {@link expressionsOf}'s) and its children.
 */
function fillSpans(fills: readonly SlotFill[], path: string, add: AddSpan): void {
  for (const [index, fill] of fills.entries()) {
    const at = `${path}/${index}`;
    add(fill.span, at);
    if (fill.parameter) {
      const { parameter } = fill;
      if (parameter.pattern) add(parameter.pattern.span, `${at}/parameter/pattern`);
      if (parameter.type) add(parameter.type.span, `${at}/parameter/type`);
      add(parameter.span, `${at}/parameter`);
    }
    for (const [child, nested] of fill.children.entries()) {
      walkSpans(nested, `${at}/children/${child}`, add);
    }
  }
}

/** The spans of nodes, branches, attributes, handlers, fills and their parts (code aside). */
function walkSpans(node: VisitedNode, path: string, add: AddSpan) {
  add(node.span, path);
  switch (node.kind) {
    case "Element":
      for (const [index, attribute] of node.attributes.entries()) {
        attributeSpans(attribute, `${path}/attributes/${index}`, add);
      }
      for (const [index, child] of node.children.entries()) {
        walkSpans(child, `${path}/children/${index}`, add);
      }
      return;
    case "Component":
      for (const [index, attribute] of node.attributes.entries()) {
        attributeSpans(attribute, `${path}/attributes/${index}`, add);
      }
      fillSpans(node.fills, `${path}/fills`, add);
      return;
    case "SlotOutlet":
      for (const [index, child] of node.fallback.entries()) {
        walkSpans(child, `${path}/fallback/${index}`, add);
      }
      return;
    case "Dynamic":
      for (const [index, attribute] of node.attributes.entries()) {
        attributeSpans(attribute, `${path}/attributes/${index}`, add);
      }
      for (const [index, child] of node.children.entries()) {
        walkSpans(child, `${path}/children/${index}`, add);
      }
      fillSpans(node.fills ?? [], `${path}/fills`, add);
      return;
    case "Fragment":
      for (const [index, child] of node.children.entries()) {
        walkSpans(child, `${path}/children/${index}`, add);
      }
      return;
    case "If":
      for (const [index, branch] of node.branches.entries()) {
        const at = `${path}/branches/${index}`;
        add(branch.span, at);
        for (const [child, nested] of branch.children.entries()) {
          walkSpans(nested, `${at}/children/${child}`, add);
        }
      }
      return;
    case "For":
      walkSpans(node.body, `${path}/body`, add);
      return;
    case "Text":
    case "Interpolation":
      return;
    default:
      unreachable(node);
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
