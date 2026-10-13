import {
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  jsxContext,
  jsxNode,
  NameScope,
  Placeholders,
  printComponentModule,
  sourceNames,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { SolidComposition } from "./composition.ts";
import { NEXT_TICK_HELPER, WATCHER_HELPER } from "./helpers.ts";
import { CLASS_HELPER, solidJsx } from "./jsx.ts";
import { solidListeners } from "./listeners.ts";
import { BindingTypes, Narrowings } from "./narrowing.ts";
import { solidProps } from "./props.ts";
import { forSolid } from "./render.ts";
import { SolidCode, solidSetup } from "./setup.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type JsxExpression = ReturnType<typeof jsxNode>;
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;

/** The Solid 1.9 target. Solid's JSX takes HTML attribute names as they are. */
export const solid: Target = defineTarget({
  name: "solid",
  framework: { package: "solid-js", range: ">=1.9 <2" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    // Signals, memos, listeners and lifecycle hooks are Solid's own. Solid runs what a write
    // triggers as the write is made, so a watcher and a `watchEffect` go through an inline helper
    // whose scheduler calls each back once per synchronous run of client code, with Vue's
    // previous value, change test and cleanup timing (ADR-0048).
    interactivity: {
      support: "emulated",
      helper: WATCHER_HELPER,
      note: "State, derived values, listeners and lifecycle hooks are Solid's signals, memos, event props and onMount; a watcher and a watchEffect go through an inline helper over createReaction, whose scheduler calls each back once per synchronous run of client code, with Vue's previous value, change test and cleanup timing.",
    },
    // A listener with an option is a native listener with its options (`on:click={{ … }}`).
    "event-capture": { support: "native" },
    "event-once": { support: "native" },
    "event-passive": { support: "native" },
    // Solid's compiler delegates 22 events (`click`, `input`, `keydown`…) to one listener on the
    // document, which walks the event's path from its target, so their order and
    // `stopPropagation()` hold among them; it listens natively to every other event (`focus`,
    // `blur`, `change`, `submit`), which keeps its own DOM semantics. Where a component also
    // listens natively to a delegated event after its target, all its listeners of that event
    // are native (src/listeners.ts, ADR-0047).
    "event-semantics": { support: "native" },
    // Listeners run their handlers as the event is dispatched, controls and calls included.
    "conditional-event-control": { support: "native" },
    "use-id": { support: "native" },
    // Solid applies a write to the DOM as it is made, so a microtask is enough.
    "next-tick": {
      support: "emulated",
      helper: NEXT_TICK_HELPER,
      note: "Solid has no nextTick: it applies writes to the DOM as it makes them, so an inline helper resolves a promise.",
    },
    // The props proxy reads each key live, whatever keys a parent passes.
    "late-prop": { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    // Solid's `class` takes one string: static names and toggles print as `class` and
    // `classList`, and an inline helper joins dynamic parts with them (ADR-0038).
    "class-binding": {
      support: "emulated",
      helper: CLASS_HELPER,
      note: "Solid's class takes one string, so an inline helper joins dynamic parts with the static names and toggles; static names and toggles alone print as class and classList.",
    },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
    component: { support: "native" },
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": { support: "native" },
    "scoped-slot": { support: "native" },
    "slot-fallback": { support: "native" },
    "default-slot-presence": { support: "native" },
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
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": {
      support: "emulated",
      helper: "refObject",
      note: "A provided ref is passed as an object with a `value` getter, `refObject`, which descendants read as it changes (ADR-0054).",
    },
    "dynamic-component": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Every name the source declares or reads is taken before the output claims its own
    // (`props`, `Show`, `cx`, `setCount`), so none of them captures a reference (ADR-0035).
    const names = sourceNames(component, context.module);
    for (const name of freeNames(component, names)) names.delete(name);
    const imports = new ImportSet(new NameScope(names));
    const placeholders = new Placeholders();
    const composition = new SolidComposition(component, context.module, imports);
    const props = solidProps(component, imports, placeholders, {
      types: composition.parameterTypes(),
      reads: composition.reads,
    });
    const code = new SolidCode(component, imports, props, composition);
    const setup = solidSetup(code, placeholders);
    const types = componentTypes(component, context.module);
    // The branch callbacks around what prints, which listeners read through too.
    const narrowings = new Narrowings(
      imports,
      names,
      component,
      new BindingTypes(component, context.module.types),
    );
    const listeners = solidListeners(code, imports, placeholders, narrowings);
    const { dialect, helpers, fallthrough } = solidJsx(
      imports,
      narrowings,
      [component.propsParameter?.type.code ?? "", ...types.map((declaration) => declaration.code)],
      listeners,
      { code, composition, object: props.object },
    );
    const jsx = jsxContext({
      component,
      dialect,
      rules: code.rules,
      placeholders,
      includeKeys: false,
    });
    const object = props.object ?? "";
    const exposed = composition.expose(object);
    const fn = js.functionDeclaration(component.name, props.parameters, [
      ...props.statements,
      ...composition.statements(object).map((text) => placeholders.statements(text)),
      ...setup.statements,
      ...(exposed ? [placeholders.statements(`${exposed}\n`)] : []),
      js.returnStatement(rendered(component, code, narrowings.types, jsx, fallthrough)),
    ]);
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    const keys = composition.keys().map((text) => placeholders.statements(`${text}\n`));
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports,
            types: [...types, ...(props.events ? [props.events] : []), ...composition.types],
            body: [...keys, ...setup.hoisted, ...statements],
            helpers: [...helpers(), ...code.helpers()],
            placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

/**
 * What the component returns: its template, with what falls through added to its root where
 * the root has no `class` or `style` of its own, inside the providers of what it provides, the
 * first outermost (ADR-0054). A root that is one component, or one `<component is>`, is printed
 * as it is, not in a fragment.
 */
function rendered(
  component: UfComponent,
  code: SolidCode,
  types: BindingTypes,
  context: JsxContext,
  fallthrough: (context: JsxContext) => JsxAttribute[],
): JsxExpression {
  const render = forSolid(component, code.rules, types);
  const [only] = render.children;
  const root =
    render.kind === "Fragment" &&
    render.children.length === 1 &&
    (only?.kind === "Component" || only?.kind === "Dynamic")
      ? only
      : render;
  const printed = jsxNode(root, context);
  if (printed.type === "JSXElement")
    printed.openingElement.attributes.push(...fallthrough(context));
  let wrapped: JsxExpression = printed;
  for (const item of component.setup.toReversed()) {
    if (item.kind !== "Provide") continue;
    const value = context.placeholders.expression(code.provided(item.key, item.value));
    wrapped = js.jsxElement(
      `${item.key}.Provider`,
      [js.jsxAttribute("value", js.jsxExpressionContainer(value))],
      [
        wrapped.type === "JSXElement" || wrapped.type === "JSXFragment"
          ? wrapped
          : js.jsxExpressionContainer(wrapped),
      ],
    );
  }
  return wrapped;
}

/**
 * The source names an output may take for its own (ADR-0045): `onCleanup`, the name a watcher's
 * or `watchEffect`'s cleanup parameter is given, which Solid's import of that name serves, and
 * `nextTick`, the authoring API the output's helper replaces. Every use of them in the source is
 * a parameter or a local, which shadows the module's own where it is declared, or the API's call;
 * a component's binding of either name keeps it taken.
 */
function freeNames(component: UfComponent, names: ReadonlySet<string>): string[] {
  const bindings = new Set(component.bindings.map((binding) => binding.name));
  return ["onCleanup", NEXT_TICK_HELPER].filter((name) => names.has(name) && !bindings.has(name));
}

export default solid;
