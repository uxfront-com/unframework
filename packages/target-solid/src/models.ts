// `v-model` on a form control as Solid writes it (ADR-0054): the control's state as a prop, and
// the listener that writes it back, Vue's events for each control.
//
// - A text field: `value` and `onInput`; a `<textarea>`: its value in the browser and its text
//   on the server, and `onInput`; a `<select>`: each option's `selected` (src/render.ts), and `onChange`.
// - A checkbox: `checked` and `onChange`; a radio: `checked={plan() === "monthly"}`, and
//   `onChange` writes its value.
// - Checkboxes into an array: `checked={drinks().includes("tea")}`, and `onChange` writes
//   `toggle(drinks(), "tea", checked)`; a `<select multiple>`: each option's `selected`
//   (src/render.ts), and `onChange` writes `selectedValues(select)` (`model-array`, emulated).
// - A number or range input, and the `trim`, `lazy` and `number` modifiers: `modelText`, which
//   reproduces Vue's `vModelText`, its focus rules included (`model-modifiers`, emulated).
import { js, jsxBinding, jsxExpression } from "@unframework/codegen";
import type { ImportSet, JsxContext } from "@unframework/codegen";
import type { ElementNode, ModelAttribute } from "@unframework/ir";

import type { SolidCode } from "./setup.ts";

type AstExpression = Parameters<typeof js.callExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
type JsxAttributeItem = JsxAttribute | ReturnType<typeof js.jsxSpreadAttribute>;

/** The inline helpers a file's `v-model`s call, each claimed when first used. */
export class ModelHelpers {
  readonly #imports: ImportSet;
  #event: string | undefined;
  #toggle: string | undefined;
  #selectedValues: string | undefined;
  #modelText: string | undefined;

  constructor(imports: ImportSet) {
    this.#imports = imports;
  }

  /** The name of a listener's event parameter. */
  event(): string {
    return (this.#event ??= this.#imports.claim("event"));
  }

  /** `isServer`'s local name. */
  isServer(): string {
    return this.#imports.add("solid-js/web", "isServer");
  }

  toggle(): string {
    return (this.#toggle ??= this.#imports.claim("toggle"));
  }

  selectedValues(): string {
    return (this.#selectedValues ??= this.#imports.claim("selectedValues"));
  }

  modelText(): string {
    return (this.#modelText ??= this.#imports.claim("modelText"));
  }

  /** The helpers' code, in the order they print. */
  helpers(): string[] {
    const helpers: string[] = [];
    if (this.#modelText) {
      helpers.push(
        modelTextHelperCode(this.#modelText, {
          untrack: this.#imports.add("solid-js", "untrack"),
          createRenderEffect: this.#imports.add("solid-js", "createRenderEffect"),
        }),
      );
    }
    if (this.#toggle) helpers.push(toggleHelperCode(this.#toggle));
    if (this.#selectedValues) helpers.push(selectedValuesHelperCode(this.#selectedValues));
    return helpers;
  }
}

/** An element's `v-model`: see the module comment. */
export function modelAttribute(
  attribute: ModelAttribute,
  element: ElementNode,
  context: JsxContext,
  code: SolidCode,
  helpers: ModelHelpers,
): JsxAttributeItem[] {
  const [ref] = attribute.value.refs;
  if (ref?.kind !== "Binding") throw new Error("A v-model binds a binding's value: invalid IR.");
  const binding = jsxBinding(ref.binding, context);
  const setter = code.setter(ref.binding)!;
  const value = () => jsxExpression(attribute.value, context, "operand");
  const event = helpers.event();
  const target = (property: string) =>
    js.memberExpression(js.memberExpression(js.identifier(event), "currentTarget"), property);
  const set = (argument: AstExpression) => js.callExpression(js.identifier(setter), [argument]);
  const listener = (body: AstExpression) => js.arrowFunction([js.bindingIdentifier(event)], body);
  const number = attribute.number || attribute.control === "number";
  if (attribute.trim || attribute.lazy || number) {
    const options = [
      ...(attribute.trim ? [js.property("trim", js.booleanLiteral(true))] : []),
      ...(attribute.lazy ? [js.property("lazy", js.booleanLiteral(true))] : []),
      ...(number ? [js.property("number", js.booleanLiteral(true))] : []),
    ];
    return [
      js.jsxSpreadAttribute(
        js.callExpression(js.identifier(helpers.modelText()), [
          js.identifier(binding.name),
          js.identifier(setter),
          js.objectExpression(options),
        ]),
      ),
    ];
  }
  switch (attribute.control) {
    case "text":
      return [prop("value", value()), prop("onInput", listener(set(target("value"))))];
    case "textarea": {
      // Solid's server writes a `<textarea>`'s `value` as an attribute: there the state is its
      // text, and in the browser its value, as Vue renders it.
      const server = helpers.isServer();
      return [
        prop("value", js.conditionalExpression(js.identifier(server), nothing(), value())),
        prop("children", js.conditionalExpression(js.identifier(server), value(), nothing())),
        prop("onInput", listener(set(target("value")))),
      ];
    }
    case "select":
      // Each option is `selected` where it holds the state's value (src/render.ts): Solid's
      // server writes a `<select>`'s `value` as an attribute.
      return [prop("onChange", listener(set(target("value"))))];
    case "checkbox":
      return [prop("checked", value()), prop("onChange", listener(set(target("checked"))))];
    case "radio":
      return [
        prop("checked", js.binaryExpression("===", value(), own(element, context))),
        prop("onChange", js.arrowFunction([], set(own(element, context)))),
      ];
    case "checkbox-group":
      return [
        prop(
          "checked",
          js.callExpression(js.memberExpression(value(), "includes"), [own(element, context)]),
        ),
        prop(
          "onChange",
          listener(
            set(
              js.callExpression(js.identifier(helpers.toggle()), [
                value(),
                own(element, context),
                target("checked"),
              ]),
            ),
          ),
        ),
      ];
    case "select-multiple":
      return [
        prop(
          "onChange",
          listener(
            set(
              js.callExpression(js.identifier(helpers.selectedValues()), [
                js.memberExpression(js.identifier(event), "currentTarget"),
              ]),
            ),
          ),
        ),
      ];
    case "number":
      throw new Error("A number control prints through modelText.");
    default:
      return attribute.control satisfies never;
  }
}

/** `name={expression}`. */
function prop(name: string, expression: AstExpression): JsxAttribute {
  return js.jsxAttribute(name, js.jsxExpressionContainer(expression));
}

/** `undefined`. */
function nothing(): AstExpression {
  return js.identifier("undefined");
}

/** A checkbox's or a radio's own value: its `value` attribute, or `"on"`, as the DOM's. */
function own(element: ElementNode, context: JsxContext): AstExpression {
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" && attribute.name === "value") {
      return js.stringLiteral(attribute.value === true ? "" : attribute.value);
    }
    if (attribute.kind === "Bound" && attribute.name === "value") {
      return jsxExpression(attribute.value, context, "operand");
    }
  }
  return js.stringLiteral("on");
}

/**
 * The inline `modelText` helper (emulated `model-modifiers`, ADR-0054): Vue's `vModelText`. The
 * field shows the state's initial value from its props, which the server renders, and its `ref`
 * listens to the field and keeps it in step: it writes what the user types, trimmed or cast as
 * Vue's `looseToNumber` casts it, on `input` or, when lazy, on `change`, and a trimmed field shows
 * its trimmed text once it changes; it shows each new value of the state, except where the text
 * already reads as it, or while the user is typing in a trimmed field what it reads as trimmed.
 */
function modelTextHelperCode(
  name: string,
  solid: { untrack: string; createRenderEffect: string },
): string {
  return `/** Binds a text field to a signal as Vue's \`vModelText\` does: see its modifiers. */
function ${name}<T extends string | number>(
  value: () => T,
  setValue: (value: T) => void,
  modifiers: { trim?: boolean; lazy?: boolean; number?: boolean },
): { value: T; ref: (field: HTMLInputElement | HTMLTextAreaElement) => void } {
  const cast = (text: string): string | number => {
    const number = Number.parseFloat(text);
    return Number.isNaN(number) ? text : number;
  };
  return {
    value: ${solid.untrack}(value),
    ref(field) {
      field.addEventListener(modifiers.lazy ? "change" : "input", () => {
        const text = modifiers.trim ? field.value.trim() : field.value;
        setValue((modifiers.number ? cast(text) : text) as T);
      });
      if (modifiers.trim) {
        field.addEventListener("change", () => {
          field.value = field.value.trim();
        });
      }
      ${solid.createRenderEffect}(() => {
        const next = value();
        const shown =
          modifiers.number && !/^0\\d/.test(field.value) ? cast(field.value) : field.value;
        if (shown === next) return;
        const typing = document.activeElement === field && field.type !== "range";
        if (typing && modifiers.trim && field.value.trim() === next) return;
        field.value = String(next);
      });
    },
  };
}`;
}

/** The inline `toggle` helper (emulated `model-array`): a checkbox's value added or removed. */
function toggleHelperCode(name: string): string {
  return `/** The values with \`value\` added when \`checked\`, and removed otherwise. */
function ${name}<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((each) => each !== value);
}`;
}

/** The inline `selectedValues` helper (emulated `model-array`): a `<select multiple>`'s values. */
function selectedValuesHelperCode(name: string): string {
  return `/** The values of a \`<select multiple>\`'s selected options, in their order. */
function ${name}(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}`;
}
