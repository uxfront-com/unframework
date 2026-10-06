// The builders write each node's keys in the order of its type, which is the order of every
// `ir.json` snapshot, and leave an absent optional field out: never `key: undefined`, which a
// JSON round trip would drop (ADR-0032).

import type {
  Attribute,
  Binding,
  BindingId,
  BindingKind,
  BindingReference,
  BoundAttribute,
  BoundStyle,
  ClassAttribute,
  ClassItem,
  DynamicClass,
  ElementNode,
  Expression,
  ForNode,
  FragmentNode,
  GlobalReference,
  IfBranch,
  IfNode,
  InterpolationNode,
  Prop,
  PropsParameter,
  Reference,
  RenderNode,
  Span,
  SpreadAttribute,
  SpreadKey,
  StaticAttribute,
  StaticClass,
  StaticStyle,
  StyleAttribute,
  StyleDeclaration,
  TextNode,
  ToggleClass,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfExport,
  UfModule,
} from "./types.ts";
import { IR_VERSION } from "./version.ts";

/** Builds a span. */
export function span(start: number, end: number): Span {
  return { start, end };
}

/** Builds a module. */
export function createModule(
  file: string,
  components: UfComponent[] = [],
  exports: UfExport[] = [],
  types: TypeDeclaration[] = [],
): UfModule {
  return { irVersion: IR_VERSION, file, components, exports, types };
}

/** Builds a type declaration. */
export function createTypeDeclaration(
  name: string,
  exported: boolean,
  code: string,
  at: Span,
): TypeDeclaration {
  return { name, exported, code, span: at };
}

/** Builds a component: without props, types or bindings unless given. */
export function createComponent(
  name: string,
  render: ElementNode | FragmentNode,
  at: Span,
  props: Prop[] = [],
  propsParameter?: PropsParameter,
  types: string[] = [],
  bindings: Binding[] = [],
): UfComponent {
  return {
    name,
    span: at,
    props,
    ...(propsParameter ? { propsParameter } : {}),
    types,
    bindings,
    render,
  };
}

/** Builds a props parameter: `name` is the parameter's in the object form only. */
export function createPropsParameter(
  form: PropsParameter["form"],
  type: TypeText,
  at: Span,
  name?: string,
): PropsParameter {
  return { form, ...(name === undefined ? {} : { name }), type, span: at };
}

/** Builds a prop. */
export function createProp(
  name: string,
  optional: boolean,
  type: TypeText,
  at: Span,
  binding?: BindingId,
  defaultValue?: Expression,
): Prop {
  return {
    name,
    optional,
    type,
    ...(defaultValue ? { default: defaultValue } : {}),
    ...(binding === undefined ? {} : { binding }),
    span: at,
  };
}

/** Builds a type annotation's text. */
export function createTypeText(code: string, at: Span): TypeText {
  return { code, span: at };
}

/** Builds a binding, with its id: its name and where it is declared. */
export function createBinding(name: string, kind: BindingKind, at: Span): Binding {
  return { id: bindingId(name, at.start), name, kind, span: at };
}

/** A binding's id: `name@offset` (plan §5.3). */
export function bindingId(name: string, offset: number): BindingId {
  return `${name}@${offset}`;
}

/** Builds an expression. */
export function createExpression(code: string, at: Span, refs: Reference[] = []): Expression {
  return { code, span: at, refs };
}

/** Builds a reference to a binding; `shorthand` marks a shorthand property (`{ label }`). */
export function createBindingReference(
  binding: BindingId,
  at: Span,
  shorthand = false,
): BindingReference {
  return { kind: "Binding", binding, span: at, ...(shorthand ? { shorthand: true as const } : {}) };
}

/** Builds a reference to an allowed global. */
export function createGlobalReference(name: string, at: Span): GlobalReference {
  return { kind: "Global", name, span: at };
}

/** Builds an element. */
export function createElement(
  tag: string,
  attributes: Attribute[],
  children: RenderNode[],
  at: Span,
): ElementNode {
  return { kind: "Element", tag, attributes, children, span: at };
}

/** Builds a text node. */
export function createText(value: string, at: Span): TextNode {
  return { kind: "Text", value, span: at };
}

/** Builds an interpolation. */
export function createInterpolation(value: Expression, at: Span): InterpolationNode {
  return { kind: "Interpolation", value, span: at };
}

/** Builds a conditional. */
export function createIf(branches: IfBranch[], at: Span): IfNode {
  return { kind: "If", branches, span: at };
}

/** Builds a branch of a conditional: `condition` is `undefined` for the final else. */
export function createBranch(
  condition: Expression | undefined,
  children: RenderNode[],
  at: Span,
): IfBranch {
  return { ...(condition ? { condition } : {}), children, span: at };
}

/** Builds a list. */
export function createFor(
  source: Expression,
  item: BindingId,
  key: Expression,
  body: ElementNode,
  at: Span,
  index?: BindingId,
): ForNode {
  return {
    kind: "For",
    source,
    item,
    ...(index === undefined ? {} : { index }),
    key,
    body,
    span: at,
  };
}

/** Builds a root fragment. */
export function createFragment(children: RenderNode[], at: Span): FragmentNode {
  return { kind: "Fragment", children, span: at };
}

/** Builds a static attribute. */
export function createStaticAttribute(
  name: string,
  value: string | true,
  at: Span,
): StaticAttribute {
  return { kind: "Static", name, value, span: at };
}

/** Builds a bound attribute. */
export function createBoundAttribute(name: string, value: Expression, at: Span): BoundAttribute {
  return { kind: "Bound", name, value, span: at };
}

/** Builds a `class` from its parts. */
export function createClassAttribute(items: ClassItem[], at: Span): ClassAttribute {
  return { kind: "Class", items, span: at };
}

/** Builds static class names, a part of a `class`. */
export function createStaticClass(value: string, at: Span): StaticClass {
  return { kind: "Static", value, span: at };
}

/** Builds a toggled class name, a part of a `class`. */
export function createToggleClass(name: string, condition: Expression, at: Span): ToggleClass {
  return { kind: "Toggle", name, condition, span: at };
}

/** Builds a dynamic part of a `class`. */
export function createDynamicClass(value: Expression, at: Span): DynamicClass {
  return { kind: "Dynamic", value, span: at };
}

/** Builds a `style` from its declarations. */
export function createStyleAttribute(declarations: StyleDeclaration[], at: Span): StyleAttribute {
  return { kind: "Style", declarations, span: at };
}

/** Builds a static style declaration. */
export function createStaticStyle(property: string, value: string, at: Span): StaticStyle {
  return { kind: "Static", property, value, span: at };
}

/** Builds a bound style declaration. */
export function createBoundStyle(property: string, value: Expression, at: Span): BoundStyle {
  return { kind: "Bound", property, value, span: at };
}

/** Builds a spread of an object with known keys, which may be nullish where it is spread. */
export function createSpreadAttribute(
  value: Expression,
  keys: SpreadKey[],
  nullish: boolean,
  at: Span,
): SpreadAttribute {
  return { kind: "Spread", value, keys, nullish, span: at };
}

/** Builds a key a spread renders. */
export function createSpreadKey(name: string, at: Span): SpreadKey {
  return { name, span: at };
}

/** Builds an export entry. */
export function createExport(kind: UfExport["kind"], local: string, at: Span): UfExport {
  return { kind, name: kind === "default" ? "default" : local, local, span: at };
}
