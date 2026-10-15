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
// - A number or range input, and the `trim`, `lazy` and `number` modifiers: the initial value, and
//   `ref={modelText(…)}`, which reproduces Vue's `vModelText`, its focus rules included
//   (`model-modifiers`, emulated).
// - A value that may be `null` or `undefined` shows as no text: `value={name() ?? ""}`.
// - Options another component renders, which the `<select>` cannot mark, are selected by an
//   inline `selectOptions` from the `ref`: once they are rendered, as the state changes, and as
//   options come and go.
// - A helper that needs the element (`modelText`, `selectOptions`) is called from the element's
//   own `ref` callback where it has one (a template ref, an added listener): one `ref` an element.
import { js, jsxBinding, jsxExpression } from "@unframework/codegen";
import type { ImportSet, JsxContext } from "@unframework/codegen";
import type { ElementNode, ModelAttribute, UfComponent } from "@unframework/ir";

import { unmarkedOptions } from "./render.ts";
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
  #select: string | undefined;
  #selectOptions: string | undefined;

  constructor(imports: ImportSet) {
    this.#imports = imports;
  }

  /** The name of a listener's event parameter. */
  event(): string {
    return (this.#event ??= this.#imports.claim("event"));
  }

  /** The name of a `ref` callback's `<select>` parameter. */
  select(): string {
    return (this.#select ??= this.#imports.claim("select"));
  }

  selectOptions(): string {
    return (this.#selectOptions ??= this.#imports.claim("selectOptions"));
  }

  /** `isServer`'s local name. */
  isServer(): string {
    return this.#imports.add("solid-js/web", "isServer");
  }

  /** A Solid import's local name. */
  solid(name: string): string {
    return this.#imports.add("solid-js", name);
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
      helpers.push(modelTextHelperCode(this.#modelText, this.solid("createRenderEffect")));
    }
    if (this.#toggle) helpers.push(toggleHelperCode(this.#toggle));
    if (this.#selectedValues) helpers.push(selectedValuesHelperCode(this.#selectedValues));
    if (this.#selectOptions) {
      helpers.push(
        selectOptionsHelperCode(this.#selectOptions, {
          createEffect: this.solid("createEffect"),
          onCleanup: this.solid("onCleanup"),
        }),
      );
    }
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
  carried: boolean,
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
  // A value that may be `null` or `undefined` shows as no text, as Vue's `vModelText` writes it.
  const nullish = mayBeNullish(context.component, ref.binding);
  const text = (expression: AstExpression) =>
    nullish ? js.logicalExpression("??", expression, js.stringLiteral("")) : expression;
  const server = () => js.identifier(helpers.isServer());
  // Solid's server writes a `<textarea>`'s `value` as an attribute: there the state is its text,
  // and in the browser its value, as Vue renders it.
  const textarea = (shown: () => AstExpression) => [
    prop("value", js.conditionalExpression(server(), nothing(), text(shown()))),
    prop("children", js.conditionalExpression(server(), value(), nothing())),
  ];
  if (attribute.trim || attribute.lazy || number) {
    // The field's initial value, which the server renders; `modelText` keeps it in step after.
    const initial = () =>
      js.callExpression(js.identifier(helpers.solid("untrack")), [js.identifier(binding.name)]);
    // The element's own `ref` callback calls the helper's where it has one (src/listeners.ts).
    const bound = carried
      ? []
      : [
          prop(
            "ref",
            context.placeholders.expression(
              modelTextCall(attribute, binding.name, setter, helpers),
            ),
          ),
        ];
    return attribute.control === "textarea"
      ? [...textarea(initial), ...bound]
      : [prop("value", text(initial())), ...bound];
  }
  // Options another component, a slot or a row renders are not marked: the browser selects them
  // (`selectOptions`), from the element's own `ref` callback where it has one.
  const selection = () => {
    if (carried || !unmarkedOptions(element.children)) return [];
    const select = helpers.select();
    return [
      prop(
        "ref",
        context.placeholders.expression(
          `(${select}) => ${helpers.selectOptions()}(${select}, ${binding.name})`,
        ),
      ),
    ];
  };
  switch (attribute.control) {
    case "text":
      return [prop("value", text(value())), prop("onInput", listener(set(target("value"))))];
    case "textarea":
      return [...textarea(value), prop("onInput", listener(set(target("value"))))];
    case "select":
      // Each option is `selected` where it holds the state's value (src/render.ts): Solid's
      // server writes a `<select>`'s `value` as an attribute.
      return [prop("onChange", listener(set(target("value")))), ...selection()];
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
        ...selection(),
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

/**
 * What a `v-model` does in its element's `ref`, as a statement of the element's own `ref` callback
 * (src/listeners.ts) given its parameter, where the element has one: `modelText`'s binding, or
 * `selectOptions`' selection; none for any other `v-model`.
 */
export function modelRef(
  element: ElementNode,
  context: JsxContext,
  code: SolidCode,
  helpers: ModelHelpers,
): ((parameter: string) => string) | undefined {
  const attribute = element.attributes.find(
    (each): each is ModelAttribute => each.kind === "Model",
  );
  const [ref] = attribute?.value.refs ?? [];
  if (!attribute || ref?.kind !== "Binding") return undefined;
  const { name } = jsxBinding(ref.binding, context);
  if (attribute.trim || attribute.lazy || attribute.number || attribute.control === "number") {
    const call = modelTextCall(attribute, name, code.setter(ref.binding)!, helpers);
    return (parameter) => `${call}(${parameter});`;
  }
  if (
    (attribute.control === "select" || attribute.control === "select-multiple") &&
    unmarkedOptions(element.children)
  ) {
    return (parameter) => `${helpers.selectOptions()}(${parameter}, ${name});`;
  }
  return undefined;
}

/** `modelText(name, setName, { trim: true })`: the `ref` callback of a field's `v-model`. */
function modelTextCall(
  attribute: ModelAttribute,
  name: string,
  setter: string,
  helpers: ModelHelpers,
): string {
  const options = [
    ...(attribute.trim ? ["trim: true"] : []),
    ...(attribute.lazy ? ["lazy: true"] : []),
    ...(attribute.number || attribute.control === "number" ? ["number: true"] : []),
  ];
  return `${helpers.modelText()}(${name}, ${setter}, { ${options.join(", ")} })`;
}

/**
 * Whether a state or a model may hold `null` or `undefined`, by what the source writes: its type
 * argument names either, or it has no initial value, or its initial value is either.
 */
function mayBeNullish(component: UfComponent, id: string): boolean {
  const item = component.setup.find((each) => "binding" in each && each.binding === id);
  if (item?.kind === "State") {
    if (named(item.type) || !item.initial) return true;
    return !item.type && /^(?:null|undefined)$/.test(item.initial.code.trim());
  }
  if (item?.kind === "Model") return named(item.type) || (!item.default && !item.required);
  return false;
}

/** Whether a type names `null` or `undefined`. */
function named(type: { code: string } | undefined): boolean {
  return type !== undefined && /\b(?:null|undefined)\b/.test(type.code);
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
 * The inline `modelText` helper (emulated `model-modifiers`, ADR-0054): Vue's `vModelText`, as a
 * field's `ref`. The field's initial value is its `value` prop, which the server renders; the
 * helper writes what the user types, trimmed or cast as Vue's `looseToNumber` casts it, on
 * `input` or, when lazy, on `change`, and a trimmed field shows its trimmed text once it
 * changes; it shows each new value of the state (no text for `null` or `undefined`), except
 * where the text already reads as it, or while the user is typing in a trimmed field what it
 * reads as trimmed.
 */
function modelTextHelperCode(name: string, createRenderEffect: string): string {
  return `/** Binds a text field to a signal as Vue's \`vModelText\` does: see its modifiers. */
function ${name}<T extends string | number | null | undefined>(
  value: () => T,
  setValue: (value: T) => void,
  modifiers: { trim?: boolean; lazy?: boolean; number?: boolean },
): (field: HTMLInputElement | HTMLTextAreaElement) => void {
  const cast = (text: string): string | number => {
    const number = Number.parseFloat(text);
    return Number.isNaN(number) ? text : number;
  };
  return (field) => {
    field.addEventListener(modifiers.lazy ? "change" : "input", () => {
      const text = modifiers.trim ? field.value.trim() : field.value;
      setValue((modifiers.number ? cast(text) : text) as T);
    });
    if (modifiers.trim) {
      field.addEventListener("change", () => {
        field.value = field.value.trim();
      });
    }
    ${createRenderEffect}(() => {
      const next = value() ?? "";
      const shown =
        modifiers.number && !/^0\\d/.test(field.value) ? cast(field.value) : field.value;
      if (shown === next) return;
      const typing = document.activeElement === field && field.type !== "range";
      if (typing && modifiers.trim && field.value.trim() === next) return;
      field.value = String(next);
    });
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

/**
 * The inline `selectOptions` helper (emulated `model-array` and `two-way-binding` where the
 * options are another component's): each option selected where it holds the state, or where
 * the state's array holds it, as Vue's `vModelSelect` sets them, once they are rendered, as the
 * state changes, and as options come and go or change their value.
 */
function selectOptionsHelperCode(
  name: string,
  solid: { createEffect: string; onCleanup: string },
): string {
  return `/**
 * Selects a \`<select>\`'s options that hold \`value\`, or a value of it for an array: as the value
 * changes, and as options come and go.
 */
function ${name}(select: HTMLSelectElement, value: () => unknown): void {
  const choose = () => {
    const current = value();
    for (const option of select.options) {
      option.selected = Array.isArray(current)
        ? current.includes(option.value)
        : option.value === current;
    }
  };
  ${solid.createEffect}(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  ${solid.onCleanup}(() => observer.disconnect());
}`;
}
