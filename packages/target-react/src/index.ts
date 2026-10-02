import {
  defineTarget,
  exportDeclaration,
  exportsOf,
  js,
  jsxElement,
  printProgram,
} from "@unframework/codegen";
import type { EmitContext, JsxDialect, OutputFile, Target } from "@unframework/codegen";
import type { Attribute, ElementNode, RenderNode, UfComponent } from "@unframework/ir";

import { BOOLEAN_PROPS, formControlProp, REACT_PROP_NAMES, unsupportedOnReact } from "./props.ts";

const dialect: JsxDialect = {
  attributeName: (name, element) =>
    formControlProp(name, element) ?? REACT_PROP_NAMES[name] ?? name,
  // React drops `attr=""` on boolean props and stringifies `true` elsewhere.
  presentAttributeValue: (name) => (BOOLEAN_PROPS.has(name) ? true : ""),
};

/** The React 19 target. */
export const react: Target = defineTarget({
  name: "react",
  framework: { package: "react", range: ">=19.2 <20" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const fn = js.functionDeclaration(
      component.name,
      [],
      [js.returnStatement(jsxElement(forReact(component.render, context), dialect))],
    );
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    return [
      {
        path: `${component.name}.tsx`,
        contents: printProgram(js.program(statements), { jsx: true }),
      },
    ];
  },
});

/**
 * Applies React's attribute rules to the render tree: a boolean attribute's presence means
 * `true`, whatever its static value; an attribute React cannot render as the HTML would is
 * reported (UF1002) and left out, so the output never crashes or silently differs.
 */
function forReact(node: ElementNode, context: EmitContext): ElementNode {
  const attributes: Attribute[] = [];
  for (const attribute of node.attributes) {
    const problem = unsupportedOnReact(attribute.name, attribute.value, node.tag);
    if (problem) {
      context.report({ code: "UF1002", severity: "error", message: problem, span: attribute.span });
      continue;
    }
    attributes.push(BOOLEAN_PROPS.has(attribute.name) ? { ...attribute, value: true } : attribute);
  }
  if (node.tag === "textarea") return textareaForReact(node, attributes, context);
  const children = node.children.map((child): RenderNode =>
    child.kind === "Element" ? forReact(child, context) : child,
  );
  return { ...node, attributes, children };
}

/**
 * React warns about a `<textarea>`'s children and takes its initial text from `defaultValue`,
 * so the text content becomes a `value` attribute, which the dialect writes as `defaultValue`.
 * Content that prop cannot carry (elements, or text beside a static `value`) is reported.
 */
function textareaForReact(
  node: ElementNode,
  attributes: Attribute[],
  context: EmitContext,
): ElementNode {
  const first = node.children[0];
  if (!first) return { ...node, attributes };
  const element = node.children.find((child) => child.kind === "Element");
  const value = attributes.find((attribute) => attribute.name === "value");
  if (element || value) {
    context.report({
      code: "UF1002",
      severity: "error",
      message: element
        ? "React takes a `<textarea>`'s content as its `defaultValue`, so it cannot render elements inside one."
        : "A `<textarea>` with both a static `value` and content has two initial values; React takes only one.",
      span: (element ?? value)!.span,
    });
    return { ...node, attributes, children: [] };
  }
  const last = node.children.at(-1)!;
  const text = node.children.map((child) => (child.kind === "Text" ? child.value : "")).join("");
  const content: Attribute = {
    kind: "Static",
    name: "value",
    value: text,
    span: { start: first.span.start, end: last.span.end },
  };
  return { ...node, attributes: [...attributes, content], children: [] };
}

export default react;
