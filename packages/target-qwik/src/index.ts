import {
  addPassThroughImports,
  bindingOf,
  boundJsxAttribute,
  childImports,
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  expressionCode,
  ImportSet,
  js,
  jsxAttributeValue,
  jsxContext,
  jsxDynamic,
  jsxElement,
  jsxExpression,
  jsxNode,
  keyImports,
  keyOwner,
  mapCall,
  moduleHelperName,
  printComponentModule,
  rewriteExpression,
  scopeRoots,
  sourceNames,
  spreadRead,
  staticJsxAttribute,
  ternaryChain,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, JsxDialect, OutputFile, Target } from "@unframework/codegen";
import { codeOf } from "@unframework/ir";
import { childrenOf, walk } from "@unframework/ir";
import type {
  BindingId,
  DynamicNode,
  ElementNode,
  EventAttribute,
  EventDeclaration,
  FragmentNode,
  ModelAttribute,
  RenderNode,
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
import {
  componentHandler,
  fillExpressions,
  keyType,
  fillAttribute,
  isRenderProp,
  modelAttribute,
  modelCallback,
  modelOptions,
  modelWriter,
  optionSelected,
  readsRenderLocal,
  RenderLocals,
  slotOutlet,
  textOptionSelected,
  withLocals,
  slotProp,
} from "./composition.ts";
import { qwikEventProp } from "./events.ts";
import { Listeners } from "./listeners.ts";
import { OutputNames, planSetup } from "./plan.ts";
import type { SetupPlan } from "./plan.ts";
import { exposeStatement, fillFunction, printSetup } from "./setup.ts";
import { qwikTitles } from "./title.ts";
import { isPrimitiveValue } from "./values.ts";

/** The scope helper's name, before the name scope makes it unique. */
const SCOPE_HELPER = "scopeAttributes";

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
    "scoped-styles": { support: "native" },
    // The child's root picks its styled parents' `data-uf-*` attributes out of its props
    // (ADR-0063): their names are the parents', which the child cannot know.
    "child-root-scope": {
      support: "emulated",
      helper: SCOPE_HELPER,
      note: "A child cannot know the scope attributes its styled parents pass, so an inline helper picks them out of its props by name and spreads them on its root.",
    },
    "slotted-styles": { support: "native" },
    // Sheets cascade in render order, not Vue's import order (ADR-0063): declared, since a
    // parent sees too little of its subtree to attach its sheets in Vue's order.
    "sheet-order": {
      support: "unsupported",
      code: "UF4002",
      severity: "info",
      reason:
        "Qwik adds a component's sheet to the page when the component first renders (`useStyles$`): a parent's before its children's, and siblings in the order they render, where Vue loads them in import order, a child's first. Where two sheets' rules of equal specificity meet on one element (a child's root, content filled into a slot, `:deep()`, `:global()`), the winner can differ. Qwik's server render also writes the sheet as a `<style>` element where the component renders, before its root, which `:first-child`, `:nth-child()` and `+` count in the server's markup.",
    },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { module } = context;
    // Every name the source declares or reads is taken before the output names its own, but for
    // the authoring APIs code calls (`nextTick`), which the output replaces with its own.
    const ownNames = (each: UfComponent) => {
      const names = sourceNames(each, module);
      for (const name of apiNames(each)) names.delete(name);
      return names;
    };
    const reserved = ownNames(component);
    const imports = new ImportSet(reserved);
    // A source's components are joined into one module where it is loaded (ADR-0053): each
    // claims the scope helper from a base of its own (`scopeAttributes_1`), past the names any
    // other component declares.
    const { base, others } = moduleHelperName(
      SCOPE_HELPER,
      module.components.map(ownNames),
      module.components.findIndex((each) => each.name === component.name),
    );
    imports.reserve(...others);
    imports.scope.rebase(SCOPE_HELPER, base);
    // The imports that pass through, which the render reads as written (ADR-0064).
    addPassThroughImports(component, module, imports);
    // Each child's output by the name the template uses (ADR-0053), and each key from the output
    // of its module's main component (ADR-0054). A component that renders itself names its own
    // `const`.
    const children = childImports(component, module, (name) => name);
    for (const child of children) {
      if (child.self) continue;
      if (child.export === "default") {
        imports.addDefault(child.specifier, child.local, { exact: true });
      } else {
        imports.add(child.specifier, child.name, { local: child.local, exact: true });
      }
    }
    for (const key of keyImports(component, module, (name) => name)) {
      if (key.specifier) imports.add(key.specifier, key.name, { local: key.local, exact: true });
    }
    const componentFn = imports.add("@qwik.dev/core", "component$");
    const names = new OutputNames(imports);
    const plan = planSetup(component, module, names);
    const scope = scopePlan(component, names);
    const listeners = new Listeners(plan);
    // The dialect reads the namespaces of the tree it prints, which is the render tree with
    // Qwik's form of each `<title>`: they are filled in once that tree is built.
    const namespaces = new Map<ElementNode, Namespace>();
    const options = new Map<ElementNode, ModelAttribute>();
    const followed = new Set<RenderNode>();
    // What the render reads before it returns: `<component is>`'s `const`, the values of the
    // form controls a `v-model` binds (./composition.ts).
    const locals = new RenderLocals(plan);
    const jsx = jsxContext({
      component,
      module,
      dialect: qwikDialect(
        component,
        module,
        namespaces,
        options,
        followed,
        listeners,
        plan,
        locals,
        scope,
      ),
      rules: plan.rules(),
    });
    const render = qwikTitles(component.render, jsx, module);
    for (const [element, namespace] of elementNamespaces(render))
      namespaces.set(element, namespace);
    for (const [option, model] of modelOptions(render)) {
      options.set(option, model);
      // An option without a `value` is selected by its text.
      const valued = option.attributes.some(
        (attribute) =>
          (attribute.kind === "Static" || attribute.kind === "Bound") && attribute.name === "value",
      );
      const selected = valued ? undefined : textOptionSelected(option, model, jsx, plan, locals);
      if (selected) option.attributes = [selected, ...option.attributes];
    }
    for (const node of replacedBeforeSiblings(render)) followed.add(node);
    for (const attribute of listsInFills(render)) listeners.explicit.add(attribute);
    const setup = printSetup(plan);
    const root = jsxNode(render, jsx);
    if (plan.composition.fallthrough) mergeFallthrough(root, plan.composition.fallthrough);
    const returned = js.returnStatement(root);
    // The sheet `compile()` emits beside the source, already scoped (ADR-0063), as a string
    // Qwik attaches once per component: `useStyles$(styles)`.
    const sheet = component.styles && {
      specifier: `./${module.file.slice(module.file.lastIndexOf("/") + 1)}.css?inline`,
      local: names.fresh("styles"),
    };
    const body = [
      sheet ? `${names.core("useStyles$")}(${sheet.local});` : "",
      setup.body,
      exposeStatement(plan),
      locals.statements.join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");
    const events = eventsInterface(component, plan);
    const slots = slotsInterface(component, plan);
    const models = modelsInterface(component, plan);
    const parameter = propsParameter(component, jsx, plan, scope);
    const propsType = [
      component.propsParameter?.type.code,
      events?.name,
      models?.name,
      slots?.name,
      ownProps(component, plan),
    ].filter((type) => type !== undefined);
    // The rest the root picks the scope attributes out of needs a props type to destructure.
    if (scope && !propsType.length) propsType.push("object");
    const definition = js.callExpression(
      js.identifier(componentFn),
      [
        js.arrowFunction(parameter ? [parameter] : [], [
          ...(body ? [jsx.placeholders.statements(`${body}\n`)] : []),
          returned,
        ]),
      ],
      propsType.length ? [jsx.placeholders.type(propsType.join(" & "))] : [],
    );
    const hoisted = setup.hoisted.length
      ? [jsx.placeholders.statements(`${joinHoisted(setup.hoisted)}\n`)]
      : [];
    const keys = keyDeclarations(component, module, plan);
    const exported = exportsOf(component.name, module.exports);
    // A component that renders itself refers to its own `const` (ADR-0053).
    const helperCode = helpers(plan, listeners);
    if (scope) helperCode.push(scopeAttributesHelper(scope.helper));
    // The sheet's import comes after the other imports, as on the other targets: an `?inline`
    // import loads nothing, and `useStyles$` attaches the sheet as the component first renders
    // (`sheet-order`). Collected last: the types and the helpers import what they name.
    const declarations = [
      ...imports.toDeclarations(),
      ...(sheet
        ? [js.importDeclaration(sheet.specifier, [js.importDefaultSpecifier(sheet.local)])]
        : []),
    ];
    const declared = children.some((child) => child.self)
      ? [
          js.variableDeclaration("const", component.name, definition),
          ...exported.map((entry) =>
            entry.kind === "default"
              ? js.exportDefault(js.identifier(component.name))
              : js.exportList(component.name, [entry.name]),
          ),
        ]
      : exportDeclaration(component.name, definition, exported);
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports: declarations,
            types: [
              ...componentTypes(component, module),
              ...(events ? [events] : []),
              ...(models ? [models] : []),
              ...(slots ? [slots] : []),
            ],
            body: [
              ...(keys ? [jsx.placeholders.statements(`${keys}\n`)] : []),
              ...hoisted,
              ...declared,
            ],
            helpers: helperCode,
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
type JsxAttributeNode = ReturnType<typeof js.jsxAttribute>;

/**
 * Where the scope attributes of the styled parents that render the component land (the
 * child-root rule, ADR-0063): each of its root nodes (`scopeRoots`) spreads
 * `{...scopeAttributes(attributes)}`, picked out of its props.
 */
interface ScopePlan {
  /** The root nodes still to spread them on, by `start:end` of their spans. */
  pending: Set<string>;
  /** What the roots pick them out of: the props pattern's rest, or the props object. */
  props: string;
  /** The inline helper that picks them. */
  helper: string;
}

/** The component's {@link ScopePlan}, or none where Vue gives no node the attributes. */
function scopePlan(component: UfComponent, names: OutputNames): ScopePlan | undefined {
  const roots = scopeRoots(component);
  if (!roots.length) return undefined;
  const parameter = component.propsParameter;
  return {
    pending: new Set(roots.map(spanKey)),
    props: parameter?.form === "object" ? parameter.name! : names.fresh("attributes"),
    helper: names.once(SCOPE_HELPER),
  };
}

/** A span's key in {@link ScopePlan.pending}. */
function spanKey({ start, end }: { start: number; end: number }): string {
  return `${start}:${end}`;
}

/**
 * `child-root-scope`: the scope attributes a component's styled parents pass it (ADR-0063),
 * which its root carries. Their names are the parents' ids, which the component cannot know, so
 * it picks the props' `data-uf-*` keys by name, each with the empty value the parent passes: a
 * rest spread alone would also pass on the props the output leaves unread.
 */
function scopeAttributesHelper(name: string): string {
  return `/** The scope attributes of the styled parents that render this component, for its root. */
function ${name}(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}`;
}

/**
 * The props as `component$`'s parameter, typed by its type argument (`component$<Props>`,
 * ADR-0034): the source's destructuring, with its defaults, or its `props` object. A prop
 * no printed expression reads is left out (an unused binding fails L5), and so is the whole
 * parameter when none is read. Qwik's optimizer turns destructured props into reactive reads
 * of the props object, and applies a default as `??` (ADR-0034: the analyser rejects a default
 * on a prop that admits `null`, so `??` and destructuring agree). A component whose root takes
 * its styled parents' scope attributes destructures the rest of its props too (`...attributes`).
 */
function propsParameter(
  component: UfComponent,
  jsx: JsxContext,
  plan: SetupPlan,
  scope: ScopePlan | undefined,
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
  const composition = compositionProps(plan);
  if (parameter?.form === "object") {
    return read.length || plan.emitted.size || composition.length || scope
      ? js.bindingIdentifier(parameter.name!)
      : undefined;
  }
  if (!read.length && !events.length && !composition.length && !scope) return undefined;
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
    ...composition.map(([prop, local]) => {
      const property = js.bindingProperty(prop);
      return local === prop
        ? property
        : { ...property, value: js.bindingIdentifier(local), shorthand: false };
    }),
    ...(scope ? [js.bindingRestElement(scope.props)] : []),
  ]);
}

/**
 * The props composition adds that the component reads, each with its local: its models and
 * their callbacks, its render-prop slots, the `class` and `style` that fall through, and the
 * `ref` it exposes through (./composition.ts).
 */
function compositionProps(plan: SetupPlan): [prop: string, local: string][] {
  const { composition } = plan;
  const found: [string, string][] = [];
  for (const model of composition.models.values()) {
    found.push([model.name, model.prop]);
    if (model.written) found.push([model.callbackProp, model.callback]);
  }
  for (const [slot, local] of composition.slots) found.push([slotProp(slot), local]);
  if (composition.fallthrough) {
    found.push(["class", composition.fallthrough.className]);
    found.push(["style", composition.fallthrough.style]);
  }
  if (composition.expose) found.push(["ref", composition.expose.ref]);
  return found;
}

/**
 * The slots a component declares as QRL render props (ADR-0054), as an exported interface beside
 * its props type: `export interface CardSlots { title$?: QRL<() => JSXOutput>; }`. The default
 * slot without props is projected, and is no prop.
 */
function slotsInterface(component: UfComponent, plan: SetupPlan): TypeDeclaration | undefined {
  const declared = (component.slots?.slots ?? []).filter((slot) =>
    isRenderProp(component, slot.name),
  );
  if (!declared.length) return undefined;
  const name = plan.names.fresh(`${component.name}Slots`);
  const qrl = plan.names.core("QRL", { type: true });
  const output = plan.names.core("JSXOutput", { type: true });
  const members = declared.map(
    (slot) =>
      `  ${slotProp(slot.name)}?: ${qrl}<(${slot.props ? `props: ${slot.props.code}` : ""}) => ${output}>;`,
  );
  const code = `interface ${name} {\n${members.join("\n")}\n}`;
  return { name, exported: true, code, span: component.slots!.span };
}

/**
 * The models a component declares (ADR-0054), each a prop and its change callback, as an
 * exported interface beside its props type: `export interface StepperModels { value?: number;
 * onValueChange$?: QRL<(value: number) => void>; }`.
 */
function modelsInterface(component: UfComponent, plan: SetupPlan): TypeDeclaration | undefined {
  const models = [...plan.composition.models.values()];
  const [first] = models;
  if (!first) return undefined;
  const name = plan.names.fresh(`${component.name}Models`);
  const qrl = plan.names.core("QRL", { type: true });
  const members = models.flatMap(({ item, name: model, callbackProp }) => {
    const type = item.type?.code ?? "unknown";
    return [
      `  ${model}${item.required ? "" : "?"}: ${type};`,
      `  ${callbackProp}?: ${qrl}<(${model}: ${type}) => void>;`,
    ];
  });
  const code = `interface ${name} {\n${members.join("\n")}\n}`;
  return { name, exported: true, code, span: first.item.span };
}

/**
 * The props every component of its kind takes, as a type literal: `class` and `style` where
 * they fall through, and the `ref` a component that exposes functions fills.
 */
function ownProps(component: UfComponent, plan: SetupPlan): string | undefined {
  const members: string[] = [];
  if (plan.composition.fallthrough) {
    members.push(
      `class?: ${plan.names.core("ClassList", { type: true })}`,
      `style?: ${plan.names.core("CSSProperties", { type: true })}`,
    );
  }
  // The signal of a consumer's component ref, which the component fills (`exposeRef`): of
  // `object`, as Qwik's lint (`qwik/valid-lexical-scope`) refuses a captured signal whose type
  // holds functions, and the consumer's ref type names the exposed functions as plain ones.
  if (component.exposes)
    members.push(`ref?: ${plan.names.core("Signal", { type: true })}<object | undefined>`);
  return members.length ? `{ ${members.join("; ")} }` : undefined;
}

/**
 * The injection keys of the module (ADR-0054), declared in the output of its main component:
 * `export const ThemeKey = createContextId<Theme>("uf.theme");`. A key that holds a ref holds
 * Qwik's signal, which is provided itself.
 */
function keyDeclarations(
  component: UfComponent,
  module: UfModule,
  plan: SetupPlan,
): string | undefined {
  if (!module.keys?.length || keyOwner(module.components, module.exports) !== component.name) {
    return undefined;
  }
  const create = plan.names.core("createContextId");
  return module.keys
    .map(
      (key) =>
        `export const ${key.name} = ${create}<${keyType(key.type.code, plan.names)}>(${JSON.stringify(key.description)});`,
    )
    .join("\n");
}

/**
 * Merges the `class` and `style` a consumer passes into the root (`fallthrough`): the class
 * tokens after the root's own, `class={["tag", className]}`, and the style's declarations after
 * the root's, `style={{ padding: "2px", ...style }}`, so the consumer's win (ADR-0054).
 */
function mergeFallthrough(
  root: AstExpression,
  { className, style }: { className: string; style: string },
): void {
  // A component at the root is the only child of a fragment.
  const [only] = root.type === "JSXFragment" ? root.children : [];
  const element =
    root.type === "JSXElement" ? root : only?.type === "JSXElement" ? only : undefined;
  if (!element) return;
  const attributes = element.openingElement.attributes;
  const find = (name: string) =>
    attributes.find(
      (attribute): attribute is JsxAttributeNode =>
        attribute.type === "JSXAttribute" &&
        attribute.name.type === "JSXIdentifier" &&
        attribute.name.name === name,
    );
  const classAttribute = find("class");
  const classValue = classAttribute && attributeValue(classAttribute);
  const merged =
    classValue === undefined
      ? js.identifier(className)
      : classValue.type === "ArrayExpression"
        ? js.arrayExpression([...classValue.elements, js.identifier(className)])
        : js.arrayExpression([classValue, js.identifier(className)]);
  const styleAttribute = find("style");
  const styleValue = styleAttribute && attributeValue(styleAttribute);
  const styled =
    styleValue === undefined
      ? js.identifier(style)
      : js.objectExpression([
          ...(styleValue.type === "ObjectExpression"
            ? styleValue.properties
            : [js.spreadElement(styleValue)]),
          js.spreadElement(js.identifier(style)),
        ] as Parameters<typeof js.objectExpression>[0]);
  const replace = (attribute: JsxAttributeNode | undefined, name: string, value: AstExpression) => {
    const next = js.jsxAttribute(name, js.jsxExpressionContainer(value));
    if (attribute) attributes.splice(attributes.indexOf(attribute), 1, next);
    else attributes.push(next);
  };
  replace(classAttribute, "class", merged);
  replace(styleAttribute, "style", styled);
}

/** An attribute's value as an expression: a string for a quoted one. */
function attributeValue(attribute: JsxAttributeNode): AstExpression | undefined {
  const { value } = attribute;
  if (value?.type === "Literal") return js.stringLiteral(value.value);
  if (value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression") {
    return value.expression;
  }
  return undefined;
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
  if (names.has("exposeRef")) {
    const signal = names.core("Signal", { type: true });
    found.push(
      [
        "/**",
        " * Fills a consumer's component ref with what the component exposes, or empties it: Qwik has no",
        " * component instance for the ref to hold (ADR-0054).",
        " */",
        `function ${names.once("exposeRef")}(`,
        `  ref: ${signal}<object | undefined> | undefined,`,
        "  exposed: object | undefined,",
        "): void {",
        "  if (ref) ref.value = exposed;",
        "}",
      ].join("\n"),
    );
  }
  if (names.has("toggle")) {
    found.push(
      [
        "/** The values with `value` added or removed, as Vue's `vModelCheckbox` writes a checkbox group. */",
        `function ${names.once("toggle")}<T>(values: readonly T[], value: T, checked: boolean): T[] {`,
        "  if (!checked) return values.filter((each) => each !== value);",
        "  return values.includes(value) ? [...values] : [...values, value];",
        "}",
      ].join("\n"),
    );
  }
  if (names.has("selectedValues")) {
    found.push(
      [
        "/** The values of a multiple select's selected options, as Vue's `vModelSelect` writes them. */",
        `function ${names.once("selectedValues")}(select: HTMLSelectElement): string[] {`,
        "  return Array.from(select.selectedOptions, (option) => option.value);",
        "}",
      ].join("\n"),
    );
  }
  if (names.has("modelText")) {
    const modifiers = names.once("TextModifiers");
    found.push(
      [
        "/**",
        " * A text control's `v-model` as Vue's `vModelText` runs it: `read` is what the control's text",
        " * writes, trimmed with `trim` and cast with `number` as `looseToNumber` does; `shown` is the text",
        " * the control shows for a value, which keeps the person's own text while it is focused and",
        " * reads as the value (`trim`, `lazy`), or casts to it.",
        " */",
        `const ${names.once("modelText")} = {`,
        `  read<T>(element: HTMLInputElement | HTMLTextAreaElement, modifiers: ${modifiers}): T {`,
        "    const text = modifiers.trim ? element.value.trim() : element.value;",
        "    const number = Number.parseFloat(text);",
        "    // The state's type: where the text is no number, Vue writes the text, as here.",
        "    return (modifiers.number && !Number.isNaN(number) ? number : text) as T;",
        "  },",
        "  shown(",
        "    element: HTMLInputElement | HTMLTextAreaElement | undefined,",
        "    value: unknown,",
        `    modifiers: ${modifiers},`,
        "  ): string {",
        '    const text = value == null ? "" : String(value);',
        "    if (!element || element.value === text) return text;",
        '    if (element === document.activeElement && element.type !== "range") {',
        "      if (modifiers.lazy || (modifiers.trim && element.value.trim() === text)) {",
        "        return element.value;",
        "      }",
        "    }",
        "    if (modifiers.number && this.read(element, modifiers) === value) return element.value;",
        "    return text;",
        "  },",
        "};",
        "",
        "/** The modifiers of a text control's `v-model`. */",
        `interface ${modifiers} {`,
        "  trim?: boolean;",
        "  lazy?: boolean;",
        "  number?: boolean;",
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
  options: ReadonlyMap<ElementNode, ModelAttribute>,
  followed: ReadonlySet<RenderNode>,
  listeners: Listeners,
  plan: SetupPlan,
  locals: RenderLocals,
  scope: ScopePlan | undefined,
): JsxDialect {
  const namespaceOf = (element: ElementNode) => namespaces.get(element) ?? "html";
  const { composition } = plan;
  const fills = fillExpressions(component);
  /** The name of each setup function's copy in the fills that call it. */
  const fillCopies = new Map<BindingId, string>();
  return {
    conditional(node, context) {
      const chain = ternaryChain(node, context);
      return followed.has(node) ? js.jsxFragment([js.jsxExpressionContainer(chain)]) : chain;
    },
    // A child's event is its QRL prop (ADR-0047), its handler a `$` scope the optimizer makes.
    componentEvent(attribute, _node, context) {
      return [
        js.jsxAttribute(
          qwikEventProp(attribute.event),
          js.jsxExpressionContainer(componentHandler(attribute.handler, context, plan)),
        ),
      ];
    },
    fillAttribute: (fill, _node, context) => fillAttribute(fill, context, composition, locals),
    list(node, context) {
      locals.enter(false);
      const call = mapCall(node, context);
      const scope = locals.leave();
      if (call.type !== "CallExpression") return call;
      const [arrow] = call.arguments;
      if (arrow?.type !== "ArrowFunctionExpression") return call;
      return { ...call, arguments: [withLocals(arrow, scope, context)] };
    },
    // A fill's code runs as a `$` scope, which captures no plain function: a setup function it
    // calls is declared in the fill's callback, its own calls written in place (./inline.ts), so
    // the fill renders at once, with no promise in a condition, a class or a style.
    // Where the component declares the function too (its QRL, or a plain one render calls), the
    // fill's copy takes a name of its own: a listener in the fill keeps calling the QRL.
    expression(expression, context, site) {
      const rules = context.rules!;
      if (!(locals.inFill && fills.has(expression))) {
        return rewriteExpression(expression, component, rules, site);
      }
      const copies = new Map<BindingId, string>();
      for (const reference of expression.refs) {
        if (reference.kind !== "Binding" || !reference.call) continue;
        const fn = plan.functions.get(reference.binding);
        if (!fn || fn.form === "module") continue;
        const id = fn.item.binding;
        let name = fillCopies.get(id);
        if (name === undefined) {
          const declared = plan.declared.has(id) || fn.form === "render" || fn.form === "both";
          name = declared ? plan.names.fresh(`${fn.binding.name}InFill`) : fn.binding.name;
          fillCopies.set(id, name);
        }
        copies.set(id, name);
        locals.declareInFill(name, () => fillFunction(plan, id, name));
      }
      return rewriteExpression(
        expression,
        component,
        {
          ...rules,
          binding: (reference, binding, written, at) =>
            (reference.call && copies.get(binding.id)) ||
            rules.binding(reference, binding, written, at),
        },
        site,
      );
    },
    slotOutlet: (node, context) =>
      slotOutlet(node, context, composition, () => plan.names.core("Slot")),
    modelBinding(attribute, _node, context) {
      return [
        js.jsxAttribute(
          attribute.model,
          js.jsxExpressionContainer(jsxExpression(attribute.value, context)),
        ),
        js.jsxAttribute(
          modelCallback(attribute.model),
          js.jsxExpressionContainer(
            context.placeholders.expression(modelWriter(attribute.value, plan)),
          ),
        ),
      ];
    },
    modelAttribute: (attribute, element, context) =>
      modelAttribute(attribute, element, context, plan, locals, listeners.explicit.has(attribute)),
    // A `<component is>` that reads a list's item, or sits in a fill, is declared in that
    // callback.
    dynamic(node, context) {
      // In a fill, it may call a function only the fill declares (./composition.ts).
      const local = readsRenderLocal(node.is, component) || locals.inFill;
      const name = locals.declare("Tag", expressionCode(node.is, context), local);
      // Each candidate tag is a root node of its own.
      const root = scope?.pending.has(spanKey(node.span)) ?? false;
      const element = node.attributes.some((attribute) => attribute.kind === "Event")
        ? candidateBranches(node, name, context, listeners, () => {
            if (root) scope!.pending.add(spanKey(node.span));
          })
        : jsxDynamic(node, name, context);
      return followed.has(node)
        ? js.jsxFragment([
            element.type === "JSXElement" ? element : js.jsxExpressionContainer(element),
          ])
        : element;
    },
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
      const model = name === "value" ? options.get(element) : undefined;
      return [
        ...(model ? [optionSelected(element, model, context, plan, locals)] : []),
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
      const model = attribute.name === "value" ? options.get(element) : undefined;
      if (model) {
        return [
          optionSelected(element, model, context, plan, locals),
          ...boundJsxAttribute(attribute, element, context),
        ];
      }
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
    // The `data-uf-*` attributes of the styled parents that render the component, whose names
    // only they know, picked out of its props by name (the child-root rule, ADR-0063). Each
    // root takes them once: the first node printed with its span, which is the root itself,
    // printed before what it holds.
    scopeRootAttributes(element, context) {
      if (!scope?.pending.delete(spanKey(element.span))) return [];
      return [
        js.jsxSpreadAttribute(
          context.placeholders.expression(`${scope.helper}(${scope.props})`, "argument"),
        ),
      ];
    },
  };
}

/**
 * A `<component is>` with listeners, as one element per candidate tag: `Tag === "a" ? <a …> :
 * <button …>`. Qwik 2.0.0-beta.47's runtime makes a `$` prop an element's listener only where
 * the optimizer splits the props, which it does not for `<Tag>`, so `onClick$` on it would be an
 * attribute. Listeners are on tags only: a component candidate's are its props (ADR-0054).
 */
function candidateBranches(
  node: DynamicNode,
  name: string,
  context: JsxContext,
  listeners: Listeners,
  reroot: () => void,
): AstExpression {
  const tags = node.candidates.flatMap((candidate) =>
    candidate.kind === "Tag" ? [candidate.tag] : [],
  );
  const branches = tags.map((tag) => {
    listeners.reprint(node);
    reroot();
    return jsxElement(
      {
        kind: "Element",
        tag,
        // A tag candidate's attributes are an element's (ADR-0054).
        attributes: node.attributes.filter(
          (attribute) =>
            attribute.kind !== "Prop" &&
            attribute.kind !== "Listener" &&
            attribute.kind !== "ModelBinding",
        ),
        children: node.children,
        span: node.span,
      },
      context,
    );
  });
  return branches
    .slice(0, -1)
    .reduceRight<AstExpression>(
      (alternate, branch, index) =>
        js.conditionalExpression(
          js.binaryExpression("===", js.identifier(name), js.stringLiteral(tags[index]!)),
          branch,
          alternate,
        ),
      branches.at(-1)!,
    );
}

/**
 * The listeners and models of the elements and `<component is>` nodes in a render-prop fill and
 * in a list, the fill's own or one around its component (see `Listeners.explicit`).
 */
function listsInFills(root: ElementNode | FragmentNode): Set<EventAttribute | ModelAttribute> {
  const found = new Set<EventAttribute | ModelAttribute>();
  const visit = (node: RenderNode, fill: boolean, list: boolean): void => {
    if ((node.kind === "Element" || node.kind === "Dynamic") && fill && list) {
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" || attribute.kind === "Model") found.add(attribute);
      }
    }
    if (node.kind === "Component" || node.kind === "Dynamic") {
      const fills = node.kind === "Component" ? node.fills : (node.fills ?? []);
      for (const each of fills) {
        // The default slot's plain fill is projected: it renders in the component's own segment.
        const own = each.slot === "default" && !each.parameter;
        for (const child of each.children) visit(child, own ? fill : true, list);
      }
      if (node.kind === "Dynamic") for (const child of node.children) visit(child, fill, list);
      return;
    }
    if (node.kind === "For") return visit(node.body, fill, true);
    for (const child of childrenOf(node)) visit(child, fill, list);
  };
  for (const child of root.kind === "Fragment" ? root.children : [root]) visit(child, false, false);
  return found;
}

/**
 * The conditionals and `<component is>` nodes that a sibling follows. Qwik 2.0.0-beta.47's diff
 * inserts a node that replaces another before it, then moves each unkeyed sibling after it back
 * in place (core's `retrieveChildWithKey`), and a focused sibling loses its focus. In a fragment
 * of its own, the replacement happens among the fragment's children, and no sibling moves.
 */
function replacedBeforeSiblings(root: ElementNode | FragmentNode): Set<RenderNode> {
  const found = new Set<RenderNode>();
  const visit = (children: readonly RenderNode[]) => {
    children.forEach((child, index) => {
      if ((child.kind === "If" || child.kind === "Dynamic") && index < children.length - 1) {
        found.add(child);
      }
    });
  };
  visit(root.kind === "Fragment" ? root.children : [root]);
  walk(root, {
    enter(node) {
      if (node.kind === "Element") visit(node.children);
      if (node.kind === "If") for (const branch of node.branches) visit(branch.children);
      if (node.kind === "Component") for (const fill of node.fills) visit(fill.children);
      if (node.kind === "SlotOutlet") visit(node.fallback);
      if (node.kind === "Dynamic") {
        visit(node.children);
        for (const fill of node.fills ?? []) visit(fill.children);
      }
    },
  });
  return found;
}

/** `{...{ name: value }}`: an attribute under its HTML name, which Qwik's types leave unchecked. */
function untypedSpread(name: string, value: AstExpression): JsxAttribute {
  return js.jsxSpreadAttribute(js.objectExpression([[name.toLowerCase(), value]]));
}
