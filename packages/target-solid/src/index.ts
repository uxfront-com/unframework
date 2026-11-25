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
import type { Span, TypeDeclaration, UfComponent, UfModule } from "@unframework.dev/ir";

import {
  addComposableImports,
  emitComposable,
  moduleReads,
  moduleValueNames,
} from "./composable.ts";
import { SolidComposition } from "./composition.ts";
import { emitDirective, factoryCode, QUEUE_HELPER } from "./directive.ts";
import { REST_HELPER } from "./fallthrough.ts";
import { typeParameterDeclaration } from "./generics.ts";
import { NEXT_TICK_HELPER, WATCHER_HELPER } from "./helpers.ts";
import {
  CLASS_HELPER,
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
import {
  printHelper,
  reserveSharedNames,
  SHARED_HELPER_NAMES,
  SharedHelpers,
} from "./shared-names.ts";
import { importShared } from "./shared.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type JsxExpression = ReturnType<typeof jsxNode>;
type Statement = Parameters<typeof js.blockStatement>[0][number];

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
      note: "Solid has no nextTick: it applies writes to the DOM as it makes them, so a shared helper resolves a promise.",
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
    // `classList`, and a shared helper, `cx`, joins dynamic parts with them (ADR-0038, ADR-0121).
    "class-binding": {
      support: "emulated",
      helper: CLASS_HELPER,
      note: "Solid's class takes one string, so a helper shared in the tree's _unframework/ joins dynamic parts with the static names and toggles; static names and toggles alone print as class and classList.",
    },
    "style-binding": {
      support: "emulated",
      helper: STYLE_HELPER,
      note: "Solid's style takes kebab-case keys, so a style bound to a value goes through a shared helper, `styleProperties`, that writes an object's camel-case keys in kebab case and splits a declaration list as Vue does (ADR-0065); declarations print as an object.",
    },
    "attribute-spread": { support: "native" },
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
      note: "A checkbox group's array goes through an inline helper, `toggle`, a multiple select's through an inline `selectedValues`, and the options of a select that a component, a slot or an interpolation renders through a shared `selectOptions`, as Vue's `vModelCheckbox` and `vModelSelect` do (ADR-0054).",
    },
    "model-modifiers": {
      support: "emulated",
      helper: "modelText",
      note: "A `v-model`'s modifiers and a number control's cast follow Vue's `vModelText` through a shared helper, `modelText` (ADR-0054).",
    },
    // Solid's `splitProps` takes what a component declares out of its props, and its root
    // spreads the others after its own attributes, its own listeners calling the consumer's
    // (ADR-0118, src/fallthrough.ts).
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    // `props.ref?.(api)` in `untrack`, and on a component that exposes nothing, the root element:
    // Solid passes `ref` as a prop, which the root's spread hands the element (ADR-0118).
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
      note: "A child cannot know the scope attributes its styled parents pass, so a root that takes what falls through takes them with it, and a shared helper, `scopeAttributes`, picks them out of its props by name for any other root: each branch of a root conditional, a root <component is>, and the root of a component that spreads the props' rest on another element, whose rest leaves them out through a second helper, `restAttributes`, as Vue's fallthrough reaches them.",
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
    // One `createResource` runs the awaits, and the rest of the setup and the template wait for
    // it in a `<Show>` callback inside `<Suspense>` (ADR-0101). Declared there and on the targets
    // page: after hydration Solid creates that subtree again once the setup resolves, so focus
    // and selection inside it reset; with the data its server render serializes by default, the
    // client hydrates in place and doesn't run the setup again; a rejected setup throws from the
    // resource's read.
    "async-setup": { support: "native" },
    // `<For>` follows the items themselves, so a list goes through a shared helper whose rows
    // follow the source's key (ADR-0096).
    "keyed-identity": {
      support: "emulated",
      helper: KEYED_HELPER,
      note: "Solid's <For> follows the items themselves, so an item replaced by a copy gets a new row. A list goes through a shared helper, `KeyedFor`, over <For> whose rows follow the source's key, and a row reads its item and index through accessors.",
    },
    // `<Portal>` wraps its content in a `<div>` (ADR-0098).
    // A ref factory, `ref={vFocusTrap(() => open())}`, whose hooks run through a shared queue
    // in Vue's order: Solid runs a parent's ref before its children's (ADR-0099).
    directive: {
      support: "emulated",
      helper: QUEUE_HELPER,
      note: "A directive is a ref factory, `ref={vFocusTrap(() => open())}`, Solid 2's own form. Solid runs an element's ref before its children's, so its hooks go through a shared queue, `queueHook`, which runs them in Vue's order once the turn ends.",
    },
    // Solid's transitions are a package of their own, which no output imports (P7, ADR-0100).
    transition: {
      support: "emulated",
      helper: "Transition",
      note: "A `<Transition>` is a shared component, `Transition`, that resolves its child and keeps a leaving element among the nodes it renders until its leave ends, running Vue's classes on each element as it enters and leaves. The server renders the child as it is (ADR-0100).",
    },
    teleport: {
      support: "emulated",
      helper: TELEPORT_HELPER,
      note: "Solid's <Portal> wraps its content in a <div>, so a `<Teleport>` goes through a shared helper, `Teleport`, that inserts its one element into `to` once the component has mounted, as <Portal> does in <head> (ADR-0098).",
    },
  },
  emit(component: UfComponent, context: EmitContext): Array<OutputFile> {
    // Every name the source declares or reads is taken before the output claims its own
    // (`props`, `Show`, `cx`, `setCount`), so none of them captures a reference (ADR-0035); so is
    // every name the module declares for its components to read, which keep theirs (ADR-0070).
    const names = sourceNames(component, context.module);
    for (const name of freeNames(component, names)) {
      names.delete(name);
    }
    for (const name of moduleValueNames(context.module)) {
      names.add(name);
    }
    // With `helper`, the helpers one text serves are shared modules (ADR-0121); without it, inline.
    // A source's components are joined into one module where it is loaded (ADR-0053): each claims
    // the helpers it prints inline from bases of its own (`cx_1`), past the names any other
    // component declares.
    const shared = context.helper ? new SharedHelpers() : undefined;
    const index = context.module.components.findIndex((each) => each.name === component.name);
    const reserved = context.module.components.map((each) => {
      const taken = sourceNames(each, context.module);
      for (const name of freeNames(each, taken)) {
        taken.delete(name);
      }
      return taken;
    });
    const bases = [
      CLASS_HELPER,
      SCOPE_HELPER,
      STYLE_HELPER,
      KEYED_HELPER,
      TELEPORT_HELPER,
      QUEUE_HELPER,
      REST_HELPER,
    ]
      .filter((helper) => !shared || !SHARED_HELPER_NAMES.includes(helper))
      .map((helper) => {
        const { base, others } = moduleHelperName(helper, reserved, index);
        for (const name of others) {
          names.add(name);
        }
        return [helper, base] as const;
      });
    // A shared helper (ADR-0121) is imported by every component of the source under one name,
    // the module's own unless a component declares it, so their imports are one line in the join.
    if (shared) {
      reserveSharedNames(names, reserved);
    }
    const scope = new NameScope(names);
    for (const [helper, base] of bases) {
      scope.rebase(helper, base);
    }
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
    const code = new SolidCode(component, imports, props, composition, shared);
    const setup = solidSetup(code, placeholders);
    const types = componentTypes(component, context.module);
    // The branch callbacks around what prints, which listeners read through too.
    const narrowings = new Narrowings(
      imports,
      names,
      component,
      new BindingTypes(component, context.module.types),
    );
    const models = new ModelHelpers(imports, shared);
    // What falls through (ADR-0118): the props but what the component declares and what the
    // element that takes them merges itself, `const [, others] = splitProps(props, ["title"]);`.
    const { plan } = composition;
    const split = plan?.target && plan.split.length ? plan.split : undefined;
    // The elements that spread what falls through render through `ssrElement`.
    const spreads = [
      ...(plan?.target ? [plan.target.span] : []),
      ...(plan?.root && plan.rootScope ? [plan.root.span] : []),
    ];
    const others = split ? imports.claim(plan!.rest ? "rest" : "others") : props.object;
    const splitStatements = split
      ? [
          placeholders.statements(
            `const [, ${others}] = ${code.solid("splitProps")}(${props.object!}, [${split.map((name) => JSON.stringify(name)).join(", ")}]);\n`,
          ),
        ]
      : [];
    const listeners = solidListeners(
      code,
      imports,
      placeholders,
      narrowings,
      (element, context) => modelRef(element, context, code, models),
      // A root element that takes the consumer's `ref` beside its own callback (ADR-0118).
      (element) =>
        plan?.root?.kind === "Element" &&
        plan.root.span.start === element.span.start &&
        plan.root.span.end === element.span.end
          ? `${props.object!}.ref`
          : undefined,
    );
    const { dialect, helpers } = solidJsx(
      imports,
      narrowings,
      [component.propsParameter?.type.code ?? "", ...types.map((declaration) => declaration.code)],
      listeners,
      { code, composition, object: props.object, models, others },
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
      js.returnStatement(rendered(component, code, narrowings.types, jsx, spreads)),
    ];
    const { resource } = setup;
    const fn = js.functionDeclaration(component.name, props.parameters, [
      ...props.statements,
      ...splitStatements,
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
    const printed = [
      ...helpers(),
      ...code.helpers(),
      ...(queue ? printHelper(shared, QUEUE_HELPER, queue.name, hookQueueCode) : []),
    ];
    const path = `${component.name}.tsx`;
    if (context.helper && shared) {
      importShared(context.helper, path, imports, shared.used);
    }
    return [
      {
        path,
        contents: printComponentModule(
          {
            types: [
              ...moduleTypes(component, context.module, [...types, ...reads.types]),
              ...(props.events ? [props.events] : []),
              ...composition.types,
            ],
            body: [...keys, ...reads.constants, ...directives, ...setup.hoisted, ...statements],
            helpers: printed,
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
  spreads: ReadonlyArray<Span>,
): JsxExpression {
  const render = forSolid(component, code.rules, types, spreads);
  const [only] = render.children;
  const root =
    render.kind === "Fragment" &&
    render.children.length === 1 &&
    (only?.kind === "Component" || only?.kind === "Dynamic")
      ? only
      : render;
  let wrapped: JsxExpression = jsxNode(root, context);
  for (const item of component.setup.toReversed()) {
    if (item.kind !== "Provide") {
      continue;
    }
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
 * An async setup's template (ADR-0101): the rest of the setup and the template in the function
 * child of `<Show>`, which runs once the resource resolves, inside a `<Suspense>` with no
 * fallback, so the server render waits for it and a client mount shows nothing until then. A
 * `<Show>` callback, not an inner component: the rest of the setup closes over `props`, which an
 * inner component would read through props of its own, and `solid/reactivity` (L5) reports.
 */
function pending(resource: SolidResource, body: Array<Statement>, code: SolidCode): JsxExpression {
  const show = js.jsxElement(
    code.solid("Show"),
    [
      js.jsxAttribute(
        "when",
        js.jsxExpressionContainer(js.callExpression(js.identifier(resource.accessor), [])),
      ),
    ],
    [
      js.jsxExpressionContainer(
        js.arrowFunction([js.bindingIdentifier(resource.parameter)], [resource.bindings, ...body]),
      ),
    ],
  );
  return js.jsxElement(code.solid("Suspense"), [], [show]);
}

/**
 * The types an output declares, in source order: those it reaches, copied as written, and in
 * the output of the module's main component the module's type exports (ADR-0068), each a
 * statement of its own, `export type { Tone } from "./types";`, that the module prints as it is.
 */
function moduleTypes(
  component: UfComponent,
  module: UfModule,
  types: ReadonlyArray<TypeDeclaration>,
): Array<TypeDeclaration> {
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
function freeNames(component: UfComponent, names: ReadonlySet<string>): Array<string> {
  const bindings = new Set(component.bindings.map((binding) => binding.name));
  return ["onCleanup", NEXT_TICK_HELPER].filter((name) => names.has(name) && !bindings.has(name));
}

export default solid;
