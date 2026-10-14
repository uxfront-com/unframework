// Composition in Qwik (ADR-0053 to ADR-0055):
// - a child is imported from its output file (`import Field from "./Field"`); a component that
//   renders itself is a named `component$` const;
// - a component's event is its QRL prop, `onClear$={…}`, as an element's listener is (ADR-0047);
// - the default slot is projected, `<Slot />`, its fallback the `<Slot>`'s children; any other
//   slot is a QRL render prop, `title$?: QRL<() => JSXOutput>`, rendered `{title$?.()}` (with
//   `?? fallback`), tested `title$` and filled `title$={() => <h2 />}` (`named-slot`,
//   `scoped-slot`: emulated). Qwik's `<Slot>` takes no props and has no presence API, and a plain
//   function prop does not serialise (ADR-0054);
// - a model is a prop and its change callback, `value` and `onValueChange$`: the component reads
//   a `useComputed$` of the prop, or of a local signal while the prop is `undefined`, and a write
//   goes through a `$()` setter that writes the local signal while unbound and awaits the
//   callback; a form control's `v-model` reads its state in render (see `modelAttribute`);
// - a consumer's `class` and `style` are props merged into the root (`fallthrough`);
// - `defineExpose` fills the consumer's `ref` signal with the exposed QRLs once the component is
//   in the document, and empties it when it goes (`exposeRef`, emulated);
// - an injection key is a `createContextId`, `provide` `useContextProvider`, and `inject`
//   `useContext` with its fallback.
import {
  bindingOf,
  expressionCode,
  js,
  jsxBranch,
  jsxChildren,
  jsxSlotProps,
} from "@unframework/codegen";
import type { JsxContext } from "@unframework/codegen";
import { codeOf, expressionsOf, walk } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  BoundAttribute,
  ElementNode,
  Expression,
  FragmentNode,
  Handler,
  ModelAttribute,
  ModelItem,
  RenderNode,
  SlotFill,
  SlotOutletNode,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { qwikEventProp } from "./events.ts";
import { unreachable } from "./plan.ts";
import type { OutputNames, SetupPlan } from "./plan.ts";
import { printFunction } from "./setup.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type AstExpression = Parameters<typeof js.conditionalExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;

/** A model the component declares (ADR-0054), and the names its output gives it. */
export interface ModelPlan {
  item: ModelItem;
  binding: Binding;
  /** The prop's name: the model's, `value`. */
  name: string;
  /** The destructured prop: its name, or `valueProp` where the source takes it. */
  prop: string;
  /** The change callback's prop, `onValueChange$`, and its destructured local. */
  callbackProp: string;
  callback: string;
  /** The signal that holds the value while the consumer binds none. */
  local: string;
  /** The `$()` setter a write calls. */
  setter: string;
  /** Whether client code writes it: the setter and the callback are declared only then. */
  written: boolean;
}

/** What a component's composition adds to its props and names. */
export interface CompositionPlan {
  /** Each slot rendered as a QRL render prop, by its name: the destructured `title$`. */
  readonly slots: ReadonlyMap<string, string>;
  /** Each model, by its binding. */
  readonly models: ReadonlyMap<BindingId, ModelPlan>;
  /** The `class` and `style` props a consumer's attributes fall through as. */
  readonly fallthrough?: { className: string; style: string };
  /** The `ref` prop that `defineExpose` fills. */
  readonly expose?: { ref: string };
}

/** Plans a component's composition: see {@link CompositionPlan}. */
export function planComposition(
  component: UfComponent,
  module: UfModule,
  names: OutputNames,
): CompositionPlan {
  // Each prop's local: destructured, or read from the props object in the object form.
  const props =
    component.propsParameter?.form === "object" ? component.propsParameter.name : undefined;
  const local = (prop: string, name = prop) =>
    props === undefined ? names.fresh(name) : `${props}.${prop}`;
  const slots = new Map<string, string>();
  for (const slot of renderedSlots(component)) {
    // Qwik's lint takes a call of Qwik City's `action$` or `loader$` names for a loader
    // (`qwik/loader-location`): such a slot's local takes another name.
    const name = LOADER_NAMES.has(slotProp(slot)) ? `${slot}Slot$` : slotProp(slot);
    slots.set(slot, local(slotProp(slot), name));
  }
  const written = new Set<BindingId>();
  for (const { code, context } of codeOf(component)) {
    if (context !== "client") continue;
    for (const reference of code.refs)
      if (reference.kind === "Write") written.add(reference.binding);
  }
  // A model a `v-model` binds, on an element or a child, is written there too.
  walk(component.render, {
    enter(node) {
      if (!("attributes" in node)) return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Model" && attribute.kind !== "ModelBinding") continue;
        for (const reference of attribute.value.refs) {
          if (reference.kind === "Binding") written.add(reference.binding);
        }
      }
    },
  });
  const models = new Map<BindingId, ModelPlan>();
  for (const item of component.setup) {
    if (item.kind !== "Model") continue;
    const binding = bindingOf(component, item.binding);
    const taken = names.imports.scope.has(item.name);
    const callbackProp = modelCallback(item.name);
    models.set(item.binding, {
      item,
      binding,
      name: item.name,
      prop: local(item.name, taken ? `${item.name}Prop` : item.name),
      callbackProp,
      callback: local(callbackProp),
      local: names.fresh(`${binding.name}Local`),
      setter: names.fresh(`set${capitalized(binding.name)}`),
      written: written.has(item.binding),
    });
  }
  return {
    slots,
    models,
    ...(fallsThrough(component, module)
      ? { fallthrough: { className: local("class", "className"), style: local("style") } }
      : {}),
    ...(component.exposes ? { expose: { ref: local("ref") } } : {}),
  };
}

/** The names `qwik/loader-location` takes for Qwik City's loaders and actions. */
const LOADER_NAMES: ReadonlySet<string> = new Set([
  "loader$",
  "routeLoader$",
  "routeAction$",
  "routeHandler$",
  "action$",
  "globalAction$",
]);

/** The QRL prop of a slot rendered as a render prop: `title$`, `item$`. */
export function slotProp(slot: string): string {
  return `${slot}$`;
}

/** The change callback of a model, by ADR-0012's names: `onValueChange$`. */
export function modelCallback(model: string): string {
  return qwikEventProp(`${model}Change`);
}

/**
 * Whether a slot is rendered as a QRL render prop: every slot but a default one without props,
 * which `<Slot />` projects.
 */
export function isRenderProp(component: UfComponent, slot: string): boolean {
  if (slot !== "default") return true;
  return component.slots?.slots.some((each) => each.name === slot && each.props) ?? false;
}

/**
 * The render-prop slots the component's code names, in the order it first names them: an outlet
 * or a forwarded fill, then a presence test.
 */
function renderedSlots(component: UfComponent): string[] {
  const found: string[] = [];
  const add = (slot: string) => {
    if (isRenderProp(component, slot) && !found.includes(slot)) found.push(slot);
  };
  walk(component.render, {
    enter(node) {
      if (node.kind === "SlotOutlet") add(node.slot);
      if (node.kind !== "Component" && node.kind !== "Dynamic") return;
      for (const fill of node.kind === "Component" ? node.fills : (node.fills ?? [])) {
        if (fill.forward !== undefined) add(fill.forward);
      }
    },
  });
  for (const { expression } of expressionsOf(component)) {
    for (const reference of expression.refs) if (reference.kind === "Slot") add(reference.slot);
  }
  return found;
}

/**
 * Whether a consumer's `class` and `style` fall through to the component (ADR-0054): its root is
 * one element, or one component that takes them in turn, and it does not turn them off.
 */
function fallsThrough(component: UfComponent, module: UfModule): boolean {
  if (component.inheritAttrs === false) return false;
  if (component.render.kind === "Element") return true;
  // A component at the root is the only child of the root fragment.
  const [root, ...rest] = component.render.children;
  if (root?.kind !== "Component" || rest.length) return false;
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find(
      (name) => name.kind === "Component" && name.local === root.component,
    );
    if (!imported) continue;
    const api = entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    return api?.inheritAttrs ?? false;
  }
  const local = module.components.find((each) => each.name === root.component);
  return local !== undefined && local !== component && fallsThrough(local, module);
}

/**
 * Where a component renders a slot: `<Slot />` for the default one, with its fallback as the
 * `<Slot>`'s children; `{title$?.()}`, `{item$?.({ item })}` for a render prop, and
 * `{title$?.() ?? fallback}` with a fallback.
 */
export function slotOutlet(
  node: SlotOutletNode,
  context: JsxContext,
  plan: CompositionPlan,
  slotComponent: () => string,
): AstExpression {
  const local = plan.slots.get(node.slot);
  if (local === undefined) {
    return js.jsxElement(slotComponent(), [], jsxChildren(node.fallback, context));
  }
  const props = jsxSlotProps(node, context);
  const args = props ? [props] : [];
  if (!node.fallback.length) {
    return optionalCall(local, args);
  }
  // `title$?.() ?? fallback`, not a ternary: Qwik's lint takes a call of a `$` name as a loader
  // (`qwik/loader-location`). A filled slot's call is a promise, never nullish.
  return js.logicalExpression("??", optionalCall(local, args), jsxBranch(node.fallback, context));
}

/** `name?.(args)`. */
function optionalCall(
  name: string,
  args: Parameters<typeof js.callExpression>[1],
): ReturnType<typeof js.chainExpression> {
  return js.chainExpression({ ...js.callExpression(js.identifier(name), args), optional: true });
}

/**
 * A fill of a child's render-prop slot (ADR-0054): `title$={() => <h2 />}`, a scoped one
 * `item$={({ item }) => …}`, and a forwarded one the parent's own `title$`. Qwik's optimizer
 * makes the arrow a QRL, as it makes a listener's.
 */
export function fillAttribute(
  fill: SlotFill,
  context: JsxContext,
  plan: CompositionPlan,
  locals: RenderLocals,
): JsxAttribute[] {
  const name = slotProp(fill.slot);
  if (fill.forward !== undefined) {
    // Forwarding the default slot needs its presence, an error on Qwik
    // (`default-slot-presence`): the output passes nothing.
    const local = plan.slots.get(fill.forward);
    return local === undefined
      ? []
      : [js.jsxAttribute(name, js.jsxExpressionContainer(js.identifier(local)))];
  }
  locals.enter(true);
  const body = jsxBranch(fill.children, context);
  const parameter = fill.parameter && (fill.parameter.name ?? fill.parameter.pattern!.code);
  const arrow = js.arrowFunction(
    parameter === undefined ? [] : [context.placeholders.parameter(parameter)],
    body,
  );
  return [
    js.jsxAttribute(name, js.jsxExpressionContainer(withLocals(arrow, locals.leave(), context))),
  ];
}

/** `value` → `Value`. */
export function capitalized(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * A listener of a child's event (ADR-0053): a setup function as its QRL, or one written in place
 * as the arrow the optimizer makes a QRL, its calls of QRLs awaited (./calls.ts). A function that
 * moved to module scope is called from an arrow, which takes the event's payload.
 */
export function componentHandler(
  handler: Handler,
  context: JsxContext,
  plan: SetupPlan,
): AstExpression {
  if (handler.kind === "Inline") {
    return context.placeholders.expression(printFunction(plan, handler.function, "client").text);
  }
  const fn = plan.functions.get(handler.binding)!;
  if (fn.form !== "module") return js.identifier(fn.qrl);
  return context.placeholders.expression(`(...payload) => ${fn.binding.name}(...payload)`);
}

/**
 * What a component's `v-model:<name>` writes the model's value with (ADR-0054): the parent's own
 * model's setter, or an arrow that writes its state, `(value) => (cups.value = value)`.
 */
export function modelWriter(value: Expression, plan: SetupPlan): string {
  const reference = value.refs.find((each) => each.kind === "Binding");
  const binding = reference && bindingOf(plan.component, reference.binding);
  const model = binding && plan.composition.models.get(binding.id);
  if (model) return model.setter;
  const parameter = binding?.name === "value" ? "next" : "value";
  return `(${parameter}) => (${value.code} = ${parameter})`;
}

/**
 * What the component's render declares before it returns (ADR-0054): the `const` a
 * `<component is>` renders, and the values form controls read in render.
 */
export class RenderLocals {
  readonly #plan: SetupPlan;
  readonly #declared = new Map<string, string>();
  readonly statements: string[] = [];
  /** The callbacks being printed (a list's, a fill's), innermost last, with what they declare. */
  readonly #scopes: {
    statements: string[];
    fill: boolean;
    functions: Map<string, string>;
  }[] = [];

  constructor(plan: SetupPlan) {
    this.#plan = plan;
  }

  /** `const Tag = …;`, under a fresh name: in the innermost callback where `local`. */
  declare(base: string, code: string, local = false): string {
    const name = this.#plan.names.fresh(base);
    const scope = local ? this.#scopes.at(-1) : undefined;
    (scope?.statements ?? this.statements).push(`const ${name} = ${code};`);
    return name;
  }

  /** A read of a model's value in render, declared once: `const currentName = name.value;`. */
  current(read: string, base: string): string {
    let name = this.#declared.get(read);
    if (name === undefined) {
      name = this.declare(`current${capitalized(base)}`, read);
      this.#declared.set(read, name);
    }
    return name;
  }

  /** Starts printing a callback: a list's, or a fill's (a `$` scope). */
  enter(fill: boolean): void {
    this.#scopes.push({ statements: [], fill, functions: new Map() });
  }

  /** Ends the callback {@link enter} started: what it declares, its functions first. */
  leave(): string[] {
    const scope = this.#scopes.pop()!;
    return [...scope.functions.values(), ...scope.statements];
  }

  /** Whether a fill's callback is being printed: its code runs as a `$` scope. */
  get inFill(): boolean {
    return this.#scopes.some((scope) => scope.fill);
  }

  /** Declares a setup function in the innermost fill's callback, once. */
  declareInFill(name: string, declaration: () => string): void {
    const fill = this.#scopes.findLast((scope) => scope.fill);
    if (!fill || fill.functions.has(name)) return;
    fill.functions.set(name, declaration());
  }
}

/**
 * A callback's arrow with what it declares before what it returns:
 * `(item) => { const Tag = item.tag; return <Tag />; }`.
 */
export function withLocals(
  arrow: ReturnType<typeof js.arrowFunction>,
  statements: readonly string[],
  context: JsxContext,
): ReturnType<typeof js.arrowFunction> {
  const { body } = arrow;
  if (!statements.length || body.type === "BlockStatement") return arrow;
  return js.arrowFunction(arrow.params, [
    context.placeholders.statements(`${statements.join("\n")}\n`),
    js.returnStatement(body),
  ]);
}

/** Whether an expression reads a binding only a callback of the render declares. */
export function readsRenderLocal(expression: Expression, component: UfComponent): boolean {
  return expression.refs.some(
    (reference) =>
      reference.kind === "Binding" &&
      ["loopVar", "slotScope"].includes(bindingOf(component, reference.binding).kind),
  );
}

/**
 * The expressions of the fills a component passes as render props: Qwik's optimizer makes each
 * fill a `$` scope, which declares a copy of each setup function it calls, as a listener does.
 */
export function fillExpressions(component: UfComponent): Set<Expression> {
  const found = new Set<Expression>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Component" && node.kind !== "Dynamic") return;
      for (const fill of node.kind === "Component" ? node.fills : (node.fills ?? [])) {
        if (fill.forward !== undefined || (fill.slot === "default" && !fill.parameter)) continue;
        const render: FragmentNode = { kind: "Fragment", children: fill.children, span: fill.span };
        for (const { expression } of expressionsOf({
          ...component,
          props: [],
          setup: [],
          render,
        })) {
          found.add(expression);
        }
      }
    },
  });
  return found;
}

/**
 * A form control's `v-model` (ADR-0054): its state from the model, and the listener that writes
 * it back, which takes the control as Qwik's element argument. Qwik writes a prop the optimizer
 * can make a signal (`value={name.value}`, as `bind:value`) as an attribute when it creates the
 * element, and any other as the DOM property, as Vue does (ADR-0058): so the control reads its
 * model in render, through a local. A text control listens to `input`, a lazy one to `change`; a
 * modifier or a number control's cast goes through `modelText`, which also keeps the person's own
 * text where it reads as the value, as Vue's `vModelText` does, through a ref to the control. A
 * checkbox binds `checked`, into an array through `toggle`; a radio is checked where the model
 * holds its value; a select's options are selected where the model holds theirs (./index.ts),
 * and a multiple one writes `selectedValues`.
 */
export function modelAttribute(
  attribute: ModelAttribute,
  element: ElementNode,
  context: JsxContext,
  plan: SetupPlan,
  locals: RenderLocals,
): JsxAttribute[] {
  const read = expressionCode(attribute.value, context);
  const current = locals.current(read, modelBindingName(attribute.value, plan));
  const write = (value: string) => modelWrite(attribute.value, value, plan);
  const listener = (event: string, value: string, parameters = "_, element") =>
    js.jsxAttribute(
      qwikEventProp(event),
      js.jsxExpressionContainer(
        context.placeholders.expression(`(${parameters}) => ${write(value)}`),
      ),
    );
  const prop = (name: string, code: string) =>
    js.jsxAttribute(name, js.jsxExpressionContainer(context.placeholders.expression(code)));
  switch (attribute.control) {
    case "text":
    case "number":
    case "textarea": {
      const event = attribute.lazy ? "change" : "input";
      const modifiers = [
        ...(attribute.trim ? ["trim: true"] : []),
        ...(attribute.lazy ? ["lazy: true"] : []),
        ...(attribute.number || attribute.control === "number" ? ["number: true"] : []),
      ];
      if (!modifiers.length) return [prop("value", current), listener(event, "element.value")];
      const modelText = plan.names.once("modelText");
      const options = `{ ${modifiers.join(", ")} }`;
      const ref = controlRef(element, plan, locals, modelBindingName(attribute.value, plan));
      return [
        ...(ref.attribute ? [prop("ref", ref.name)] : []),
        prop("value", `${modelText}.shown(${ref.name}.value, ${current}, ${options})`),
        listener(event, `${modelText}.read(element, ${options})`),
      ];
    }
    case "checkbox":
      return [prop("checked", current), listener("change", "element.checked")];
    case "checkbox-group": {
      const value = controlValue(element, context);
      return [
        prop("checked", `${current}.includes(${value})`),
        listener("change", `${plan.names.once("toggle")}(${read}, ${value}, element.checked)`),
      ];
    }
    case "radio": {
      const value = controlValue(element, context);
      return [prop("checked", `${current} === ${value}`), listener("change", value, "")];
    }
    case "select":
      return [listener("change", "element.value")];
    case "select-multiple":
      return [listener("change", `${plan.names.once("selectedValues")}(element)`)];
    default:
      return unreachable(attribute.control);
  }
}

/** The name of the state or the model a `v-model` binds: `name` in `name.value`. */
function modelBindingName(value: Expression, plan: SetupPlan): string {
  const reference = value.refs.find((each) => each.kind === "Binding");
  return reference ? bindingOf(plan.component, reference.binding).name : "value";
}

/**
 * The template ref `modelText` reads a control through: the control's own `ref`, or a signal the
 * component declares for it, `nameInput`.
 */
function controlRef(
  element: ElementNode,
  plan: SetupPlan,
  locals: RenderLocals,
  base: string,
): { name: string; attribute: boolean } {
  const own = element.attributes.find((attribute) => attribute.kind === "Ref");
  if (own?.kind === "Ref")
    return { name: bindingOf(plan.component, own.binding).name, attribute: false };
  const textarea = element.tag === "textarea";
  const name = locals.declare(
    `${base}${textarea ? "Textarea" : "Input"}`,
    `${plan.names.core("useSignal")}<${textarea ? "HTMLTextAreaElement" : "HTMLInputElement"}>()`,
  );
  return { name, attribute: true };
}

/** A write of a `v-model`'s value: the model's setter, or the state's `.value`. */
function modelWrite(value: Expression, written: string, plan: SetupPlan): string {
  const reference = value.refs.find((each) => each.kind === "Binding");
  const model = reference && plan.composition.models.get(reference.binding);
  return model ? `${model.setter}(${written})` : `(${value.code} = ${written})`;
}

/** The value a checkbox or a radio stands for: its `value` attribute, as written. */
export function controlValue(element: ElementNode, context: JsxContext): string {
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" && attribute.name === "value" && attribute.value !== true) {
      return JSON.stringify(attribute.value);
    }
    if (attribute.kind === "Bound" && attribute.name === "value") {
      return expressionCode(attribute.value, context);
    }
  }
  // Without a `value`, a checkbox stands for "on", as the DOM's does.
  return JSON.stringify("on");
}

/**
 * The options of each select a `v-model` binds, with the model: an option is selected where the
 * model holds its value (`selected={size.value === "m"}`), so the server renders it selected too.
 */
export function modelOptions(root: RenderNode | FragmentNode): Map<ElementNode, ModelAttribute> {
  const found = new Map<ElementNode, ModelAttribute>();
  walk(root, {
    enter(node) {
      if (node.kind !== "Element" || node.tag !== "select") return;
      const model = node.attributes.find(
        (attribute): attribute is ModelAttribute => attribute.kind === "Model",
      );
      if (!model) return;
      walk(node, {
        enter(inner) {
          if (inner.kind === "Element" && inner.tag === "option") found.set(inner, model);
        },
      });
    },
  });
  return found;
}

/** The `selected` of an option a `v-model`'s select holds (see {@link modelOptions}). */
export function optionSelected(
  option: ElementNode,
  model: ModelAttribute,
  context: JsxContext,
  plan: SetupPlan,
  locals: RenderLocals,
): JsxAttribute {
  const read = locals.current(
    expressionCode(model.value, context),
    modelBindingName(model.value, plan),
  );
  const value = controlValue(option, context);
  const selected =
    model.control === "select-multiple" ? `${read}.includes(${value})` : `${read} === ${value}`;
  return js.jsxAttribute(
    "selected",
    js.jsxExpressionContainer(context.placeholders.expression(selected)),
  );
}

/** The authoring types of a ref a key may hold, and the Qwik signal each is. */
const REF_SIGNALS: readonly (readonly [string, string])[] = [
  ["Ref", "Signal"],
  ["ComputedRef", "ReadonlySignal"],
  ["ModelRef", "ReadonlySignal"],
];

/**
 * An injection key's value type as Qwik's context holds it (ADR-0054): a ref the key holds is
 * Qwik's signal, which is provided itself.
 */
export function keyType(type: string, names: OutputNames): string {
  let written = type;
  for (const [name, signal] of REF_SIGNALS) {
    const reference = new RegExp(`(?<![\\w$.])${name}(?=\\s*<)`, "g");
    if (reference.test(written)) {
      written = written.replace(reference, names.core(signal, { type: true }));
    }
  }
  return written;
}

/**
 * The `selected` of an option without a `value`, whose value is its text, as the DOM's is
 * (ASCII whitespace collapsed and stripped): compared with the model as written, or, where the
 * text holds expressions, as the option renders it. `undefined` for an option holding anything
 * else (a conditional), which then shows unselected.
 */
export function textOptionSelected(
  option: ElementNode,
  model: ModelAttribute,
  context: JsxContext,
  plan: SetupPlan,
  locals: RenderLocals,
): BoundAttribute | undefined {
  const read = locals.current(
    expressionCode(model.value, context),
    modelBindingName(model.value, plan),
  );
  const [prefix, suffix] =
    model.control === "select-multiple" ? [`${read}.includes(`, ")"] : [`${read} === `, ""];
  const at = option.span;
  const parts: (string | Expression)[] = [];
  for (const child of option.children) {
    if (child.kind === "Text") parts.push(child.value);
    else if (child.kind === "Interpolation") parts.push(child.value);
    else return undefined;
  }
  let compared: string;
  if (parts.every((part) => typeof part === "string")) {
    compared = JSON.stringify(optionText(parts.join("")));
  } else {
    // The text the option renders, read as the DOM reads an option's value.
    const template = parts
      .map((part) =>
        typeof part === "string"
          ? part.replace(/[`\\]|\$\{/g, (found) => `\\${found}`)
          : // A nullish value renders nothing, as in Vue's text.
            `\${${nullishOperand(expressionCode(part, context))} ?? ""}`,
      )
      .join("");
    compared = `\`${template}\`.replace(/[\\t\\n\\f\\r ]+/g, " ").replace(/^ | $/g, "")`;
  }
  const code = `${prefix}${compared}${suffix}`;
  return {
    kind: "Bound",
    name: "selected",
    value: { code, refs: [], span: { start: at.start, end: at.start + code.length } },
    span: at,
  };
}

/** Code as the left operand of `??`: in parentheses unless it is a name or a member. */
function nullishOperand(code: string): string {
  return /^[\w$]+(?:(?:\?\.|\.)[\w$]+)*$/.test(code) ? code : `(${code})`;
}

/** An option's value from its text, as the DOM reads it: ASCII whitespace collapsed and stripped. */
function optionText(text: string): string {
  return text.replace(/[\t\n\f\r ]+/g, " ").replace(/^ | $/g, "");
}
