// Composition in Svelte 5 (ADR-0054): what the markup prints differs from the IR's render tree
// where Svelte writes a construct as a prop or a variable. A component's fallthrough `class`
// and `style` are props it merges into its root; a forwarded slot is the parent's snippet
// passed on as a prop (`{title}`); and `<component is>` over components renders a variable the
// script declares with `$derived`. The target prints the tree this module returns.
import { parseExpression } from "@unframework/codegen";
import type {
  Attribute,
  ComponentAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Expression,
  FragmentNode,
  IfNode,
  Parameter,
  RenderNode,
  StyleAttribute,
  UfComponent,
  UfModule,
} from "@unframework/ir";

/** The local names of a component's fallthrough props, `class` and `style`. */
export interface Fallthrough {
  className: string;
  style: string;
  /** The `mergeStyle` helper's name, where the root has a style of its own. */
  mergeStyle?: string;
}

/** What the markup prints in place of the IR's render tree. */
export interface ComposedRender {
  render: ElementNode | FragmentNode;
  /**
   * The candidates of the `<component is>` each component element stands for: its fills take
   * each candidate's `-s`, as Vue's do (ADR-0063).
   */
  candidates: ReadonlyMap<ComponentNode, readonly string[]>;
}

/** The prop a slot is passed as: a snippet named like the slot, `children` for the default. */
export function slotProp(slot: string): string {
  return slot === "default" ? "children" : slot;
}

/**
 * Whether a component takes a consumer's `class` and `style` (ADR-0054): unless it sets
 * `inheritAttrs: false`, when its root is one element or one component, as `ComponentApi.root`
 * says. A root that is a fragment, a conditional or a list takes neither (UF3045).
 */
export function takesFallthrough(component: UfComponent): boolean {
  if (component.inheritAttrs === false) return false;
  const { render } = component;
  if (render.kind === "Element") return true;
  const [only, ...rest] = render.children;
  // A lone component is a fragment of one child in the IR, with the fragment's own span; a
  // written fragment around it (`<><Base /></>`) is wider.
  return (
    only?.kind === "Component" &&
    rest.length === 0 &&
    only.span.start === render.span.start &&
    only.span.end === render.span.end
  );
}

/** Whether an attribute of a `<component is>` over components is a component's. */
function isComponentAttribute(
  attribute: Attribute | ComponentAttribute,
): attribute is ComponentAttribute {
  switch (attribute.kind) {
    case "Prop":
    case "Listener":
    case "ModelBinding":
    case "Class":
    case "Style":
    case "Ref":
      return true;
    default:
      return false;
  }
}

/**
 * `<component is>` over components whose condition reads a variable of the block it sits in (a
 * list's item, a fill's parameter), which a `$derived` in the script cannot see: each candidate
 * under its branch of the condition, `{#if item.compact}<Chip />{:else}<Card />{/if}`, where it
 * sits. Svelte mounts the other component when the condition changes, as it does for a
 * component held in a variable.
 */
function chosenComponent(
  node: DynamicNode,
  component: (name: string) => ComponentNode,
): RenderNode {
  const { is } = node;
  const part = (start: number, end: number) => ({
    code: is.code.slice(start, end),
    span: { start: is.span.start + start, end: is.span.start + end },
    refs: is.refs.filter(
      (reference) =>
        reference.span.start >= is.span.start + start && reference.span.end <= is.span.start + end,
    ),
  });
  const chosen = (expression: ReturnType<typeof parseExpression>): RenderNode => {
    switch (expression.type) {
      case "ParenthesizedExpression":
        return chosen(expression.expression);
      case "ConditionalExpression": {
        const choice: IfNode = {
          kind: "If",
          branches: [
            {
              condition: part(expression.test.start, expression.test.end),
              children: [chosen(expression.consequent)],
              span: node.span,
            },
            { children: [chosen(expression.alternate)], span: node.span },
          ],
          span: node.span,
        };
        return choice;
      }
      case "Identifier":
        return component(expression.name);
      default:
        // The analyser lets only a conditional of components through (UF3044, ADR-0054).
        throw new Error(`\`<component is>\` chooses a component by \`${is.code}\`.`);
    }
  };
  return chosen(parseExpression(is.code));
}

/**
 * Whether a component's root takes the fallthrough it passes on: an element does, and a
 * component does unless it sets `inheritAttrs: false` (`ComponentApi.inheritAttrs`).
 */
export function rootTakesFallthrough(component: UfComponent, module: UfModule): boolean {
  const { render } = component;
  if (render.kind === "Element") return true;
  const [root] = render.children;
  if (root?.kind !== "Component") return false;
  const name = root.component;
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((each) => each.kind === "Component" && each.local === name);
    if (!imported) continue;
    const api = entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    return api?.inheritAttrs !== false;
  }
  return module.components.find((each) => each.name === name)?.inheritAttrs !== false;
}

/** Whether a component's root, an element or a component, has a style of its own. */
export function hasOwnStyle(component: UfComponent): boolean {
  const { render } = component;
  const root = render.kind === "Element" ? render : render.children[0];
  return (
    (root?.kind === "Element" || root?.kind === "Component") &&
    root.attributes.some((attribute) => attribute.kind === "Style")
  );
}

/** An expression the target writes, already in Svelte's spelling: printed as it is. */
function written(code: string): Expression {
  return { code, span: { start: 0, end: 0 }, refs: [] };
}

/**
 * The render tree as the markup prints it: the root merged with the fallthrough props, each
 * forwarded slot a prop, and each `<component is>` over components the component variable
 * `dynamic` names for it.
 */
export function composedRender(
  component: UfComponent,
  fallthrough: Fallthrough | undefined,
  dynamic: ReadonlyMap<RenderNode, string>,
  slotLocal: (slot: string) => string,
  fillParameter: (parameter: Parameter) => Parameter,
  code: (expression: Expression) => string,
): ComposedRender {
  const candidates = new Map<ComponentNode, readonly string[]>();
  const rewrite = (nodes: readonly RenderNode[]): RenderNode[] =>
    nodes.map((node) => rewriteNode(node));
  const rewriteElement = (element: ElementNode): ElementNode => ({
    ...element,
    children: rewrite(element.children),
  });
  const rewriteNode = (node: RenderNode): RenderNode => {
    switch (node.kind) {
      case "Element":
        return rewriteElement(node);
      case "If":
        return {
          ...node,
          branches: node.branches.map((branch) => ({
            ...branch,
            children: rewrite(branch.children),
          })),
        };
      case "For":
        return {
          ...node,
          body:
            node.body.kind === "Element" ? rewriteElement(node.body) : composedComponent(node.body),
        };
      case "Component":
        return composedComponent(node);
      case "SlotOutlet": {
        // The markup renders the slot through its snippet's variable.
        const local = slotLocal(node.slot);
        const slot = local === slotProp(node.slot) ? node.slot : local;
        return { ...node, slot, fallback: rewrite(node.fallback) };
      }
      case "Dynamic": {
        if (node.candidates.some((candidate) => candidate.kind === "Tag")) {
          return { ...node, children: rewrite(node.children) };
        }
        const names = node.candidates.flatMap((each) =>
          each.kind === "Component" ? [each.component] : [],
        );
        const candidate = (name: string): ComponentNode => {
          const composed = composedComponent({
            kind: "Component",
            component: name,
            attributes: node.attributes.filter(isComponentAttribute),
            fills: node.fills ?? [],
            span: node.span,
          });
          candidates.set(composed, names);
          return composed;
        };
        const name = dynamic.get(node);
        return name === undefined ? chosenComponent(node, candidate) : candidate(name);
      }
      case "Text":
      case "Interpolation":
        return node;
      default:
        return node satisfies never;
    }
  };
  // A forwarded slot is the parent's own snippet, passed as the child's prop of that slot: the
  // child sees it absent where the parent got none, as forwarding keeps presence (ADR-0054).
  const composedComponent = (node: ComponentNode): ComponentNode => {
    const forwarded = node.fills.flatMap((fill): ComponentAttribute[] =>
      fill.forward === undefined
        ? []
        : [
            {
              kind: "Prop",
              name: slotProp(fill.slot),
              value: written(slotLocal(fill.forward)),
              span: fill.span,
            },
          ],
    );
    return {
      ...node,
      attributes: [...node.attributes, ...forwarded],
      fills: node.fills
        .filter((fill) => fill.forward === undefined)
        .map((fill) => ({
          ...fill,
          ...(fill.parameter ? { parameter: fillParameter(fill.parameter) } : {}),
          children: rewrite(fill.children),
        })),
    };
  };

  const { render } = component;
  if (render.kind === "Element") {
    const element = rewriteElement(render);
    if (!fallthrough) return { render: element, candidates };
    return { render: rootElement(element, fallthrough, code), candidates };
  }
  const fragment: FragmentNode = { ...render, children: rewrite(render.children) };
  const [only] = fragment.children;
  if (!fallthrough || only?.kind !== "Component") return { render: fragment, candidates };
  return {
    render: { ...fragment, children: [rootComponent(only, fallthrough, code)] },
    candidates,
  };
}

/**
 * The root's own style merged with the fallthrough `style` (ADR-0054): `mergeStyle(own, style)`,
 * which drops the root's declaration of a property the consumer's names with a nullish value, as
 * an object merge does on the other targets (`fallthrough`, emulated). Without a style of its own
 * the root takes the consumer's as it is.
 */
function mergedStyle(
  attribute: StyleAttribute | undefined,
  { style, mergeStyle }: Fallthrough,
  code: (expression: Expression) => string,
): string {
  if (!attribute) return style;
  const own = attribute.declarations.map((declaration) => {
    const key = isIdentifierName(declaration.property)
      ? declaration.property
      : JSON.stringify(declaration.property);
    const value =
      declaration.kind === "Static" ? JSON.stringify(declaration.value) : code(declaration.value);
    return `${key}: ${value}`;
  });
  return `${mergeStyle!}({ ${own.join(", ")} }, ${style})`;
}

/** Whether a property name is written bare as an object key. */
function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/**
 * The root element with the fallthrough merged in: `className` as the last part of its class,
 * and its style merged with `style` (`mergedStyle`), so the consumer's declarations win.
 */
function rootElement(
  element: ElementNode,
  fallthrough: Fallthrough,
  code: (expression: Expression) => string,
): ElementNode {
  const { className } = fallthrough;
  const attributes: Attribute[] = [];
  let classed = false;
  let own: StyleAttribute | undefined;
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" && attribute.name === "class" && attribute.value !== true) {
      classed = true;
      attributes.push({
        kind: "Class",
        items: [
          { kind: "Static", value: attribute.value, span: attribute.span },
          { kind: "Dynamic", value: written(className), span: attribute.span },
        ],
        span: attribute.span,
      });
    } else if (attribute.kind === "Class") {
      classed = true;
      attributes.push({
        ...attribute,
        items: [
          ...attribute.items,
          { kind: "Dynamic", value: written(className), span: attribute.span },
        ],
      });
    } else if (attribute.kind === "Style") own = attribute;
    else attributes.push(attribute);
  }
  if (!classed) {
    attributes.push({
      kind: "Class",
      items: [{ kind: "Dynamic", value: written(className), span: element.span }],
      span: element.span,
    });
  }
  const style = written(mergedStyle(own, fallthrough, code));
  attributes.push({ kind: "Bound", name: "style", value: style, span: own?.span ?? element.span });
  return { ...element, attributes };
}

/**
 * The root component with the fallthrough passed on (ADR-0054): `className` as the last part of
 * the class it passes, and its style merged with `style` (`mergedStyle`).
 */
function rootComponent(
  node: ComponentNode,
  fallthrough: Fallthrough,
  code: (expression: Expression) => string,
): ComponentNode {
  const { className } = fallthrough;
  const attributes: ComponentAttribute[] = [];
  let classed = false;
  let own: StyleAttribute | undefined;
  for (const attribute of node.attributes) {
    if (attribute.kind === "Class") {
      classed = true;
      attributes.push({
        ...attribute,
        items: [
          ...attribute.items,
          { kind: "Dynamic", value: written(className), span: attribute.span },
        ],
      });
    } else if (attribute.kind === "Style") own = attribute;
    else attributes.push(attribute);
  }
  if (!classed) {
    attributes.push({
      kind: "Class",
      items: [{ kind: "Dynamic", value: written(className), span: node.span }],
      span: node.span,
    });
  }
  const style = written(mergedStyle(own, fallthrough, code));
  attributes.push({ kind: "Prop", name: "style", value: style, span: own?.span ?? node.span });
  return { ...node, attributes };
}
