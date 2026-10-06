// How React writes what the JSX printer's defaults (design §4.2) write differently: React's
// prop names, number-typed props as numbers, `className` through an inline `cx`, style objects
// typed for custom properties, and spreads written out key by key (design §5.1). Every boolean
// attribute the IR can hold is one of React's boolean props (test/attributes.test.ts), so the
// defaults write it bare and bind it as it is.
import {
  expressionCode,
  isIdentifier,
  isNumberTypedAttribute,
  js,
  jsxAttributeName,
  jsxExpression,
  spreadClassReads,
  spreadRead,
  staticJsxAttribute,
  styleObject,
} from "@unframework/codegen";
import type { ImportSet, JsxContext, JsxDialect } from "@unframework/codegen";
import type { ClassAttribute, ElementNode } from "@unframework/ir";

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
}

/** The React dialect of the JSX printer, claiming names in `names` as it needs them. */
export function reactDialect(names: ReactNames): JsxDialect {
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

    classAttribute: (attribute, element, context) => [
      className([...classParts(attribute, context), ...spreadClassReads(element, context)], names),
    ],

    styleAttribute(attribute, _element, context) {
      const object: Expression = styleObject(attribute, context, "camel");
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
        .map((key) => prop(key.name, element, context, spreadRead(attribute, key, context)));
    },
  };
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

/**
 * The `cx` helper, printed after the component (a reader meets the component first). It joins
 * class names as Vue's `:class` does: strings as they are, and the keys of an object's truthy
 * entries. Its parameters are `unknown`: a toggle's condition may be any value, tested for
 * truthiness.
 */
export function cxHelper(name: string): string {
  return `/** Joins class names, and the keys of an object's truthy entries, into one \`className\`. */
function ${name}(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}`;
}
