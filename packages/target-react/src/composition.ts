// Composition in React (ADR-0053 to ADR-0055): what a component takes beside the source's props,
// and what it hands its children. A slot is a prop, `children` for the default one, the slot's own
// name for a named one, and a render prop `render<Slot>` for a scoped one (oxlint's
// `react/no-unstable-nested-components` exempts those names, ADR-0054). A model is a controllable
// prop with its change callback, `value` and `onValueChange`, and local state while the parent
// binds nothing (§4.5). A `class` and a `style` fall through as `className` and `style` props,
// merged into the root. What `defineExpose` exposes is the `ref` prop's handle
// (`useImperativeHandle`). An injection key is a React context, provided around the template and
// read with `use`. `<component is>` renders a `const` the body declares.
import {
  childImports,
  keyImports,
  keyOwner,
  pascalCase,
  scopeRoots,
} from "@unframework.dev/codegen";
import type { ChildImport, ImportSet, KeyImport } from "@unframework.dev/codegen";
import { codeOf, walk } from "@unframework.dev/ir";
import type {
  BindingId,
  Code,
  ComponentApi,
  ComponentNode,
  DynamicNode,
  ElementNode,
  FunctionCode,
  ModelItem,
  ProvideItem,
  RefType,
  RenderNode,
  Span,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";

/** The scope helper's name, before the name scope makes it unique. */
export const SCOPE_HELPER = "scopeAttributes";

/** A slot the component declares: the prop it is passed as, and how code reads it. */
export interface SlotPlan {
  /** `children`, `title`, or `renderItem` for a scoped slot. */
  prop: string;
  /** The destructured local, or `props.title` in the object form. */
  local: string;
  /** Whether the slot passes props: a render prop. */
  scoped: boolean;
  /** Whether any code reads it: only those are destructured. */
  read: boolean;
}

/** A model the component declares (ADR-0054): a controllable prop and its change callback. */
export interface ModelPlan {
  item: ModelItem;
  /** The model's binding: what render code reads. */
  name: string;
  /** The prop, the model's name: `value`. */
  prop: string;
  /**
   * How code reads the prop: the binding's own name where the model is its prop, `valueProp`
   * where the binding takes `value`, or `props.value`.
   */
  propLocal: string;
  /** The change callback's prop: `onValueChange`. */
  event: string;
  /** How code calls it. */
  eventLocal: string;
  /** Whether a write calls it: code writes the model, or a `v-model` binds it. */
  calls: boolean;
  /**
   * The local state of an unbound model, where code writes it or a child binds it: without one,
   * the model is its prop, with its default.
   */
  local?: { value: string; setter: string };
  /** The mirror client code reads and writes, where client code writes the model. */
  mirror?: string;
}

/** What the component's root takes of a consumer's `class` and `style` (ADR-0054). */
export interface FallthroughPlan {
  /**
   * The node they merge into: the render root's element, its one component, or its one
   * `<component is>` over tags (ADR-0119), or with `inheritAttrs: false` the element that spreads
   * the props' rest (ADR-0118).
   */
  root: ElementNode | ComponentNode | DynamicNode;
  className: string;
  style: string;
}

/**
 * What a consumer passes that the component does not declare (ADR-0118): its attributes, its
 * listeners and its `ref`, which the props' rest holds and the fallthrough node spreads after
 * its own attributes, so the consumer's win.
 */
export interface PassingPlan {
  /**
   * The tags of the element it lands on, which type it: one (the child's `fallthroughTag`), or a
   * `<component is>` root's, where it lands on whichever renders (ADR-0122).
   */
  tags: readonly string[];
  /** The node that spreads it: the {@link FallthroughPlan.root}. */
  target: ElementNode | ComponentNode | DynamicNode;
  /**
   * Whether the target is the element that spreads the props' rest, inside the root: the root
   * keeps the styled parents' scope attributes, and the `ref` (ADR-0063).
   */
  inner: boolean;
  /** The rest's local: `attributes`. */
  rest: string;
  /**
   * The names a consumer passes the component's own props by (its props, its events' and its
   * models' callbacks, its slots, and `children`): none of them passes through.
   */
  declared: readonly string[];
  /**
   * The tags of the element a `ref` on the component holds, where it exposes nothing and has one
   * (the child's `refTag`, or a `<component is>` root's `refTags`, ADR-0122).
   */
  refTags?: readonly string[];
}

/**
 * Where the scope attributes of the styled parents that render the component land (the
 * child-root rule, ADR-0063): its root nodes (`scopeRoots`), each of which spreads them.
 */
export interface ScopePlan {
  /** The root nodes, by `start:end` of their spans. */
  roots: ReadonlySet<string>;
  /**
   * What the roots pick the attributes out of: the props pattern's rest (`attributes`), or the
   * props object of the object form.
   */
  props: string;
  /** The inline helper that picks them, `scopeAttributes`. */
  helper: string;
}

/** A span's key in {@link ScopePlan.roots}. */
export function spanKey(span: Span): string {
  return `${span.start}:${span.end}`;
}

/** The composition of one component on React. */
export interface CompositionPlan {
  /** The children the template renders, each once, and how they are imported. */
  readonly children: readonly ChildImport[];
  /** The injection keys the setup names, each once. */
  readonly keys: readonly KeyImport[];
  /** Whether the component's output declares its module's keys. */
  readonly ownsKeys: boolean;
  /** The slots, by name, in member order. */
  readonly slots: ReadonlyMap<string, SlotPlan>;
  /** The models, by binding, in source order. */
  readonly models: ReadonlyMap<BindingId, ModelPlan>;
  readonly fallthrough?: FallthroughPlan;
  /** What passes through to the fallthrough node, where its tag is known (ADR-0118). */
  readonly passing?: PassingPlan;
  /**
   * The tags of the root element a consumer's `ref` holds where nothing passes through:
   * fallthrough is off, no element spreads the props' rest, and the component exposes nothing
   * (ADR-0118). Several for a `<component is>` root, whichever renders (ADR-0122).
   */
  readonly refTags?: readonly string[];
  readonly scope?: ScopePlan;
  /** The `ref` prop's local and the handle's interface, where the component exposes functions. */
  readonly expose?: { ref: string; handle: string };
  /** The local each `provide` names its value by. */
  readonly provided: ReadonlyMap<ProvideItem, string>;
  /**
   * The `const` each `<component is>` is rendered through, by the node's start: the printer's
   * node may be a copy. One the body declares is `hoisted`; one inside a list, a branch or a
   * scoped fill reads what only that scope has, and is declared where it renders.
   */
  readonly dynamic: ReadonlyMap<number, { node: DynamicNode; name: string; hoisted: boolean }>;
  /** The generated interfaces of the slots' and the models' props, and of the root's. */
  readonly interfaces: { slots?: string; models?: string; attributes?: string };
  /** The state a `v-model` binds: it needs its setter, whoever else writes it. */
  readonly bound: ReadonlySet<BindingId>;
  /** The state a control's `v-model` writes and client code reads: it needs a mirror. */
  readonly mirrored: ReadonlySet<BindingId>;
  /**
   * Whether a child's slot is scoped, as the child declares it, by the child's local name and the
   * slot: a fill is a render prop where the slot is one, with a parameter or without.
   */
  scoped(component: string, slot: string): boolean;
}

/**
 * Plans a component's composition, claiming its names in `names` after the source's: the
 * children's and the keys' locals are the source's own.
 */
export function planComposition(
  component: UfComponent,
  module: UfModule,
  names: ImportSet,
  written: ReadonlySet<BindingId>,
): CompositionPlan {
  const children = childImports(component, module, (name) => name);
  const keys = keyImports(component, module, (name) => name);
  for (const child of children) names.reserve(child.local);
  for (const key of keys) names.reserve(key.local);
  const ownsKeys =
    (module.keys?.length ?? 0) > 0 &&
    keyOwner(module.components, module.exports) === component.name;
  if (ownsKeys) for (const key of module.keys!) names.reserve(key.name);
  const object = component.propsParameter?.form === "object" ? component.propsParameter.name! : "";
  // A prop's own name where nothing takes it, `<name>Prop` otherwise.
  const propLocal = (prop: string) => {
    if (object) return `${object}.${prop}`;
    return names.scope.has(prop) || RESERVED_WORDS.has(prop)
      ? names.claim(`${prop}Prop`)
      : names.claim(prop);
  };

  // What the template and the setup bind with `v-model`: a state's setter, or a model's. One a
  // control's `v-model` writes and client code reads gets a mirror: a listener that runs after
  // the write, beside the control or around it, reads it there (ADR-0046).
  const bound = new Set<BindingId>();
  const controlled = new Set<BindingId>();
  walk(component.render, {
    enter(node) {
      const attributes =
        node.kind === "Element" || node.kind === "Component" || node.kind === "Dynamic"
          ? node.attributes
          : [];
      for (const attribute of attributes) {
        if (attribute.kind === "Model" || attribute.kind === "ModelBinding") {
          const [reference] = attribute.value.refs;
          if (reference?.kind !== "Binding") continue;
          bound.add(reference.binding);
          if (attribute.kind === "Model") controlled.add(reference.binding);
        }
      }
    },
  });

  const mirrored = new Set<BindingId>();
  for (const { code, context } of codeOf(component)) {
    if (context !== "client") continue;
    for (const reference of code.refs) {
      if (reference.kind === "Binding" && controlled.has(reference.binding)) {
        mirrored.add(reference.binding);
      }
    }
  }

  const slotReads = readSlots(component);
  const slots = new Map<string, SlotPlan>();
  for (const slot of component.slots?.slots ?? []) {
    const scoped = slot.props !== undefined;
    const prop = slotProp(slot.name, scoped);
    const read = slotReads.has(slot.name);
    slots.set(slot.name, { prop, local: read ? propLocal(prop) : prop, scoped, read });
  }

  const models = new Map<BindingId, ModelPlan>();
  for (const item of component.setup) {
    if (item.kind !== "Model") continue;
    const binding = component.bindings.find((each) => each.id === item.binding)!;
    const event = `on${pascalCase(item.name)}Change`;
    const writes = written.has(item.binding);
    // A model nothing writes is its prop, destructured under the binding's name with its
    // default; one that is written keeps local state while it is unbound. A required one is
    // always bound: it is its prop, and its local state only makes a write render.
    const calls = writes || bound.has(item.binding);
    const local = calls || object !== "";
    const plan: ModelPlan = {
      item,
      name: binding.name,
      prop: item.name,
      propLocal:
        local && !item.required
          ? propLocal(item.name)
          : object
            ? `${object}.${item.name}`
            : binding.name,
      event,
      eventLocal: calls ? (object ? `${object}.${event}` : names.claim(event)) : event,
      calls,
    };
    if (local) {
      const base = pascalCase(binding.name);
      plan.local = { value: names.claim(`local${base}`), setter: names.claim(`setLocal${base}`) };
    }
    if (writes || mirrored.has(item.binding)) plan.mirror = names.claim(`${binding.name}Ref`);
    models.set(item.binding, plan);
  }

  const root = fallthroughRoot(component);
  const tags = root && fallthroughTags(module, root, new Set([component.name]));
  const tag = tags?.[0];
  // The object form takes what passes through out of its props object with a pattern in its
  // body, whose locals the consumer's `class` and `style` are (ADR-0118).
  const local = (prop: string) =>
    tag !== undefined && object ? names.claim(prop) : propLocal(prop);
  const fallthrough: FallthroughPlan | undefined = root && {
    root,
    className: local("className"),
    style: local("style"),
  };
  const inner = root !== undefined && component.inheritAttrs === false;
  // Beside the props' rest on another element, the root keeps the styled parents' scope
  // attributes, as it would without the rest, where it is one element or component (ADR-0118).
  const single =
    component.render.kind === "Element"
      ? component.render
      : component.render.children.length === 1 && component.render.children[0]!.kind === "Component"
        ? component.render.children[0]!
        : undefined;
  const roots = inner ? (single ? [single.span] : []) : scopeRoots(component);
  // The root that spreads the rest passes the styled parents' scope attributes with it, and the
  // rest's own element leaves them to the root, which picks them out (ADR-0063, ADR-0118).
  const scope: ScopePlan | undefined =
    roots.length && (tag === undefined || inner)
      ? {
          roots: new Set(roots.map(spanKey)),
          props: object && tag === undefined ? object : names.claim("attributes"),
          helper: names.claim(SCOPE_HELPER),
        }
      : undefined;
  const refTags = component.exposes ? undefined : refTagsOf(component, module);
  const passing: PassingPlan | undefined =
    root && tags !== undefined
      ? {
          tags,
          target: root,
          inner,
          rest: scope?.props ?? names.claim("attributes"),
          declared: declaredProps(component),
          ...(refTags ? { refTags } : {}),
        }
      : undefined;
  // With fallthrough off and no rest, nothing passes through, but a ref on the component still
  // holds its root element (ADR-0118).
  const refRoot: { refTags?: readonly string[] } = passing || !refTags ? {} : { refTags };
  const expose = component.exposes && {
    ref: propLocal("ref"),
    handle: names.claim(`${component.name}Handle`),
  };

  const provided = new Map<ProvideItem, string>();
  for (const item of component.setup) {
    if (item.kind !== "Provide") continue;
    const base = item.key.replace(/Key$/, "") || item.key;
    provided.set(item, names.claim(`${base.charAt(0).toLowerCase()}${base.slice(1)}Value`));
  }

  const dynamic = new Map<number, { node: DynamicNode; name: string; hoisted: boolean }>();
  const visit = (nodes: readonly RenderNode[], scoped: boolean): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case "Element":
          visit(node.children, scoped);
          break;
        case "If":
          for (const branch of node.branches) visit(branch.children, true);
          break;
        case "For":
          visit([node.body], true);
          break;
        case "Component":
          for (const fill of node.fills)
            visit(fill.children, scoped || fill.parameter !== undefined);
          break;
        case "SlotOutlet":
          visit(node.fallback, scoped);
          break;
        case "Dynamic":
          dynamic.set(node.span.start, { node, name: names.claim("Tag"), hoisted: !scoped });
          visit(node.children, scoped);
          for (const fill of node.fills ?? []) {
            visit(fill.children, scoped || fill.parameter !== undefined);
          }
          break;
        case "Teleport":
        case "Transition":
          visit(node.children, scoped);
          break;
        case "Text":
        case "Interpolation":
          break;
        default:
          node satisfies never;
      }
    }
  };
  visit(
    component.render.kind === "Element" ? [component.render] : component.render.children,
    false,
  );

  const interfaces: CompositionPlan["interfaces"] = {};
  if (slots.size) interfaces.slots = names.claim(`${component.name}Slots`);
  if (models.size) interfaces.models = names.claim(`${component.name}Models`);
  if (fallthrough || expose || refRoot.refTags !== undefined) {
    interfaces.attributes = names.claim(`${component.name}Attributes`);
  }

  // The slots each child declares: its module's own components, or the resolver's API.
  const childSlots = new Map<string, Set<string>>();
  for (const child of children) {
    const own = module.components.find((each) => each.name === child.name);
    const imported = module.imports
      ?.find((entry) =>
        entry.names.some((name) => name.kind === "Component" && name.local === child.local),
      )
      ?.api.components.find((each) => each.name === child.name);
    const scopedSlots = imported
      ? imported.slots.filter((slot) => slot.props !== undefined).map((slot) => slot.name)
      : (own?.slots?.slots ?? []).filter((slot) => slot.props).map((slot) => slot.name);
    childSlots.set(child.local, new Set(scopedSlots));
  }

  return {
    children,
    keys,
    ownsKeys,
    scoped: (child, slot) => childSlots.get(child)?.has(slot) ?? false,
    slots,
    models,
    ...(fallthrough ? { fallthrough } : {}),
    ...(passing ? { passing } : {}),
    ...refRoot,
    ...(scope ? { scope } : {}),
    ...(expose ? { expose } : {}),
    provided,
    dynamic,
    interfaces,
    bound,
    mirrored,
  };
}

/**
 * The words a binding may not be named in strict-mode modules: a prop named so (a slot `case`, a
 * model `new`) is destructured under another local (`case: caseProp`).
 */
const RESERVED_WORDS: ReadonlySet<string> = new Set(
  `arguments await break case catch class const continue debugger default delete do else enum
  eval export extends false finally for function if implements import in instanceof interface let
  new null package private protected public return static super switch this throw true try typeof
  var void while with yield`.split(/\s+/),
);

/** The prop a slot is passed as: `children`, its own name, or `render<Slot>` for a scoped one. */
export function slotProp(slot: string, scoped: boolean): string {
  if (scoped) return `render${pascalCase(slot)}`;
  return slot === "default" ? "children" : slot;
}

/** The slots a component's template renders, tests or forwards. */
function readSlots(component: UfComponent): Set<string> {
  const found = new Set<string>();
  const references = (code: Code | undefined) => {
    for (const reference of code?.refs ?? []) {
      if (reference.kind === "Slot") found.add(reference.slot);
    }
  };
  walk(component.render, {
    enter(node) {
      if (node.kind === "SlotOutlet") found.add(node.slot);
      if (node.kind === "Component" || node.kind === "Dynamic") {
        for (const fill of node.fills ?? []) if (fill.forward) found.add(fill.forward);
      }
      if (node.kind === "If") for (const branch of node.branches) references(branch.condition);
      if (node.kind === "Interpolation") references(node.value);
    },
  });
  return found;
}

/**
 * The node a consumer's `class` and `style` merge into (ADR-0054): the render root's element, or
 * the one component or `<component is>` over tags a fragment holds (ADR-0119), and where
 * `inheritAttrs` is off the element that spreads the props' rest (ADR-0118). None where the root
 * is anything else, or `inheritAttrs` is off and no element spreads the rest, where a consumer's
 * `class` is UF3045.
 */
function fallthroughRoot(
  component: UfComponent,
): ElementNode | ComponentNode | DynamicNode | undefined {
  if (component.inheritAttrs === false) return restElement(component);
  const { render } = component;
  if (render.kind === "Element") return render;
  const [only] = render.children;
  if (render.children.length !== 1) return undefined;
  if (only?.kind === "Component") return only;
  return only?.kind === "Dynamic" && only.candidates.every((each) => each.kind === "Tag")
    ? only
    : undefined;
}

/** The element that spreads the props' rest, `<input {...rest} />`: one at most (ADR-0118). */
function restElement(component: UfComponent): ElementNode | undefined {
  let found: ElementNode | undefined;
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element" || found) return;
      if (node.attributes.some((attribute) => attribute.kind === "Rest")) found = node;
    },
  });
  return found;
}

/**
 * The tags of the element what passes through a fallthrough node lands on (ADR-0118): an
 * element's own, a `<component is>`'s candidates (ADR-0122), or a component's, as its API gives
 * them (`fallthroughTag`, or the `rootTags` of a `<component is>` root that keeps `inheritAttrs`)
 * or, for one of the module's own components, as its render says (`seen` stops a cycle).
 */
function fallthroughTags(
  module: UfModule,
  node: ElementNode | ComponentNode | DynamicNode,
  seen: Set<string>,
): readonly string[] | undefined {
  if (node.kind === "Element") return [node.tag];
  if (node.kind === "Dynamic") return candidateTags(node);
  const api = childApi(module, node.component);
  if (api) return apiFallthroughTags(api);
  const own = module.components.find((each) => each.name === node.component);
  if (!own || seen.has(own.name)) return undefined;
  seen.add(own.name);
  const root = fallthroughRoot(own);
  return root && fallthroughTags(module, root, seen);
}

/** The tags what falls through to a component lands on, as its API gives them (ADR-0122). */
function apiFallthroughTags(api: ComponentApi): readonly string[] | undefined {
  if (api.fallthroughTag !== undefined) return [api.fallthroughTag];
  return api.inheritAttrs ? api.rootTags : undefined;
}

/** The tags a `<component is>` over tags may render, in source order. */
function candidateTags(node: DynamicNode): string[] {
  return node.candidates.flatMap((candidate) => (candidate.kind === "Tag" ? [candidate.tag] : []));
}

/**
 * The tags of the element what a parent passes a child that it does not declare lands on
 * (ADR-0118, ADR-0122), or none where nothing but what it declares may be passed.
 */
export function componentFallthroughTags(
  module: UfModule,
  node: ComponentNode,
): readonly string[] | undefined {
  return fallthroughTags(module, node, new Set());
}

/**
 * The first of {@link componentFallthroughTags}: the tag the listeners a parent passes a child
 * are planned on, which every tag checks (ADR-0122).
 */
export function componentFallthroughTag(module: UfModule, node: ComponentNode): string | undefined {
  return componentFallthroughTags(module, node)?.[0];
}

/** The API the resolver gives for an imported child, by its local name. */
export function childApi(module: UfModule, local: string): ComponentApi | undefined {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) continue;
    return entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
  }
  return undefined;
}

/**
 * The tags of the element a `ref` on a component that exposes nothing holds (ADR-0118): its root
 * element's, its `<component is>` root's (ADR-0122), or its root component's own, through a
 * chain of root components.
 */
function refTagsOf(component: UfComponent, module: UfModule): readonly string[] | undefined {
  const seen = new Set<string>();
  let current: UfComponent | undefined = component;
  while (current && !seen.has(current.name)) {
    seen.add(current.name);
    const render: UfComponent["render"] = current.render;
    if (render.kind === "Element") return [render.tag];
    const only: RenderNode | undefined = render.children[0];
    if (render.children.length !== 1) return undefined;
    if (only?.kind === "Dynamic") {
      const tags = candidateTags(only);
      return tags.length === only.candidates.length ? tags : undefined;
    }
    if (only?.kind !== "Component") return undefined;
    const api = childApi(module, only.component);
    if (api) {
      if (api.exposes.length) return undefined;
      return api.refTag !== undefined ? [api.refTag] : api.refTags;
    }
    const name: string = only.component;
    current = module.components.find((each) => each.name === name);
    if (current?.exposes) return undefined;
  }
  return undefined;
}

/**
 * The names a consumer passes the component's own props by (ADR-0118): its props, its events'
 * callbacks (`onPick`), its models' values and callbacks, its slots, and `children` always,
 * which is content, never an attribute.
 */
function declaredProps(component: UfComponent): string[] {
  const names = new Set<string>(component.props.map((prop) => prop.name));
  for (const event of component.emits?.events ?? []) names.add(`on${pascalCase(event.name)}`);
  for (const item of component.setup) {
    if (item.kind !== "Model") continue;
    names.add(item.name);
    names.add(`on${pascalCase(item.name)}Change`);
  }
  for (const slot of component.slots?.slots ?? []) {
    names.add(slotProp(slot.name, slot.props !== undefined));
  }
  names.add("children");
  return [...names];
}

/**
 * The props a root component's element sets on it itself (ADR-0118): the props it declares, its
 * events' and models' callbacks, and its slots' fills. They are not the consumer's to pass, and
 * the component's own value has a type of its own (`value: number`), which no attribute's is. The
 * attributes and listeners that fall through to its root are the consumer's still: theirs win.
 */
export function rootComponentProps(
  node: ComponentNode,
  scoped: (child: string, slot: string) => boolean,
): string[] {
  const names = new Set<string>();
  for (const attribute of node.attributes) {
    if (attribute.kind === "Prop") names.add(attribute.name);
    else if (attribute.kind === "Listener") names.add(`on${pascalCase(attribute.event)}`);
    else if (attribute.kind === "ModelBinding") {
      names.add(attribute.model);
      names.add(`on${pascalCase(attribute.model)}Change`);
    }
  }
  for (const fill of node.fills) names.add(slotProp(fill.slot, scoped(node.component, fill.slot)));
  return [...names];
}

/** The authoring type of the ref a key holds, by the local name the setup uses. */
export function keyRef(module: UfModule, local: string): RefType | undefined {
  const own = module.keys?.find((key) => key.name === local);
  if (own) return own.ref;
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Key" && name.local === local);
    if (imported) return entry.api.keys.find((key) => key.name === imported.imported)?.ref;
  }
  return undefined;
}

/** Whether code is one reference to a binding, its whole text: a ref passed by its name. */
export function wholeReference(code: Code): boolean {
  const [only] = code.refs;
  return (
    code.refs.length === 1 &&
    only?.kind === "Binding" &&
    only.span.start === code.span.start &&
    only.span.end === code.span.end
  );
}

/** `Ref<number>` → `number`: the value type of a ref type, or the type where it is none. */
export function refValueType(type: string): string {
  const match = /^\s*(?:Ref|ComputedRef|ModelRef)\s*<([\s\S]*)>\s*$/.exec(type);
  return match ? match[1]!.trim() : type;
}

/**
 * The signature of a function the component exposes, as its handle declares it: a method, whose
 * parameters TypeScript compares both ways, so a parameter the source leaves untyped is `unknown`
 * and the function still fits; and `void` where it declares no return type (a caller's own type
 * of the handle only reads what it calls).
 */
export function exposedType(fn: FunctionCode, parameters: string): string {
  const returns = fn.returnType ? fn.returnType.code : fn.async ? "Promise<void>" : "void";
  return `(${parameters}): ${returns}`;
}
