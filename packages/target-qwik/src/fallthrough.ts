// What falls through a component in its Qwik output (ADR-0118). A consumer's attributes and
// listeners the component does not declare are its props' rest, `...attributes`, which its
// fallthrough element spreads last, as Qwik's own components pass on what they do not declare:
// the root element, the root component, which passes them on in turn, or with `inheritAttrs:
// false` the element that spreads the source's `{...rest}`. So the props pattern names every
// prop the component declares, an unread one as `_name`, and the props type takes the element's
// own, `Omit<PropsOf<"button">, "title" | …>`, or a root component's props, `PropsOf<typeof
// Base>`, without the props the root sets itself. Spread last, the consumer's attribute wins over
// the element's own; its `class` and `style` are props the element merges as before; and its
// listener of an event the element listens to itself is a prop the element's listener runs
// after its own, `onClick$={[$(…), onClick$]}`.
// A ref on a component that exposes nothing holds its root element: Qwik's `ref` on an element
// takes the signal, so it passes on in the rest, or where the root has a ref of its own, or the
// rest spreads elsewhere, the root takes it beside its own, `ref={(element) => { … }}`. A root
// component takes a signal instead, since Qwik serialises a component's props: the consumer's,
// or else its own, which a visible task fills from the consumer's.
import { walk } from "@unframework.dev/ir";
import type {
  ComponentApi,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Span,
  TemplateRefItem,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";

import { qwikListenerProp } from "./events.ts";

/** A name the output declares, claimed fresh (`OutputNames.fresh`). */
type Fresh = (name: string) => string;

/**
 * What a component takes apart from its declared props (ADR-0118): see this file's header.
 * Names are claimed as the render is printed, which comes before the props pattern.
 */
export class Passed {
  readonly #fresh: Fresh;
  /** The tag whose attributes the props take: `PropsOf<"button">`. */
  readonly tag: string | undefined;
  /**
   * The tags a `<component is>` root may render, where it spreads the rest: each branch takes it
   * (ADR-0122), and the props take what every tag takes. Absent otherwise.
   */
  readonly tags: readonly string[] | undefined;
  /** The span of the node that spreads the rest: the root, or the `{...rest}` element. */
  readonly target: Span | undefined;
  /** Whether the rest spreads on the root, which then takes the scope attributes in it. */
  readonly onRoot: boolean;
  /**
   * The root component the rest spreads on, which types what it takes: `PropsOf<typeof Base>`.
   * Not a component that renders itself, whose type would name itself, nor a generic one, whose
   * props Qwik's `PropsOf` cannot infer: those take their tag's attributes.
   */
  readonly rootComponent: ComponentNode | undefined;
  /**
   * A generic root component the rest spreads on, which `PropsOf` cannot type: its tag's
   * attributes type what the rest takes, without what the component declares.
   */
  readonly genericRoot: ComponentNode | undefined;
  /** The rest's local, `attributes`. */
  readonly rest: string | undefined;
  /** Whether a consumer's ref holds the component's root element (it exposes nothing). */
  readonly rootRef: boolean;
  /**
   * The component's own template ref on its root component, where a consumer's ref holds the
   * same element. Qwik serialises a component's props, so the root component takes one signal,
   * the consumer's or else this one, and a visible task fills this one from the consumer's.
   */
  readonly forwarded: TemplateRefItem | undefined;
  /** The props the component declares, by the names a consumer passes them as. */
  readonly declared: ReadonlySet<string>;
  /** The consumer's listeners the target merges with its own, by prop: their locals. */
  readonly listeners: Map<string, string> = new Map();
  #ref: string | undefined;
  #rootSignal: string | undefined;

  constructor(
    component: UfComponent,
    module: UfModule,
    declared: ReadonlySet<string>,
    fresh: Fresh,
  ) {
    this.#fresh = fresh;
    this.declared = declared;
    const root = singleRoot(component);
    const target = fallthroughTarget(component, module);
    this.target = target?.span;
    this.onRoot = target !== undefined && (target === root || target.kind === "Dynamic");
    const rootComponent =
      this.onRoot && root?.kind === "Component" && root.component !== component.name
        ? root
        : undefined;
    const generic = rootComponent !== undefined && isGeneric(module, rootComponent.component);
    this.rootComponent = generic ? undefined : rootComponent;
    this.genericRoot = generic ? rootComponent : undefined;
    this.tag = fallthroughTag(component, module);
    this.tags = target?.kind === "Dynamic" ? dynamicTags(target) : undefined;
    this.rest = target === undefined ? undefined : fresh("attributes");
    this.rootRef =
      component.exposes === undefined &&
      ((root !== undefined && (root.kind === "Element" || holdsElement(module, root.component))) ||
        target?.kind === "Dynamic");
    const own =
      this.rootRef && root?.kind === "Component"
        ? root.attributes.find((attribute) => attribute.kind === "Ref")
        : undefined;
    this.forwarded = component.setup.find(
      (item): item is TemplateRefItem =>
        item.kind === "TemplateRef" && item.binding === own?.binding,
    );
  }

  /** Whether `node` is the one that spreads the rest. */
  isTarget(node: { span: Span }): boolean {
    return this.target !== undefined && sameSpan(node.span, this.target);
  }

  /**
   * The local of the consumer's listener of `event`, where `element` spreads the rest and the
   * consumer's prop is no prop the component declares (an emit named like the event): the
   * element runs it after its own.
   */
  listener(element: { span: Span }, event: string): string | undefined {
    if (!this.isTarget(element)) {
      return undefined;
    }
    const prop = qwikListenerProp(event);
    if (this.declared.has(prop)) {
      return undefined;
    }
    let local = this.listeners.get(prop);
    if (local === undefined) {
      local = this.#fresh(prop);
      this.listeners.set(prop, local);
    }
    return local;
  }

  /**
   * The local of the signal a root component takes in place of the own template ref
   * (`forwarded`): the consumer's, or else the own one. A local, since Qwik's optimizer makes a
   * prop that reads a prop a read-only signal of its own.
   */
  rootSignal(): string {
    this.#rootSignal ??= this.#fresh("rootRef");
    return this.#rootSignal;
  }

  /** The consumer's ref, which the root takes apart from the rest. */
  ref(): string {
    this.#ref ??= this.#fresh("ref");
    return this.#ref;
  }

  /** The consumer's ref's local, once the root takes it apart from the rest. */
  get refLocal(): string | undefined {
    return this.#ref;
  }
}

/**
 * The node that spreads the props' rest, where what a consumer passes lands: the root element,
 * a root component that takes what falls through, or with `inheritAttrs: false` the element that
 * spreads the source's `{...rest}`.
 */
export function fallthroughTarget(
  component: UfComponent,
  module: UfModule,
): ElementNode | ComponentNode | DynamicNode | undefined {
  if (component.inheritAttrs === false) {
    return restElement(component);
  }
  const root = singleRoot(component);
  if (!root) {
    return dynamicRoot(component);
  }
  return root.kind === "Element" || takesFallthrough(module, root.component) ? root : undefined;
}

/** The component's root, where it is one `<component is>` over tags (ADR-0119). */
function dynamicRoot(component: UfComponent): DynamicNode | undefined {
  const { render } = component;
  if (render.kind !== "Fragment") {
    return undefined;
  }
  const [root, ...others] = render.children;
  return root?.kind === "Dynamic" &&
    !others.length &&
    root.candidates.every((each) => each.kind === "Tag")
    ? root
    : undefined;
}

/** The tags a `<component is>` over tags may render. */
function dynamicTags(node: DynamicNode): string[] {
  return node.candidates.flatMap((each) => (each.kind === "Tag" ? [each.tag] : []));
}

/**
 * The root that takes a consumer's `class` and `style` alone (ADR-0119): a `<component is>`
 * over tags, the one node its fragment holds, or a root component that renders one in turn,
 * where no rest spreads (`fallthroughTarget`). Nothing else falls through to it yet.
 */
export function classAndStyleRoot(
  component: UfComponent,
  module: UfModule,
  seen: ReadonlySet<string> = new Set(),
): DynamicNode | ComponentNode | undefined {
  if (component.inheritAttrs === false) {
    return undefined;
  }
  const { render } = component;
  if (render.kind !== "Fragment") {
    return undefined;
  }
  const [root, ...others] = render.children;
  if (others.length) {
    return undefined;
  }
  if (root?.kind === "Dynamic") {
    return root.candidates.every((each) => each.kind === "Tag") ? root : undefined;
  }
  if (root?.kind !== "Component") {
    return undefined;
  }
  const api = importedApi(module, root.component);
  if (api !== null) {
    return api?.inheritAttrs && api.rootTags !== undefined ? root : undefined;
  }
  const own = module.components.find((each) => each.name === root.component);
  if (!own || own === component || seen.has(own.name)) {
    return undefined;
  }
  return classAndStyleRoot(own, module, new Set([...seen, component.name])) ? root : undefined;
}

/** Whether two spans are the same. */
export function sameSpan(a: Span, b: Span): boolean {
  return a.start === b.start && a.end === b.end;
}

/** The component's one root: its root element, or the one component its fragment holds. */
export function singleRoot(component: UfComponent): ElementNode | ComponentNode | undefined {
  const { render } = component;
  if (render.kind === "Element") {
    return render;
  }
  const [root, ...others] = render.children;
  return root?.kind === "Component" && !others.length ? root : undefined;
}

/** The element that spreads the props' rest, `<input {...rest} />`: one at most (UF2001). */
export function restElement(component: UfComponent): ElementNode | undefined {
  let found: ElementNode | undefined;
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element" || found) {
        return;
      }
      if (node.attributes.some((attribute) => attribute.kind === "Rest")) {
        found = node;
      }
    },
  });
  return found;
}

/**
 * The tag a consumer's attributes and listeners land on (`ComponentApi.fallthroughTag`): the
 * root element's, the root component's own, or with `inheritAttrs: false` the rest element's.
 */
export function fallthroughTag(
  component: UfComponent,
  module: UfModule,
  seen: ReadonlySet<string> = new Set(),
): string | undefined {
  if (component.inheritAttrs === false) {
    return restElement(component)?.tag;
  }
  const root = singleRoot(component);
  if (root?.kind === "Element") {
    return root.tag;
  }
  // A `<component is>` root's first tag stands for them all (ADR-0122).
  if (!root) {
    const dynamic = dynamicRoot(component);
    return dynamic && dynamicTags(dynamic)[0];
  }
  return childTag(module, root.component, "fallthroughTag", new Set([...seen, component.name]));
}

/** Whether a component, by its local name, takes what falls through (it has a fallthrough tag). */
export function takesFallthrough(module: UfModule, local: string): boolean {
  return childTag(module, local, "fallthroughTag", new Set()) !== undefined;
}

/**
 * The tag of the fallthrough element of the child a component element renders, by its local
 * name: where a parent's attributes on it land, as the child's props type takes them.
 */
export function childFallthroughTag(module: UfModule, local: string): string | undefined {
  return childTag(module, local, "fallthroughTag", new Set());
}

/**
 * Whether what a parent passes a child, by its local name, lands on a `<component is>` root of
 * several tags (ADR-0122): the child types its listeners as each tag's, so a parent's handler
 * takes no one type from them, and is typed as written.
 */
export function landsOnTags(
  module: UfModule,
  local: string,
  seen: ReadonlySet<string> = new Set(),
): boolean {
  const api = importedApi(module, local);
  if (api !== null) {
    return (
      api !== undefined &&
      api.fallthroughTag === undefined &&
      api.inheritAttrs &&
      (api.rootTags?.length ?? 0) > 1
    );
  }
  const own = module.components.find((each) => each.name === local);
  if (!own || seen.has(own.name)) {
    return false;
  }
  const target = fallthroughTarget(own, module);
  if (target?.kind === "Dynamic") {
    return dynamicTags(target).length > 1;
  }
  return (
    target?.kind === "Component" &&
    landsOnTags(module, target.component, new Set([...seen, own.name]))
  );
}

/** Whether a ref on a component, by its local name, holds an element (it exposes nothing). */
function holdsElement(module: UfModule, local: string): boolean {
  return childTag(module, local, "refTag", new Set()) !== undefined;
}

/**
 * A child's fallthrough or ref tag: an imported child's API says, and one of the module's own
 * components says through its render, followed down a chain of root components.
 */
function childTag(
  module: UfModule,
  local: string,
  tag: "fallthroughTag" | "refTag",
  seen: ReadonlySet<string>,
): string | undefined {
  const api = importedApi(module, local);
  // A `<component is>` root's first tag stands for them all (ADR-0122).
  if (api !== null) {
    if (!api) {
      return undefined;
    }
    return tag === "fallthroughTag"
      ? (api.fallthroughTag ?? (api.inheritAttrs ? api.rootTags?.[0] : undefined))
      : (api.refTag ?? api.refTags?.[0]);
  }
  const own = module.components.find((each) => each.name === local);
  if (!own || seen.has(own.name)) {
    return undefined;
  }
  if (tag === "fallthroughTag") {
    return fallthroughTag(own, module, seen);
  }
  if (own.exposes) {
    return undefined;
  }
  const root = singleRoot(own);
  if (root?.kind === "Element") {
    return root.tag;
  }
  if (!root) {
    const dynamic = dynamicRoot(own);
    return dynamic && dynamicTags(dynamic)[0];
  }
  return root && childTag(module, root.component, tag, new Set([...seen, own.name]));
}

/**
 * What a child declares, by its local name: its props, its models and its events, as its source
 * names them. Empty for a child the module neither imports nor declares.
 */
export function declaredBy(
  module: UfModule,
  local: string,
): { props: string[]; models: string[]; events: string[] } {
  const api = importedApi(module, local);
  if (api) {
    return {
      props: api.props.map(({ name }) => name),
      models: api.models.map(({ name }) => name),
      events: api.events.map(({ name }) => name),
    };
  }
  const own = module.components.find((each) => each.name === local);
  const models = own?.setup.flatMap((item) => (item.kind === "Model" ? [item.name] : [])) ?? [];
  return {
    props: own?.props.map(({ name }) => name) ?? [],
    models,
    events: own?.emits?.events.map(({ name }) => name) ?? [],
  };
}

/** Whether a child, by its local name, is generic (ADR-0068). */
function isGeneric(module: UfModule, local: string): boolean {
  const api = importedApi(module, local);
  if (api !== null) {
    return Boolean(api?.typeParameters?.length);
  }
  const own = module.components.find((each) => each.name === local);
  return Boolean(own?.typeParameters?.length);
}

/** An imported child's API, by its local name: `null` where the module does not import it. */
function importedApi(module: UfModule, local: string): ComponentApi | undefined | null {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) {
      continue;
    }
    return entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
  }
  return null;
}

/**
 * `restAttributes`: what a consumer passes the component, but the scope attributes its styled
 * parents pass its root (ADR-0063), for an element other than the root that spreads the rest.
 */
export function restAttributesHelper(name: string, type: string): string {
  return `/** What the consumer passes, but the scope attributes its root keeps. */
function ${name}(attributes: ${type}): ${type} {
  return Object.fromEntries(Object.entries(attributes).filter(([key]) => !key.startsWith("data-uf-")));
}`;
}
