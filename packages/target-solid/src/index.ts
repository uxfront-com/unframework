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
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { NEXT_TICK_HELPER, WATCHER_HELPER } from "./helpers.ts";
import { CLASS_HELPER, solidJsx } from "./jsx.ts";
import { solidListeners } from "./listeners.ts";
import { BindingTypes, Narrowings } from "./narrowing.ts";
import { solidProps } from "./props.ts";
import { forSolid } from "./render.ts";
import { SolidCode, solidSetup } from "./setup.ts";

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
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Every name the source declares or reads is taken before the output claims its own
    // (`props`, `Show`, `cx`, `setCount`), so none of them captures a reference (ADR-0035).
    const names = sourceNames(component, context.module);
    for (const name of freeNames(component, names)) names.delete(name);
    const imports = new ImportSet(new NameScope(names));
    const placeholders = new Placeholders();
    const props = solidProps(component, imports, placeholders);
    const code = new SolidCode(component, imports, props);
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
    const { dialect, helpers } = solidJsx(
      imports,
      narrowings,
      [component.propsParameter?.type.code ?? "", ...types.map((declaration) => declaration.code)],
      listeners,
    );
    const jsx = jsxContext({
      component,
      dialect,
      rules: code.rules,
      placeholders,
      includeKeys: false,
    });
    const fn = js.functionDeclaration(component.name, props.parameters, [
      ...props.statements,
      ...setup.statements,
      js.returnStatement(jsxNode(forSolid(component, code.rules, narrowings.types), jsx)),
    ]);
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports,
            types: props.events ? [...types, props.events] : types,
            body: [...setup.hoisted, ...statements],
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
