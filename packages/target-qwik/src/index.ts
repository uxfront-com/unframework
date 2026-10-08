import {
  bindingOf,
  boundJsxAttribute,
  componentTypes,
  compositionUse,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  jsxAttributeValue,
  jsxContext,
  jsxExpression,
  jsxNode,
  printComponentModule,
  sourceNames,
  spreadRead,
  staticJsxAttribute,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, JsxDialect, OutputFile, Target } from "@unframework/codegen";
import { codeOf } from "@unframework/ir";
import type {
  ElementNode,
  EventDeclaration,
  TypeDeclaration,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import {
  elementNamespaces,
  isUntypedAttribute,
  qwikAttributeName,
  qwikStaticValue,
} from "./attributes.ts";
import type { Namespace } from "./attributes.ts";
import { qwikClassAttribute } from "./class.ts";
import { qwikEventProp } from "./events.ts";
import { Listeners } from "./listeners.ts";
import { OutputNames, planSetup } from "./plan.ts";
import type { SetupPlan } from "./plan.ts";
import { printSetup } from "./setup.ts";
import { qwikTitles } from "./title.ts";
import { isPrimitiveValue } from "./values.ts";

/** The Qwik 2 target (experimental while Qwik 2 is in beta). */
export const qwik: Target = defineTarget({
  name: "qwik",
  framework: { package: "@qwik.dev/core", range: ">=2.0.0-beta.47 <3" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    // `capture:<event>`; an element that listens in both phases runs its capture listener from
    // the window (./listeners.ts).
    "event-capture": { support: "native" },
    "event-once": {
      support: "emulated",
      helper: "once<Event>",
      note: "Qwik's listeners have no `once`: a module-level WeakSet of the elements a `once` listener ran for, checked first in its handler, which also takes the element's `preventdefault:`/`stoppropagation:` off after its first run.",
    },
    "event-passive": { support: "native" },
    // Qwik's listeners take the DOM's events, `change` and `focus` included.
    "event-semantics": { support: "native" },
    // Controls run apart from the handler, as the loader dispatches (./listeners.ts), only where
    // moving them there changes nothing: at the top of a template listener (codegen's controls.ts).
    "conditional-event-control": {
      support: "unsupported",
      code: "UF4001",
      severity: "error",
      reason:
        "Qwik runs a handler once its code has loaded, after the event is dispatched, so it runs `preventDefault()` and `stopPropagation()` apart, as the event is dispatched: a control at the top of a template listener on every event (`preventdefault:click`), or under an `if` there that tests only the event, in a `sync$` handler, which captures nothing. A control after another statement, in a block beside other statements, in an `else` or a `switch`, after a test of state or of what a control changes (`event.defaultPrevented`), or in a function the listener calls anywhere but at its top, cannot run there; nor can a `once` listener's control that runs under a condition or on an element listening to the event in both phases (a `sync$` handler cannot tell whether the listener already ran), nor a capture listener's control where an element of the component listens to the event in both phases (Qwik runs those capture listeners from the window); nor a control in a local function that reads the component's state and that client code hands to `addEventListener` or calls outside a template listener, which is a QRL. Make the control the first statement of the listener, or the only statement under an `if` that tests only the event (`if (event.key === \"Enter\") event.preventDefault();`), and keep a `once` listener's control unconditional; in a listener client code adds, make the control in the listener itself, before it calls a local function.",
    },
    // `"uf-id-" + useId()`.
    "use-id": { support: "native" },
    "next-tick": {
      support: "emulated",
      helper: "nextTick",
      note: "Qwik has no public way to wait for a render: `nextTick()` resolves after a macrotask, by which time the render its writes scheduled (in a microtask) has run.",
    },
    // Qwik 2.0.0-beta.47's props proxy subscribes a reader only to the keys the props hold
    // (core's `PropsProxyHandler.get`: `if (prop in this.owner.varProps)`), and a key a parent
    // adds later finds no subscriber, so only the component's own render runs again.
    "late-prop": {
      support: "unsupported",
      code: "UF4001",
      severity: "warning",
      reason:
        "Qwik subscribes a `useComputed$` or a task only to the props the component holds when it reads them, so a derived value or a watcher that reads an optional prop the parent did not pass at mount, and passes later (a spread that gains the key), does not see it: the template does. Pass the prop from the start, `undefined` while it has no value.",
    },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
    component: { support: "native" },
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": {
      support: "emulated",
      helper: "<slot>$",
      note: "A named slot is a QRL render prop, `<slot>$`: Qwik's `<Slot>` takes no props and has no presence API, and a plain function prop does not serialise (ADR-0054).",
    },
    "scoped-slot": {
      support: "emulated",
      helper: "<slot>$",
      note: "A named slot is a QRL render prop, `<slot>$`: Qwik's `<Slot>` takes no props and has no presence API, and a plain function prop does not serialise (ADR-0054).",
    },
    "slot-fallback": { support: "native" },
    "default-slot-presence": {
      support: "unsupported",
      code: "UF4001",
      severity: "error",
      reason:
        "Qwik's `<Slot />` has no presence API, and forwarding the default slot needs its presence (ADR-0054).",
    },
    "slot-forwarding": { support: "native" },
    model: { support: "native" },
    "two-way-binding": { support: "native" },
    "model-array": {
      support: "emulated",
      helper: "toggle",
      note: "A checkbox group's array goes through an inline helper, `toggle`, and a multiple select's through `selectedValues`, as Vue's `vModelCheckbox` and `vModelSelect` do (ADR-0054).",
    },
    "model-modifiers": {
      support: "emulated",
      helper: "modelText",
      note: "A `v-model`'s modifiers and a number control's cast follow Vue's `vModelText` through an inline helper, `modelText` (ADR-0054).",
    },
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: {
      support: "emulated",
      helper: "exposeRef",
      note: "Qwik has no component instance, so a component ref is a signal the child fills with what it exposes, through an inline helper, `exposeRef` (ADR-0054).",
    },
    context: { support: "native" },
    "reactive-context": { support: "native" },
    "dynamic-component": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Composition's cells are declared before this target emits it (ADR-0055): until M3's lane
    // for Qwik lands, a component that uses it is reported, never emitted without it (P2).
    const composition = compositionUse(context.module, component);
    if (composition) {
      context.report({
        code: "UF1002",
        severity: "error",
        message: `The qwik target does not emit ${composition.what} yet: composition lands in M3.`,
        span: composition.span,
      });
      return [];
    }
    const { module } = context;
    // Every name the source declares or reads is taken before the output names its own, but for
    // the authoring APIs code calls (`nextTick`), which the output replaces with its own.
    const reserved = sourceNames(component, module);
    for (const name of apiNames(component)) reserved.delete(name);
    const imports = new ImportSet(reserved);
    const componentFn = imports.add("@qwik.dev/core", "component$");
    const names = new OutputNames(imports);
    const plan = planSetup(component, module, names);
    const listeners = new Listeners(plan);
    // The dialect reads the namespaces of the tree it prints, which is the render tree with
    // Qwik's form of each `<title>`: they are filled in once that tree is built.
    const namespaces = new Map<ElementNode, Namespace>();
    const jsx = jsxContext({
      component,
      dialect: qwikDialect(component, module, namespaces, listeners),
      rules: plan.rules(),
    });
    const render = qwikTitles(component.render, jsx, module);
    for (const [element, namespace] of elementNamespaces(render))
      namespaces.set(element, namespace);
    const setup = printSetup(plan);
    const returned = js.returnStatement(jsxNode(render, jsx));
    const events = eventsInterface(component, plan);
    const parameter = propsParameter(component, jsx, plan);
    const propsType = [component.propsParameter?.type.code, events?.name].filter(
      (type) => type !== undefined,
    );
    const definition = js.callExpression(
      js.identifier(componentFn),
      [
        js.arrowFunction(parameter ? [parameter] : [], [
          ...(setup.body ? [jsx.placeholders.statements(`${setup.body}\n`)] : []),
          returned,
        ]),
      ],
      propsType.length ? [jsx.placeholders.type(propsType.join(" & "))] : [],
    );
    const hoisted = setup.hoisted.length
      ? [jsx.placeholders.statements(`${joinHoisted(setup.hoisted)}\n`)]
      : [];
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports,
            types: [...componentTypes(component, module), ...(events ? [events] : [])],
            body: [
              ...hoisted,
              ...exportDeclaration(
                component.name,
                definition,
                exportsOf(component.name, module.exports),
              ),
            ],
            helpers: helpers(plan, listeners),
            placeholders: jsx.placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

export default qwik;

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Parameter = Parameters<typeof js.arrowFunction>[0][number];
type AstExpression = Parameters<typeof js.conditionalExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute> | ReturnType<typeof js.jsxSpreadAttribute>;

/**
 * The props as `component$`'s parameter, typed by its type argument (`component$<Props>`,
 * ADR-0034): the source's destructuring, with its defaults, or its `props` object. A prop
 * no printed expression reads is left out (an unused binding fails L5), and so is the whole
 * parameter when none is read. Qwik's optimizer turns destructured props into reactive reads
 * of the props object, and applies a default as `??` (ADR-0034: the analyser rejects a default
 * on a prop that admits `null`, so `??` and destructuring agree).
 */
function propsParameter(
  component: UfComponent,
  jsx: JsxContext,
  plan: SetupPlan,
): Parameter | undefined {
  const parameter = component.propsParameter;
  const read = component.props.filter(
    (prop) => prop.binding !== undefined && jsx.referenced.has(prop.binding),
  );
  // The events code emits, after the props: `({ initial = 0, onChange$ })`.
  const events = [...plan.eventLocals].map(([event, local]) => {
    const prop = qwikEventProp(event);
    const property = js.bindingProperty(prop);
    // A name the source takes renames the destructured prop (`{ onChange$: onChange$_1 }`).
    return local === prop
      ? property
      : { ...property, value: js.bindingIdentifier(local), shorthand: false };
  });
  if (parameter?.form === "object") {
    return read.length || plan.emitted.size ? js.bindingIdentifier(parameter.name!) : undefined;
  }
  if (!read.length && !events.length) return undefined;
  // In the order the source destructures them, which may differ from the type's.
  const start = (binding: string) => bindingOf(component, binding).span.start;
  return js.objectPattern([
    ...read
      .toSorted((a, b) => start(a.binding!) - start(b.binding!))
      .map((prop) =>
        js.bindingProperty(
          prop.name,
          prop.default && jsx.placeholders.expression(prop.default.code),
        ),
      ),
    ...events,
  ]);
}

/**
 * The events a component emits, as an exported interface of their QRL props beside the props
 * type (ADR-0047): `export interface CounterEvents { onChange$?: QRL<(value: number) => void>; }`,
 * which the component's props type joins (`CounterProps & CounterEvents`).
 */
function eventsInterface(component: UfComponent, plan: SetupPlan): TypeDeclaration | undefined {
  const declared = component.emits?.events ?? [];
  if (!declared.length) return undefined;
  const name = plan.names.fresh(`${component.name}Events`);
  const qrl = plan.names.core("QRL", { type: true });
  const members = declared.map(
    (event) => `  ${qwikEventProp(event.name)}?: ${qrl}<(${eventParameters(event)}) => void>;`,
  );
  const code = `interface ${name} {\n${members.join("\n")}\n}`;
  return { name, exported: true, code, span: component.emits!.span };
}

/** An event's payload as a listener's parameters: `value: number, note?: string`. */
function eventParameters(event: EventDeclaration): string {
  return event.parameters
    .map((parameter) => `${parameter.name}${parameter.optional ? "?" : ""}: ${parameter.type.code}`)
    .join(", ");
}

/** The names of the authoring APIs code calls (`nextTick`): the output declares its own. */
function apiNames(component: UfComponent): Set<string> {
  const found = new Set<string>();
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) {
      if (reference.kind !== "Api") continue;
      found.add(
        code.code.slice(
          reference.span.start - code.span.start,
          reference.span.end - code.span.start,
        ),
      );
    }
  }
  return found;
}

/** Module-level declarations, one-line `const`s together, a blank line around anything else. */
function joinHoisted(declarations: readonly string[]): string {
  let text = "";
  declarations.forEach((code, index) => {
    if (index > 0)
      text += oneLineConst(declarations[index - 1]!) && oneLineConst(code) ? "\n" : "\n\n";
    text += code;
  });
  return text;
}

/** Whether code is a `const` on one line. */
function oneLineConst(code: string): boolean {
  return !code.includes("\n") && code.startsWith("const ");
}

/**
 * The inline helpers after the component (ADR-0033): the `once` listeners' WeakSets, `nextTick`
 * and `rendered`, each only where the output uses it.
 */
function helpers(plan: SetupPlan, listeners: Listeners): string[] {
  const { names } = plan;
  const found: string[] = [];
  if (listeners.helpers.length) {
    found.push(
      [
        "// The elements each `once` listener ran for: Qwik's listeners have no `once` option.",
        ...listeners.helpers,
      ].join("\n"),
    );
  }
  if (names.has("nextTick")) {
    found.push(
      [
        "/**",
        " * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,",
        " * so they are in the DOM by the next task.",
        " */",
        `function ${names.once("nextTick")}(): Promise<void> {`,
        "  return new Promise((resolve) => setTimeout(resolve));",
        "}",
      ].join("\n"),
    );
  }
  if (names.has("rendered")) {
    found.push(
      [
        "/**",
        " * The element a template ref holds while it is in the document, else `null`: Qwik keeps a",
        " * removed element in its ref, where a template ref is empty once its element is gone (ADR-0049).",
        " */",
        `function ${names.once("rendered")}<T extends Element>(element: T | undefined): T | null {`,
        "  return element?.isConnected ? element : null;",
        "}",
      ].join("\n"),
    );
  }
  return found;
}

/**
 * How Qwik's JSX differs from the defaults (React's shape: ternaries, keyed `.map`, `{expr}`):
 * HTML attributes take the names and value types Qwik's JSX types declare, an attribute they
 * declare no name for is an object spread, and `class` takes Qwik's own forms. Style objects
 * (camelCase keys, which Qwik's renderer writes in kebab case) are the default.
 */
function qwikDialect(
  component: UfComponent,
  module: UfModule,
  namespaces: ReadonlyMap<ElementNode, Namespace>,
  listeners: Listeners,
): JsxDialect {
  const namespaceOf = (element: ElementNode) => namespaces.get(element) ?? "html";
  return {
    eventAttribute: (attribute, element, context) =>
      listeners.attributes(attribute, element, context),
    attributeName: (name, element) => qwikAttributeName(name, namespaceOf(element)),
    staticAttribute(attribute, element, context) {
      // A static `class` beside a spread that carries one merges with it.
      if (attribute.name === "class") return staticJsxAttribute(attribute, element, context);
      const namespace = namespaceOf(element);
      const { name, value: written } = attribute;
      if (isUntypedAttribute(element.tag, namespace, name, written)) {
        return [untypedSpread(name, js.stringLiteral(written === true ? "" : written))];
      }
      const value = qwikStaticValue(element.tag, namespace, name, written);
      return [
        js.jsxAttribute(
          qwikAttributeName(name, namespace),
          value === true
            ? null
            : typeof value === "string"
              ? jsxAttributeValue(value)
              : js.jsxExpressionContainer(context.placeholders.expression(value.code)),
        ),
      ];
    },
    boundAttribute(attribute, element, context) {
      if (!isUntypedAttribute(element.tag, namespaceOf(element), attribute.name)) {
        return boundJsxAttribute(attribute, element, context);
      }
      return [untypedSpread(attribute.name, jsxExpression(attribute.value, context))];
    },
    // One attribute per declared key (ADR-0039), as the default writes them, but a key Qwik's
    // types do not declare is an object spread too. A `class` key joins the element's `class`.
    spreadAttribute(attribute, element, context) {
      const namespace = namespaceOf(element);
      const merged = element.attributes.some(
        (other) => other.kind === "Class" || (other.kind === "Static" && other.name === "class"),
      );
      return attribute.keys
        .filter((key) => !(merged && key.name === "class"))
        .map((key) => {
          const value = spreadRead(attribute, key, context);
          return isUntypedAttribute(element.tag, namespace, key.name)
            ? untypedSpread(key.name, value)
            : js.jsxAttribute(
                qwikAttributeName(key.name, namespace),
                js.jsxExpressionContainer(value),
              );
        });
    },
    classAttribute: (attribute, element, context) =>
      qwikClassAttribute(attribute, element, context, (condition) =>
        isPrimitiveValue(condition, component, module),
      ),
  };
}

/** `{...{ name: value }}`: an attribute under its HTML name, which Qwik's types leave unchecked. */
function untypedSpread(name: string, value: AstExpression): JsxAttribute {
  return js.jsxSpreadAttribute(js.objectExpression([[name.toLowerCase(), value]]));
}
