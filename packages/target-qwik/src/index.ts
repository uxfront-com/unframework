import {
  bindingOf,
  boundJsxAttribute,
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  jsxAttributeValue,
  jsxContext,
  jsxExpression,
  jsxNode,
  printComponentModule,
  sourceNames,
  spreadRead,
  staticJsxAttribute,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, JsxDialect, OutputFile, Target } from "@unframework/codegen";
import type { ElementNode, UfComponent, UfModule } from "@unframework/ir";

import {
  elementNamespaces,
  isUntypedAttribute,
  qwikAttributeName,
  qwikStaticValue,
} from "./attributes.ts";
import { qwikClassAttribute } from "./class.ts";
import { isPrimitiveValue } from "./values.ts";

/** The Qwik 2 target (experimental while Qwik 2 is in beta). */
export const qwik: Target = defineTarget({
  name: "qwik",
  framework: { package: "@qwik.dev/core", range: ">=2.0.0-beta.47 <3" },
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
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { module } = context;
    // Every name the source declares or reads is taken before the output names its own.
    const imports = new ImportSet(sourceNames(component, module));
    const componentFn = imports.add("@qwik.dev/core", "component$");
    const jsx = jsxContext({ component, dialect: qwikDialect(component, module) });
    const parameter = propsParameter(component, jsx);
    const definition = js.callExpression(
      js.identifier(componentFn),
      [
        js.arrowFunction(parameter ? [parameter] : [], [
          js.returnStatement(jsxNode(component.render, jsx)),
        ]),
      ],
      component.propsParameter ? [jsx.placeholders.type(component.propsParameter.type.code)] : [],
    );
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports,
            types: componentTypes(component, module),
            body: exportDeclaration(
              component.name,
              definition,
              exportsOf(component.name, module.exports),
            ),
            placeholders: jsx.placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

export default qwik;

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Parameter = Parameters<typeof js.arrowFunction>[0][number];
type AstExpression = Parameters<typeof js.conditionalExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute> | ReturnType<typeof js.jsxSpreadAttribute>;

/**
 * The props as `component$`'s parameter, typed by its type argument (`component$<Props>`,
 * design §5.6): the source's destructuring, with its defaults, or its `props` object. A prop
 * no printed expression reads is left out (an unused binding fails L5), and so is the whole
 * parameter when none is read. Qwik's optimizer turns destructured props into reactive reads
 * of the props object, and applies a default as `??` (ADR-0034: the analyser rejects a default
 * on a prop that admits `null`, so `??` and destructuring agree).
 */
function propsParameter(component: UfComponent, jsx: JsxContext): Parameter | undefined {
  const parameter = component.propsParameter;
  if (!parameter) return undefined;
  const read = component.props.filter(
    (prop) => prop.binding !== undefined && jsx.referenced.has(prop.binding),
  );
  if (!read.length) return undefined;
  if (parameter.form === "object") return js.bindingIdentifier(parameter.name!);
  // In the order the source destructures them, which may differ from the type's.
  const start = (binding: string) => bindingOf(component, binding).span.start;
  return js.objectPattern(
    read
      .toSorted((a, b) => start(a.binding!) - start(b.binding!))
      .map((prop) =>
        js.bindingProperty(
          prop.name,
          prop.default && jsx.placeholders.expression(prop.default.code),
        ),
      ),
  );
}

/**
 * How Qwik's JSX differs from the defaults (React's shape: ternaries, keyed `.map`, `{expr}`):
 * HTML attributes take the names and value types Qwik's JSX types declare, an attribute they
 * declare no name for is an object spread, and `class` takes Qwik's own forms. Style objects
 * (camelCase keys, which Qwik's renderer writes in kebab case) are the default.
 */
function qwikDialect(component: UfComponent, module: UfModule): JsxDialect {
  const namespaces = elementNamespaces(component.render);
  const namespaceOf = (element: ElementNode) => namespaces.get(element) ?? "html";
  return {
    attributeName: (name, element) => qwikAttributeName(name, namespaceOf(element)),
    staticAttribute(attribute, element, context) {
      // A static `class` beside a spread that carries one merges with it.
      if (attribute.name === "class") return staticJsxAttribute(attribute, element, context);
      const namespace = namespaceOf(element);
      const { name, value: written } = attribute;
      if (isUntypedAttribute(element.tag, namespace, name, written)) {
        return [untypedSpread(name, js.stringLiteral(written === true ? "" : written))];
      }
      const value = qwikStaticValue(element.tag, namespace, name, written);
      return [
        js.jsxAttribute(
          qwikAttributeName(name, namespace),
          value === true
            ? null
            : typeof value === "string"
              ? jsxAttributeValue(value)
              : js.jsxExpressionContainer(context.placeholders.expression(value.code)),
        ),
      ];
    },
    boundAttribute(attribute, element, context) {
      if (!isUntypedAttribute(element.tag, namespaceOf(element), attribute.name)) {
        return boundJsxAttribute(attribute, element, context);
      }
      return [untypedSpread(attribute.name, jsxExpression(attribute.value, context))];
    },
    // One attribute per declared key (ADR-0039), as the default writes them, but a key Qwik's
    // types do not declare is an object spread too. A `class` key joins the element's `class`.
    spreadAttribute(attribute, element, context) {
      const namespace = namespaceOf(element);
      const merged = element.attributes.some(
        (other) => other.kind === "Class" || (other.kind === "Static" && other.name === "class"),
      );
      return attribute.keys
        .filter((key) => !(merged && key.name === "class"))
        .map((key) => {
          const value = spreadRead(attribute, key, context);
          return isUntypedAttribute(element.tag, namespace, key.name)
            ? untypedSpread(key.name, value)
            : js.jsxAttribute(
                qwikAttributeName(key.name, namespace),
                js.jsxExpressionContainer(value),
              );
        });
    },
    classAttribute: (attribute, element, context) =>
      qwikClassAttribute(attribute, element, context, (condition) =>
        isPrimitiveValue(condition, component, module),
      ),
  };
}

/** `{...{ name: value }}`: an attribute under its HTML name, which Qwik's types leave unchecked. */
function untypedSpread(name: string, value: AstExpression): JsxAttribute {
  return js.jsxSpreadAttribute(js.objectExpression([[name.toLowerCase(), value]]));
}
