// Composition in React (ADR-0053 to ADR-0055): what a component takes beside the source's props,
// and what it hands its children. A slot is a prop, `children` for the default one, the slot's own
// name for a named one, and a render prop `render<Slot>` for a scoped one (oxlint's
// `react/no-unstable-nested-components` exempts those names, ADR-0054). A model is a controllable
// prop with its change callback, `value` and `onValueChange`, and local state while the parent
// binds nothing (§4.5). A `class` and a `style` fall through as `className` and `style` props,
// merged into the root. What `defineExpose` exposes is the `ref` prop's handle
// (`useImperativeHandle`). An injection key is a React context, provided around the template and
// read with `use`. `<component is>` renders a `const` the body declares.
import { childImports, keyImports, keyOwner, pascalCase } from "@unframework/codegen";
import type { ChildImport, ImportSet, KeyImport } from "@unframework/codegen";
import { walk } from "@unframework/ir";
import type {
  BindingId,
  Code,
  ComponentNode,
  DynamicNode,
  ElementNode,
  FunctionCode,
  ModelItem,
  ProvideItem,
  RefType,
  UfComponent,
  UfModule,
} from "@unframework/ir";

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
  /** The root they merge into: the render root's element, or its one component. */
  root: ElementNode | ComponentNode;
  className: string;
  style: string;
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
  /** The `ref` prop's local and the handle's interface, where the component exposes functions. */
  readonly expose?: { ref: string; handle: string };
  /** The local each `provide` names its value by. */
  readonly provided: ReadonlyMap<ProvideItem, string>;
  /**
   * The `const` each `<component is>` is rendered through, by the node's start: the printer's
   * node may be a copy.
   */
  readonly dynamic: ReadonlyMap<number, { node: DynamicNode; name: string }>;
  /** The generated interfaces of the slots' and the models' props, and of the root's. */
  readonly interfaces: { slots?: string; models?: string; attributes?: string };
  /** The state a `v-model` binds: it needs its setter, whoever else writes it. */
  readonly bound: ReadonlySet<BindingId>;
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
    return names.scope.has(prop) ? names.claim(`${prop}Prop`) : names.claim(prop);
  };

  // What the template and the setup bind with `v-model`: a state's setter, or a model's.
  const bound = new Set<BindingId>();
  walk(component.render, {
    enter(node) {
      const attributes =
        node.kind === "Element" || node.kind === "Component" || node.kind === "Dynamic"
          ? node.attributes
          : [];
      for (const attribute of attributes) {
        if (attribute.kind === "Model" || attribute.kind === "ModelBinding") {
          const [reference] = attribute.value.refs;
          if (reference?.kind === "Binding") bound.add(reference.binding);
        }
      }
    },
  });

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
    // default; one that is written keeps local state while it is unbound.
    const local = writes || bound.has(item.binding) || object !== "";
    const plan: ModelPlan = {
      item,
      name: binding.name,
      prop: item.name,
      propLocal: local ? propLocal(item.name) : binding.name,
      event,
      eventLocal: local ? (object ? `${object}.${event}` : names.claim(event)) : event,
    };
    if (local) {
      const base = pascalCase(binding.name);
      plan.local = { value: names.claim(`local${base}`), setter: names.claim(`setLocal${base}`) };
    }
    if (writes) plan.mirror = names.claim(`${binding.name}Ref`);
    models.set(item.binding, plan);
  }

  const root = fallthroughRoot(component);
  const fallthrough: FallthroughPlan | undefined = root && {
    root,
    className: propLocal("className"),
    style: propLocal("style"),
  };
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

  const dynamic = new Map<number, { node: DynamicNode; name: string }>();
  walk(component.render, {
    enter(node) {
      if (node.kind === "Dynamic") dynamic.set(node.span.start, { node, name: names.claim("Tag") });
    },
  });

  const interfaces: CompositionPlan["interfaces"] = {};
  if (slots.size) interfaces.slots = names.claim(`${component.name}Slots`);
  if (models.size) interfaces.models = names.claim(`${component.name}Models`);
  if (fallthrough || expose) interfaces.attributes = names.claim(`${component.name}Attributes`);

  return {
    children,
    keys,
    ownsKeys,
    slots,
    models,
    ...(fallthrough ? { fallthrough } : {}),
    ...(expose ? { expose } : {}),
    provided,
    dynamic,
    interfaces,
    bound,
  };
}

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
 * The root a consumer's `class` and `style` merge into (ADR-0054): the render root's element, or
 * the one component a fragment holds. None where `inheritAttrs` is off, or the root is anything
 * else, where a consumer's `class` is UF3045.
 */
function fallthroughRoot(component: UfComponent): ElementNode | ComponentNode | undefined {
  if (component.inheritAttrs === false) return undefined;
  const { render } = component;
  if (render.kind === "Element") return render;
  const [only] = render.children;
  return render.children.length === 1 && only?.kind === "Component" ? only : undefined;
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
 * The type of a function the component exposes, as its handle declares it: its parameters as
 * written, and `void` where it declares no return type (a caller's own type of the handle only
 * reads what it calls).
 */
export function exposedType(fn: FunctionCode, parameters: string): string {
  const returns = fn.returnType ? fn.returnType.code : fn.async ? "Promise<void>" : "void";
  return `(${parameters}) => ${returns}`;
}
