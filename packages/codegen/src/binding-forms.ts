// The binding forms ADR-0065 lowers that a target may need an inline helper for: a `style`
// bound to one value, an object or a declaration list known only at run time (or a spread's
// `style` key, which is the same), and a class part that may hold an array or an object.
import { walk } from "@unframework/ir";
import type {
  Attribute,
  ComponentAttribute,
  Expression,
  SpreadAttribute,
  UfComponent,
} from "@unframework/ir";

/** Which of the forms a component's template uses. */
export interface BindingForms {
  /** A `style` bound to one value, or a spread's `style` key. */
  wholeStyle: boolean;
  /** A class part that may be an array or an object at run time. */
  classCollection: boolean;
}

/** The forms a component's template uses, on its elements, components and `<component is>`. */
export function bindingForms(component: UfComponent): BindingForms {
  const forms: BindingForms = { wholeStyle: false, classCollection: false };
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element" && node.kind !== "Component" && node.kind !== "Dynamic") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Style" && attribute.value) forms.wholeStyle = true;
        if (attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style")) {
          forms.wholeStyle = true;
        }
        if (
          attribute.kind === "Class" &&
          attribute.items.some((item) => item.kind === "Dynamic" && item.collection)
        ) {
          forms.classCollection = true;
        }
      }
    },
  });
  return forms;
}

/**
 * A spread's `style` key read as an expression of its own, `attrs.style` or `attrs?.style`
 * (ADR-0039's `nullish`), for a target that writes it as the element's style (ADR-0065). Its
 * references are the source's, at the same offsets: the code only adds parentheses around a
 * source that needs them and the member after it.
 */
export function spreadStyleExpression(attribute: SpreadAttribute): Expression {
  const { value } = attribute;
  const bare = /^[\w$]+(?:\??\.[\w$]+)*$/.test(value.code);
  const source = bare ? value.code : `(${value.code})`;
  const code = `${source}${attribute.nullish ? "?." : "."}style`;
  const start = bare ? value.span.start : value.span.start - 1;
  return { code, span: { start, end: start + code.length }, refs: value.refs };
}

/** Whether attributes hold a style bound to one value, or a spread's `style` key. */
function whole(attributes: readonly (Attribute | ComponentAttribute)[]): boolean {
  return attributes.some(
    (attribute) =>
      (attribute.kind === "Style" && attribute.value !== undefined) ||
      (attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style")),
  );
}

/**
 * Whether a component's template merges a style bound to one value into an object: on its
 * root, an element or a component, which takes a consumer's `style`, or on a component, whose
 * root spreads it (ADR-0054). The value may be a declaration list, so the targets that merge
 * by an object spread turn it into an object first (ADR-0065).
 */
export function mergesWholeStyle(component: UfComponent): boolean {
  const { render } = component;
  const [only] = render.kind === "Fragment" ? render.children : [render];
  const root =
    render.kind === "Element" || (render.kind === "Fragment" && render.children.length === 1)
      ? only
      : undefined;
  if (
    component.inheritAttrs !== false &&
    (root?.kind === "Element" || root?.kind === "Component") &&
    whole(root.attributes)
  ) {
    return true;
  }
  let found = false;
  walk(render, {
    enter(node) {
      if (node.kind === "Component" && whole(node.attributes)) found = true;
    },
  });
  return found;
}
