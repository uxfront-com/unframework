import {
  addPassThroughImports,
  componentTypes,
  composableUse,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  jsxContext,
  jsxNode,
  moduleHelperName,
  NameScope,
  Placeholders,
  printComponentModule,
  sourceNames,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { SolidComposition } from "./composition.ts";
import { NEXT_TICK_HELPER, WATCHER_HELPER } from "./helpers.ts";
import { CLASS_HELPER, SCOPE_HELPER, solidJsx, STYLE_HELPER } from "./jsx.ts";
import { solidListeners } from "./listeners.ts";
import { ModelHelpers, modelRef } from "./models.ts";
import { BindingTypes, Narrowings } from "./narrowing.ts";
import { solidProps } from "./props.ts";
import { forSolid } from "./render.ts";
import { SolidCode, solidSetup } from "./setup.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type JsxExpression = ReturnType<typeof jsxNode>;

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
    "style-binding": {
      support: "emulated",
      helper: STYLE_HELPER,
      note: "Solid's style takes kebab-case keys, so a style bound to a value goes through an inline helper that writes an object's camel-case keys in kebab case and splits a declaration list as Vue does (ADR-0065); declarations print as an object.",
    },
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
      note: "A checkbox group's array goes through an inline helper, `toggle`, a multiple select's through `selectedValues`, and the options of a select that a component, a slot or an interpolation renders through `selectOptions`, as Vue's `vModelCheckbox` and `vModelSelect` do (ADR-0054).",
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
    "scoped-styles": { support: "native" },
    // The child's root picks its styled parents' `data-uf-*` attributes out of its props
    // (ADR-0063): their names are the parents', which the child cannot know.
    "child-root-scope": {
      support: "emulated",
      helper: SCOPE_HELPER,
      note: "A child cannot know the scope attributes its styled parents pass, so an inline helper picks them out of its props by name and spreads them on its root, on each branch of a root conditional and on a root <component is> too, as Vue's fallthrough reaches them.",
    },
    "slotted-styles": { support: "native" },
    // A sheet loads as its module evaluates, in import order, as Vue's does (ADR-0063).
    "sheet-order": { support: "native" },
    "generic-components": { support: "native" },
    "generic-slot-props": { support: "native" },
    composables: { support: "native" },
    // A composable's module has its own watcher queue (ADR-0069).
    "composable-effect-order": {
      support: "unsupported",
      code: "UF4005",
      severity: "info",
      reason:
        "A composable's watchers coalesce in its own module's queue (`createWatcher`), apart from the caller's, so its watchers, effects and hooks cannot take their place among the caller's own, and code that relies on that order may see another (ADR-0069).",
    },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // A composable's call and what a module or a composable gives are declared before this
    // target emits them (ADR-0069, ADR-0070): until its composables lane lands, a component that
    // uses one is reported, never emitted without it (P2).
    const composable = composableUse(component);
    if (composable) {
      context.report({
        code: "UF1002",
        severity: "error",
        message: `The solid target does not emit ${composable.what} yet: it lands with this target's composables lane.`,
        span: composable.span,
      });
      return [];
    }
    // Every name the source declares or reads is taken before the output claims its own
    // (`props`, `Show`, `cx`, `setCount`), so none of them captures a reference (ADR-0035).
    const names = sourceNames(component, context.module);
    for (const name of freeNames(component, names)) names.delete(name);
    // A source's components are joined into one module where it is loaded (ADR-0053): each claims
    // the class and scope helpers from bases of its own (`cx_1`), past the names any other
    // component declares.
    const index = context.module.components.findIndex((each) => each.name === component.name);
    const reserved = context.module.components.map((each) => {
      const taken = sourceNames(each, context.module);
      for (const name of freeNames(each, taken)) taken.delete(name);
      return taken;
    });
    const bases = [CLASS_HELPER, SCOPE_HELPER, STYLE_HELPER].map((helper) => {
      const { base, others } = moduleHelperName(helper, reserved, index);
      for (const name of others) names.add(name);
      return [helper, base] as const;
    });
    const scope = new NameScope(names);
    for (const [helper, base] of bases) scope.rebase(helper, base);
    const imports = new ImportSet(scope);
    // The imports that pass through, which the render reads as written (ADR-0064).
    addPassThroughImports(component, context.module, imports);
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
    const models = new ModelHelpers(imports);
    const listeners = solidListeners(code, imports, placeholders, narrowings, (element, context) =>
      modelRef(element, context, code, models),
    );
    const { dialect, helpers } = solidJsx(
      imports,
      narrowings,
      [component.propsParameter?.type.code ?? "", ...types.map((declaration) => declaration.code)],
      listeners,
      { code, composition, object: props.object, models },
    );
    const jsx = jsxContext({
      component,
      module: context.module,
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
      js.returnStatement(rendered(component, code, narrowings.types, jsx)),
    ]);
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    const keys = composition.keys().map((text) => placeholders.statements(`${text}\n`));
    // The sheet `compile()` emits beside the source, already scoped (ADR-0063), imported after
    // the children's outputs, so a child's sheet loads first, as plugin-vue imports a
    // component's style after its script.
    const file = context.module.file;
    const sheet = component.styles
      ? [js.importDeclaration(`./${file.slice(file.lastIndexOf("/") + 1)}.css`, [])]
      : [];
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            types: [...types, ...(props.events ? [props.events] : []), ...composition.types],
            body: [...keys, ...setup.hoisted, ...statements],
            helpers: [...helpers(), ...code.helpers()],
            // Collected last: the helpers import what they call.
            imports: [...imports.toDeclarations(), ...sheet],
            placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

/**
 * What the component returns: its template, inside the providers of what it provides, the
 * first outermost (ADR-0054). A root that is one component, or one `<component is>`, is printed
 * as it is, not in a fragment.
 */
function rendered(
  component: UfComponent,
  code: SolidCode,
  types: BindingTypes,
  context: JsxContext,
): JsxExpression {
  const render = forSolid(component, code.rules, types);
  const [only] = render.children;
  const root =
    render.kind === "Fragment" &&
    render.children.length === 1 &&
    (only?.kind === "Component" || only?.kind === "Dynamic")
      ? only
      : render;
  let wrapped: JsxExpression = jsxNode(root, context);
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
