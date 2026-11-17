import {
  addPassThroughImports,
  addTypeImports,
  componentTypes,
  defineTarget,
  directiveSpecifier,
  hookQueueCode,
  importedDirectives,
  ownDirectives,
  moduleHelperName,
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
  typeExportsCode,
} from "@unframework.dev/codegen";
import type { EmitContext, JsxContext, OutputFile, Target } from "@unframework.dev/codegen";
import type { TypeDeclaration, UfComponent, UfModule } from "@unframework.dev/ir";

import {
  addComposableImports,
  emitComposable,
  moduleReads,
  moduleValueNames,
} from "./composable.ts";
import { SolidComposition } from "./composition.ts";
import { emitDirective, factoryCode, QUEUE_HELPER } from "./directive.ts";
import { typeParameterDeclaration } from "./generics.ts";
import { NEXT_TICK_HELPER, REF_HELPER, STATE_HELPER, WATCHER_HELPER } from "./helpers.ts";
import {
  CLASS_HELPER,
  ENUMERATED_HELPER,
  KEYED_HELPER,
  SCOPE_HELPER,
  solidJsx,
  STYLE_HELPER,
  TELEPORT_HELPER,
} from "./jsx.ts";
import { solidListeners } from "./listeners.ts";
import { ModelHelpers, modelRef } from "./models.ts";
import { BindingTypes, Narrowings } from "./narrowing.ts";
import { solidProps } from "./props.ts";
import { forSolid } from "./render.ts";
import { SolidCode, solidSetup } from "./setup.ts";
import type { SolidResource } from "./setup.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type JsxExpression = ReturnType<typeof jsxNode>;
type Statement = Parameters<typeof js.blockStatement>[0][number];

/**
 * The Solid 2 target, selected as `solid@2` (ADR-0102). Solid's JSX takes HTML attribute names as
 * they are.
 */
export const solid2: Target = defineTarget({
  name: "solid2",
  framework: { package: "solid-js", range: ">=2 <3" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    // Solid 2 lets a read see a write only once it flushes, which an effect's callback or
    // `onSettled` cannot ask for: state goes through an inline helper, `createState`, whose read
    // returns the last write. A watcher and a `watchEffect` go through inline helpers whose
    // scheduler calls each back once per synchronous run of client code, with Vue's previous
    // value, change test and cleanup timing (ADR-0048, ADR-0102).
    interactivity: {
      support: "emulated",
      helper: WATCHER_HELPER,
      note: "Solid 2 lets a read see a write only once it flushes, so state goes through an inline helper, createState, a signal whose read returns the last value written; derived values are functions, listeners event props and hooks onSettled, and a template ref is emptied with its element through clearedRef, as Solid 2 refuses onCleanup in a ref callback. A watcher and a watchEffect go through inline helpers over createReaction, whose scheduler is queued at the write and calls each back once per synchronous run of client code, with Vue's previous value, change test and cleanup timing.",
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
    // Solid 2 applies writes on a microtask, which queues the watchers' run.
    "next-tick": {
      support: "emulated",
      helper: NEXT_TICK_HELPER,
      note: "Solid has no nextTick: it applies writes on a microtask queued at the first write, which queues the watchers' run, so an inline helper resolves a promise two microtasks on.",
    },
    // The props proxy reads each key live, whatever keys a parent passes.
    "late-prop": { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    // Solid 2 writes a boolean as the attribute's presence; Vue writes an enumerated attribute's
    // boolean as its name, `aria-expanded="false"` (ADR-0102).
    "bound-attribute": {
      support: "emulated",
      helper: ENUMERATED_HELPER,
      note: 'Solid 2 writes a boolean as an attribute\'s presence, where Vue writes the boolean of an ARIA attribute and of contenteditable, draggable and spellcheck as its name. So such a value goes through an inline helper, enumeratedValue, that writes "true" or "false" and passes any other value as it is.',
    },
    // Static names and toggles print as Solid 2's own `class` array, and an inline helper joins
    // dynamic parts into one string, as a component's `class` prop takes it (ADR-0038).
    "class-binding": {
      support: "emulated",
      helper: CLASS_HELPER,
      note: "Static names and toggles print as Solid 2's own class array, class={[\"a b\", { on: active() }]}; a dynamic part goes through an inline helper that joins them into one string, as a component's class prop takes it.",
    },
    "style-binding": {
      support: "emulated",
      helper: STYLE_HELPER,
      note: "Solid's style takes kebab-case keys, so a style bound to a value goes through an inline helper that writes an object's camel-case keys in kebab case and splits a declaration list as Vue does (ADR-0065); declarations print as an object.",
    },
    "attribute-spread": {
      support: "emulated",
      helper: ENUMERATED_HELPER,
      note: "A spread is written out per key, and an ARIA or enumerated key goes through enumeratedValue, as a bound one does, so a boolean is written as its name.",
    },
    "raw-html": { support: "native" },
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
    hydration: { support: "native" },
    // One async `createMemo` runs the awaits, and the rest of the setup and the template wait for
    // it in a keyed `<Show>` callback inside `<Loading>` (ADR-0101, ADR-0102). Declared on the
    // targets page: Solid 2 hydrates the subtree in place with the values its server render
    // serializes, so after hydration the awaits don't run again; the rest of the setup does.
    "async-setup": { support: "native" },
    // `<For>` follows the items themselves, so a list goes through an inline helper whose rows
    // follow the source's key (ADR-0096).
    "keyed-identity": {
      support: "emulated",
      helper: KEYED_HELPER,
      note: "Solid's <For> follows the items themselves, so an item replaced by a copy gets a new row. A list goes through an inline helper over <For> whose rows follow the source's key, and a row reads its item and index through accessors.",
    },
    // `<Portal>` throws on the server and renders where it is created (ADR-0098, ADR-0102).
    // A ref factory, `ref={vFocusTrap(() => open())}`, whose hooks run through an inline queue
    // in Vue's order: Solid runs a parent's ref before its children's (ADR-0099).
    directive: {
      support: "emulated",
      helper: QUEUE_HELPER,
      note: "A directive is a ref factory, `ref={vFocusTrap(() => open())}`, Solid 2's own form. Solid runs an element's ref before its children's, so its hooks go through an inline queue, `queueHook`, which runs them in Vue's order once the turn ends.",
    },
    // Solid's transitions are a package of their own, which no output imports (P7, ADR-0100).
    transition: {
      support: "emulated",
      helper: "Transition",
      note: "A `<Transition>` is an inline component, `Transition`, that resolves its child and keeps a leaving element among the nodes it renders until its leave ends, running Vue's classes on each element as it enters and leaves. The server renders the child as it is (ADR-0100).",
    },
    teleport: {
      support: "emulated",
      helper: TELEPORT_HELPER,
      note: "Solid 2's <Portal> inserts its content with no wrapper, but throws on the server and renders where it is created, so a `<Teleport>` goes through an inline helper, `Teleport`, that renders a <Portal> into `to` once the component has mounted, the teleports in the order they rendered (ADR-0098).",
    },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Every name the source declares or reads is taken before the output claims its own
    // (`props`, `Show`, `cx`, `setCount`), so none of them captures a reference (ADR-0035); so is
    // every name the module declares for its components to read, which keep theirs (ADR-0070).
    const names = sourceNames(component, context.module);
    for (const name of freeNames(component, names)) names.delete(name);
    for (const name of moduleValueNames(context.module)) names.add(name);
    // A source's components are joined into one module where it is loaded (ADR-0053): each claims
    // the class, scope, style, keyed list, teleport and directive queue helpers from bases of its own (`cx_1`), past the
    // names any other component declares.
    const index = context.module.components.findIndex((each) => each.name === component.name);
    const reserved = context.module.components.map((each) => {
      const taken = sourceNames(each, context.module);
      for (const name of freeNames(each, taken)) taken.delete(name);
      return taken;
    });
    const bases = [
      CLASS_HELPER,
      ENUMERATED_HELPER,
      SCOPE_HELPER,
      STYLE_HELPER,
      KEYED_HELPER,
      TELEPORT_HELPER,
      QUEUE_HELPER,
      STATE_HELPER,
      REF_HELPER,
    ].map((helper) => {
      const { base, others } = moduleHelperName(helper, reserved, index);
      for (const name of others) names.add(name);
      return [helper, base] as const;
    });
    const scope = new NameScope(names);
    for (const [helper, base] of bases) scope.rebase(helper, base);
    const imports = new ImportSet(scope);
    // The imports that pass through, which the render reads as written (ADR-0064).
    addPassThroughImports(component, context.module, imports);
    // The types it imports, by name (ADR-0067): a child's from its output, `./Field`.
    addTypeImports(component, context.module, imports, (name) => name);
    // The composables it calls, from their outputs (ADR-0069).
    addComposableImports(component, context.module, imports);
    // The directives it applies from `.uf.ts` modules, from their outputs (ADR-0099).
    for (const { specifier, imported, local } of importedDirectives(component, context.module)) {
      imports.add(directiveSpecifier(specifier, imported), imported, { local, exact: true });
    }
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
    const body = [
      ...composition.statements(object).map((text) => placeholders.statements(text)),
      ...setup.statements,
      ...(exposed ? [placeholders.statements(`${exposed}\n`)] : []),
      js.returnStatement(rendered(component, code, narrowings.types, jsx)),
    ];
    const { resource } = setup;
    const fn = js.functionDeclaration(component.name, props.parameters, [
      ...props.statements,
      ...(resource
        ? [...resource.statements, js.returnStatement(pending(resource, body, code))]
        : body),
    ]);
    // A generic component is a generic function, `function List<T>(…)` (ADR-0068).
    fn.typeParameters = typeParameterDeclaration(component, placeholders);
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    const keys = composition.keys().map((text) => placeholders.statements(`${text}\n`));
    // The module's own directives it applies, as ref factories, with the queue they run their
    // hooks through (ADR-0099).
    const own = ownDirectives(component, context.module);
    const queue = own.length ? { name: scope.claim(QUEUE_HELPER) } : undefined;
    const directives = queue
      ? own.map((directive) =>
          placeholders.statements(
            `${factoryCode(directive, { solid: (name) => code.solid(name), queue: queue.name })}\n`,
          ),
        )
      : [];
    // What it reads of its module: its imported values and its constants (ADR-0070).
    const reads = moduleReads(component.name, context.module, imports, placeholders);
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
            types: [
              ...moduleTypes(component, context.module, [...types, ...reads.types]),
              ...(props.events ? [props.events] : []),
              ...composition.types,
            ],
            body: [...keys, ...reads.constants, ...directives, ...setup.hoisted, ...statements],
            helpers: [
              ...helpers(),
              ...code.helpers(),
              ...(queue ? [hookQueueCode(queue.name)] : []),
            ],
            // Collected last: the helpers import what they call.
            imports: [...imports.toDeclarations(), ...sheet],
            placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
  emitComposable,
  emitDirective,
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
    // Solid 2's context is its own provider, `<ThemeKey value={…}>`.
    wrapped = js.jsxElement(
      item.key,
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
 * An async setup's template (ADR-0101): the rest of the setup and the template in the function
 * child of `<Show>`, which runs once the async memo resolves, inside a `<Loading>` with no
 * fallback, so the server render waits for it and a client mount shows nothing until then. A
 * `<Show>` callback, not an inner component: the rest of the setup closes over `props`, which an
 * inner component would read through props of its own, and `solid/reactivity` (L5) reports.
 */
function pending(resource: SolidResource, body: Statement[], code: SolidCode): JsxExpression {
  // Keyed: the child takes the record itself, which Solid 2 reads nowhere but where it tracks.
  const show = js.jsxElement(
    code.solid("Show"),
    [
      js.jsxAttribute(
        "when",
        js.jsxExpressionContainer(js.callExpression(js.identifier(resource.accessor), [])),
      ),
      js.jsxAttribute("keyed", null),
    ],
    [
      js.jsxExpressionContainer(
        js.arrowFunction([js.bindingIdentifier(resource.parameter)], [resource.bindings, ...body]),
      ),
    ],
  );
  return js.jsxElement(code.solid("Loading"), [], [show]);
}

/**
 * The types an output declares, in source order: those it reaches, copied as written, and in
 * the output of the module's main component the module's type exports (ADR-0068), each a
 * statement of its own, `export type { Tone } from "./types";`, that the module prints as it is.
 */
function moduleTypes(
  component: UfComponent,
  module: UfModule,
  types: readonly TypeDeclaration[],
): TypeDeclaration[] {
  const exports = typeExportsCode(component, module, (name) => name).map(({ code, span }) => ({
    name: "",
    exported: false,
    code,
    span,
  }));
  return [...types, ...exports].toSorted((a, b) => a.span.start - b.span.start);
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

export default solid2;
