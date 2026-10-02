import type {
  Attribute,
  ElementNode,
  RenderNode,
  Span,
  StaticAttribute,
  TextNode,
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
): UfModule {
  return { irVersion: IR_VERSION, file, components, exports };
}

/** Builds a component. */
export function createComponent(name: string, render: ElementNode, at: Span): UfComponent {
  return { name, span: at, render };
}

/** Builds an export entry. */
export function createExport(kind: UfExport["kind"], local: string, at: Span): UfExport {
  return { kind, name: kind === "default" ? "default" : local, local, span: at };
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

/** Builds a static attribute. */
export function createStaticAttribute(
  name: string,
  value: string | true,
  at: Span,
): StaticAttribute {
  return { kind: "Static", name, value, span: at };
}
