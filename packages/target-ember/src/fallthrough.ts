// Attribute fallthrough (ADR-0054, ADR-0056). The root takes a caller's attributes through
// `...attributes`, where Glimmer joins a `class` with the root's own as Vue does. Glimmer lets a
// caller's `style` replace the root's own, so a `style` is the `@style` argument instead, which
// the root merges into its own declarations (`fallthroughStyle`).
import type {
  ComponentNode,
  DynamicNode,
  ElementNode,
  RenderNode,
  Span,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";

/** A node a component's root may be: an element, a `<component is>` over tags, or a child. */
export interface RootNode {
  node: ElementNode | DynamicNode | ComponentNode;
  span: Span;
  /** The tags it renders, none for a child. */
  tags: string[];
  /** The child it renders, by the name the template writes it with. */
  component?: string;
}

/**
 * The nodes a component's root may be, which take the caller's attributes: the root element,
 * each branch's node of a root conditional, a root `<component is>` over tags, or a child whose
 * own root takes them. None where a root may be anything else, such as text.
 */
export function rootNodes(component: UfComponent, module: UfModule): RootNode[] {
  return rootsOf(component, module, new Set([component.name]));
}

function rootsOf(component: UfComponent, module: UfModule, seen: Set<string>): RootNode[] {
  const { render } = component;
  if (render.kind === "Element") return [{ node: render, span: render.span, tags: [render.tag] }];
  if (render.children.length !== 1) return [];
  const [only] = render.children;
  const branches = only?.kind === "If" ? only.branches.map((branch) => branch.children) : [[only]];
  const roots: RootNode[] = [];
  for (const children of branches) {
    const [node] = children;
    const root = children.length === 1 && node ? single(node, module, seen) : undefined;
    if (!root) return [];
    roots.push(root);
  }
  return roots;
}

function single(node: RenderNode, module: UfModule, seen: Set<string>): RootNode | undefined {
  if (node.kind === "Element") return { node, span: node.span, tags: [node.tag] };
  if (node.kind === "Dynamic") {
    const tags = node.candidates.flatMap((each) => (each.kind === "Tag" ? [each.tag] : []));
    if (tags.length !== node.candidates.length) return undefined;
    return { node, span: node.span, tags: Array.from(new Set(tags)) };
  }
  if (node.kind === "Component" && hasRoot(module, node.component, seen)) {
    return { node, span: node.span, tags: [], component: node.component };
  }
  return undefined;
}

/** Whether a child's signature names an `Element`: its root is one the caller can reach. */
function hasRoot(module: UfModule, local: string, seen: Set<string>): boolean {
  const api = importedApi(module, local);
  if (api) return api.root !== "other";
  const own = module.components.find((each) => each.name === local);
  if (!own || seen.has(local)) return false;
  return rootsOf(own, module, new Set(seen).add(local)).length > 0;
}

/**
 * The one node a caller's `class` and `style` reach, as Vue's fallthrough does: a root element,
 * `<component is>` or child, unless `inheritAttrs: false` turns it off. A root conditional is a
 * fragment to Vue, which takes neither.
 */
export function fallthroughRoot(component: UfComponent, module: UfModule): RootNode | undefined {
  if (component.inheritAttrs === false) return undefined;
  const { render } = component;
  if (render.kind === "Fragment" && render.children[0]?.kind === "If") return undefined;
  const roots = rootNodes(component, module);
  return roots.length === 1 ? roots[0] : undefined;
}

/** Whether a child takes a caller's `class` and `style`, by the name the template writes. */
export function takesFallthrough(module: UfModule, local: string): boolean {
  const api = importedApi(module, local);
  if (api) return api.inheritAttrs && api.root !== "other";
  const own = module.components.find((each) => each.name === local);
  return own !== undefined && fallthroughRoot(own, module) !== undefined;
}

function importedApi(module: UfModule, local: string) {
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

/** Whether a root writes a `style` of its own, which the caller's merges into. */
export function hasOwnStyle(root: RootNode): boolean {
  return root.node.attributes.some(
    (attribute) =>
      attribute.kind === "Style" ||
      (attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style")),
  );
}

/**
 * A style as a Glimmer subexpression: a literal where Glimmer reads one back as written, which
 * holds no backslash and not both quotes.
 */
export function styleLiteral(text: string): string | undefined {
  if (text.includes("\\")) return undefined;
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return undefined;
}

/** The module helper the root's `style` goes through. */
export const FALLTHROUGH_STYLE = `/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of \`[property, value]\` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(key.startsWith("--") ? key : key.replace(/[A-Z]/g, (letter) => \`-\${letter.toLowerCase()}\`), value);
      }
    } else {
      const text = String(style).replace(/\\/\\*[^]*?\\*\\//g, "");
      for (const declaration of text.split(/;(?![^(]*\\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [\`\${property}: \${String(value)}\`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}`;
