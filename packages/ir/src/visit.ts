import type {
  Attribute,
  BindingKind,
  Expression,
  FragmentNode,
  RenderNode,
  Span,
  UfComponent,
  UfModule,
} from "./types.ts";

// Records rather than arrays: `satisfies` rejects a missing or an unknown kind, so a kind added
// to the unions cannot be left out of the lists the coverage gate iterates.
const renderNodeKinds = {
  Element: true,
  Text: true,
  Interpolation: true,
  If: true,
  For: true,
} satisfies Record<RenderNode["kind"], true>;
const attributeKinds = {
  Static: true,
  Bound: true,
  Class: true,
  Style: true,
  Spread: true,
} satisfies Record<Attribute["kind"], true>;
const bindingKinds = { prop: true, loopVar: true } satisfies Record<BindingKind, true>;

/**
 * Every kind of render node. The coverage gate requires a corpus case for each. A root
 * `Fragment` is not a render node; the `fragment` capability covers it.
 */
export const RENDER_NODE_KINDS: readonly RenderNode["kind"][] = Object.keys(
  renderNodeKinds,
) as RenderNode["kind"][];

/** Every kind of attribute. The coverage gate requires a corpus case for each. */
export const ATTRIBUTE_KINDS: readonly Attribute["kind"][] = Object.keys(
  attributeKinds,
) as Attribute["kind"][];

/** Every kind of binding. The coverage gate requires a corpus case for each. */
export const BINDING_KINDS: readonly BindingKind[] = Object.keys(bindingKinds) as BindingKind[];

/** A node {@link walk} visits: a render node, or a component's root fragment. */
export type VisitedNode = RenderNode | FragmentNode;

/**
 * Callbacks for {@link walk}. Returning `false` from `enter` skips the node's children. The
 * parent is the node whose children hold this one: an element, the root fragment, the `If`
 * whose branch holds it or the `For` whose body it is.
 */
export interface Visitor {
  enter?(node: VisitedNode, parent: VisitedNode | undefined): void | false;
  leave?(node: VisitedNode, parent: VisitedNode | undefined): void;
}

/**
 * The child nodes of a node, in document order: an element's or a fragment's children, every
 * branch's children of an `If` in order, a `For`'s body, and nothing for text.
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
  attributeKinds: Set<Attribute["kind"]>;
  bindingKinds: Set<BindingKind>;
}

/** Collects the node, attribute and binding kinds that a module's components use. */
export function collectFeatures(module: UfModule): ModuleFeatures {
  const features: ModuleFeatures = {
    nodeKinds: new Set(),
    attributeKinds: new Set(),
    bindingKinds: new Set(),
  };
  for (const component of module.components) {
    for (const binding of component.bindings) features.bindingKinds.add(binding.kind);
    walk(component.render, {
      enter(node) {
        if (node.kind === "Fragment") return;
        features.nodeKinds.add(node.kind);
        if (node.kind === "Element") {
          for (const attribute of node.attributes) features.attributeKinds.add(attribute.kind);
        }
      },
    });
  }
  return features;
}

/** An expression of a component, with where it is. */
export interface LocatedExpression {
  expression: Expression;
  /** A JSON Pointer to the expression: from the component, after `base`. */
  path: string;
}

/**
 * Every expression of a component, in document order: the props' defaults, then the render
 * tree's interpolations, conditions, list sources and keys, and attribute values (bound
 * attributes, class parts, style declarations and spreads). `base` prefixes each path, such as
 * `/components/0`.
 */
export function expressionsOf(component: UfComponent, base = ""): LocatedExpression[] {
  const found: LocatedExpression[] = [];
  const add = (expression: Expression, path: string) => found.push({ expression, path });
  for (const [index, prop] of component.props.entries()) {
    if (prop.default) add(prop.default, `${base}/props/${index}/default`);
  }
  const visit = (node: VisitedNode, path: string): void => {
    switch (node.kind) {
      case "Element":
        for (const [index, attribute] of node.attributes.entries()) {
          attributeExpressions(attribute, `${path}/attributes/${index}`, add);
        }
        for (const [index, child] of node.children.entries()) {
          visit(child, `${path}/children/${index}`);
        }
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
  attribute: Attribute,
  path: string,
  add: (expression: Expression, path: string) => void,
): void {
  switch (attribute.kind) {
    case "Static":
      return;
    case "Bound":
    case "Spread":
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
    default:
      unreachable(attribute);
  }
}

/** A span of a module, with where it is. */
export interface LocatedSpan {
  span: Span;
  /** A JSON Pointer to the node or value the span belongs to. */
  path: string;
}

/**
 * Every span of a module, each with a JSON Pointer to what carries it: components, exports,
 * type declarations, props and their types, bindings, every node, branch, attribute, class
 * part, style declaration and spread key, and every expression and reference. What points into
 * the source (diagnostics, a plugin's module) is checked span by span with it.
 */
export function spansOf(module: UfModule): LocatedSpan[] {
  const found: LocatedSpan[] = [];
  const add = (span: Span, path: string) => found.push({ span, path: `${path}/span` });
  const expression = (value: Expression, path: string) => {
    add(value.span, path);
    for (const [index, ref] of value.refs.entries()) add(ref.span, `${path}/refs/${index}`);
  };
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
    for (const [binding, { span }] of component.bindings.entries()) {
      add(span, `${base}/bindings/${binding}`);
    }
    walkSpans(component.render, `${base}/render`, add);
    for (const located of expressionsOf(component, base)) {
      expression(located.expression, located.path);
    }
  }
  for (const [index, entry] of module.exports.entries()) add(entry.span, `/exports/${index}`);
  for (const [index, declaration] of module.types.entries()) {
    add(declaration.span, `/types/${index}`);
  }
  return found;
}

/** The spans of nodes, branches, attributes and their parts (expressions aside). */
function walkSpans(node: VisitedNode, path: string, add: (span: Span, path: string) => void) {
  add(node.span, path);
  switch (node.kind) {
    case "Element":
      for (const [index, attribute] of node.attributes.entries()) {
        const at = `${path}/attributes/${index}`;
        add(attribute.span, at);
        switch (attribute.kind) {
          case "Static":
          case "Bound":
            break;
          case "Class":
            for (const [item, { span }] of attribute.items.entries()) {
              add(span, `${at}/items/${item}`);
            }
            break;
          case "Style":
            for (const [item, { span }] of attribute.declarations.entries()) {
              add(span, `${at}/declarations/${item}`);
            }
            break;
          case "Spread":
            for (const [item, { span }] of attribute.keys.entries())
              add(span, `${at}/keys/${item}`);
            break;
          default:
            unreachable(attribute);
        }
      }
      for (const [index, child] of node.children.entries()) {
        walkSpans(child, `${path}/children/${index}`, add);
      }
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
