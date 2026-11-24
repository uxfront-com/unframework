// What falls through a component in its Svelte output (ADR-0118). Svelte has no fallthrough of
// its own: a component takes what it does not declare in its props' rest, `...attributes`, which
// its root spreads last, so the consumer's attribute wins over the root's own, as a later
// attribute does in Svelte. The props type declares the fallthrough element's attributes from
// `svelte/elements`, but for the names the component declares, so a consumer's `id`, `aria-*` or
// `onclick` type-checks. A ref on a child that exposes nothing holds its root element: the child
// takes a `$bindable` prop, `ref`, which its root binds (`bind:this={ref}`), and the parent binds
// it, `bind:ref={save}`.
import type {
  ComponentApi,
  ComponentNode,
  DynamicNode,
  ElementNode,
  RefAttribute,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";
import { walk } from "@unframework.dev/ir";

/**
 * The attribute types `svelte/elements` declares for an element of its own (5.57,
 * `SvelteHTMLElements`): `HTMLButtonAttributes` for `<button>`. Every other element's are
 * `SvelteHTMLElements["div"]`, as Svelte's documentation types a wrapper of one.
 */
const ELEMENT_ATTRIBUTES: ReadonlyMap<string, string> = new Map([
  ["a", "HTMLAnchorAttributes"],
  ["area", "HTMLAreaAttributes"],
  ["audio", "HTMLAudioAttributes"],
  ["blockquote", "HTMLBlockquoteAttributes"],
  ["button", "HTMLButtonAttributes"],
  ["canvas", "HTMLCanvasAttributes"],
  ["col", "HTMLColAttributes"],
  ["colgroup", "HTMLColgroupAttributes"],
  ["data", "HTMLDataAttributes"],
  ["del", "HTMLDelAttributes"],
  ["details", "HTMLDetailsAttributes"],
  ["dialog", "HTMLDialogAttributes"],
  ["embed", "HTMLEmbedAttributes"],
  ["fieldset", "HTMLFieldsetAttributes"],
  ["form", "HTMLFormAttributes"],
  ["iframe", "HTMLIframeAttributes"],
  ["img", "HTMLImgAttributes"],
  ["input", "HTMLInputAttributes"],
  ["ins", "HTMLInsAttributes"],
  ["label", "HTMLLabelAttributes"],
  ["li", "HTMLLiAttributes"],
  ["map", "HTMLMapAttributes"],
  ["menu", "HTMLMenuAttributes"],
  ["meter", "HTMLMeterAttributes"],
  ["object", "HTMLObjectAttributes"],
  ["ol", "HTMLOlAttributes"],
  ["optgroup", "HTMLOptgroupAttributes"],
  ["option", "HTMLOptionAttributes"],
  ["output", "HTMLOutputAttributes"],
  ["progress", "HTMLProgressAttributes"],
  ["q", "HTMLQuoteAttributes"],
  ["select", "HTMLSelectAttributes"],
  ["source", "HTMLSourceAttributes"],
  ["table", "HTMLTableAttributes"],
  ["td", "HTMLTdAttributes"],
  ["textarea", "HTMLTextareaAttributes"],
  ["th", "HTMLThAttributes"],
  ["time", "HTMLTimeAttributes"],
  ["track", "HTMLTrackAttributes"],
  ["video", "HTMLVideoAttributes"],
]);

/**
 * The type of an element's attributes and listeners, its name imported from `svelte/elements`
 * through `importType`: `HTMLButtonAttributes`, or `SvelteHTMLElements["p"]`.
 */
export function attributesType(tag: string, importType: (name: string) => string): string {
  const own = ELEMENT_ATTRIBUTES.get(tag);
  if (own !== undefined) {
    return importType(own);
  }
  return `${importType("SvelteHTMLElements")}[${JSON.stringify(tag)}]`;
}

/**
 * The type of what falls through to the element a component's rest lands on, but for the names
 * it declares (`omitted`): the element's attributes, or a `<component is>` root's, what every
 * tag takes, with the listeners of whichever renders (ADR-0122), so a listener it calls after
 * its own takes that element's event: `Omit<HTMLAnchorAttributes & HTMLButtonAttributes, …> &
 * Omit<DOMAttributes<HTMLElementTagNameMap["a" | "button"]>, "children">`.
 */
export function passedType(
  tags: ReadonlyArray<string>,
  declared: ReadonlyArray<string>,
  importType: (name: string) => string,
): string {
  const names = (each: ReadonlyArray<string>) =>
    [...new Set(each)].map((name) => JSON.stringify(name)).join(" | ");
  const attributes = tags.map((tag) => attributesType(tag, importType)).join(" & ");
  if (tags.length === 1) {
    return `Omit<${attributes}, ${names(declared)}>`;
  }
  const dom = `${importType("DOMAttributes")}<${elementType(tags)}>`;
  // `DOMAttributes` holds the listeners and `children` alone.
  const listeners = declared.filter((name) => name === "children" || name.startsWith("on"));
  return `Omit<${attributes}, ${names(declared)} | keyof ${dom}> & Omit<${dom}, ${names(listeners)}>`;
}

/**
 * The type of the element a ref holds, from lib.dom's maps: `HTMLElementTagNameMap["button"]`,
 * which is `HTMLButtonElement`, and an `<svg>` root's `SVGElementTagNameMap["svg"]`. A
 * `<component is>` root's holds whichever tag renders: `HTMLElementTagNameMap["a" | "button"]`.
 */
export function elementType(tags: ReadonlyArray<string>): string {
  const map = tags[0] === "svg" ? "SVGElementTagNameMap" : "HTMLElementTagNameMap";
  return `${map}[${[...new Set(tags)].map((tag) => JSON.stringify(tag)).join(" | ")}]`;
}

/** The API of a child the module imports, by its local name. */
function importedApi(module: UfModule, local: string): ComponentApi | undefined | null {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) {
      continue;
    }
    return (
      entry.api.components.find((each) =>
        imported.imported === "default"
          ? each.export === "default"
          : each.export === "named" && each.name === imported.imported,
      ) ?? null
    );
  }
  return undefined;
}

/** The root component of a component whose root is one component, as `takesFallthrough` reads it. */
export function rootComponentNode(component: UfComponent): ComponentNode | undefined {
  const { render } = component;
  if (render.kind !== "Fragment") {
    return undefined;
  }
  const [only, ...others] = render.children;
  return only?.kind === "Component" &&
    others.length === 0 &&
    only.span.start === render.span.start &&
    only.span.end === render.span.end
    ? only
    : undefined;
}

/** A component's root `<component is>` over tags (ADR-0119), as `takesFallthrough` reads it. */
export function rootDynamicNode(component: UfComponent): DynamicNode | undefined {
  const { render } = component;
  if (render.kind !== "Fragment") {
    return undefined;
  }
  const [only, ...others] = render.children;
  return only?.kind === "Dynamic" &&
    only.candidates.every((candidate) => candidate.kind === "Tag") &&
    others.length === 0 &&
    only.span.start === render.span.start &&
    only.span.end === render.span.end
    ? only
    : undefined;
}

/** The tags a `<component is>` over tags may render. */
function dynamicTags(node: DynamicNode): Array<string> {
  return node.candidates.flatMap((candidate) => (candidate.kind === "Tag" ? [candidate.tag] : []));
}

/** The prop a slot is passed as: `children` for the default slot. */
const slot = (name: string) => (name === "default" ? "children" : name);

/** The callback prop of an event: `onpick` for `pick`. */
const event = (name: string) => `on${name.toLowerCase()}`;

/**
 * The names a component's root component declares, where its root is one (ADR-0118): its props,
 * models, slots' snippets (`children` for the default slot), events' callback props
 * (`onpick`) and `ref`. The rest a component passes on to its root component takes none of them,
 * so its props type leaves them out of the root element's attributes, whose `title` or
 * `children` would else meet the root component's own.
 */
export function rootComponentNames(component: UfComponent, module: UfModule): Array<string> {
  const root = rootComponentNode(component);
  if (!root) {
    return [];
  }
  const api = importedApi(module, root.component);
  if (api === null) {
    return [];
  }
  if (api !== undefined) {
    return [
      ...api.props.map(({ name }) => name),
      ...api.models.map(({ name }) => name),
      ...api.slots.map(({ name }) => slot(name)),
      ...api.events.map(({ name }) => event(name)),
      "ref",
    ];
  }
  const own = module.components.find((each) => each.name === root.component);
  if (!own) {
    return [];
  }
  return [
    ...own.props.map(({ name }) => name),
    ...own.setup.flatMap((item) => (item.kind === "Model" ? [item.name] : [])),
    ...(own.slots?.slots ?? []).map(({ name }) => slot(name)),
    ...(own.emits?.events ?? []).map(({ name }) => event(name)),
    "ref",
  ];
}

/**
 * The tags a child's API names (ADR-0118), for a child of the module, imported or its own: the
 * element what it does not declare lands on, and the element a ref on it holds, several for a
 * `<component is>` root, whichever renders (ADR-0122).
 */
function childTags(
  module: UfModule,
  local: string,
  seen: ReadonlySet<string>,
): { fallthrough?: ReadonlyArray<string>; ref?: ReadonlyArray<string> } {
  const api = importedApi(module, local);
  if (api === null) {
    return {};
  }
  if (api !== undefined) {
    const fallthrough =
      api.fallthroughTag !== undefined
        ? [api.fallthroughTag]
        : api.inheritAttrs
          ? api.rootTags
          : undefined;
    const ref = api.exposes.length
      ? undefined
      : api.refTag !== undefined
        ? [api.refTag]
        : api.refTags;
    return {
      ...(fallthrough === undefined ? {} : { fallthrough }),
      ...(ref === undefined ? {} : { ref }),
    };
  }
  const own = module.components.find((each) => each.name === local);
  if (!own || seen.has(own.name)) {
    return {};
  }
  const next = new Set([...seen, own.name]);
  const fallthrough = ownFallthroughTag(own, module, next);
  const ref = ownRefTag(own, module, next);
  return {
    ...(fallthrough === undefined ? {} : { fallthrough }),
    ...(ref === undefined ? {} : { ref }),
  };
}

function ownFallthroughTag(
  component: UfComponent,
  module: UfModule,
  seen: ReadonlySet<string>,
): ReadonlyArray<string> | undefined {
  if (component.inheritAttrs === false) {
    const element = restElement(component);
    return element && [element.tag];
  }
  if (component.render.kind === "Element") {
    return [component.render.tag];
  }
  const dynamic = rootDynamicNode(component);
  if (dynamic) {
    return dynamicTags(dynamic);
  }
  const root = rootComponentNode(component);
  return root ? childTags(module, root.component, seen).fallthrough : undefined;
}

function ownRefTag(
  component: UfComponent,
  module: UfModule,
  seen: ReadonlySet<string>,
): ReadonlyArray<string> | undefined {
  if (component.exposes?.functions.length) {
    return undefined;
  }
  if (component.render.kind === "Element") {
    return [component.render.tag];
  }
  const dynamic = rootDynamicNode(component);
  if (dynamic) {
    return dynamicTags(dynamic);
  }
  const root = rootComponentNode(component);
  return root ? childTags(module, root.component, seen).ref : undefined;
}

/**
 * The tags of the element what a consumer passes and the component does not declare lands on
 * (`ComponentApi.fallthroughTag`): its root element's, its `<component is>` root's (ADR-0122),
 * its root component's own, or with `inheritAttrs: false` the element that spreads the props'
 * rest. `undefined` where a consumer passes nothing but what the component declares (UF3045).
 */
export function fallthroughTags(
  component: UfComponent,
  module: UfModule,
): ReadonlyArray<string> | undefined {
  return ownFallthroughTag(component, module, new Set([component.name]));
}

/**
 * The tags of the element a ref on the component holds (`ComponentApi.refTag`): its root
 * element's, its `<component is>` root's, whichever renders (ADR-0122), or its root component's,
 * where it exposes nothing. `undefined` where a ref holds what it exposes, or no element.
 */
export function refTags(
  component: UfComponent,
  module: UfModule,
): ReadonlyArray<string> | undefined {
  return ownRefTag(component, module, new Set([component.name]));
}

/** The element that spreads the props' rest, `{...rest}`, which the analyser allows on one. */
export function restElement(component: UfComponent): ElementNode | undefined {
  let found: ElementNode | undefined;
  walk(component.render, {
    enter(node) {
      if (found || node.kind !== "Element") {
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
 * The template refs on a child that exposes nothing, which hold its root element (ADR-0118):
 * the parent binds the child's `ref` prop to them, `bind:ref={save}`. A ref on a child that
 * exposes something holds the child's instance, `bind:this`, as before.
 */
export function elementRefs(component: UfComponent, module: UfModule): Set<RefAttribute> {
  const found = new Set<RefAttribute>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Component") {
        return;
      }
      if (childTags(module, node.component, new Set([component.name])).ref === undefined) {
        return;
      }
      for (const attribute of node.attributes) {
        if (attribute.kind === "Ref") {
          found.add(attribute);
        }
      }
    },
  });
  return found;
}

/** The scope attributes' prefix, which a styled parent passes its child's root (ADR-0063). */
export const SCOPE_PREFIX = "data-uf-";

/**
 * The `restAttributes` helper (`child-root-scope`, emulated, ADR-0063): what the consumer passes
 * but its styled parents' scope attributes, which the root keeps, for the element that spreads
 * the props' rest when it is not the root.
 */
export function restAttributesHelper(name: string): string {
  return [
    "/** What the consumer passes, but the scope attributes the root keeps. */",
    `function ${name}(props: object): Record<string, unknown> {`,
    "  return Object.fromEntries(",
    `    Object.entries(props).filter(([name]) => !name.startsWith(${JSON.stringify(SCOPE_PREFIX)})),`,
    "  );",
    "}",
  ].join("\n");
}
