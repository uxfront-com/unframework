// How React writes what the JSX printer's defaults write differently: React's prop names,
// number-typed props as numbers, `className` through an inline `cx`, style objects typed for
// custom properties, and spreads written out key by key (ADR-0037 to ADR-0039). Every boolean
// attribute the IR can hold is one of React's boolean props (test/attributes.test.ts), so the
// defaults write it bare and bind it as it is.
import {
  expressionCode,
  isIdentifier,
  isNumberTypedAttribute,
  js,
  jsxAttributeName,
  jsxAttributeValue,
  jsxExpression,
  spreadClassReads,
  spreadRead,
  staticJsxAttribute,
  styleObject,
} from "@unframework/codegen";
import type { ImportSet, JsxContext, JsxDialect } from "@unframework/codegen";
import type { ClassAttribute, ElementNode } from "@unframework/ir";

import { keyedTernary } from "./branches.ts";
import type { ReactComposer } from "./compose.ts";
import type { ReactListeners } from "./listeners.ts";
import { formControlProp, REACT_PROP_NAMES } from "./props.ts";

type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
type Expression = Parameters<typeof js.jsxExpressionContainer>[0];
type ObjectExpression = ReturnType<typeof js.objectExpression>;

/** The names one output file claims as it prints: its imports, and its inline helper. */
export interface ReactNames {
  /** The output file's imports and names (`sourceNames` reserved). */
  readonly imports: ImportSet;
  /** The local name of the `cx` helper, once a `className` needs it. */
  cx?: string;
  /** Whether a `className` joins a part that may be an array or an object (ADR-0065). */
  cxCollections?: boolean;
  /** The local name of the `styleObject` helper, once a style bound to a value needs it. */
  styleObject?: string;
  /** The `style` prop's local, where the root takes a consumer's (ADR-0054). */
  style?: string;
}

/**
 * The React dialect of the JSX printer, claiming names in `names` as it needs them; `listeners`
 * prints the listeners and template refs, and `composer` composition (ADR-0054).
 */
export function reactDialect(
  names: ReactNames,
  listeners: ReactListeners,
  composer: ReactComposer,
): JsxDialect {
  return {
    attributeName: (name, element) =>
      formControlProp(name, element) ?? REACT_PROP_NAMES[name] ?? name,

    staticAttribute(attribute, element, context) {
      const { name, value } = attribute;
      if (typeof value === "string" && name === "class") {
        const reads = spreadClassReads(element, context);
        if (reads.length) return [className([js.stringLiteral(value), ...reads], names)];
      }
      // @types/react types these as `number`, so a string fails L4; the invariants keep their
      // static values canonical numbers, which print as written (`tabIndex={0}`).
      if (typeof value === "string" && isNumberTypedAttribute(element.tag, name)) {
        const number = context.placeholders.expression(value);
        return [prop(name, element, context, number)];
      }
      return staticJsxAttribute(attribute, element, context);
    },

    boundAttribute: (attribute, element, context) => [
      prop(attribute.name, element, context, jsxExpression(attribute.value, context)),
    ],

    classAttribute(attribute, element, context) {
      if (attribute.items.some((item) => item.kind === "Dynamic" && item.collection)) {
        names.cxCollections = true;
      }
      // The root's `class` is the consumer's alone: as it is (ADR-0054).
      if (composer.bareClasses.has(attribute) && !spreadsClass(element)) {
        const [only] = attribute.items;
        if (only?.kind === "Dynamic") {
          return [
            js.jsxAttribute(
              "className",
              js.jsxExpressionContainer(jsxExpression(only.value, context)),
            ),
          ];
        }
      }
      // A component's static `class` is a string, as an element's (`className="wide"`).
      if (/^[A-Z]/.test(element.tag) && attribute.items.every((item) => item.kind === "Static")) {
        const value = attribute.items
          .map((item) => (item.kind === "Static" ? item.value : ""))
          .join(" ");
        return [js.jsxAttribute("className", jsxAttributeValue(value))];
      }
      return [
        className(
          [...classParts(attribute, context), ...spreadClassReads(element, context)],
          names,
        ),
      ];
    },

    styleAttribute(attribute, _element, context) {
      const fallthrough = composer.fallthroughStyles.has(attribute);
      const own = names.style;
      // A style bound to a value, an object or a declaration list (ADR-0065).
      if (attribute.value) {
        const value = styleObjectCall(jsxExpression(attribute.value, context), names);
        return [
          js.jsxAttribute(
            "style",
            js.jsxExpressionContainer(fallthrough ? withConsumer(value, own!) : value),
          ),
        ];
      }
      if (fallthrough && attribute.declarations.length === 0) {
        return [js.jsxAttribute("style", js.jsxExpressionContainer(js.identifier(own!)))];
      }
      const object = styleObject(attribute, context, "camel");
      // A consumer's declarations win over the root's own (ADR-0054).
      if (fallthrough) object.properties.push(js.spreadElement(js.identifier(own!)));
      // React's `CSSProperties` declares no custom properties, so an object holding one is
      // typed as its own (tsgo rejects the literal otherwise).
      const custom = attribute.declarations.some(({ property }) => property.startsWith("--"));
      const value = custom
        ? js.asExpression(
            object,
            js.typeReference(names.imports.add("react", "CSSProperties", { type: true })),
          )
        : object;
      return [js.jsxAttribute("style", js.jsxExpressionContainer(value))];
    },

    // ADR-0039: a spread renders exactly its declared keys, so each is written out as the bound
    // attribute it stands for. A `class` key merges into the element's own `className`.
    spreadAttribute(attribute, element, context) {
      const merged = element.attributes.some(
        (other) => other.kind === "Class" || (other.kind === "Static" && other.name === "class"),
      );
      return attribute.keys
        .filter((key) => !(merged && key.name === "class"))
        .map((key) => {
          const read = spreadRead(attribute, key, context);
          // A `style` key is the element's style (ADR-0065).
          return prop(
            key.name,
            element,
            context,
            key.name === "style" ? styleObjectCall(read, names) : read,
          );
        });
    },

    conditional: (node, context) => keyedTernary(node, context, names.imports),

    eventAttribute: (attribute, element, context) => listeners.event(attribute, element, context),

    // A component's `ref` holds what it exposes (ADR-0054): the ref object itself.
    refAttribute: (attribute, element, context) =>
      /^[A-Z]/.test(element.tag)
        ? [
            js.jsxAttribute(
              "ref",
              js.jsxExpressionContainer(
                js.identifier(
                  context.component.bindings.find((binding) => binding.id === attribute.binding)!
                    .name,
                ),
              ),
            ),
          ]
        : listeners.ref(attribute, element, context),

    slotOutlet: (node, context) => composer.slotOutlet(node, context),
    slotValue: (slot, context) => composer.slotValue(slot, context),
    fillAttribute: (fill, node, context) => composer.fillAttribute(fill, node, context),
    componentEvent: (attribute, node, context) => composer.componentEvent(attribute, node, context),
    modelAttribute: (attribute, element, context) =>
      composer.modelAttribute(attribute, element, context),
    modelBinding: (attribute, node, context) => composer.modelBinding(attribute, node, context),
    dynamic: (node, context) => composer.dynamic(node, context),
    scopeRootAttributes: (element, context) => composer.scopeRootAttributes(element, context),
  };
}

/** Whether a spread on the element carries a `class`, which the element's `class` merges. */
function spreadsClass(element: ElementNode): boolean {
  return element.attributes.some(
    (attribute) =>
      attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "class"),
  );
}

/** `name={value}`, under the name React spells the attribute with. */
function prop(
  name: string,
  element: ElementNode,
  context: JsxContext,
  value: Expression,
): JsxAttribute {
  return js.jsxAttribute(
    jsxAttributeName(name, element, context),
    js.jsxExpressionContainer(value),
  );
}

/**
 * A `class`'s parts as `cx`'s arguments: static names as strings, dynamic parts as written, and
 * adjacent toggles as one object, `{ active, "is-busy": busy }`, in shorthand where the
 * condition is a variable of the toggle's own name.
 */
function classParts(attribute: ClassAttribute, context: JsxContext): Expression[] {
  const parts: Expression[] = [];
  let toggles: ObjectExpression | undefined;
  for (const item of attribute.items) {
    if (item.kind !== "Toggle") {
      toggles = undefined;
      parts.push(
        item.kind === "Static" ? js.stringLiteral(item.value) : jsxExpression(item.value, context),
      );
      continue;
    }
    const shorthand =
      isIdentifier(item.name) && expressionCode(item.condition, context) === item.name;
    const entry = shorthand
      ? js.property(item.name, js.identifier(item.name), { shorthand: true })
      : js.property(item.name, jsxExpression(item.condition, context));
    if (toggles) toggles.properties.push(entry);
    else parts.push((toggles = js.objectExpression([entry])));
  }
  return parts;
}

/**
 * `className={cx(…)}`: React's `className` takes one string, so the inline `cx` helper joins
 * the static names, the dynamic parts, the toggles' objects and the spreads' classes (the
 * `class-binding` capability, emulated: ADR-0038).
 */
function className(parts: Expression[], names: ReactNames): JsxAttribute {
  names.cx ??= names.imports.claim("cx");
  return js.jsxAttribute(
    "className",
    js.jsxExpressionContainer(js.callExpression(js.identifier(names.cx), parts)),
  );
}

/** `{ ...value, ...style }`: a consumer's declarations win over the root's own (ADR-0054). */
function withConsumer(value: Expression, own: string): Expression {
  const object = js.objectExpression([]);
  object.properties.push(js.spreadElement(value), js.spreadElement(js.identifier(own)));
  return object;
}

/**
 * `styleObject(value)`: a style bound to a value as React's `style` takes it (the
 * `style-binding` capability, emulated: ADR-0065).
 */
function styleObjectCall(value: Expression, names: ReactNames): Expression {
  names.styleObject ??= names.imports.claim("styleObject");
  return js.callExpression(js.identifier(names.styleObject), [value]);
}

/**
 * The `styleObject` helper: an object as it is, and a declaration list as an object, split as
 * Vue's `parseStringStyle` splits it, with React's camel-case keys (`-webkit-x` is `WebkitX`).
 */
export function styleObjectHelper(name: string, cssProperties: string): string {
  // Raw, so the regular expressions keep their escapes.
  return String.raw`/** A style bound to a value as React's style takes it: a declaration list becomes an object. */
function ${name}(style: ${cssProperties} | string | null | undefined): ${cssProperties} | undefined {
  if (typeof style !== "string") return style ?? undefined;
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    if (value === undefined) continue;
    const key = property!.trim();
    const camel = key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object as ${cssProperties};
}`;
}

/**
 * The `cx` helper, printed after the component (a reader meets the component first). It joins
 * class names as Vue's `:class` does: strings as they are, and the keys of an object's truthy
 * entries; with `collections`, an array's entries too, recursively (ADR-0065). Its parameters
 * are `unknown`: a toggle's condition may be any value, tested for truthiness.
 */
export function cxHelper(name: string, collections = false): string {
  return `/** Joins class names, and the keys of an object's truthy entries, into one \`className\`. */
function ${name}(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (${
      collections
        ? `Array.isArray(part)) {
      const joined = ${name}(...part);
      if (joined) names.push(joined);
    } else if (`
        : ""
    }part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}`;
}
