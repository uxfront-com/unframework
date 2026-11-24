// What falls through a component in its Vue output (ADR-0118). Attributes and listeners fall
// through natively, through `$attrs`, and a ref on a child holds the child's instance. Two forms
// need code: the props' rest, which binds `$attrs` on its element, and a ref on a child that
// exposes nothing, which holds the child's root element, its instance's `$el`.
import { walk } from "@unframework.dev/ir";
import type { BindingId, ElementNode, UfComponent, UfModule } from "@unframework.dev/ir";

import type { VueNames } from "./names.ts";

/** How the template binds the props' rest, `{...rest}`, and the root beside it. */
export interface RestPlan {
  /** What the element that spreads the rest binds: `$attrs`, or what of it is not the root's. */
  element: string;
  /**
   * What the root binds where the rest sits on another element: the styled parents' scope
   * attributes, which stay on the root (ADR-0063). Absent where the rest is the root's, or no
   * single root takes them.
   */
  root?: string;
  /** The functions that split `$attrs`, which the script declares. */
  functions: string[];
}

/** The prefix of the scope attributes a styled parent passes its child's root (ADR-0063). */
const SCOPE_PREFIX = "data-uf-";

/**
 * How the component binds its props' rest, if an element spreads it. With `inheritAttrs: false`,
 * `$attrs` holds everything a consumer passes but the declared props, which is the rest, and the
 * scope attributes of its styled parents, which go to the root, as they would without the rest:
 * so where the rest is not the root's, the root binds those and the element the others.
 */
export function planRest(component: UfComponent, names: VueNames): RestPlan | undefined {
  const element = restElement(component);
  if (!element) return undefined;
  const { render } = component;
  if (render === element) return { element: "$attrs", functions: [] };
  const rest = names.scope.claim("restAttrs");
  const functions = [
    [
      `/** What the consumer passes, but the scope attributes its root keeps. */`,
      `function ${rest}(attrs: Record<string, unknown>): Record<string, unknown> {`,
      `  return Object.fromEntries(Object.entries(attrs).filter(([name]) => !name.startsWith(${JSON.stringify(SCOPE_PREFIX)})));`,
      `}`,
    ].join("\n"),
  ];
  // A root that is several nodes takes no scope attribute (ADR-0063).
  const single =
    render.kind === "Element" ||
    (render.children.length === 1 && render.children[0]!.kind === "Component");
  if (!single) return { element: `${rest}($attrs)`, functions };
  const scope = names.scope.claim("scopeAttrs");
  functions.unshift(
    [
      `/** The scope attributes of the styled parents that render this component, for its root. */`,
      `function ${scope}(attrs: Record<string, unknown>): Record<string, unknown> {`,
      `  return Object.fromEntries(Object.entries(attrs).filter(([name]) => name.startsWith(${JSON.stringify(SCOPE_PREFIX)})));`,
      `}`,
    ].join("\n"),
  );
  return { element: `${rest}($attrs)`, root: `${scope}($attrs)`, functions };
}

/**
 * The type of what the props' rest takes, where its element binds less than `$attrs`: vue-tsc
 * types a consumer's attributes from the root, or from the element that binds `$attrs` as
 * written (`fallthroughAttributes`), and from nothing else. So the props declare the element's
 * attributes and listeners, but for the names the component declares, a type alone, which
 * `@vue-ignore` keeps out of the runtime props, so they stay in `$attrs` (ADR-0118).
 */
export function restAttributesType(
  component: UfComponent,
  attributes: () => string,
): string | undefined {
  const element = restElement(component);
  // A `<component :is>` root takes `$attrs` natively, but vue-tsc types a consumer's attributes
  // from no tag of it, so the props declare what every tag takes the same way (ADR-0122).
  const tags = element ? undefined : dynamicRootTags(component);
  if (tags) {
    const declared = declaredNames(component);
    const type = tags.map((tag) => `${attributes()}[${JSON.stringify(tag)}]`).join(" & ");
    return declared.length
      ? `Omit<${type}, ${[...new Set(declared)].map((name) => JSON.stringify(name)).join(" | ")}>`
      : `(${type})`;
  }
  if (!element || element === component.render) return undefined;
  const declared = declaredNames(component);
  // An input's `autocomplete` is Vue's `InputAutoCompleteAttribute`, a union of every autofill
  // token and `string & {}`, which `defineProps` intersects with itself (`LooseRequired`) past
  // what TypeScript represents (TS2590) once a prop is read: `string` takes the same values. Not
  // a type literal, which `vue/require-default-prop` would read as a prop of its own.
  const input = element.tag === "input";
  if (input) declared.push("autocomplete");
  const type = `${attributes()}[${JSON.stringify(element.tag)}]`;
  const omitted = declared.length
    ? `Omit<${type}, ${[...new Set(declared)].map((name) => JSON.stringify(name)).join(" | ")}>`
    : type;
  return input ? `(${omitted} & Partial<Record<"autocomplete", string>>)` : omitted;
}

/** The names the component declares: its props, its events' listeners and its models'. */
function declaredNames(component: UfComponent): string[] {
  return [
    ...component.props.map((prop) => prop.name),
    ...(component.emits?.events ?? []).map((event) => listenerName(event.name)),
    ...component.setup.flatMap((item) =>
      item.kind === "Model" ? [item.name, `onUpdate:${item.name}`] : [],
    ),
  ];
}

/**
 * The tags of a `<component is>` root over tags that takes `$attrs` (ADR-0119, ADR-0122): the
 * only node the component renders, with fallthrough on.
 */
function dynamicRootTags(component: UfComponent): string[] | undefined {
  if (component.inheritAttrs === false || component.render.kind === "Element") return undefined;
  const { render } = component;
  const [only] = render.children;
  if (render.children.length !== 1 || only?.kind !== "Dynamic") return undefined;
  if (only.span.start !== render.span.start || only.span.end !== render.span.end) return undefined;
  const tags = only.candidates.flatMap((each) => (each.kind === "Tag" ? [each.tag] : []));
  return tags.length && tags.length === only.candidates.length ? tags : undefined;
}

/** The prop Vue passes a listener of an event as: `onPick` for `pick`. */
function listenerName(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

/** The element that spreads the props' rest, which the analyser allows on one element. */
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
 * The template refs attached to a child that exposes nothing, by the key the child's instance is
 * read by (`saveComponent`): the source's ref holds the child's root element, the instance's
 * `$el` (ADR-0118). A ref on a child that exposes something holds what it exposes, as Vue's does.
 */
export function rootElementRefs(
  component: UfComponent,
  module: UfModule,
  names: VueNames,
): Map<BindingId, string> {
  const refs = new Map<BindingId, string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Component" || !exposesNothing(module, node.component)) return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Ref" || refs.has(attribute.binding)) continue;
        const binding = component.bindings.find((each) => each.id === attribute.binding);
        if (binding) refs.set(attribute.binding, names.scope.claim(`${binding.name}Component`));
      }
    },
  });
  return refs;
}

/**
 * Whether a child exposes nothing, so a ref on it holds its root element: an imported child's
 * API says, where it names the element (`refTag`, or `refTags` for a `<component is>` root,
 * ADR-0122), and one of the module's own components says
 * through its `defineExpose`. The analyser rejects a ref on a child that holds nothing (UF3046).
 */
function exposesNothing(module: UfModule, local: string): boolean {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) continue;
    const api = entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    return (
      api !== undefined &&
      api.exposes.length === 0 &&
      (api.refTag !== undefined || api.refTags !== undefined)
    );
  }
  const own = module.components.find((each) => each.name === local);
  return own !== undefined && !own.exposes?.functions.length;
}
