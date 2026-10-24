// The template's listeners (ADR-0047): `@click="save"` for a setup function, the inline
// statement Vue's docs write for a handler that is one expression (`@click="count++"`), an arrow
// for one that takes its event (`@input="(event) => (note = …)"`), and Vue's `.stop` and
// `.prevent` modifiers for the `stopPropagation()` and `preventDefault()` a handler starts with.
// Any other handler moves to the script, as a function the template names: a template expression
// reads only the component's bindings and Vue's template globals, and holds one expression.
import {
  bindingOf,
  codeNames,
  functionBodyText,
  functionText,
  handlerText,
  NameScope,
  parametersText,
  parseExpression,
  parseStatementsSource,
  rewriteCode,
  vueAttributeCode,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import { DOM_EVENTS, walk } from "@unframework/ir";
import type {
  BindingKind,
  Code,
  CodeReference,
  ElementNode,
  EventAttribute,
  EventControl,
  FunctionCode,
  ModelAttribute,
  UfComponent,
} from "@unframework/ir";

import { unreachable, VUE_TEMPLATE_GLOBALS } from "./names.ts";
import type { VueNames } from "./names.ts";

/** How the template writes its listeners, and the functions the script declares for them. */
export interface Listeners {
  /** Each listener's attribute (`@click.stop="record('stopped')"`), by its IR attribute. */
  attributes: ReadonlyMap<EventAttribute, string>;
  /** The script functions the template calls for the handlers it cannot hold, in its order. */
  functions: string[];
}

/**
 * Plans every listener of a component's template, in document order: what each attribute says,
 * and the script functions handlers move to (claimed from `names`, `on<Event>`).
 */
export function planListeners(
  component: UfComponent,
  names: VueNames,
  rules: { script: RewriteRules; template: RewriteRules },
): Listeners {
  const attributes = new Map<EventAttribute, string>();
  const functions: string[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      const captures = node.attributes.some(
        (attribute) =>
          attribute.kind === "Event" && attribute.capture && attribute.event === "input",
      );
      const write = captures ? fieldWrite(node, component, names, rules.script) : undefined;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event") continue;
        const then = attribute.capture && attribute.event === "input" ? write?.call : undefined;
        const planned = listener(attribute, component, names, rules, then);
        attributes.set(attribute, planned.attribute);
        if (planned.function !== undefined) functions.push(planned.function);
      }
      if (write !== undefined) functions.push(write.function);
    },
  });
  return { attributes, functions };
}

interface Planned {
  attribute: string;
  /** The script function the attribute names, when the handler moved there. */
  function?: string;
}

/**
 * A listener's attribute, and the script function its handler moves to. `then` is a statement
 * the listener runs after its handler, in the same listener (`fieldWrite`): the handler is then
 * called in a statement, with the event where it takes a parameter.
 */
function listener(
  attribute: EventAttribute,
  component: UfComponent,
  names: VueNames,
  rules: { script: RewriteRules; template: RewriteRules },
  then?: string,
): Planned {
  // Options are `addEventListener`'s, which Vue's modifiers set (`withModifiers` aside).
  const options = [
    attribute.capture ? "capture" : undefined,
    attribute.once ? "once" : undefined,
    attribute.passive ? "passive" : undefined,
  ].filter((option) => option !== undefined);
  const write = (
    value: string | undefined,
    guards: readonly string[] = [],
    takesEvent?: boolean,
  ) => {
    const called =
      value === undefined || takesEvent === undefined
        ? value
        : `${value}(${takesEvent ? "$event" : ""})`;
    const code = then === undefined ? called : called === undefined ? then : `${called}; ${then}`;
    return `@${attribute.event}${[...guards, ...options].map((modifier) => `.${modifier}`).join("")}${
      code === undefined
        ? ""
        : `="${vueAttributeCode(code, then === undefined ? undefined : "statements")}"`
    }`;
  };
  const { handler } = attribute;
  switch (handler.kind) {
    case "Function": {
      const declared = component.setup.find(
        (item) => item.kind === "Function" && item.binding === handler.binding,
      );
      const takesEvent =
        then === undefined
          ? undefined
          : declared?.kind === "Function" && declared.function.parameters.length > 0;
      return { attribute: write(handlerText(handler, component, rules.template), [], takesEvent) };
    }
    case "Inline":
      break;
    default:
      return unreachable(handler);
  }
  const fn = handler.function;
  // In a statement, a handler Vue would call with the event moves to the script, which calls it.
  const held = (value: string) => then === undefined || !calledByVue(value);
  // `.stop` and `.prevent` call `stopPropagation()` and `preventDefault()` before the handler,
  // as a handler that starts with them does: Vue's own spelling of those statements. Vue refuses
  // `.prevent` beside `.passive`, where it would do nothing.
  const guarded = attribute.passive ? undefined : leadingControls(fn);
  if (guarded) {
    if (guarded.rest === undefined) return { attribute: write(undefined, guarded.modifiers) };
    if (inTemplate(guarded.rest, component)) {
      const value = templateValue(fn, guarded.rest, component, rules.template);
      if (held(value)) return { attribute: write(value, guarded.modifiers) };
    }
  }
  if (fn.expression && inTemplate(fn.body, component)) {
    const value = templateValue(fn, fn.body, component, rules.template);
    if (held(value)) return { attribute: write(value) };
  }
  const name = names.scope.claim(
    `on${attribute.event.charAt(0).toUpperCase()}${attribute.event.slice(1)}`,
  );
  return {
    attribute: write(name, [], then === undefined ? undefined : fn.parameters.length > 0),
    function: scriptFunction(name, attribute.event, fn, component, rules.script),
  };
}

/**
 * What a capture listener of a field's `input` runs after its handler: the field's `v-model`
 * write, as a script function. `v-model` writes the field from its own `input` listener, which
 * runs after the capture one, and Vue renders in between when the handler writes state: the
 * render puts the model's old value back into the field, and `v-model` then writes that. Writing
 * the model first leaves the render nothing to put back, and `v-model`'s write the same value.
 * The function writes what Vue's `vModelText` writes: nothing while an input method composes,
 * the text trimmed for `.trim`, and cast as Vue's `looseToNumber` casts it for `.number`, a
 * `type="number"` field and a range (whose `v-model` takes `.number`, `../codegen` `vue.ts`).
 * `vue` exports no `looseToNumber`, so the cast is written in place. A `lazy` field writes on
 * `change`, which this leaves to `v-model`.
 */
function fieldWrite(
  element: ElementNode,
  component: UfComponent,
  names: VueNames,
  rules: RewriteRules,
): { call: string; function: string } | undefined {
  const model = element.attributes.find(
    (attribute): attribute is ModelAttribute => attribute.kind === "Model",
  );
  if (model === undefined || model.lazy) return undefined;
  if (model.control !== "text" && model.control !== "textarea" && model.control !== "number") {
    return undefined;
  }
  const reference = model.value.refs.find((each) => each.kind === "Binding");
  const bound = reference ? bindingOf(component, reference.binding).name : "model";
  const name = names.scope.claim(`write${bound.charAt(0).toUpperCase()}${bound.slice(1)}`);
  const type = model.control === "textarea" ? "HTMLTextAreaElement" : "HTMLInputElement";
  const target = rewriteCode(model.value, component, rules, "client");
  // Its locals are named apart from the model it writes, which a local `text` would shadow.
  const locals = new NameScope(codeNames(target));
  const [event, field, text, number] = ["event", "field", "text", "number"].map((each) =>
    locals.claim(each),
  );
  const value = `${field}.value${model.trim ? ".trim()" : ""}`;
  const write =
    model.number || model.control === "number"
      ? [
          `  const ${text} = ${value};`,
          `  const ${number} = Number.parseFloat(${text});`,
          `  ${target} = (Number.isNaN(${number}) ? ${text} : ${number}) as typeof ${target};`,
        ]
      : [`  ${target} = ${value};`];
  return {
    call: `${name}($event)`,
    function: [
      `function ${name}(${event}: ${vueEventInterface("input")}): void {`,
      `  const ${field} = ${event}.target as ${type} & { composing?: boolean };`,
      `  if (${field}.composing) return;`,
      ...write,
      "}",
    ].join("\n"),
  };
}

/**
 * What the template runs for an inline handler's expression: the expression itself, which Vue
 * wraps as `$event => (…)` (`count++`, `select(task.id)`), or, for a handler that reads its
 * event, or whose expression Vue would take for a function to call (a name, a member), the
 * arrow as written.
 */
function templateValue(
  fn: FunctionCode,
  body: Code,
  component: UfComponent,
  rules: RewriteRules,
): string {
  const code = unwrapped(rewriteCode(body, component, rules, "client"));
  const names = codeNames(body.code);
  const readsParameter = fn.parameters.some(
    (parameter) =>
      (parameter.name !== undefined && names.has(parameter.name)) ||
      (parameter.pattern?.names ?? []).some((name) => names.has(name)),
  );
  if (!fn.async && !readsParameter && !calledByVue(code)) return code;
  if (body === fn.body) return functionText(fn, component, rules, "client");
  // A body `leadingControls` cut down to its last statement's expression.
  return `${fn.async ? "async " : ""}(${parametersText(fn)}) => ${needsWrapping(code) ? `(${code})` : code}`;
}

/**
 * Whether Vue's compiler takes an `@event` value for a function to call with the event rather
 * than a statement to run: a name or a member access (compiler-core's `isMemberExpression`), or
 * a function expression.
 */
function calledByVue(code: string): boolean {
  let expression = parseExpression(code);
  while (
    expression.type === "TSAsExpression" ||
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSNonNullExpression"
  ) {
    expression = expression.expression;
  }
  if (expression.type === "ChainExpression")
    return expression.expression.type === "MemberExpression";
  return (
    expression.type === "Identifier" ||
    expression.type === "MemberExpression" ||
    expression.type === "ArrowFunctionExpression" ||
    expression.type === "FunctionExpression"
  );
}

/** An arrow's expression body that is an object literal or a sequence needs its parentheses. */
function needsWrapping(code: string): boolean {
  const expression = parseExpression(code);
  return expression.type === "ObjectExpression" || expression.type === "SequenceExpression";
}

/** Code without the parentheses around it all: `(zoom += 25)` → `zoom += 25`. */
function unwrapped(code: string): string {
  let current = code.trim();
  for (;;) {
    if (!current.startsWith("(")) return current;
    const expression = parseExpression(current);
    if (expression.start === 0) return current;
    current = current.slice(expression.start, expression.end).trim();
  }
}

/**
 * Whether code can be a template expression: it reads only the component's bindings (a setup
 * `let` aside, which is not reactive and which Vue's compiler reads as a possible ref) and Vue's
 * template globals, and makes no API call (`nextTick` needs `await`, which a template cannot).
 */
function inTemplate(code: Code, component: UfComponent): boolean {
  return code.refs.every((reference) => templateReads(reference, component));
}

function templateReads(reference: CodeReference, component: UfComponent): boolean {
  switch (reference.kind) {
    case "Binding":
    case "Write":
      return templateReadsBinding(bindingOf(component, reference.binding).kind);
    case "Global":
      return VUE_TEMPLATE_GLOBALS.has(reference.name);
    case "Emit":
    case "Event":
    case "Slot":
    // `<script setup>` hands its imports to the template.
    case "Import":
      return true;
    case "Api":
      return false;
    default:
      return unreachable(reference);
  }
}

/**
 * Whether a template expression reads a binding of this kind as the script does. A setup `let`
 * is no reactive state: Vue's compiler would read it through `isRef` on every access.
 */
function templateReadsBinding(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
    case "loopVar":
    case "state":
    case "derived":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "emit":
    case "model":
    case "slots":
    case "slotScope":
    case "context":
    case "component":
      return true;
    case "localVar":
    // `emit` reports UF1002 for these first (ADR-0069, ADR-0070).
    case "moduleConst":
    case "import":
    case "argument":
    case "usedState":
    case "usedDerived":
    case "usedFn":
    case "usedConst":
      return false;
    default:
      return unreachable(kind);
  }
}

/** The modifier Vue writes for an event control. */
function modifierOf(control: EventControl): string {
  switch (control.method) {
    case "preventDefault":
      return "prevent";
    case "stopPropagation":
      return "stop";
    default:
      return unreachable(control.method);
  }
}

/**
 * A handler that starts with unconditional `stopPropagation()` and `preventDefault()` calls and
 * then runs at most one expression: its modifiers, and the code of that expression (absent when
 * the calls are all it does). `undefined` for any other handler, or one with comments, which a
 * modifier would drop.
 */
function leadingControls(fn: FunctionCode): { modifiers: string[]; rest?: Code } | undefined {
  const controls = fn.eventControls ?? [];
  if (controls.length === 0 || controls.some((control) => control.condition !== undefined)) {
    return undefined;
  }
  const modifiers = controls.map(modifierOf);
  if (fn.expression) {
    // The body is the call itself.
    return controls.length === 1 ? { modifiers } : undefined;
  }
  const { statements, comments } = parseStatementsSource(fn.body.code);
  const [block] = statements;
  if (comments.length > 0 || block?.type !== "BlockStatement") return undefined;
  const base = fn.body.span.start;
  const leading = block.body.slice(0, controls.length);
  const matches = leading.every(
    (statement, index) =>
      base + statement.start === controls[index]!.span.start &&
      base + statement.end === controls[index]!.span.end,
  );
  if (!matches || leading.length < controls.length) return undefined;
  const rest = block.body.slice(controls.length);
  if (rest.length === 0) return { modifiers };
  const [only] = rest;
  if (rest.length > 1 || only?.type !== "ExpressionStatement") return undefined;
  const span = { start: base + only.expression.start, end: base + only.expression.end };
  return {
    modifiers,
    rest: {
      code: fn.body.code.slice(only.expression.start, only.expression.end),
      span,
      refs: fn.body.refs.filter(
        (reference) => reference.span.start >= span.start && reference.span.end <= span.end,
      ),
    },
  };
}

/**
 * A handler the template cannot hold, as a script function: `function onClick() { … }`, its
 * event parameter typed with the interface Vue's element types give the event
 * ({@link vueEventInterface}) where the source leaves it to the context. An expression body
 * becomes a statement: a listener's value is never used. The analyser keeps a handler that reads
 * a loop variable to one call the template holds (UF3029), so a script function never needs one.
 */
function scriptFunction(
  name: string,
  event: string,
  fn: FunctionCode,
  component: UfComponent,
  rules: RewriteRules,
): string {
  const typed: FunctionCode = {
    ...fn,
    parameters: fn.parameters.map((parameter) =>
      parameter.event !== undefined && parameter.type === undefined
        ? { ...parameter, type: { code: vueEventInterface(event), span: parameter.span } }
        : parameter,
    ),
  };
  if (!typed.expression) return functionText(typed, component, rules, "client", { name });
  const body = functionBodyText(typed, component, rules, "client", { discard: true });
  const returnType = typed.returnType ? `: ${typed.returnType.code}` : "";
  return `${typed.async ? "async " : ""}function ${name}(${parametersText(typed)})${returnType} {\n  ${body}\n}`;
}

/**
 * The event interface `@vue/runtime-dom`'s `Events` gives a DOM event: lib.dom's
 * (`DOM_EVENTS`), but for `error`, which Vue types as a plain `Event` (3.5.43), so a handler
 * annotated `ErrorEvent` would not take what `@error` passes (vocabulary.test.ts pins both).
 */
export function vueEventInterface(event: string): string {
  if (event === "error") return "Event";
  const name = DOM_EVENTS.get(event);
  if (name === undefined) throw new Error(`Unknown DOM event "${event}".`);
  return name;
}
