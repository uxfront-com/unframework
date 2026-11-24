// What falls through a component in its Solid 2 output (ADR-0054, ADR-0118). Solid passes
// everything as a prop, so a component leaves what it declares out of its props with Solid 2's
// `omit` and spreads the others on the element that takes them, after its own attributes, so the
// consumer's attribute wins (`fallthrough`, native):
//
// - with `inheritAttrs` on, on its root element, or on its root component, which places them by
//   the same rule. The others hold the styled parents' scope attributes too, which the root
//   takes (ADR-0063), and the consumer's `ref`, which Solid's spread hands the element beside
//   the element's own `ref` callback;
// - with `inheritAttrs: false`, on the element that spreads the props' rest, `{...rest}`, last;
//   the scope attributes stay on the root, which picks them out of the props as it does without
//   the rest, and the rest leaves them out by rule, `omit(rest, (name) => …)`. The root takes the
//   consumer's `ref` (D4): a ref on a component that exposes nothing holds its root.
//
// What the element merges itself is split out too: its `class` and `style`, which it merges with
// the consumer's as it does today, and each listener of its own that Solid writes as an event
// prop, which calls the consumer's listener of the same event after its own (`props.onClick?.(
// event)`), as Vue chains them. The props type takes the element's attributes from Solid's own,
// `ComponentProps<"button">`, or a root component's props, `ComponentProps<typeof Base>`, but
// the names the component declares, so one named like an attribute (`title`) keeps its own type.
// An element's `class` and `style` are a string and an object, which the root merges, as Solid 2
// types a class as any `ClassValue`.
import { walk } from "@unframework.dev/ir";
import type {
  Attribute,
  ComponentApi,
  ComponentAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  EventAttribute,
  ModelAttribute,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";

import { SOLID_EVENT_PROPS, eventProps } from "./listeners.ts";
import { eventProp } from "./props.ts";

/** The listener props Solid's element types declare (`onClick`, `onKeyDown`). */
const DOM_EVENT_PROPS: ReadonlySet<string> = new Set(SOLID_EVENT_PROPS.values());

/** How a component passes what falls through to the node that takes it. */
export interface FallthroughPlan {
  /**
   * The node that spreads the others: the root element or component, or the rest's element.
   * None where nothing falls through but the root's `ref` (`inheritAttrs: false`, no rest).
   */
  target?: ElementNode | ComponentNode | DynamicNode;
  /** Whether the target spreads the props' rest, `{...rest}`, with `inheritAttrs: false`. */
  rest: boolean;
  /**
   * What `omit` leaves out of the others: the names the component declares, and what the
   * target merges itself. Empty where the target spreads the props as they are.
   */
  split: string[];
  /** The target's own listeners that call the consumer's after them, with the prop of each. */
  composed: ReadonlyMap<EventAttribute, string>;
  /** The event props of the target's `v-model` that call the consumer's after them. */
  models: ReadonlySet<string>;
  /**
   * Whether the target's spread leaves out the styled parents' scope attributes, which stay on a
   * root of their own (`omit` by rule).
   */
  unscoped: boolean;
  /**
   * The root that takes the scope attributes and the consumer's `ref` where the target is not
   * the root: with `inheritAttrs: false`, a root that is one element or one component.
   */
  root?: ElementNode | ComponentNode | DynamicNode;
  /** Whether that root takes the scope attributes too: where the props' rest is spread. */
  rootScope: boolean;
}

/** What the props parameter takes for fallthrough and `ref`, and how the component passes it. */
export interface Fallthrough {
  /** The type text the props parameter takes beside its own, or none. */
  type: string | undefined;
  /** How the component spreads what falls through, or none (a fragment, a conditional root). */
  plan: FallthroughPlan | undefined;
}

/** What the plan needs of the component's file. */
export interface FallthroughNames {
  /** Imports `ComponentProps` and returns its name. */
  componentProps(): string;
  /** Imports `JSX` and returns its name. */
  jsx(): string;
  /** The type of what the component exposes, `{ focus: () => void }`, where it does. */
  exposed(): string;
}

/** The component's root, where it is one `<component is>` over tags (ADR-0119). */
function dynamicRoot(component: UfComponent): DynamicNode | undefined {
  const { render } = component;
  if (render.kind !== "Fragment" || render.children.length !== 1) return undefined;
  const [only] = render.children;
  return only?.kind === "Dynamic" && only.candidates.every((each) => each.kind === "Tag")
    ? only
    : undefined;
}

/** The tags a `<component is>` over tags may render. */
function dynamicTags(node: DynamicNode): string[] {
  return node.candidates.flatMap((each) => (each.kind === "Tag" ? [each.tag] : []));
}

/**
 * How a component passes what falls through (see the module comment). A component whose root is
 * neither one element nor one component, or with `inheritAttrs: false` and no rest, passes
 * nothing but its root's `ref`; one whose root component's fallthrough is unknown keeps `class`
 * and `style` alone, as before.
 */
export function planFallthrough(
  component: UfComponent,
  module: UfModule,
  names: FallthroughNames,
): Fallthrough {
  const single = singleRoot(component);
  const exposes = Boolean(component.exposes);
  const declared = declaredNames(component);
  const exposedRef = exposes ? [`ref?: (api: ${names.exposed()}) => void`] : [];
  const omitted = (base: string, extra: readonly string[], members: readonly string[]) => {
    // A listener prop of no DOM event (`onPick`) is no attribute an element's type declares; a
    // root component's may declare it.
    const element = base.endsWith('">');
    const keys = [...new Set([...declared, ...(exposes ? ["ref"] : []), ...extra])].filter(
      (key) => !element || !/^on[A-Z]/.test(key) || DOM_EVENT_PROPS.has(key),
    );
    const omit = keys.length
      ? `Omit<${base}, ${keys.map((key) => JSON.stringify(key)).join(" | ")}>`
      : base;
    return members.length ? `${omit} & { ${members.join("; ")} }` : omit;
  };
  if (component.inheritAttrs !== false) {
    // A root `<component is>` over tags takes what falls through as a root element does, on
    // whichever tag renders (ADR-0122).
    const root = single ?? dynamicRoot(component);
    if (!root) return { type: exposedType(exposedRef), plan: undefined };
    const base = rootBase(root, component, module, names);
    if (base === undefined) {
      // A root component whose own root takes nothing: `class` and `style` alone, as before.
      const jsx = names.jsx();
      return {
        type: `{ ${["class?: string", `style?: ${jsx}.CSSProperties`, ...exposedRef].join("; ")} }`,
        plan: undefined,
      };
    }
    const target = root;
    const merged = mergedNames(target);
    const composed = composedListeners(target, component, declared);
    const models = modelEvents(target, declared);
    const handlers = [...new Set([...composed.values(), ...models])];
    // An element's `class` is a string and its `style` an object, which the root merges, as
    // Solid's props type a root component's already.
    const element = target.kind !== "Component";
    const members = [
      ...(element ? ["class?: string", `style?: ${names.jsx()}.CSSProperties`] : []),
      ...handlers.map((prop) => `${prop}?: ${handlerType(base, prop)}`),
      ...exposedRef,
    ];
    const extra = [
      ...(element ? ["class", "style"] : []),
      ...handlers,
      // A root component's own props, which it sets itself, are not its consumer's.
      ...(target.kind === "Component" ? passedNames(target) : []),
    ];
    // A root component's own `ref` would replace the consumer's, which the spread passes: its
    // callback hands the consumer's the element too. An element takes both, its own callback
    // and the spread's.
    const ownRef =
      !exposes &&
      target.kind === "Component" &&
      target.attributes.some((attribute) => attribute.kind === "Ref");
    // A `<component is>` root's spread can't hand the consumer's `ref` to whichever tag renders,
    // typed for each tag, so the root takes it apart, as a callback (ADR-0122).
    const dynamicRef = !exposes && target.kind === "Dynamic";
    return {
      type: omitted(base, extra, members),
      plan: {
        target,
        rest: false,
        split: [
          ...new Set([
            ...declared,
            ...(exposes || ownRef || dynamicRef ? ["ref"] : []),
            ...merged,
            ...handlers,
          ]),
        ],
        composed,
        models: new Set(models),
        unscoped: false,
        ...(ownRef || dynamicRef ? { root: target } : {}),
        rootScope: false,
      },
    };
  }
  const root = single;
  const element = restElement(component);
  // The consumer's `ref` holds the root element where the component exposes nothing (D4).
  const ref = !exposes && root ? root : undefined;
  const refType = (target: ElementNode | ComponentNode) =>
    `Pick<${rootBase(target, component, module, names) ?? `${names.componentProps()}<"div">`}, "ref">`;
  if (!element) {
    if (!ref) return { type: exposedType(exposedRef), plan: undefined };
    return {
      type: refType(ref),
      plan: {
        rest: false,
        split: [],
        composed: new Map(),
        models: new Set(),
        unscoped: false,
        root: ref,
        rootScope: false,
      },
    };
  }
  const base = `${names.componentProps()}<${JSON.stringify(element.tag)}>`;
  const composed = composedListeners(element, component, declared);
  const models = modelEvents(element, declared);
  const handlers = [...new Set([...composed.values(), ...models])];
  const atRoot = root === element;
  // Where the rest's element is not the root, the root takes the consumer's `ref`.
  const splitRef = exposes || (!atRoot && ref !== undefined);
  const members = [
    "class?: string",
    `style?: ${names.jsx()}.CSSProperties`,
    ...handlers.map((prop) => `${prop}?: ${handlerType(base, prop)}`),
    ...exposedRef,
  ];
  const type = omitted(
    base,
    ["class", "style", ...handlers, ...(splitRef ? ["ref"] : [])],
    members,
  );
  return {
    type: !atRoot && ref ? `${type} & ${refType(ref)}` : type,
    plan: {
      target: element,
      rest: true,
      split: [
        ...new Set([
          ...declared,
          ...(splitRef ? ["ref"] : []),
          ...mergedNames(element),
          ...handlers,
        ]),
      ],
      composed,
      models: new Set(models),
      unscoped: !atRoot,
      ...(atRoot || !root ? {} : { root }),
      rootScope: !atRoot && root !== undefined,
    },
  };
}

/** The exposed `ref`'s type alone, or none. */
function exposedType(members: readonly string[]): string | undefined {
  return members.length ? `{ ${members.join("; ")} }` : undefined;
}

/**
 * The props type of what a root takes, by Solid's own types: an element's, or a root
 * component's props, which hold its own root's (`ComponentProps<typeof Base>`), a generic one's
 * with its type parameters `unknown`, which the names the root sets itself leave out. None for a
 * root component whose attributes land nowhere.
 */
function rootBase(
  root: ElementNode | ComponentNode | DynamicNode,
  component: UfComponent,
  module: UfModule,
  names: FallthroughNames,
): string | undefined {
  if (root.kind === "Element") return `${names.componentProps()}<${JSON.stringify(root.tag)}>`;
  // What every tag takes, with the listeners and the `ref` of whichever renders, so a listener
  // the root calls after its own takes that element's event (ADR-0122).
  if (root.kind === "Dynamic") {
    const tags = dynamicTags(root);
    const element = `HTMLElementTagNameMap[${tags.map((tag) => JSON.stringify(tag)).join(" | ")}]`;
    const dom = `${names.jsx()}.ElementAttributes<${element}>`;
    const each = tags.map((tag) => `${names.componentProps()}<${JSON.stringify(tag)}>`);
    return `Omit<${each.join(" & ")}, keyof ${dom}> & ${dom}`;
  }
  // Imported only where the type names it.
  if (childFallthroughTag(module, root.component, component) === undefined) return undefined;
  return `${names.componentProps()}<typeof ${root.component}>`;
}

/**
 * A listener the target calls the consumer's from, typed as a function: Solid's props type it a
 * function or a bound `[handler, data]` pair, and the component calls it as a function.
 */
function handlerType(base: string, prop: string): string {
  const indexed = base.includes(" ") ? `(${base})` : base;
  return `Extract<${indexed}[${JSON.stringify(prop)}], (event: never) => void>`;
}

/**
 * The names a component declares, which never fall through: its props, its events' listeners
 * (`onPick`), its slots (`children`, `title`) and its models' value and listener.
 */
export function declaredNames(component: UfComponent): string[] {
  return [
    ...component.props.map((prop) => prop.name),
    ...(component.emits?.events ?? []).map((event) => eventProp(event.name)),
    ...(component.slots?.slots ?? []).map((slot) =>
      slot.name === "default" ? "children" : slot.name,
    ),
    ...component.setup.flatMap((item) =>
      item.kind === "Model" ? [item.name, eventProp(`${item.name}Change`)] : [],
    ),
  ];
}

/** The root a component renders, where it is one element or one component. */
export function singleRoot(component: UfComponent): ElementNode | ComponentNode | undefined {
  const { render } = component;
  if (render.kind === "Element") return render;
  const [only] = render.children;
  return render.children.length === 1 && only?.kind === "Component" ? only : undefined;
}

/** The element that spreads the props' rest, which the analyser allows on one element. */
export function restElement(component: UfComponent): ElementNode | undefined {
  let found: ElementNode | undefined;
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element" || found) return;
      if (node.attributes.some((attribute) => attribute.kind === "Rest")) found = node;
    },
  });
  return found;
}

/** What the target merges with the consumer's itself: its `class` and its `style`. */
function mergedNames(target: ElementNode | ComponentNode | DynamicNode): string[] {
  const attributes: readonly { kind: string; name?: string; keys?: { name: string }[] }[] =
    target.attributes;
  const has = (name: "class" | "style") =>
    attributes.some(
      (attribute) =>
        attribute.kind === (name === "class" ? "Class" : "Style") ||
        (attribute.kind === "Static" && attribute.name === name) ||
        (attribute.kind === "Spread" && attribute.keys!.some((key) => key.name === name)),
    );
  return (["class", "style"] as const).filter(has);
}

/**
 * The target's own listeners Solid writes as event props (`onClick`), which a consumer's of the
 * same event would replace: each calls the consumer's after its own. A listener the target adds
 * from its `ref`, or writes as `on:click`, is one of its own beside the consumer's, and a prop the
 * component declares (`onClick` of its own `click` event) is no consumer's listener of the DOM's.
 */
function composedListeners(
  target: ElementNode | ComponentNode | DynamicNode,
  component: UfComponent,
  declared: readonly string[],
): Map<EventAttribute, string> {
  const attributes: readonly (Attribute | ComponentAttribute)[] = target.attributes;
  const listeners =
    target.kind === "Element"
      ? eventProps(target, component)
      : attributes.filter(
          (attribute): attribute is EventAttribute =>
            attribute.kind === "Event" && SOLID_EVENT_PROPS.has(attribute.event),
        );
  return new Map(
    listeners.flatMap((listener) => {
      const prop = SOLID_EVENT_PROPS.get(listener.event)!;
      return declared.includes(prop) ? [] : [[listener, prop] as const];
    }),
  );
}

/** The event props a target's `v-model` writes (src/models.ts), which the consumer's would replace. */
function modelEvents(
  target: ElementNode | ComponentNode | DynamicNode,
  declared: readonly string[],
): string[] {
  if (target.kind !== "Element") return [];
  return target.attributes.flatMap((attribute) => {
    const prop = attribute.kind === "Model" ? modelEvent(attribute) : undefined;
    return prop === undefined || declared.includes(prop) ? [] : [prop];
  });
}

/** The event prop a `v-model` listens with, or none where its helper listens from its `ref`. */
function modelEvent(attribute: ModelAttribute): string | undefined {
  if (attribute.trim || attribute.lazy || attribute.number || attribute.control === "number") {
    return undefined;
  }
  return attribute.control === "text" || attribute.control === "textarea" ? "onInput" : "onChange";
}

/** The names a root component's own attributes and fills set on it: not its consumer's to pass. */
function passedNames(node: ComponentNode): string[] {
  const fills = node.fills.map((fill) => (fill.slot === "default" ? "children" : fill.slot));
  return [...fills, ...attributeNames(node)];
}

/** The names a root component's own attributes set on it. */
function attributeNames(node: ComponentNode): string[] {
  return node.attributes.flatMap((attribute) => {
    switch (attribute.kind) {
      case "Prop":
        return [attribute.name];
      case "Listener":
        return [eventProp(attribute.event)];
      case "ModelBinding":
        return [attribute.model, eventProp(`${attribute.model}Change`)];
      case "Static":
      case "Bound":
        return attribute.name === "class" || attribute.name === "style" ? [] : [attribute.name];
      default:
        return [];
    }
  });
}

/**
 * A child's fallthrough tag (ADR-0118): an imported child's API names it; one of the module's
 * own components says through its root, through a chain of root components.
 */
function childFallthroughTag(
  module: UfModule,
  local: string,
  from: UfComponent,
): string | undefined {
  const api = importedApi(module, local);
  if (api) return api.fallthroughTag ?? (api.inheritAttrs ? api.rootTags?.[0] : undefined);
  const own = module.components.find((each) => each.name === local);
  if (!own || own === from) return undefined;
  return ownFallthroughTag(own, module, new Set([from.name]));
}

/** An imported child's API, by the name the template uses. */
export function importedApi(module: UfModule, local: string): ComponentApi | undefined {
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

/** The tag a module's own component's fallthrough lands on, as its API would say. */
function ownFallthroughTag(
  component: UfComponent,
  module: UfModule,
  seen: Set<string>,
): string | undefined {
  if (component.inheritAttrs === false) return restElement(component)?.tag;
  const root = singleRoot(component);
  if (!root) {
    const dynamic = dynamicRoot(component);
    return dynamic && dynamicTags(dynamic)[0];
  }
  if (root.kind === "Element") return root.tag;
  if (seen.has(component.name)) return undefined;
  seen.add(component.name);
  const api = importedApi(module, root.component);
  if (api) return api.fallthroughTag ?? (api.inheritAttrs ? api.rootTags?.[0] : undefined);
  const own = module.components.find((each) => each.name === root.component);
  return own ? ownFallthroughTag(own, module, seen) : undefined;
}

/**
 * Whether a ref on a child holds its root element: an imported child's API says, where it names
 * the element and exposes nothing; one of the module's own components where it exposes nothing.
 */
export function holdsElement(module: UfModule, local: string): boolean {
  const api = importedApi(module, local);
  if (api) {
    return api.exposes.length === 0 && (api.refTag !== undefined || api.refTags !== undefined);
  }
  const own = module.components.find((each) => each.name === local);
  return own !== undefined && !own.exposes;
}
