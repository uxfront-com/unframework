// How React prints composition in a template (ADR-0054): a component's events as its `on…` props,
// slot fills as props (a scoped one a render prop), a slot where the component renders it, a
// `v-model` as a control's state and its `onChange` (a text field with modifiers, and a number or
// a range input, through the `modelText` hook), a component's `v-model:<name>` as its prop and
// its change callback, and `<component is>` as the `const` the body declares.
import {
  expressionCode,
  handlerText,
  js,
  jsxBranch,
  jsxDynamic,
  jsxFillValue,
  pascalCase,
  rewriteExpression,
} from "@unframework/codegen";
import type { JsxContext } from "@unframework/codegen";
import type {
  BindingId,
  ClassAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Expression,
  ListenerAttribute,
  ModelAttribute,
  ModelBindingAttribute,
  SlotFill,
  SlotOutletNode,
  StyleAttribute,
} from "@unframework/ir";

import { slotProp } from "./composition.ts";
import type { ReactPlan } from "./plan.ts";
import type { ReactCode } from "./rules.ts";
import { locals } from "./setup.ts";

type JsxAttributeItem =
  | ReturnType<typeof js.jsxAttribute>
  | ReturnType<typeof js.jsxSpreadAttribute>;
type AstExpression = Parameters<typeof js.jsxExpressionContainer>[0];

/** Prints the composition of a planned component's template. */
export class ReactComposer {
  readonly #plan: ReactPlan;
  readonly #code: ReactCode;
  /** The `class` the root takes from a consumer alone: `className={className}`. */
  readonly bareClasses: WeakSet<ClassAttribute> = new WeakSet();
  /** The `style`s the root merges a consumer's into. */
  readonly fallthroughStyles: WeakSet<StyleAttribute> = new WeakSet();
  /** The `modelText` fields, in render order. */
  readonly fields: string[] = [];

  constructor(plan: ReactPlan, code: ReactCode) {
    this.#plan = plan;
    this.#code = code;
  }

  /**
   * Where the component renders a slot (ADR-0054): `{title}`, `{renderItem?.({ item })}`, with
   * its fallback after `??`, which renders when the parent passed nothing.
   */
  slotOutlet(node: SlotOutletNode, context: JsxContext): AstExpression {
    const slot = this.#plan.composition.slots.get(node.slot)!;
    const props = node.props ? expressionCode(node.props, context) : "";
    const value = context.placeholders.expression(
      slot.scoped ? `${slot.local}?.(${props})` : slot.local,
      slot.scoped ? "argument" : "operand",
    );
    if (!node.fallback.length) return value;
    return js.logicalExpression("??", value, jsxBranch(node.fallback, context));
  }

  /** One of the component's own slots as a value, which a forwarded fill passes on. */
  slotValue(slot: string, context: JsxContext): AstExpression {
    return context.placeholders.expression(this.#plan.composition.slots.get(slot)!.local);
  }

  /**
   * A fill of a child's slot as its prop: `title={<h2 />}`, a scoped one as a render prop,
   * `renderItem={({ item }) => …}`, and a forwarded one the component's own slot.
   */
  fillAttribute(fill: SlotFill, _node: ComponentNode, context: JsxContext): JsxAttributeItem[] {
    const scoped =
      fill.parameter !== undefined ||
      (fill.forward !== undefined && this.#plan.composition.slots.get(fill.forward)!.scoped);
    return [
      js.jsxAttribute(
        slotProp(fill.slot, scoped),
        js.jsxExpressionContainer(jsxFillValue(fill, context)),
      ),
    ];
  }

  /** A listener of a child's event (ADR-0012): `onClear={clear}`, its handler as client code. */
  componentEvent(
    attribute: ListenerAttribute,
    _node: ComponentNode,
    context: JsxContext,
  ): JsxAttributeItem[] {
    const { handler } = attribute;
    const code =
      handler.kind === "Function"
        ? handlerText(handler, this.#plan.component, this.#code.rules, "client")
        : this.#code.fn(handler.function, "client");
    return [
      js.jsxAttribute(
        `on${pascalCase(attribute.event)}`,
        js.jsxExpressionContainer(context.placeholders.expression(code)),
      ),
    ];
  }

  /**
   * A form control's `v-model` (ADR-0054): the control's state and the `onChange` that writes it
   * back, React's event for every edit of a text field. A field with modifiers, and a number or a
   * range input, binds through `modelText`, which follows Vue's `vModelText`.
   */
  modelAttribute(
    attribute: ModelAttribute,
    element: ElementNode,
    context: JsxContext,
  ): JsxAttributeItem[] {
    const read = expressionCode(attribute.value, context);
    const binding = this.#bound(attribute.value);
    const container = (code: string) =>
      js.jsxExpressionContainer(context.placeholders.expression(code));
    const { control } = attribute;
    if (control === "number" || attribute.trim || attribute.lazy || attribute.number) {
      const options = [
        ...(attribute.lazy ? ["lazy: true"] : []),
        ...(attribute.trim ? ["trim: true"] : []),
        ...(attribute.number || control === "number" ? ["number: true"] : []),
      ];
      const name = this.#plan.bindings.get(binding)!.name;
      const field = this.#plan.names.claim(`${name}Field`);
      const helper = (this.#plan.helpers.modelText ??= this.#plan.names.claim("useModelText"));
      const { value } = locals([read, ...this.#assign(binding, "")], ["value"]);
      const write = this.#writer(binding, value);
      this.fields.push(`const ${field} = ${helper}(${read}, ${write}, { ${options.join(", ")} });`);
      return [js.jsxSpreadAttribute(js.identifier(field))];
    }
    const current = this.#clientRead(attribute.value);
    const box = boxValue(element, context);
    let state: [string, string];
    let written: string;
    switch (control) {
      case "checkbox":
        state = ["checked", read];
        written = "EVENT.target.checked";
        break;
      case "checkbox-group": {
        const toggle = (this.#plan.helpers.toggle ??= this.#plan.names.claim("toggle"));
        state = ["checked", `${read}.includes(${box})`];
        written = `${toggle}(${current}, ${box}, EVENT.target.checked)`;
        break;
      }
      case "radio":
        state = ["checked", `${read} === ${box}`];
        written = box;
        break;
      case "select-multiple":
        state = ["value", read];
        written = "Array.from(EVENT.target.selectedOptions, (option) => option.value)";
        break;
      case "text":
      case "textarea":
      case "select":
        state = ["value", read];
        written = "EVENT.target.value";
        break;
      default:
        return control satisfies never;
    }
    const { event } = locals([read, current, box, ...this.#assign(binding, "")], ["event"]);
    const statements = this.#assign(binding, written.replaceAll("EVENT", event));
    const uses = written.includes("EVENT");
    const body =
      statements.length === 1
        ? statements[0]!
        : `{\n${statements.map((s) => `${s};`).join("\n")}\n}`;
    const handler = `(${uses ? event : ""}) => ${body}`;
    return [
      js.jsxAttribute(state[0], container(state[1])),
      js.jsxAttribute("onChange", container(handler)),
    ];
  }

  /**
   * A child's `v-model:<name>` (ADR-0054): its value, and the change callback writing it back,
   * `value={cups} onValueChange={setCups}`.
   */
  modelBinding(
    attribute: ModelBindingAttribute,
    _node: ComponentNode,
    context: JsxContext,
  ): JsxAttributeItem[] {
    const binding = this.#bound(attribute.value);
    const name = this.#plan.bindings.get(binding)!.name;
    const { value } = locals([name, ...this.#assign(binding, "")], ["value"]);
    const handler = this.#writer(binding, value);
    return [
      js.jsxAttribute(
        attribute.model,
        js.jsxExpressionContainer(
          context.placeholders.expression(expressionCode(attribute.value, context)),
        ),
      ),
      js.jsxAttribute(
        `on${pascalCase(attribute.model)}Change`,
        js.jsxExpressionContainer(context.placeholders.expression(handler)),
      ),
    ];
  }

  /** `<component is>` (ADR-0054): the element under the `const` the body declares. */
  dynamic(node: DynamicNode, context: JsxContext): AstExpression {
    return jsxDynamic(node, this.#plan.composition.dynamic.get(node.span.start)!.name, context);
  }

  /** The state or model a `v-model`'s value names. */
  #bound(value: Expression): BindingId {
    const [reference] = value.refs;
    if (reference?.kind !== "Binding") {
      throw new Error("A v-model binds a state or a model: the analyser rejects anything else.");
    }
    return reference.binding;
  }

  /** The bound value as client code reads it: the mirror, where client code writes it. */
  #clientRead(value: Expression): string {
    return rewriteExpression(value, this.#plan.component, this.#code.rules, "client");
  }

  /**
   * A function that writes the bound state or model: its setter where nothing else is to do,
   * `(value) => { … }` otherwise.
   */
  #writer(binding: BindingId, value: string): string {
    const statements = this.#assign(binding, value);
    const state = this.#plan.state.get(binding);
    if (state && !state.mirror) return state.setter!;
    if (statements.length === 1) return `(${value}) => ${statements[0]!}`;
    return `(${value}) => {\n${statements.map((statement) => `${statement};`).join("\n")}\n}`;
  }

  /**
   * The statements that write `value` to a state or a model: the mirror first where client code
   * reads it, then the setter; a model's local state and its change callback (ADR-0054).
   */
  #assign(binding: BindingId, value: string): string[] {
    const state = this.#plan.state.get(binding);
    if (state) {
      if (!state.mirror) return [`${state.setter!}(${value})`];
      const mirror = `${state.mirror}.current`;
      return [`${mirror} = ${value}`, `${state.setter!}(${mirror})`];
    }
    const model = this.#plan.composition.models.get(binding)!;
    const statements: string[] = [];
    let written = value;
    if (model.mirror) {
      statements.push(`${model.mirror}.current = ${value}`);
      written = `${model.mirror}.current`;
    }
    statements.push(`${model.local!.setter}(${written})`, `${model.eventLocal}?.(${written})`);
    return statements;
  }
}

/** A checkbox's or a radio's `value`, as code: its static text, or its bound expression. */
function boxValue(element: ElementNode, context: JsxContext): string {
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" && attribute.name === "value") {
      return JSON.stringify(attribute.value === true ? "on" : attribute.value);
    }
    if (attribute.kind === "Bound" && attribute.name === "value") {
      return expressionCode(attribute.value, context);
    }
  }
  // A box without a `value` submits "on", which Vue's `v-model` writes too.
  return JSON.stringify("on");
}
