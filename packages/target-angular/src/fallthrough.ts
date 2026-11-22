// What falls through a component on Angular (ADR-0056, ADR-0118). Angular has no attribute
// spread, and a host that carries an attribute is not unwrapped (ADR-0010), so a component that
// takes what its consumer passes declares it as inputs, which the consumer binds on the host:
// `class` and `style`, merged into the element that takes them, and two records, `ufAttributes`
// (each attribute by its name) and `ufListeners` (each native listener by its event), which an
// inline directive of the component's file, `[ufFallthrough]`, puts on that element. A root
// component passes them on to its own root component. A ref on a component that exposes nothing
// holds its root element: the component declares it, `ufElement`, a query of its root element, or
// of its root component's own, and the parent's ref reads it.
import { angularDialect, candidateAttributes } from "@unframework.dev/codegen";
import { walk } from "@unframework.dev/ir";
import type {
  ComponentApi,
  ComponentNode,
  DynamicNode,
  ElementNode,
  FragmentNode,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";

import { ELEMENT_INTERFACES } from "./elements.ts";

/** The input that takes the consumer's attributes, each by its name. */
export const ATTRIBUTES_INPUT = "ufAttributes";
/** The input that takes the consumer's native listeners, each by its event's name. */
export const LISTENERS_INPUT = "ufListeners";
/** The member that holds the element a ref on the component holds, where it exposes nothing. */
export const ELEMENT_MEMBER = "ufElement";
/** The template ref the root carries for {@link ELEMENT_MEMBER}'s query. */
export const ELEMENT_REF = "ufElement";
/** The attribute of the directive that puts the records on their element. */
export const FALLTHROUGH_ATTRIBUTE = "ufFallthrough";

/**
 * The names a component that takes fallthrough declares beside its own (ADR-0056, ADR-0118):
 * a prop, an event or an exposed function of one of them is UF2003, and a setup binding of one
 * is renamed.
 */
export const FALLTHROUGH_MEMBERS: readonly string[] = [
  "class",
  "style",
  ATTRIBUTES_INPUT,
  LISTENERS_INPUT,
  ELEMENT_MEMBER,
];

/**
 * The component's root (an element, or a fragment of one element, one component or one
 * `<component is>` over tags, ADR-0119), which what a consumer passes falls through to
 * (ADR-0054, ADR-0118), or none. A `<component is>` takes only `class` and `style`, in each
 * `@case`.
 */
export function fallthroughRoot(
  render: ElementNode | FragmentNode,
): ElementNode | ComponentNode | DynamicNode | undefined {
  if (render.kind === "Element") return render;
  const [only] = render.children;
  if (render.children.length !== 1) return undefined;
  if (only?.kind === "Element" || only?.kind === "Component") return only;
  return only?.kind === "Dynamic" && only.candidates.every((each) => each.kind === "Tag")
    ? only
    : undefined;
}

/** How a component takes what its consumer passes it. */
export interface FallthroughPlan {
  /**
   * The node that takes it: the root element or component, or, with `inheritAttrs: false`, the
   * element that spreads the props' rest.
   */
  target: ElementNode | ComponentNode | DynamicNode;
  /** Whether {@link target} is the rest's element. */
  rest: boolean;
  /**
   * Whether the component declares the records' inputs: not where its root component takes no
   * attribute of its own, which would then have no input to bind them to.
   */
  passes: boolean;
  /** The event map its listeners are typed by: the SVG one for an `<svg>`. */
  events: "HTMLElementEventMap" | "SVGElementEventMap";
}

/** What a parent reads of a child, its own module's or another's. */
export interface ChildApi {
  /** Whether it exposes functions, so a ref on it holds them and no element. */
  exposes: boolean;
  /** The tag of the element a ref on it holds, where it exposes nothing. */
  refTag?: string;
  /** The tag of the element what a consumer passes lands on. */
  fallthroughTag?: string;
}

/**
 * The API of the component a template renders by its local name: from its import, or from the
 * module's own component, read as the analyser reads it (`fillRootComponents`).
 */
export function childApi(
  module: UfModule,
  local: string,
  seen: ReadonlySet<string> = new Set(),
): ChildApi | undefined {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) continue;
    const api = entry.api.components.find((each: ComponentApi) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    if (!api) return undefined;
    return {
      exposes: api.exposes.length > 0,
      ...(api.refTag === undefined ? {} : { refTag: api.refTag }),
      ...(api.fallthroughTag === undefined ? {} : { fallthroughTag: api.fallthroughTag }),
    };
  }
  const own = module.components.find((each) => each.name === local);
  if (!own || seen.has(local)) return undefined;
  const next = new Set([...seen, local]);
  const exposes = (own.exposes?.functions.length ?? 0) > 0;
  const root = fallthroughRoot(own.render);
  const rootChild = root?.kind === "Component" ? childApi(module, root.component, next) : undefined;
  const rootTag = root?.kind === "Element" ? root.tag : undefined;
  const refTag = exposes
    ? undefined
    : (rootTag ?? (rootChild && !rootChild.exposes ? rootChild.refTag : undefined));
  const fallthroughTag =
    own.inheritAttrs === false
      ? restElement(own.render)?.element.tag
      : (rootTag ?? rootChild?.fallthroughTag);
  return {
    exposes,
    ...(refTag === undefined ? {} : { refTag }),
    ...(fallthroughTag === undefined ? {} : { fallthroughTag }),
  };
}

/**
 * How the component takes what its consumer passes (ADR-0056, ADR-0118), or `undefined` where it
 * takes nothing: its root, one element or one component, unless it sets `inheritAttrs: false`,
 * when the element that spreads the props' rest takes it, if one does. An element Angular binds
 * nothing on (`{{` in an attribute, ADR-0037) takes nothing.
 */
export function planFallthrough(
  component: UfComponent,
  module: UfModule,
): FallthroughPlan | undefined {
  if (component.inheritAttrs === false) {
    const found = restElement(component.render);
    if (!found || angularDialect.literalRegion?.(found.element) !== undefined) return undefined;
    return {
      target: found.element,
      rest: true,
      passes: true,
      events: found.svg ? "SVGElementEventMap" : "HTMLElementEventMap",
    };
  }
  const root = fallthroughRoot(component.render);
  if (!root) return undefined;
  if (root.kind === "Element") {
    if (angularDialect.literalRegion?.(root) !== undefined) return undefined;
    return { target: root, rest: false, passes: true, events: eventsOf(root.tag) };
  }
  if (root.kind === "Dynamic") {
    // Each `@case` is an element of its own tag, which takes the consumer's `class` and `style`
    // alone (ADR-0119): nothing else falls through to a `<component is>` yet.
    const bindable = root.candidates.every(
      (candidate) =>
        candidate.kind === "Tag" &&
        angularDialect.literalRegion?.({
          kind: "Element",
          tag: candidate.tag,
          attributes: candidateAttributes(root, candidate.tag),
          children: root.children,
          span: root.span,
        }) === undefined,
    );
    if (!bindable) return undefined;
    return { target: root, rest: false, passes: false, events: "HTMLElementEventMap" };
  }
  const child = childApi(module, root.component);
  const tag = child?.fallthroughTag;
  return {
    target: root,
    rest: false,
    passes: tag !== undefined,
    events: eventsOf(tag),
  };
}

/** The event map of the element a tag names. */
function eventsOf(tag: string | undefined): FallthroughPlan["events"] {
  return tag === "svg" ? "SVGElementEventMap" : "HTMLElementEventMap";
}

/** The element a ref on the component holds, which it declares as {@link ELEMENT_MEMBER}. */
export interface RootElementPlan {
  /** Its root, which carries the template ref the query reads. */
  root: ElementNode | ComponentNode;
  /** The DOM interface of a root element (`HTMLButtonElement`). */
  type?: string;
}

/**
 * The element a ref on the component holds (ADR-0118), where it exposes nothing: its root
 * element, or its root component's own, which that component declares. `undefined` where a ref
 * holds no element.
 */
export function planRootElement(
  component: UfComponent,
  module: UfModule,
): RootElementPlan | undefined {
  if (component.exposes?.functions.length) return undefined;
  const root = fallthroughRoot(component.render);
  // A `<component is>` root takes no ref of a consumer's yet (ADR-0119).
  if (!root || root.kind === "Dynamic") return undefined;
  if (root.kind === "Element") {
    const type = ELEMENT_INTERFACES.get(root.tag);
    if (type === undefined || angularDialect.literalRegion?.(root) !== undefined) return undefined;
    return { root, type };
  }
  const child = childApi(module, root.component, new Set([component.name]));
  return child && !child.exposes && child.refTag !== undefined ? { root } : undefined;
}

/** The element that spreads the props' rest, which the analyser allows on one element. */
function restElement(
  render: UfComponent["render"],
): { element: ElementNode; svg: boolean } | undefined {
  let found: { element: ElementNode; svg: boolean } | undefined;
  const svg: boolean[] = [];
  walk(render, {
    enter(node) {
      if (found || node.kind !== "Element") return;
      svg.push(node.tag === "svg" || svg.at(-1) === true);
      if (node.attributes.some((attribute) => attribute.kind === "Rest")) {
        found = { element: node, svg: svg.at(-1)! };
      }
    },
    leave(node) {
      if (node.kind === "Element") svg.pop();
    },
  });
  return found;
}

/**
 * The directive that puts what a consumer passes on the element that takes it (ADR-0118), and
 * the type of the listeners' record. Angular has no attribute spread, so it emulates Vue's
 * `$attrs`: as the record changes it sets each attribute through `Renderer2`, removes one that
 * is `null` or `undefined` as `[attr.name]` does, and so overrides the element's own attribute
 * of the name, the consumer's winning, on the server and in the browser. It writes only as the
 * record changes, so an attribute the element binds itself binds the consumer's value where the
 * record has its name (`consumerFirst` in ./template.ts), or Angular would write the element's
 * own over it each time that binding changes. In the browser it listens to each event with
 * `Renderer2.listen`, again on a new handler, and stops with the element. Its inputs are set
 * after the element's own listeners are added, so those run first.
 */
export function fallthroughDirectiveCode(
  names: { listeners: string; directive?: string },
  events: FallthroughPlan["events"],
  core: (name: string, type?: boolean) => string,
  common: (name: string) => string,
): string {
  const { directive: className, listeners } = names;
  const type = listenersTypeCode(listeners, events);
  if (className === undefined) return type;
  return [
    type,
    "/**",
    " * Puts what a consumer passes the component, and the component does not declare, on the element",
    " * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and",
    " * the native listeners, which run after the element's own.",
    " */",
    `@${core("Directive")}({ selector: "[${FALLTHROUGH_ATTRIBUTE}]" })`,
    `export class ${className} implements ${core("OnChanges", true)}, ${core("OnDestroy", true)} {`,
    `  readonly ${FALLTHROUGH_ATTRIBUTE} = ${core("input")}.required<{`,
    "    attributes: Record<string, unknown> | undefined;",
    `    listeners: ${listeners} | undefined;`,
    "  }>();",
    `  private readonly element = ${core("inject")}<${core("ElementRef")}<Element>>(${core("ElementRef")});`,
    `  private readonly renderer = ${core("inject")}(${core("Renderer2")});`,
    `  private readonly browser = ${common("isPlatformBrowser")}(${core("inject")}(${core("PLATFORM_ID")}));`,
    "  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();",
    "  private written: Record<string, unknown> = {};",
    "",
    "  ngOnChanges(): void {",
    "    const element = this.element.nativeElement;",
    `    const { attributes = {}, listeners = {} } = this.${FALLTHROUGH_ATTRIBUTE}();`,
    "    for (const name of Object.keys(this.written)) {",
    "      if (!(name in attributes)) this.renderer.removeAttribute(element, name);",
    "    }",
    "    for (const [name, value] of Object.entries(attributes)) {",
    "      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);",
    "      else this.renderer.setAttribute(element, name, String(value));",
    "    }",
    "    this.written = attributes;",
    "    if (!this.browser) return;",
    "    const handlers = new Map(Object.entries(listeners));",
    "    for (const [event, { handler, stop }] of this.listening) {",
    "      if (handlers.get(event) === handler) continue;",
    "      stop();",
    "      this.listening.delete(event);",
    "    }",
    "    for (const [event, handler] of handlers) {",
    "      if (handler === undefined || this.listening.has(event)) continue;",
    "      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });",
    "    }",
    "  }",
    "",
    "  ngOnDestroy(): void {",
    "    for (const { stop } of this.listening.values()) stop();",
    "  }",
    "}",
    "",
  ].join("\n");
}

/** The type of the listeners' record: a handler of each event, typed by its event. */
function listenersTypeCode(name: string, events: FallthroughPlan["events"]): string {
  return [
    "/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */",
    `type ${name} = { [K in keyof ${events}]?: (event: ${events}[K]) => void };`,
    "",
  ].join("\n");
}
