import {
  bindingOf,
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  jsxContext,
  jsxNode,
  printComponentModule,
  sourceNames,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, OutputFile, Target } from "@unframework/codegen";
import type {
  Attribute,
  ElementNode,
  FragmentNode,
  RenderNode,
  TextNode,
  UfComponent,
} from "@unframework/ir";

import { cxHelper, reactDialect } from "./dialect.ts";
import type { ReactNames } from "./dialect.ts";
import { titleChildren } from "./title.ts";

type Parameter = Parameters<typeof js.functionDeclaration>[1][number];

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
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    // React's `className` takes one string: an inline `cx` joins the parts (ADR-0038).
    "class-binding": {
      support: "emulated",
      helper: "cx",
      note: "React's className takes one string, so an inline helper joins the static names, toggles and dynamic parts.",
    },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
  },
  // A function component in TSX (design §5.1): the copied type declarations, the props as the
  // source declares them, and the render tree in React's JSX, with the expressions as written.
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { module } = context;
    // Every name the source declares or reads is taken before the output claims its own
    // (`cx`, `CSSProperties`, `_props`), so none captures another (design §4.2).
    const names: ReactNames = { imports: new ImportSet(sourceNames(component, module)) };
    const jsx = jsxContext({ component, dialect: reactDialect(names) });
    const fn = js.functionDeclaration(
      component.name,
      propsParameters(component, jsx, names.imports),
      [js.returnStatement(jsxNode(rootForReact(component.render, jsx), jsx))],
    );
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports: names.imports,
            types: componentTypes(component, module),
            body: exportDeclaration(component.name, fn, exportsOf(component.name, module.exports)),
            helpers: names.cx ? [cxHelper(names.cx)] : [],
            placeholders: jsx.placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

/**
 * The component's parameters, as the source declares its props (ADR-0034): the destructured
 * props in source order, with their defaults, or the props object, typed as written. A prop
 * that no printed expression reads is left out with its default, and a parameter nothing reads
 * is named `_props` (or `_` and the object's name): an unused binding, or an empty pattern,
 * fails L5.
 */
function propsParameters(
  component: UfComponent,
  context: JsxContext,
  imports: ImportSet,
): Parameter[] {
  const parameter = component.propsParameter;
  if (!parameter) return [];
  const type = context.placeholders.type(parameter.type.code);
  const read = component.props.filter(
    (prop) => prop.binding !== undefined && context.referenced.has(prop.binding),
  );
  if (parameter.form === "object") {
    // A name `_` and more says it is unused already: it stays the source's (oxlint still
    // reports a bare `_`).
    const name =
      read.length || /^_./.test(parameter.name!)
        ? parameter.name!
        : imports.claim(`_${parameter.name!}`);
    return [js.bindingIdentifier(name, type)];
  }
  if (!read.length) return [js.bindingIdentifier(imports.claim("_props"), type)];
  const start = (binding: string) => bindingOf(component, binding).span.start;
  const properties = read
    .toSorted((a, b) => start(a.binding!) - start(b.binding!))
    .map((prop) =>
      js.bindingProperty(
        prop.name,
        prop.default && context.placeholders.expression(prop.default.code),
      ),
    );
  return [js.objectPattern(properties, type)];
}

/** {@link forReact} over the render root: an element, or a fragment's roots. */
function rootForReact(
  root: ElementNode | FragmentNode,
  context: JsxContext,
): ElementNode | FragmentNode {
  return root.kind === "Element"
    ? forReact(root, context)
    : { ...root, children: root.children.map((child) => childForReact(child, context)) };
}

/** {@link forReact} over a node, inside conditionals and lists too. */
function childForReact(node: RenderNode, context: JsxContext): RenderNode {
  switch (node.kind) {
    case "Element":
      return forReact(node, context);
    case "If":
      return {
        ...node,
        branches: node.branches.map((branch) => ({
          ...branch,
          children: branch.children.map((child) => childForReact(child, context)),
        })),
      };
    case "For":
      return { ...node, body: forReact(node.body, context) };
    case "Text":
    case "Interpolation":
      return node;
    default:
      return node satisfies never;
  }
}

/**
 * Applies React's rules for the elements whose children React reads as one value. An SVG
 * `<title>` gets one child wherever its content has several parts (see `titleChildren`); the
 * IR holds no HTML `<title>` (UF3002). A `<textarea>`: React warns about its children and takes
 * its initial text from `defaultValue`, so the text becomes a `value` attribute, which the
 * dialect writes as `defaultValue`. The IR holds no `value` on one (form state, M3) and no
 * interpolation, conditional or list in one; the analyser rejects an element there too (UF3003),
 * and the target throws on one rather than drop it (a target that throws is reported by the
 * compiler).
 */
function forReact(node: ElementNode, context: JsxContext): ElementNode {
  if (node.tag === "title") return { ...node, children: titleChildren(node.children, context) };
  if (node.tag !== "textarea" || node.children.length === 0) {
    return { ...node, children: node.children.map((child) => childForReact(child, context)) };
  }
  const texts = node.children.filter((child): child is TextNode => child.kind === "Text");
  if (texts.length !== node.children.length) {
    throw new Error("A <textarea> holds only text: the analyser rejects anything else (UF3003).");
  }
  const content: Attribute = {
    kind: "Static",
    name: "value",
    value: texts.map((text) => text.value).join(""),
    span: { start: texts[0]!.span.start, end: texts.at(-1)!.span.end },
  };
  return { ...node, attributes: [...node.attributes, content], children: [] };
}

export default react;
