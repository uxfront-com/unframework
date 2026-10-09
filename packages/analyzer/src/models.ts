// Two-way bindings (ADR-0054): `v-model` on a form control, which binds the control's value or
// its checked state, and `v-model:<name>` on a component, which binds a model the child declares
// with `defineModel`. Each binds a ref's value, `text.value`, of a `ref` or a model of the
// component (UF3042 otherwise): the targets write it back through that binding.

import type { Fix } from "@unframework/diagnostics";
import { createModelAttribute, createModelBindingAttribute } from "@unframework/ir";
import type { ComponentApi, ModelAttribute, ModelBindingAttribute, Span } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { closest } from "./components.ts";
import { checkExpression, isWritableRef, span } from "./expressions.ts";
import type { CheckedExpression } from "./expressions.ts";
import type { ComponentInfo, RenderContext } from "./render.ts";
import { setupBindingOf } from "./render.ts";
import { has, outside } from "./types/kinds.ts";
import type { Kinds, Primitive } from "./types/kinds.ts";

/** A control's `v-model`, with Vue JSX's spelling of its one modifier (`v-model_trim`). */
export const CONTROL_MODEL: RegExp = /^v-model(?:_(trim|lazy|number))?$/;

/**
 * The input types Vue binds as text (`vModelText`): the ones whose value is what the user
 * types or picks as a string. A number or range input casts it, as `.number` does.
 */
const TEXT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "color",
]);

/** What a control's `v-model` needs to know about its element. */
export interface ControlContext {
  readonly tag: string;
  /**
   * The static `type`, in lower case: `undefined` without one, and `null` for a bound one, which
   * leaves the control unknown.
   */
  readonly type: string | null | undefined;
  /** Whether a static `multiple` is set: `null` for a bound one. */
  readonly multiple: boolean | null;
  /** Whether the element has a `value` attribute: a checkbox's in a group, a radio's. */
  readonly value: boolean;
  readonly render: RenderContext;
}

/** Reports a misuse of `v-model` (UF3042), and gives nothing. */
function invalid(
  render: RenderContext,
  at: { start: number; end: number },
  message: string,
  help = "Bind a ref's value to a form control, `<input v-model={text.value} />`, or a model a component declares, `<Field v-model:value={text.value} />`.",
  fixes?: Fix[],
): undefined {
  render.reporter.report("UF3042", at, message, { help, ...(fixes ? { fixes } : {}) });
  return undefined;
}

/** The value a `v-model` binds: `x.value` of a `state` or `model` binding, checked. */
function boundValue(item: AST.JSXAttribute, render: RenderContext): CheckedExpression | undefined {
  const { value } = item;
  const expression =
    value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
      ? value.expression
      : undefined;
  const member = expression?.type === "MemberExpression" ? expression : undefined;
  const binding =
    member &&
    member.object.type === "Identifier" &&
    !member.computed &&
    !member.optional &&
    member.property.type === "Identifier" &&
    member.property.name === "value"
      ? setupBindingOf(member.object, render)
      : undefined;
  if (!expression || !binding || !isWritableRef(binding)) {
    return invalid(
      render,
      value ?? item,
      "`v-model` binds a ref's value, `text.value`, of a `ref` or a model of the component: the targets write the control's changes back through it.",
    );
  }
  const checked = checkExpression(expression, render);
  return checked.clean ? checked : undefined;
}

/**
 * A control's `v-model` (ADR-0054): the control its tag and static `type` make, the modifier
 * its spelling names, and a bound value of the kind the control writes.
 */
export function lowerControlModel(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  modifier: "trim" | "lazy" | "number" | undefined,
  context: ControlContext,
): ModelAttribute | undefined {
  const { tag, type, multiple, render } = context;
  const checked = boundValue(item, render);
  if (!checked) return undefined;
  const control = controlOf(item, name, checked.kinds, context);
  if (!control) return undefined;
  if (modifier && control !== "text" && control !== "number" && control !== "textarea") {
    return invalid(
      render,
      name,
      `\`${name.name}\` reads the text of a control that has none: <${tag}${type ? ` type="${type}"` : multiple ? " multiple" : ""}> binds ${control === "select" || control === "select-multiple" ? "its selected options" : "its checked state"}.`,
      "Write `v-model` without the modifier.",
    );
  }
  const numeric = control === "number" || modifier === "number";
  const expected: Primitive[] =
    control === "checkbox"
      ? ["boolean"]
      : control === "checkbox-group" || control === "select-multiple"
        ? ["array"]
        : control === "radio"
          ? ["string", "number", "boolean", "null", "undefined"]
          : numeric
            ? ["number", "string", "undefined", "null"]
            : ["string", "undefined", "null"];
  const wrong = outside(checked.kinds, expected);
  if (wrong.length || (numeric && !has(checked.kinds, "number") && !unknown(checked.kinds))) {
    return invalid(
      render,
      checked.expression.span,
      `\`${checked.expression.code}\` holds ${describe(checked.kinds)}, and <${tag}${type ? ` type="${type}"` : ""}>'s \`v-model\` writes ${numeric ? "a number (or the text, where it is no number)" : control === "checkbox" ? "a boolean" : control === "checkbox-group" || control === "select-multiple" ? "an array of the checked values" : "a string"}.`,
      numeric
        ? "Bind a ref of a number."
        : control === "text" || control === "textarea"
          ? "Bind a ref of a string, or write `v-model_number` to read a number."
          : "Bind a ref of the type the control writes.",
    );
  }
  return createModelAttribute(checked.expression, control, span(item), {
    trim: modifier === "trim",
    lazy: modifier === "lazy",
    number: modifier === "number",
  });
}

/** The control a `v-model` binds, from its element and the bound value's kinds (UF3042). */
function controlOf(
  item: AST.JSXAttribute,
  name: AST.JSXIdentifier,
  kinds: Kinds,
  context: ControlContext,
): ModelAttribute["control"] | undefined {
  const { tag, type, multiple, value, render } = context;
  switch (tag) {
    case "textarea":
      return "textarea";
    case "select":
      if (multiple === null) {
        return invalid(
          render,
          name,
          "`v-model` on a <select> with a bound `multiple` binds a value or an array, which no target can tell before it renders.",
          "Write `multiple` as it is, or leave it out.",
        );
      }
      return multiple ? "select-multiple" : "select";
    case "input":
      break;
    default:
      return invalid(
        render,
        name,
        `<${tag}> is no form control: \`v-model\` binds an <input>, a <textarea> or a <select>.`,
      );
  }
  if (type === null) {
    return invalid(
      render,
      name,
      "`v-model` on an <input> with a bound `type` binds a value or a checked state, which no target can tell before it renders.",
      "Write the `type` as it is.",
    );
  }
  if (type === undefined || TEXT_TYPES.has(type)) return "text";
  if (type === "number" || type === "range") return "number";
  if (type === "checkbox") {
    if (unknown(kinds)) {
      return invalid(
        render,
        item.value ?? item,
        "A checkbox's `v-model` binds a boolean, or an array of the checked boxes' values, and this ref's type says neither.",
        "Type the ref: `ref<boolean>(false)` or `ref<string[]>([])`.",
      );
    }
    if (!has(kinds, "array")) return "checkbox";
    if (!value) {
      return invalid(
        render,
        name,
        "A checkbox that binds an array adds its `value` to it, and this one has none.",
        'Give the checkbox its `value`: `<input type="checkbox" value="tea" v-model={drinks.value} />`.',
      );
    }
    return "checkbox-group";
  }
  if (type === "radio") {
    if (!value) {
      return invalid(
        render,
        name,
        "A radio's `v-model` writes the radio's `value`, and this one has none.",
        'Give the radio its `value`: `<input type="radio" value="tea" v-model={drink.value} />`.',
      );
    }
    return "radio";
  }
  return invalid(
    render,
    name,
    `\`v-model\` binds no <input type="${type}">: Vue binds text, number, checkbox and radio inputs, and the other types hold no value a user edits.`,
  );
}

/** Whether the model cannot tell a value's kinds. */
function unknown(kinds: Kinds): boolean {
  return has(kinds, "unknown");
}

/** The kinds of a value, in words, for a message. */
function describe(kinds: Kinds): string {
  const named = [...kinds.primitives].filter((primitive) => primitive !== "unknown");
  return named.length
    ? `a value of type ${named.map((each) => `\`${each}\``).join(" | ")}`
    : "a value";
}

/**
 * A component's `v-model:<name>` (ADR-0054): a model the child declares (UF3037, with the model
 * it may mean), bound to a ref's value. A modifier is the control's: a model takes none.
 */
export function lowerModelBinding(
  item: AST.JSXAttribute,
  name: AST.JSXNamespacedName,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): ModelBindingAttribute | undefined {
  const written = `${name.namespace.name}:${name.name.name}`;
  if (name.namespace.name !== "v-model") {
    return invalid(
      render,
      name,
      CONTROL_MODEL.test(name.namespace.name)
        ? `\`${written}\` gives a component's model a modifier, which only a form control's \`v-model\` takes.`
        : `\`${written}\` is not an attribute a component takes.`,
      `Write \`v-model:${name.name.name}\`.`,
    );
  }
  const model = name.name.name;
  if (!api.models.some((each) => each.name === model)) {
    const meant = closest(
      model,
      api.models.map((each) => each.name),
    );
    render.reporter.report(
      "UF3037",
      name,
      `${info.name} declares no model \`${model}\`.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
      { help: `Bind a model ${info.name} declares with \`defineModel\`.` },
    );
    return undefined;
  }
  const checked = boundValue(item, render);
  if (!checked) return undefined;
  return createModelBindingAttribute(model, checked.expression, span(item));
}

/**
 * `v-model` without a name on a component (UF3042): a component binds its models by name, with
 * the safe fix to the name of the one model it declares.
 */
export function namelessModel(
  name: AST.JSXIdentifier,
  api: ComponentApi,
  info: ComponentInfo,
  render: RenderContext,
): void {
  const [only, ...more] = api.models;
  const at: Span = span(name);
  invalid(
    render,
    name,
    `\`${name.name}\` on a component binds a model by its name: ${info.name} declares ${api.models.length ? api.models.map((each) => `\`${each.name}\``).join(", ") : "no model"}.`,
    only
      ? `Write \`v-model:${only.name}\`.`
      : `Declare a model in ${info.name} with \`defineModel\`.`,
    only && !more.length && name.name === "v-model"
      ? [
          {
            title: `Bind \`${only.name}\``,
            confidence: "safe",
            edits: [{ span: at, text: `v-model:${only.name}` }],
          },
        ]
      : undefined,
  );
}
