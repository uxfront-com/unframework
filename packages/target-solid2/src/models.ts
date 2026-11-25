// `v-model` on a form control as Solid writes it (ADR-0054): the control's state as a prop, and
// the listener that writes it back, Vue's events for each control.
//
// - A text field and a `<textarea>`: `value` and `onInput`, which Solid 2's server writes as a
//   textarea's text; a `<select>`: each option's `selected` (src/render.ts), and `onChange`;
//   in the browser, `selectOptions` from the `ref` (below), which selects none where no option
//   holds the state.
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
//   `selectOptions` helper from the `ref`: once they are rendered, as the state changes, and as
//   options come and go. A single `<select>` calls it with marked options too: Vue's
//   `vModelSelect` selects none (`selectedIndex` -1) where no option holds the state, also once
//   the options change, where the browser would select the first.
// - A helper that needs the element (`modelText`, `selectOptions`) is called from the element's
//   own `ref` callback where it has one (a template ref, an added listener): one `ref` an element.
import { js, jsxBinding, jsxExpression } from "@unframework.dev/codegen";
import type { ImportSet, JsxContext } from "@unframework.dev/codegen";
import type { ElementNode, ModelAttribute, UfComponent } from "@unframework.dev/ir";

import { genericModelType } from "./generics.ts";
import { unmarkedOptions } from "./render.ts";
import type { SolidCode } from "./setup.ts";
import { printHelper } from "./shared-names.ts";
import type { SharedHelpers } from "./shared-names.ts";

type AstExpression = Parameters<typeof js.callExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
type JsxAttributeItem = JsxAttribute | ReturnType<typeof js.jsxSpreadAttribute>;

/**
 * The helpers a file's `v-model`s call, each claimed when first used: inline, or imported from
 * `_unframework/` where the file shares them (ADR-0121).
 */
export class ModelHelpers {
  readonly #imports: ImportSet;
  readonly #shared: SharedHelpers | undefined;
  #event: string | undefined;
  #toggle: string | undefined;
  #selectedValues: string | undefined;
  #modelText: string | undefined;
  #select: string | undefined;
  #selectOptions: string | undefined;
  #textCaret: string | undefined;

  constructor(imports: ImportSet, shared?: SharedHelpers) {
    this.#imports = imports;
    this.#shared = shared;
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
    return this.#imports.add("@solidjs/web", "isServer");
  }

  /** A Solid import's local name. */
  solid(name: string): string {
    return this.#imports.add("solid-js", name);
  }

  /** The `ref` callback that puts a bound `<textarea>`'s caret after its text (ADR-0095). */
  textCaret(): string {
    return (this.#textCaret ??= this.#imports.claim("textCaret"));
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
  helpers(): Array<string> {
    const helpers: Array<string> = [];
    if (this.#modelText) {
      helpers.push(
        ...printHelper(this.#shared, "modelText", this.#modelText, (name) =>
          modelTextHelperCode(name, this.solid("createRenderEffect")),
        ),
      );
    }
    if (this.#toggle) {
      helpers.push(toggleHelperCode(this.#toggle));
    }
    if (this.#textCaret) {
      helpers.push(textCaretHelperCode(this.#textCaret));
    }
    if (this.#selectedValues) {
      helpers.push(selectedValuesHelperCode(this.#selectedValues));
    }
    if (this.#selectOptions) {
      helpers.push(
        ...printHelper(this.#shared, "selectOptions", this.#selectOptions, (name) =>
          selectOptionsHelperCode(name, {
            createEffect: this.solid("createEffect"),
            onCleanup: this.solid("onCleanup"),
          }),
        ),
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
): Array<JsxAttributeItem> {
  const [ref] = attribute.value.refs;
  if (ref?.kind !== "Binding") {
    throw new Error("A v-model binds a binding's value: invalid IR.");
  }
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
  // Solid 2's server writes a `<textarea>`'s `value` as its text, as Vue renders it, and the
  // browser sets its value.
  const textarea = (shown: () => AstExpression) => [prop("value", text(shown()))];
  if (attribute.trim || attribute.lazy || number) {
    // The field's initial value, which the server renders; `modelText` keeps it in step after.
    const initial = () =>
      js.callExpression(js.identifier(helpers.solid("untrack")), [js.identifier(binding.name)]);
    // The element's own `ref` callback calls the helper's where it has one (src/listeners.ts).
    const call = modelTextCall(attribute, binding.name, setter, helpers);
    const bound = carried
      ? []
      : [
          prop(
            "ref",
            context.placeholders.expression(
              attribute.control === "textarea" ? `[${call}, ${helpers.textCaret()}]` : call,
            ),
          ),
        ];
    return attribute.control === "textarea"
      ? [...textarea(initial), ...bound]
      : [prop("value", text(initial())), ...bound];
  }
  // Options another component, a slot or a row renders are not marked: the browser selects them
  // (`selectOptions`), from the element's own `ref` callback where it has one. A single
  // `<select>` calls it with marked options too (see the module comment).
  const selection = () => {
    if (carried) {
      return [];
    }
    if (attribute.control !== "select" && !unmarkedOptions(element.children)) {
      return [];
    }
    return [
      prop("ref", context.placeholders.expression(`${helpers.selectOptions()}(${binding.name})`)),
    ];
  };
  switch (attribute.control) {
    case "text":
      return [prop("value", text(value())), prop("onInput", listener(set(target("value"))))];
    case "textarea":
      return [
        ...textarea(value),
        prop("onInput", listener(set(target("value")))),
        // A hydrated field keeps the server's text, with the caret before it (ADR-0095).
        ...(carried ? [] : [prop("ref", js.identifier(helpers.textCaret()))]),
      ];
    case "select": {
      // Each option is `selected` where it holds the state's value (src/render.ts): Solid's
      // server writes a `<select>`'s `value` as an attribute. A model of a generic component's
      // type parameter (`defineModel<T>`) takes the chosen option's value as `T`: it is one of
      // the options, which the consumer's `T` types (ADR-0068).
      const generic = genericModelType(context.component, ref.binding);
      const chosen = generic
        ? js.asExpression(target("value"), context.placeholders.type(generic))
        : target("value");
      return [prop("onChange", listener(set(chosen))), ...selection()];
    }
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
 * What a `v-model` puts in its element's `ref` (src/listeners.ts), where the element has a `ref`
 * of its own: `modelText`'s binding, the caret of a `<textarea>`, or `selectOptions`' selection,
 * each a `ref` callback or a factory's call that returns one; none for any other `v-model`.
 */
export function modelRef(
  element: ElementNode,
  context: JsxContext,
  code: SolidCode,
  helpers: ModelHelpers,
): Array<string> | undefined {
  const attribute = element.attributes.find(
    (each): each is ModelAttribute => each.kind === "Model",
  );
  const [ref] = attribute?.value.refs ?? [];
  if (!attribute || ref?.kind !== "Binding") {
    return undefined;
  }
  const { name } = jsxBinding(ref.binding, context);
  const caret = attribute.control === "textarea" ? [helpers.textCaret()] : [];
  if (attribute.trim || attribute.lazy || attribute.number || attribute.control === "number") {
    return [modelTextCall(attribute, name, code.setter(ref.binding)!, helpers), ...caret];
  }
  if (caret.length) {
    return caret;
  }
  if (
    attribute.control === "select" ||
    (attribute.control === "select-multiple" && unmarkedOptions(element.children))
  ) {
    return [`${helpers.selectOptions()}(${name})`];
  }
  return undefined;
}

/**
 * The `ref` callback that puts a bound `<textarea>`'s caret after its text (ADR-0095): once
 * hydrated, the field keeps the server's text with the caret before it, where a client render
 * sets the text of an empty field and leaves the caret after it. It empties the field and sets
 * its text again, as ADR-0060 has React do, which fires no event (`setSelectionRange` would fire
 * `select`). In a client render the field is still empty when Solid calls it.
 */
function textCaretHelperCode(name: string): string {
  return `/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function ${name}(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
}`;
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
    if (named(item.type) || !item.initial) {
      return true;
    }
    return !item.type && /^(?:null|undefined)$/.test(item.initial.code.trim());
  }
  if (item?.kind === "Model") {
    return named(item.type) || (!item.default && !item.required);
  }
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
 * The `modelText` helper, shared in `_unframework/` (ADR-0121) or inline (emulated
 * `model-modifiers`, ADR-0054): Vue's `vModelText`, as a field's `ref`. The field's initial value
 * is its `value` prop, which the server renders; the helper writes what the user types, trimmed or
 * cast as Vue's `looseToNumber` casts it, on `input` or, when lazy, on `change`, and a trimmed or
 * number field shows that text, trimmed or cast, once it changes; it shows each new value of the
 * state (no text for `null` or `undefined`), except where the text already reads as it, or while
 * the user is typing in a trimmed field what it reads as trimmed.
 */
export function modelTextHelperCode(name: string, createRenderEffect: string): string {
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
  let bound: HTMLInputElement | HTMLTextAreaElement | undefined;
  // Created here, as the \`ref\` is evaluated: Solid 2 creates no computation in a \`ref\` callback.
  ${createRenderEffect}(
    () => value() ?? "",
    (next) => {
      const field = bound;
      if (!field) return;
      const shown =
        modifiers.number && !/^0\\d/.test(field.value) ? cast(field.value) : field.value;
      if (shown === next) return;
      const typing = document.activeElement === field && field.type !== "range";
      if (typing && modifiers.trim && field.value.trim() === next) return;
      field.value = String(next);
    },
  );
  return (field) => {
    bound = field;
    field.addEventListener(modifiers.lazy ? "change" : "input", () => {
      const text = modifiers.trim ? field.value.trim() : field.value;
      setValue((modifiers.number ? cast(text) : text) as T);
    });
    if (modifiers.trim || modifiers.number) {
      field.addEventListener("change", () => {
        const text = modifiers.trim ? field.value.trim() : field.value;
        field.value = String(modifiers.number ? cast(text) : text);
      });
    }
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
 * The `selectOptions` helper, shared in `_unframework/` (ADR-0121) or inline (emulated
 * `model-array` and `two-way-binding` where the options are another component's): each option
 * selected where it holds the state, or where the state's array holds it, and none where no option
 * holds a single value (`selectedIndex` -1), as Vue's `vModelSelect` sets them, once they are
 * rendered, as the state changes, and as options come and go or change their value. A single value
 * is compared as a string, as Vue's `looseEqual` compares an option's value with it.
 */
export function selectOptionsHelperCode(
  name: string,
  solid: { createEffect: string; onCleanup: string },
): string {
  return `/**
 * The \`ref\` of a \`<select>\` whose options that hold \`value\`, or a value of it for an array, it
 * selects, and none where none holds it: as the value changes, and as options come and go.
 */
function ${name}(value: () => unknown): (select: HTMLSelectElement) => void {
  let bound: HTMLSelectElement | undefined;
  let observer: MutationObserver | undefined;
  const choose = (current: unknown) => {
    const select = bound;
    if (!select) return;
    if (!Array.isArray(current)) {
      // \`selectedIndex\` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  // Created here, as the \`ref\` is evaluated: Solid 2 creates no computation in a \`ref\` callback.
  ${solid.createEffect}(value, choose);
  ${solid.onCleanup}(() => observer?.disconnect());
  return (select) => {
    bound = select;
    observer = new MutationObserver(() => choose(value()));
    observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  };
}`;
}
