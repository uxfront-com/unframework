import {
  addPassThroughImports,
  addTypeImports,
  bindingOf,
  boundJsxAttribute,
  childImports,
  componentTypes,
  defineTarget,
  directiveSpecifier,
  exportDeclaration,
  exportsOf,
  expressionCode,
  importedDirectives,
  ImportSet,
  js,
  jsxAttributeValue,
  jsxContext,
  candidateAttributes,
  jsxDynamic,
  jsxElement,
  jsxExpression,
  styleJsxAttribute,
  jsxNode,
  keyImports,
  keyOwner,
  mapCall,
  moduleHelperName,
  ownDirectives,
  printComponentModule,
  printProgram,
  refJsxAttribute,
  rewriteExpression,
  scopeRoots,
  sourceNames,
  spreadRead,
  staticJsxAttribute,
  ternaryChain,
  typeExportsCode,
  typeNames,
  typeSpecifier,
} from "@unframework.dev/codegen";
import type {
  EmitContext,
  JsxContext,
  JsxDialect,
  OutputFile,
  Target,
} from "@unframework.dev/codegen";
import { codeOf } from "@unframework.dev/ir";
import { childrenOf, walk } from "@unframework.dev/ir";
import type {
  BindingId,
  ComponentNode,
  DynamicNode,
  ElementNode,
  EventAttribute,
  EventDeclaration,
  FragmentNode,
  ModelAttribute,
  Prop,
  RenderNode,
  Span,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfComposable,
  UfModule,
} from "@unframework.dev/ir";

import {
  elementNamespaces,
  isUntypedAttribute,
  qwikAttributeName,
  qwikStaticValue,
} from "./attributes.ts";
import type { Namespace } from "./attributes.ts";
import { qwikClassAttribute } from "./class.ts";
import { composableProblems, parameterCode, setupOwner } from "./composable.ts";
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
import { DIRECTIVE_HELPER, emitDirective, hooksCode, QwikDirectives } from "./directive.ts";
import { qwikEventProp } from "./events.ts";
import {
  childFallthroughTag,
  declaredBy,
  restAttributesHelper,
  sameSpan,
  singleRoot,
} from "./fallthrough.ts";
import type { Passed } from "./fallthrough.ts";
import { generatedInterface, typeParameterDeclaration } from "./generics.ts";
import type { GeneratedInterface } from "./generics.ts";
import { Listeners } from "./listeners.ts";
import { moduleReads } from "./modules.ts";
import { OutputNames, planSetup, selfReadingArguments, usedFunctionRenderCalls } from "./plan.ts";
import type { SetupPlan } from "./plan.ts";
import { exposeStatement, fillFunction, printSetup } from "./setup.ts";
import { teleportHelper, teleportJsx, teleportNames, teleportSetup } from "./teleport.ts";
import { qwikTitles } from "./title.ts";
import { qwikTransitions } from "./transition.ts";
import { isPrimitiveValue } from "./values.ts";

/** The scope helper's name, before the name scope makes it unique. */
const SCOPE_HELPER = "scopeAttributes";

/** The Qwik 2 target (experimental until Qwik 2.0.0 ships, ADR-0094). */
export const qwik: Target = defineTarget({
  name: "qwik",
  framework: { package: "@qwik.dev/core", range: ">=2.0.0-rc.5 <3" },
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
    // Qwik 2.0.0-rc.5's props proxy subscribes a reader only to the keys the props hold
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
    "style-binding": {
      support: "emulated",
      helper: "styleObject",
      note: "A style bound to a value is Qwik's own `style`, but where an object spread merges it, on the root that takes a consumer's style and on a component or a `<component is>`, an inline helper splits a declaration list into an object as Vue does (ADR-0065).",
    },
    "attribute-spread": { support: "native" },
    "raw-html": { support: "native" },
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
    // Qwik's own props' rest (ADR-0118, ./fallthrough.ts): what a consumer passes and a component
    // does not declare is `...attributes`, which its root, or the element that spreads the
    // source's `{...rest}`, spreads last, its listener of an event the element listens to beside
    // the element's own, `onClick$={[$(…), onClick$]}`.
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: {
      support: "emulated",
      helper: "exposeRef",
      note: "Qwik has no component instance, so a ref on a component that exposes functions is a signal the child fills with what it exposes, through an inline helper, `exposeRef` (ADR-0054). A ref on a component that exposes nothing is Qwik's own element ref, a signal the root element takes: in the props' rest, or beside the root's own ref, `ref={(element) => { input.value = element; if (ref) ref.value = element; }}` (ADR-0118).",
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
      note: "A child cannot know the scope attributes its styled parents pass. A root that spreads the props' rest takes them with it, and elsewhere an inline helper picks them out of its props by name and spreads them on the root, while a rest spread on another element leaves them out through `restAttributes` (ADR-0118).",
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
    "generic-components": { support: "native" },
    "generic-slot-props": { support: "native" },
    composables: { support: "native" },
    "composable-effect-order": { support: "native" },
    // L12 checks a hydrated page against a client render, and resumption is neither (ADR-0095).
    hydration: {
      support: "unsupported",
      code: "UF4001",
      severity: "info",
      reason:
        "Qwik resumes a server render instead of hydrating it: it runs no render, keeps no state for a component without client code, and runs visible tasks once the loader sees them, so the resumed page can't be checked against a client render.",
    },
    "keyed-identity": { support: "native" },
    // Qwik has no portal (ADR-0098).
    // A list of elements and a visible task per directive, through an inline helper (ADR-0099).
    directive: {
      support: "emulated",
      helper: DIRECTIVE_HELPER,
      note: "Qwik has no directive, so an element's directive is a `ref` function that adds each element one use renders to a signal of them, and a document-ready visible task that tracks them and the value, and calls an inline helper, `runDirective`, for each (with each element's own value, which its `ref` passes through `collectValues` where it reads a list's row or a scoped fill's props), which runs `mounted` once a `MutationObserver` sees the element in the document, where a slot may put it after Qwik calls the ref, `updated` behind `Object.is`, and `unmounted` once the element leaves or the component unmounts, in Vue's order through an inline queue.",
    },
    // Qwik removes a node at once and has no transition primitive (ADR-0100).
    transition: {
      support: "emulated",
      helper: "transition",
      note: "A `<Transition>`'s branches lag its conditional: a signal lists the branches it renders, and a document-ready visible task that tracks the branch shown runs the old one's leave, drops it at the leave's end and adds the new one, whose ref, `transition`, runs its enter as Qwik creates it. The signal starts at the condition's value, so the server renders the settled child and resumption changes nothing (ADR-0100).",
    },
    teleport: {
      support: "emulated",
      helper: "teleport",
      note: 'Qwik has no portal, so a `<Teleport>`\'s element renders once a visible task says the component has mounted, after the empty text of `{""}` in a fragment, and a ref, `teleport`, moves it into `to` once Qwik has inserted it and removes it once that text leaves the document. Qwik inserts a node before the first DOM node of the one after it, which is that text, never the moved element (ADR-0098).',
    },
    // Each await is an async `useComputed$` read in the body: reading its `.value` while pending
    // throws the promise, and Qwik runs the body again once it settles (ADR-0101). A resumed
    // component runs no setup again, which the `hydration` cell covers.
    "async-setup": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): Array<OutputFile> {
    const { module } = context;
    // A composable's functions are QRLs (./composable.ts): a call outside client code would give
    // a promise, so it is reported, never emitted (P2).
    const renderCalls = usedFunctionRenderCalls(component);
    for (const call of renderCalls) {
      const name = bindingOf(component, call.binding).name;
      context.report({
        code: "UF1002",
        severity: "error",
        message: `\`${name}\` is a function a composable returns, which the qwik target calls only from client code: the hook returns it as a QRL, whose call gives a promise, so the template, a getter or the setup cannot call it.`,
        span: call.span,
        help: "Return the value as a derived value of the composable, or call the function from a listener, a watcher or a lifecycle hook.",
      });
    }
    // An argument's `$` scope is made before its call returns, so it cannot capture what the call
    // returns (./plan.ts): reported, never emitted with a capture that is `undefined` (P2).
    const selfReads = selfReadingArguments(component);
    for (const { reference, member } of selfReads) {
      const name = bindingOf(component, member).name;
      const read = bindingOf(component, reference.binding).name;
      context.report({
        code: "UF1002",
        severity: "error",
        message:
          read === name
            ? `\`${name}\` is what this composable's call returns, which the qwik target cannot read in the call's own arguments: Qwik makes each argument's QRL or signal before the call returns, so it would capture \`${name}\` before it exists.`
            : `\`${read}\` reads \`${name}\`, which this composable's call returns, so the qwik target cannot read it in the call's own arguments: Qwik makes each argument's QRL or signal before the call returns, so it would capture \`${name}\` before it exists.`,
        span: reference.span,
        help: "Do the work in the composable, or have the argument write state the component declares, which a watcher of it reads.",
      });
    }
    if (renderCalls.length || selfReads.length) {
      return [];
    }
    // Every name the source declares or reads is taken before the output names its own, but for
    // the authoring APIs code calls (`nextTick`), which the output replaces with its own.
    const ownNames = (each: UfComponent) => {
      const names = sourceNames(each, module);
      for (const name of apiNames(each)) {
        names.delete(name);
      }
      return names;
    };
    const reserved = ownNames(component);
    for (const name of typeNamesOf(component, module)) {
      reserved.add(name);
    }
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
      if (child.self) {
        continue;
      }
      if (child.export === "default") {
        imports.addDefault(child.specifier, child.local, { exact: true });
      } else {
        imports.add(child.specifier, child.name, { local: child.local, exact: true });
      }
    }
    for (const key of keyImports(component, module, (name) => name)) {
      if (key.specifier) {
        imports.add(key.specifier, key.name, { local: key.local, exact: true });
      }
    }
    // The types it imports, by name (ADR-0067): a child's from its output, `./Field`.
    addTypeImports(component, module, imports, (name) => name);
    // The module's values it reads, as the source declares and imports them (ADR-0070).
    const reads = moduleReads(component.name, module, imports);
    const componentFn = imports.add("@qwik.dev/core", "component$");
    const names = new OutputNames(imports);
    const plan = planSetup(component, module, names);
    // What a consumer passes that the component does not declare (ADR-0118, ./fallthrough.ts).
    const { passed } = plan.composition;
    const scope = scopePlan(component, names, passed);
    // The props' rest, `{...rest}`, where an element other than the root spreads it: without the
    // scope attributes, which the root keeps (ADR-0063).
    const restHelper =
      passed?.rest !== undefined && !passed.onRoot ? names.once("restAttributes") : undefined;
    const printed: PrintedPassed = { merged: false };
    const listeners = new Listeners(plan);
    // Each directive's list of elements and visible task (ADR-0099).
    const directives = new QwikDirectives(component, plan, names);
    for (const { specifier, imported, local } of importedDirectives(component, module)) {
      imports.add(directiveSpecifier(specifier, imported), imported, { local, exact: true });
    }
    // The dialect reads the namespaces of the tree it prints, which is the render tree with
    // Qwik's form of each `<title>`: they are filled in once that tree is built.
    const namespaces = new Map<ElementNode, Namespace>();
    const options = new Map<ElementNode, ModelAttribute>();
    const followed = new Set<RenderNode>();
    // What the render reads before it returns: `<component is>`'s `const`, the values of the
    // form controls a `v-model` binds (./composition.ts).
    const locals = new RenderLocals(plan);
    // A teleport mounts once the component has (ADR-0098).
    const teleport = teleportNames(component, names);
    // A transition's branches lag its conditional (ADR-0100).
    const transitions = qwikTransitions(component, plan, names);
    const jsx = jsxContext({
      component,
      module,
      dialect: {
        ...qwikDialect(
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
        ...(teleport ? { teleport: teleportJsx(teleport) } : {}),
        ...(transitions ? { transition: transitions.jsx } : {}),
        // On the root, a consumer's ref fills beside the directive's list (ADR-0118).
        directiveAttribute: (attribute, element, context) => {
          const root = passed?.rootRef && isRoot(component, element);
          if (root) {
            printed.merged = true;
          }
          return directives.attribute(attribute, context, root ? passed.ref() : undefined);
        },
        // The props' rest (ADR-0118), which the element spreads last once printed.
        restAttribute: () => {
          if (passed?.rest === undefined) {
            throw new Error("A rest spread on no rest's element.");
          }
          const rest = js.identifier(passed.rest);
          printed.rest = js.jsxSpreadAttribute(
            restHelper ? js.callExpression(js.identifier(restHelper), [rest]) : rest,
          );
          return [printed.rest];
        },
        // A template ref beside a directive is filled by the directive's own `ref` (ADR-0099).
        refAttribute: (attribute, element, context) =>
          directives.fillsTemplateRef(attribute)
            ? []
            : refJsxAttribute(attribute, element, context),
      },
      rules: plan.rules(),
    });
    const render = qwikTitles(component.render, jsx, module);
    for (const [element, namespace] of elementNamespaces(render)) {
      namespaces.set(element, namespace);
    }
    for (const [option, model] of modelOptions(render)) {
      options.set(option, model);
      // An option without a `value` is selected by its text.
      const valued = option.attributes.some(
        (attribute) =>
          (attribute.kind === "Static" || attribute.kind === "Bound") && attribute.name === "value",
      );
      const selected = valued ? undefined : textOptionSelected(option, model, jsx, plan, locals);
      if (selected) {
        option.attributes = [selected, ...option.attributes];
      }
    }
    for (const node of replacedBeforeSiblings(render)) {
      followed.add(node);
    }
    for (const attribute of listsInFills(render)) {
      listeners.explicit.add(attribute);
    }
    const setup = printSetup(plan);
    const root = jsxNode(render, jsx);
    if (passed) {
      const problem = passThrough(root, plan, passed, printed);
      if (problem) {
        context.report({ code: "UF1002", severity: "error", ...problem });
        return [];
      }
    }
    // A root that takes the consumer's `class` and `style` with no rest, as a `<component is>`
    // over tags does, merges them into each element it may render (ADR-0119).
    const { fallthrough } = plan.composition;
    if (fallthrough && passed?.rest === undefined) {
      for (const element of rootElements(root)) {
        mergeFallthrough(element, fallthrough);
      }
    }
    const returned = js.returnStatement(root);
    // The sheet `compile()` emits beside the source, already scoped (ADR-0063), as a string
    // Qwik attaches once per component: `useStyles$(styles)`.
    const sheet = component.styles && {
      specifier: `./${module.file.slice(module.file.lastIndexOf("/") + 1)}.css?inline`,
      local: names.fresh("styles"),
    };
    const body = [
      restOfProps(component, plan),
      sheet ? `${names.core("useStyles$")}(${sheet.local});` : "",
      setup.body,
      teleport ? teleportSetup(teleport, names) : "",
      transitions ? transitions.setup() : "",
      directives.setup(names),
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
      events?.reference,
      models?.reference,
      slots?.reference,
      elementProps(plan),
      ownProps(component, plan),
    ].filter((type) => type !== undefined);
    // The rest the root picks the scope attributes out of needs a props type to destructure.
    if (scope && !propsType.length) {
      propsType.push("object");
    }
    const propsTypeNode = propsType.length
      ? jsx.placeholders.type(propsType.join(" & "))
      : undefined;
    // A generic component is a generic arrow, `component$(<T,>(props: ListProps<T>) => …)`,
    // whose parameter carries the props type: `component$`'s own type argument can't name `T`
    // (ADR-0068). It takes the props object where it reads none, which carries `T` all the same.
    const typeParameters = typeParameterDeclaration(component, jsx.placeholders);
    const arrowParameter =
      typeParameters && propsTypeNode
        ? ({
            ...(parameter ?? js.bindingIdentifier("_props")),
            typeAnnotation: js.tsTypeAnnotation(propsTypeNode),
          } as Parameter)
        : parameter;
    const arrow = js.arrowFunction(arrowParameter ? [arrowParameter] : [], [
      ...(body ? [jsx.placeholders.statements(`${body}\n`)] : []),
      returned,
    ]);
    arrow.typeParameters = typeParameters;
    const definition = js.callExpression(
      js.identifier(componentFn),
      [arrow],
      propsTypeNode && !typeParameters ? [propsTypeNode] : [],
    );
    const hoisted = setup.hoisted.length
      ? [jsx.placeholders.statements(`${joinHoisted(setup.hoisted)}\n`)]
      : [];
    const constants = reads.constants.length
      ? [jsx.placeholders.statements(`${reads.constants.join("\n")}\n`)]
      : [];
    // The module's own directives it applies, as their plain hooks (ADR-0099).
    const ownHooks = ownDirectives(component, module).map((directive) =>
      jsx.placeholders.statements(`${hooksCode(directive)}\n`),
    );
    const keys = keyDeclarations(component, module, plan);
    const exported = exportsOf(component.name, module.exports);
    // A component that renders itself refers to its own `const` (ADR-0053).
    const helperCode = helpers(plan, listeners);
    if (scope) {
      helperCode.push(scopeAttributesHelper(scope.helper));
    }
    if (restHelper && passed?.tag !== undefined) {
      const type = `${names.core("PropsOf", { type: true })}<${JSON.stringify(passed.tag)}>`;
      helperCode.push(restAttributesHelper(restHelper, type));
    }
    if (teleport) {
      helperCode.push(teleportHelper(teleport));
    }
    if (transitions) {
      helperCode.push(transitions.helpers());
    }
    helperCode.push(...directives.helpers(names));
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
              ...[...moduleTypes(component, module), ...reads.types].toSorted(
                (a, b) => a.span.start - b.span.start,
              ),
              ...(events ? [events.declaration] : []),
              ...(models ? [models.declaration] : []),
              ...(slots ? [slots.declaration] : []),
            ],
            body: [
              ...constants,
              ...ownHooks,
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
  emitComposable,
  emitDirective,
});

export default qwik;

/**
 * `useToggle.ts`: `export function useToggle(initial: boolean) { …; return { on, toggle }; }`, a
 * `use*` hook (ADR-0069) whose setup prints as a component's, its parameters in the forms Qwik
 * captures (./composable.ts), and what it returns as the source returns it, each function by its
 * QRL.
 */
function emitComposable(composable: UfComposable, context: EmitContext): Array<OutputFile> {
  const { module } = context;
  const owner = setupOwner(composable);
  const reserved = sourceNames(owner, module);
  for (const name of apiNames(owner)) {
    reserved.delete(name);
  }
  for (const name of typeNamesOf(owner, module)) {
    reserved.add(name);
  }
  const imports = new ImportSet(reserved);
  const names = new OutputNames(imports);
  const plan = planSetup(owner, module, names, composable);
  // What Qwik's forms of its arguments cannot keep is reported, never emitted (P2).
  const problems = composableProblems(composable, plan);
  for (const { span, message, help } of problems) {
    context.report({ code: "UF1002", severity: "error", message, span, help });
  }
  if (problems.length) {
    return [];
  }
  const setup = printSetup(plan);
  const returned = composable.returns.map((member) => {
    const local = plan.functions.get(member.binding)?.qrl ?? member.name;
    return local === member.name ? local : `${member.name}: ${local}`;
  });
  const body = [setup.body, `return { ${returned.join(", ")} };`].filter(Boolean).join("\n\n");
  const parameters = composable.parameters.map((parameter) => parameterCode(parameter, names));
  const typeParameters = composable.typeParameters?.length
    ? `<${composable.typeParameters
        .map(({ name, constraint, default: fallback }) => {
          const extended = constraint ? ` extends ${constraint.code}` : "";
          return `${name}${extended}${fallback ? ` = ${fallback.code}` : ""}`;
        })
        .join(", ")}>`
    : "";
  const helperCode = helpers(plan, new Listeners(plan));
  // The types it reads, by name, from where the source imports them (ADR-0067): its setup's, and
  // its parameters' and type parameters', which its setup owner holds no trace of.
  addTypeImports(owner, module, imports, (name) => name);
  addParameterTypeImports(composable, module, imports);
  // The module's values it reads, as the source declares and imports them (ADR-0070).
  const reads = moduleReads(composable.name, module, imports);
  const head = imports.size > 0 ? printProgram(js.program(imports.toDeclarations())).trim() : "";
  const contents = [
    ...(head ? [head] : []),
    ...[...moduleTypes(owner, module), ...reads.types]
      .toSorted((a, b) => a.span.start - b.span.start)
      .map((declaration) =>
        declaration.exported ? `export ${declaration.code}` : declaration.code,
      ),
    ...(reads.constants.length ? [reads.constants.join("\n")] : []),
    ...(setup.hoisted.length ? [joinHoisted(setup.hoisted)] : []),
    `export function ${composable.name}${typeParameters}(${parameters.join(", ")}) {\n${body}\n}`,
    ...helperCode,
  ].join("\n\n");
  return [{ path: `${composable.name}.ts`, contents: `${contents}\n` }];
}

/**
 * Imports the types a composable's parameters and type parameters name (ADR-0067), as the source
 * imports them.
 */
function addParameterTypeImports(
  composable: UfComposable,
  module: UfModule,
  imports: ImportSet,
): void {
  const texts: Array<TypeText> = [
    ...composable.parameters.map(({ type }) => type),
    ...(composable.typeParameters ?? []).flatMap(({ constraint, default: fallback }) =>
      [constraint, fallback].filter((type): type is TypeText => type !== undefined),
    ),
  ];
  const read = new Set(texts.flatMap((type) => [...typeNames(type)]));
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!read.has(name.local)) {
        continue;
      }
      const specifier = typeSpecifier(entry.specifier, module, (each) => each);
      imports.add(specifier, name.imported, { type: true, local: name.local, exact: true });
    }
  }
}

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Parameter = Parameters<typeof js.arrowFunction>[0][number];
type AstExpression = Parameters<typeof js.conditionalExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute> | ReturnType<typeof js.jsxSpreadAttribute>;
type JsxAttributeNode = ReturnType<typeof js.jsxAttribute>;
type JsxSpreadAttribute = ReturnType<typeof js.jsxSpreadAttribute>;
type JsxElementNode = ReturnType<typeof js.jsxElement>;
type JsxChild = Parameters<typeof js.jsxFragment>[0][number];

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

/**
 * The component's {@link ScopePlan}, or none where Vue gives no node the attributes, or where the
 * root spreads the props' rest, which holds them (ADR-0118). Where an element other than the root
 * spreads the rest, the root keeps them, as Vue's does.
 */
function scopePlan(
  component: UfComponent,
  names: OutputNames,
  passed: Passed | undefined,
): ScopePlan | undefined {
  const roots = scopeRoots(component).filter(
    (span) => !(passed?.onRoot && passed.isTarget({ span })),
  );
  const root = singleRoot(component);
  if (passed?.rest !== undefined && !passed.onRoot && root) {
    roots.push(root.span);
  }
  if (!roots.length) {
    return undefined;
  }
  const parameter = component.propsParameter;
  return {
    pending: new Set(roots.map(spanKey)),
    props:
      parameter?.form === "object" ? parameter.name! : (passed?.rest ?? names.fresh("attributes")),
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
 * Where that rest is what falls through (ADR-0118), the pattern names every prop the component
 * declares, an unread one as `_name`, so none falls through, and the consumer's listeners and ref
 * the component takes apart from the rest (./fallthrough.ts).
 */
function propsParameter(
  component: UfComponent,
  jsx: JsxContext,
  plan: SetupPlan,
  scope: ScopePlan | undefined,
): Parameter | undefined {
  const parameter = component.propsParameter;
  const { passed } = plan.composition;
  const read = component.props.filter(
    (prop) => prop.binding !== undefined && jsx.referenced.has(prop.binding),
  );
  // A name the source takes renames the destructured prop (`{ onChange$: onChange$_1 }`).
  const property = ([prop, local]: readonly [string, string]) => {
    const each = js.bindingProperty(prop);
    return local === prop
      ? each
      : { ...each, value: js.bindingIdentifier(local), shorthand: false };
  };
  // The events code emits, after the props: `({ initial = 0, onChange$ })`.
  const events = [...plan.eventLocals].map(([event, local]) =>
    property([qwikEventProp(event), local]),
  );
  const composition = compositionProps(plan);
  const taken = passedProps(plan);
  if (parameter?.form === "object") {
    return read.length || plan.emitted.size || composition.length || scope || passed
      ? js.bindingIdentifier(parameter.name!)
      : undefined;
  }
  const rest = passed?.rest ?? scope?.props;
  const unread = passed?.rest === undefined ? [] : unreadProps(component, plan, read);
  if (!read.length && !events.length && !composition.length && !taken.length && !rest) {
    return undefined;
  }
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
    ...composition.map(property),
    ...unread.map(property),
    ...taken.map(property),
    ...(rest ? [js.bindingRestElement(rest)] : []),
  ]);
}

/**
 * What a component declares that no printed code reads, each with a `_` local: kept out of the
 * props' rest, which falls through (ADR-0118). Its unread props, the events it never emits, the
 * change callbacks of the models it never writes, and the render-prop slots it never renders.
 */
function unreadProps(
  component: UfComponent,
  plan: SetupPlan,
  read: ReadonlyArray<Prop>,
): Array<[prop: string, local: string]> {
  const unused = (prop: string): [string, string] => [prop, plan.names.fresh(`_${prop}`)];
  const { composition } = plan;
  return [
    ...component.props.filter((prop) => !read.includes(prop)).map((prop) => unused(prop.name)),
    ...(component.emits?.events ?? [])
      .filter((event) => !plan.eventLocals.has(event.name))
      .map((event) => unused(qwikEventProp(event.name))),
    ...[...composition.models.values()]
      .filter((model) => !model.written)
      .map((model) => unused(model.callbackProp)),
    ...(component.slots?.slots ?? [])
      .filter((slot) => isRenderProp(component, slot.name) && !composition.slots.has(slot.name))
      .map((slot) => unused(slotProp(slot.name))),
  ];
}

/**
 * The consumer's listeners and ref the component takes apart from the props' rest, with their
 * locals (./fallthrough.ts): the fallthrough element runs each listener after its own, and the
 * root fills the ref beside its own.
 */
function passedProps(plan: SetupPlan): Array<[prop: string, local: string]> {
  const { passed } = plan.composition;
  if (!passed) {
    return [];
  }
  return [
    ...passed.listeners,
    ...(passed.refLocal === undefined ? [] : [["ref", passed.refLocal] as [string, string]]),
  ];
}

/**
 * In the object form, the props' rest that falls through (ADR-0118), declared first:
 * `const { label: _label, class: _class, style: _style, ...attributes } = props;`. The code reads
 * the props from the object, so each declared one is named `_name`, which keeps it out of the
 * rest.
 */
function restOfProps(component: UfComponent, plan: SetupPlan): string {
  const parameter = component.propsParameter;
  const { passed } = plan.composition;
  if (parameter?.form !== "object" || !passed) {
    return "";
  }
  const entries = [
    ...(passed.rest === undefined
      ? []
      : [...passed.declared].map((prop) => `${prop}: ${plan.names.fresh(`_${prop}`)}`)),
    ...passedProps(plan).map(([prop, local]) => (prop === local ? prop : `${prop}: ${local}`)),
    ...(passed.rest === undefined ? [] : [`...${passed.rest}`]),
  ];
  return entries.length ? `const { ${entries.join(", ")} } = ${parameter.name};` : "";
}

/**
 * The attributes and listeners of the element a consumer's land on (ADR-0118), as Qwik types
 * them, without the names the component declares (an event named like a DOM one, a prop named
 * like an attribute), which would otherwise intersect: `Omit<PropsOf<"button">, "title" | …>`.
 */
function elementProps(plan: SetupPlan): string | undefined {
  const { passed } = plan.composition;
  if (passed?.rest === undefined || passed.tag === undefined) {
    return undefined;
  }
  const omitted = new Set(passed.declared);
  // The ref the component takes apart from the rest is a signal (see `ownProps`), and a
  // component whose root holds no element for a ref (a root component that exposes) takes none.
  if (passed.refLocal !== undefined || !passed.rootRef) {
    omitted.add("ref");
  }
  const props = plan.names.core("PropsOf", { type: true });
  // A root component takes what it declares as its props type has it, `value: number` where the
  // tag's would be `string | number | readonly string[]`, and passes the rest on to its own
  // element: `PropsOf<typeof Base>`, without the props the root sets itself, which a consumer
  // then need not pass.
  const root = passed.rootComponent;
  if (root) {
    for (const name of setByRoot(root)) {
      omitted.add(name);
    }
  }
  // A generic root component's props `PropsOf` cannot infer, so the rest takes its tag's
  // attributes, without what that component declares, whose types are its own.
  const generic = passed.genericRoot;
  if (generic) {
    for (const name of setByRoot(generic)) {
      omitted.add(name);
    }
    const declared = declaredBy(plan.module, generic.component);
    for (const name of declared.props) {
      omitted.add(name);
    }
    for (const name of declared.models) {
      omitted.add(name).add(modelCallback(name));
    }
    for (const name of declared.events) {
      omitted.add(qwikEventProp(name));
    }
  }
  const names = [...omitted].map((name) => JSON.stringify(name)).join(" | ");
  // A `<component is>` root's are what every tag takes (ADR-0122). Its listeners are each
  // tag's, so a parent's handler is typed as written (`landsOnTags`).
  const elements = root
    ? [`typeof ${root.component}`]
    : (passed.tags ?? [passed.tag]).map((tag) => JSON.stringify(tag));
  return `Omit<${elements.map((element) => `${props}<${element}>`).join(" & ")}, ${names}>`;
}

/**
 * The props a root component element sets that its component declares, by the names Qwik passes
 * them as: its props, its models and their callbacks, its emits' listeners and its render-prop
 * slots. The attributes and listeners it passes on to its own element are left in, as a
 * consumer's win over them (ADR-0118).
 */
function setByRoot(root: ComponentNode): Array<string> {
  const names = root.attributes.flatMap((attribute) => {
    switch (attribute.kind) {
      case "Prop":
        return [attribute.name];
      case "ModelBinding":
        return [attribute.model, modelCallback(attribute.model)];
      case "Listener":
        return [qwikEventProp(attribute.event)];
      default:
        return [];
    }
  });
  // A default fill without a parameter is the projected children, and any other a render prop.
  for (const fill of root.fills) {
    if (fill.slot !== "default" || fill.parameter) {
      names.push(slotProp(fill.slot));
    }
  }
  return names;
}

/**
 * The props composition adds that the component reads, each with its local: its models and
 * their callbacks, its render-prop slots, the `class` and `style` that fall through, and the
 * `ref` it exposes through (./composition.ts).
 */
function compositionProps(plan: SetupPlan): Array<[prop: string, local: string]> {
  const { composition } = plan;
  const found: Array<[string, string]> = [];
  for (const model of composition.models.values()) {
    found.push([model.name, model.prop]);
    if (model.written) {
      found.push([model.callbackProp, model.callback]);
    }
  }
  for (const [slot, local] of composition.slots) {
    found.push([slotProp(slot), local]);
  }
  if (composition.fallthrough) {
    found.push(
      ["class", composition.fallthrough.className],
      ["style", composition.fallthrough.style],
    );
  }
  if (composition.expose) {
    found.push(["ref", composition.expose.ref]);
  }
  return found;
}

/**
 * The slots a component declares as QRL render props (ADR-0054), as an exported interface beside
 * its props type: `export interface CardSlots { title$?: QRL<() => JSXOutput>; }`, generic over the
 * type parameters its members read (src/generics.ts). The default slot without props is
 * projected, and is no prop.
 */
function slotsInterface(component: UfComponent, plan: SetupPlan): GeneratedInterface | undefined {
  const declared = (component.slots?.slots ?? []).filter((slot) =>
    isRenderProp(component, slot.name),
  );
  if (!declared.length) {
    return undefined;
  }
  const name = plan.names.fresh(`${component.name}Slots`);
  const qrl = plan.names.core("QRL", { type: true });
  const output = plan.names.core("JSXOutput", { type: true });
  const members = declared.map(
    (slot) =>
      `  ${slotProp(slot.name)}?: ${qrl}<(${slot.props ? `props: ${slot.props.code}` : ""}) => ${output}>;`,
  );
  return generatedInterface(component, name, members, component.slots!.span);
}

/**
 * The models a component declares (ADR-0054), each a prop and its change callback, as an
 * exported interface beside its props type: `export interface StepperModels { value?: number;
 * onValueChange$?: QRL<(value: number) => void>; }`, generic over the type parameters its members
 * read (src/generics.ts).
 */
function modelsInterface(component: UfComponent, plan: SetupPlan): GeneratedInterface | undefined {
  const models = [...plan.composition.models.values()];
  const [first] = models;
  if (!first) {
    return undefined;
  }
  const name = plan.names.fresh(`${component.name}Models`);
  const qrl = plan.names.core("QRL", { type: true });
  const members = models.flatMap(({ item, name: model, callbackProp }) => {
    const type = item.type?.code ?? "unknown";
    return [
      `  ${model}${item.required ? "" : "?"}: ${type};`,
      `  ${callbackProp}?: ${qrl}<(${model}: ${type}) => void>;`,
    ];
  });
  return generatedInterface(component, name, members, first.item.span);
}

/**
 * The props every component of its kind takes, as a type literal: `class` and `style` where
 * they fall through, and the `ref` a component that exposes functions fills.
 */
function ownProps(component: UfComponent, plan: SetupPlan): string | undefined {
  const members: Array<string> = [];
  if (plan.composition.fallthrough) {
    members.push(
      `class?: ${plan.names.core("ClassList", { type: true })}`,
      `style?: ${plan.names.core("CSSProperties", { type: true })}`,
    );
  }
  // The signal of a consumer's component ref, which the component fills (`exposeRef`): of
  // `object`, as Qwik's lint (`qwik/valid-lexical-scope`) refuses a captured signal whose type
  // holds functions, and the consumer's ref type names the exposed functions as plain ones.
  if (component.exposes) {
    members.push(`ref?: ${plan.names.core("Signal", { type: true })}<object | undefined>`);
  }
  // A consumer's ref of the root element, which the root fills beside its own (ADR-0118): the
  // signal Qwik's `ref` on an element takes. Where a root component takes it in place of the
  // root's own, it is of the own one's element, which the visible task fills from it.
  else if (plan.composition.passed?.refLocal !== undefined) {
    const element = plan.composition.passed.forwarded
      ? (plan.composition.passed.forwarded.type?.code ?? "Element")
      : "Element";
    members.push(`ref?: ${plan.names.core("Signal", { type: true })}<${element} | undefined>`);
  }
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

/** What the dialect prints of what falls through, which {@link passThrough} completes. */
interface PrintedPassed {
  /** The props' rest, `{...rest}`, as printed where the source spreads it. */
  rest?: JsxSpreadAttribute;
  /** Whether the root's directive ref fills the consumer's ref. */
  merged: boolean;
}

/** Whether a printed element is the component's root element. */
function isRoot(component: UfComponent, element: ElementNode): boolean {
  const { render } = component;
  return render.kind === "Element" && sameSpan(render.span, element.span);
}

/**
 * Completes what falls through in the printed render (ADR-0118, ./fallthrough.ts): the element
 * that spreads the props' rest merges the consumer's `class` and `style` and spreads the rest
 * last, so the consumer's attribute wins over its own; and the root takes a consumer's ref apart
 * from the rest, beside its own, where it has one or the rest spreads elsewhere. Returns the
 * problem where the root's own ref cannot take the consumer's too.
 */
function passThrough(
  root: AstExpression,
  plan: SetupPlan,
  passed: Passed,
  printed: PrintedPassed,
): { message: string; span: Span; help: string } | undefined {
  const { fallthrough } = plan.composition;
  // A `<component is>` root's branches each take it, one of which shows (ADR-0122).
  const roots = (): Array<JsxElementNode> => {
    if (passed.tags) {
      return rootElements(root);
    }
    const element = rootElement(root);
    return element ? [element] : [];
  };
  if (passed.rest !== undefined) {
    const found = printed.rest ? elementHolding(root, printed.rest) : undefined;
    for (const target of found ? [found] : roots()) {
      if (fallthrough) {
        mergeFallthrough(target, fallthrough);
      }
      const attributes = target.openingElement.attributes;
      const spread = printed.rest ?? js.jsxSpreadAttribute(js.identifier(passed.rest));
      const at = attributes.indexOf(spread);
      if (at >= 0) {
        attributes.splice(at, 1);
      }
      attributes.push(spread);
    }
  }
  if (!passed.rootRef) {
    return undefined;
  }
  for (const element of roots()) {
    const problem = passRef(element, plan, passed, printed);
    if (problem) {
      return problem;
    }
  }
  return undefined;
}

/**
 * The root element's ref (see {@link passThrough}): the consumer's, in the rest or beside the
 * root's own, on each branch of a `<component is>` root (ADR-0122).
 */
function passRef(
  element: JsxElementNode,
  plan: SetupPlan,
  passed: Passed,
  printed: PrintedPassed,
): { message: string; span: Span; help: string } | undefined {
  const attributes = element.openingElement.attributes;
  const own = attributes.find(
    (attribute): attribute is JsxAttributeNode =>
      attribute.type === "JSXAttribute" &&
      attribute.name.type === "JSXIdentifier" &&
      attribute.name.name === "ref",
  );
  if (!own) {
    // In the rest, the root takes it with what else falls through.
    if (!passed.onRoot) {
      attributes.push(
        js.jsxAttribute("ref", js.jsxExpressionContainer(js.identifier(passed.ref()))),
      );
    }
    return undefined;
  }
  if (printed.merged) {
    return undefined;
  }
  const value = attributeValue(own);
  // A template ref is its signal, by name; anything else is printed code (a placeholder).
  if (value?.type !== "Identifier" || value.name === "") {
    return {
      message:
        "The root's ref is not one template ref, so the qwik target cannot fill a consumer's ref of the component's root element beside it (ADR-0118).",
      span: plan.component.render.span,
      help: "Put the template ref on the root element alone.",
    };
  }
  const ref = passed.ref();
  // A root component takes the consumer's signal, or else its own: Qwik serialises a
  // component's props, which a function is not, and fills the consumer's as the server renders,
  // before the consumer's `onMounted` runs. A visible task fills the own one from it
  // (./setup.ts).
  if (passed.forwarded) {
    attributes.splice(
      attributes.indexOf(own),
      1,
      js.jsxAttribute("ref", js.jsxExpressionContainer(js.identifier(passed.rootSignal()))),
    );
    return undefined;
  }
  // `ref={(element) => { input.value = element; if (ref) ref.value = element; }}`: Qwik's ref
  // takes one signal or function, and both refs hold the root element.
  const parameter = plan.names.once("element");
  const fill = (signal: string) =>
    js.expressionStatement(
      js.assignmentExpression(
        "=",
        js.memberExpression(js.identifier(signal), "value"),
        js.identifier(parameter),
      ),
    );
  const merged = js.arrowFunction(
    [js.bindingIdentifier(parameter)],
    [fill(value.name), js.ifStatement(js.identifier(ref), fill(ref))],
  );
  attributes.splice(
    attributes.indexOf(own),
    1,
    js.jsxAttribute("ref", js.jsxExpressionContainer(merged)),
  );
  return undefined;
}

/** The element a printed render returns: the element, or the only element of its fragment. */
function rootElement(root: AstExpression): JsxElementNode | undefined {
  // A component at the root is the only child of a fragment.
  const [only] = root.type === "JSXFragment" ? root.children : [];
  return root.type === "JSXElement" ? root : only?.type === "JSXElement" ? only : undefined;
}

/** The printed element whose attributes hold `item`, anywhere in a printed render. */
function elementHolding(node: unknown, item: object): JsxElementNode | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }
  if (isJsxElement(node) && node.openingElement.attributes.some((each) => each === item)) {
    return node;
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = elementHolding(value, item);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Whether a printed node is a JSX element. */
function isJsxElement(node: object): node is JsxElementNode {
  return "type" in node && node.type === "JSXElement";
}

/**
 * The elements a root renders, one of which shows: the root element, the only child of a
 * fragment (a component at the root, or a `<component is>` a sibling never follows), and each
 * branch of the ternary a `<component is>` with listeners writes, one element per tag
 * (`candidateBranches`, ADR-0119).
 */
function rootElements(node: AstExpression | JsxChild): Array<JsxElementNode> {
  switch (node.type) {
    case "JSXElement":
      return [node];
    case "JSXFragment": {
      const [only] = node.children;
      return only ? rootElements(only) : [];
    }
    case "JSXExpressionContainer":
      return node.expression.type === "JSXEmptyExpression" ? [] : rootElements(node.expression);
    case "ConditionalExpression":
      return [...rootElements(node.consequent), ...rootElements(node.alternate)];
    default:
      return [];
  }
}

/**
 * Merges the `class` and `style` a consumer passes into the element that spreads the props' rest
 * (`fallthrough`): the class tokens after the element's own, `class={["tag", className]}`, and
 * the style's declarations after the element's, `style={{ padding: "2px", ...style }}`, so the
 * consumer's win (ADR-0054).
 */
function mergeFallthrough(
  element: JsxElementNode,
  { className, style }: { className: string; style: string },
): void {
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
    if (attribute) {
      attributes.splice(attributes.indexOf(attribute), 1, next);
    } else {
      attributes.push(next);
    }
  };
  replace(classAttribute, "class", merged);
  replace(styleAttribute, "style", styled);
}

/** An attribute's value as an expression: a string for a quoted one. */
function attributeValue(attribute: JsxAttributeNode): AstExpression | undefined {
  const { value } = attribute;
  if (value?.type === "Literal") {
    return js.stringLiteral(value.value);
  }
  if (value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression") {
    return value.expression;
  }
  return undefined;
}

/**
 * The events a component emits, as an exported interface of their QRL props beside the props
 * type (ADR-0047): `export interface CounterEvents { onChange$?: QRL<(value: number) => void>; }`,
 * which the component's props type joins (`CounterProps & CounterEvents`), generic over the type
 * parameters its payloads read (src/generics.ts).
 */
function eventsInterface(component: UfComponent, plan: SetupPlan): GeneratedInterface | undefined {
  const declared = component.emits?.events ?? [];
  if (!declared.length) {
    return undefined;
  }
  const name = plan.names.fresh(`${component.name}Events`);
  const qrl = plan.names.core("QRL", { type: true });
  const members = declared.map(
    (event) => `  ${qwikEventProp(event.name)}?: ${qrl}<(${eventParameters(event)}) => void>;`,
  );
  return generatedInterface(component, name, members, component.emits!.span);
}

/** An event's payload as a listener's parameters: `value: number, note?: string`. */
function eventParameters(event: EventDeclaration): string {
  return event.parameters
    .map((parameter) => `${parameter.name}${parameter.optional ? "?" : ""}: ${parameter.type.code}`)
    .join(", ");
}

/**
 * The types an output declares, in source order: those it reaches, copied as written, and in
 * the output of the module's main component the module's type exports (ADR-0068), each a
 * statement of its own, `export type { Tone } from "./types";`, that the module prints as it is.
 */
function moduleTypes(component: UfComponent, module: UfModule): Array<TypeDeclaration> {
  const exports = typeExportsCode(component, module, (name) => name).map(({ code, span }) => ({
    name: "",
    exported: false,
    code,
    span,
  }));
  return [...componentTypes(component, module), ...exports].toSorted(
    (a, b) => a.span.start - b.span.start,
  );
}

/**
 * The type names the output writes as the source does, which its own interfaces leave alone
 * (`CardEvents` beside an imported `CardEvents` becomes `CardEvents_1`): the module's type
 * imports, its type exports, and the component's type parameters.
 */
function typeNamesOf(component: UfComponent, module: UfModule): Set<string> {
  const names = new Set<string>();
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      names.add(name.local);
    }
  }
  for (const entry of module.typeExports ?? []) {
    if (entry.kind === "Declaration") {
      names.add(entry.name);
    } else {
      for (const name of entry.names) {
        names.add(name.exported);
      }
    }
  }
  for (const parameter of component.typeParameters ?? []) {
    names.add(parameter.name);
  }
  return names;
}

/** The names of the authoring APIs code calls (`nextTick`): the output declares its own. */
function apiNames(component: UfComponent): Set<string> {
  const found = new Set<string>();
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) {
      if (reference.kind !== "Api") {
        continue;
      }
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
function joinHoisted(declarations: ReadonlyArray<string>): string {
  let text = "";
  declarations.forEach((code, index) => {
    if (index > 0) {
      text += oneLineConst(declarations[index - 1]!) && oneLineConst(code) ? "\n" : "\n\n";
    }
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
function helpers(plan: SetupPlan, listeners: Listeners): Array<string> {
  const { names } = plan;
  const found: Array<string> = [];
  if (listeners.helpers.length) {
    found.push(
      [
        "// The elements each `once` listener ran for: Qwik's listeners have no `once` option.",
        ...listeners.helpers,
      ].join("\n"),
    );
  }
  if (names.has("styleObject")) {
    // Raw, so the regular expressions keep their escapes.
    found.push(String.raw`/**
 * A style bound to a value as an object, which a merge spreads: a declaration list splits as
 * Vue's parseStringStyle splits it, with camel-case keys.
 */
function ${names.once("styleObject")}(style: object | string | null | undefined): Record<string, string> {
  if (typeof style !== "string") return { ...style };
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    const key = property!.trim();
    // A property is a custom property or a CSS identifier: anything else would reach the markup.
    if (value === undefined || !/^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key)) continue;
    // A standard name is case-insensitive, as the browser reads it: COLOR is color.
    const camel = key.toLowerCase().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object;
}`);
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
  const { composition } = plan;
  // What a component element passes through to its child's fallthrough element (ADR-0118) is
  // printed as that element's attributes, as the child's props type takes them: by `start:end`
  // of the component's span, the element's tag.
  const passedTo = new Map<string, string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Component") {
        return;
      }
      const tag = childFallthroughTag(module, node.component);
      if (tag !== undefined) {
        passedTo.set(spanKey(node.span), tag);
      }
    },
  });
  /** The element an attribute is printed on: a component's passes it on to its child's. */
  const asElement = (element: ElementNode): ElementNode => {
    const tag = element.attributes.length ? undefined : passedTo.get(spanKey(element.span));
    return tag === undefined ? element : { ...element, tag };
  };
  const namespaceOf = (element: ElementNode) =>
    namespaces.get(element) ?? (element.tag === "svg" ? "svg" : "html");
  const fills = fillExpressions(component);
  /**
   * `style={value}`, or `style={styleObject(value)}` where an object spread merges it: on the
   * element that takes a consumer's style, and on a component or a `<component is>`, whose root
   * spreads it (ADR-0054).
   */
  const wholeStyle = (value: AstExpression, element: ElementNode) => {
    const merged =
      /^[A-Z]/.test(element.tag) ||
      (composition.fallthrough !== undefined &&
        sameSpan(composition.fallthrough.target, element.span));
    return js.jsxAttribute(
      "style",
      js.jsxExpressionContainer(
        merged ? js.callExpression(js.identifier(plan.names.once("styleObject")), [value]) : value,
      ),
    );
  };
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
      if (call.type !== "CallExpression") {
        return call;
      }
      const [arrow] = call.arguments;
      if (arrow?.type !== "ArrowFunctionExpression") {
        return call;
      }
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
        if (reference.kind !== "Binding" || !reference.call) {
          continue;
        }
        const fn = plan.functions.get(reference.binding);
        if (!fn || fn.form === "module") {
          continue;
        }
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
            if (root) {
              scope!.pending.add(spanKey(node.span));
            }
          })
        : jsxDynamic(node, name, context);
      return followed.has(node)
        ? js.jsxFragment([
            element.type === "JSXElement" ? element : js.jsxExpressionContainer(element),
          ])
        : element;
    },
    // A component's native listener falls through to its child's fallthrough element
    // (ADR-0118): printed as a listener of an element of the component's listeners, a prop.
    eventAttribute: (attribute, element, context) =>
      listeners.attributes(
        attribute,
        (!element.attributes.length && plan.listeners.components.get(spanKey(element.span))) ||
          element,
        context,
      ),
    // Qwik's raw HTML prop takes the string itself (ADR-0097). Its server renders an empty
    // string as a `dangerouslysetinnerhtml=""` attribute, where it renders `undefined` as nothing
    // and its client empties the element for both: markup that may be empty is passed as
    // `markup || undefined`.
    rawHtmlAttribute: (attribute, _element, context) => {
      // A non-empty string literal is never empty.
      const literal = /^(?:"(?:[^"\\\n]|\\.)+"|'(?:[^'\\\n]|\\.)+')$/.test(attribute.value.code);
      const value = literal
        ? jsxExpression(attribute.value, context)
        : js.logicalExpression(
            "||",
            jsxExpression(attribute.value, context, "operand"),
            js.identifier("undefined"),
          );
      return [js.jsxAttribute("dangerouslySetInnerHTML", js.jsxExpressionContainer(value))];
    },
    attributeName: (name, element) => qwikAttributeName(name, namespaceOf(element)),
    staticAttribute(attribute, printedOn, context) {
      const element = asElement(printedOn);
      // A static `class` beside a spread that carries one merges with it.
      if (attribute.name === "class") {
        return staticJsxAttribute(attribute, element, context);
      }
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
    boundAttribute(attribute, printedOn, context) {
      const element = asElement(printedOn);
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
          // A `style` key is the element's style (ADR-0065).
          if (key.name === "style") {
            return wholeStyle(value, element);
          }
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
    // A style bound to a value, an object or a declaration list, is Qwik's own `style`
    // (ADR-0065), but where a consumer's merges into it.
    styleAttribute: (attribute, element, context) =>
      attribute.value
        ? [wholeStyle(jsxExpression(attribute.value, context), element)]
        : styleJsxAttribute(attribute, element, context),
    // The `data-uf-*` attributes of the styled parents that render the component, whose names
    // only they know, picked out of its props by name (the child-root rule, ADR-0063). Each
    // root takes them once: the first node printed with its span, which is the root itself,
    // printed before what it holds.
    scopeRootAttributes(element, context) {
      if (!scope?.pending.delete(spanKey(element.span))) {
        return [];
      }
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
 * <button …>`. Qwik 2.0.0-rc.5's runtime makes a `$` prop an element's listener only where
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
        // A tag candidate's attributes are an element's (ADR-0054), but those only other tags
        // take (ADR-0119).
        attributes: candidateAttributes(node, tag),
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
    // A component's native listeners fall through to its root (ADR-0118), printed as an
    // element's.
    if (
      (node.kind === "Element" || node.kind === "Dynamic" || node.kind === "Component") &&
      fill &&
      list
    ) {
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" || attribute.kind === "Model") {
          found.add(attribute);
        }
      }
    }
    if (node.kind === "Component" || node.kind === "Dynamic") {
      const fills = node.kind === "Component" ? node.fills : (node.fills ?? []);
      for (const each of fills) {
        // The default slot's plain fill is projected: it renders in the component's own segment.
        const own = each.slot === "default" && !each.parameter;
        for (const child of each.children) {
          visit(child, own ? fill : true, list);
        }
      }
      if (node.kind === "Dynamic") {
        for (const child of node.children) {
          visit(child, fill, list);
        }
      }
      return;
    }
    if (node.kind === "For") {
      return visit(node.body, fill, true);
    }
    for (const child of childrenOf(node)) {
      visit(child, fill, list);
    }
  };
  for (const child of root.kind === "Fragment" ? root.children : [root]) {
    visit(child, false, false);
  }
  return found;
}

/**
 * The conditionals and `<component is>` nodes that a sibling follows. Qwik's 2.0 betas' diff
 * inserted a node that replaces another before it, then moved each unkeyed sibling after it back
 * in place (core's `retrieveChildWithKey`), and a focused sibling lost its focus. In a fragment
 * of its own, the replacement happens among the fragment's children, and no sibling moves.
 * 2.0.0-rc.4 changed that diff ("no longer re-inserts the siblings that stay in place"), and the
 * corpus passes on rc.5 without the fragment, but no case is known to catch the lost focus, so
 * the fragment stays (ADR-0094).
 */
function replacedBeforeSiblings(root: ElementNode | FragmentNode): Set<RenderNode> {
  const found = new Set<RenderNode>();
  const visit = (children: ReadonlyArray<RenderNode>) => {
    children.forEach((child, index) => {
      if ((child.kind === "If" || child.kind === "Dynamic") && index < children.length - 1) {
        found.add(child);
      }
    });
  };
  visit(root.kind === "Fragment" ? root.children : [root]);
  walk(root, {
    enter(node) {
      if (node.kind === "Element") {
        visit(node.children);
      }
      if (node.kind === "If") {
        for (const branch of node.branches) {
          visit(branch.children);
        }
      }
      if (node.kind === "Component") {
        for (const fill of node.fills) {
          visit(fill.children);
        }
      }
      if (node.kind === "SlotOutlet") {
        visit(node.fallback);
      }
      if (node.kind === "Dynamic") {
        visit(node.children);
        for (const fill of node.fills ?? []) {
          visit(fill.children);
        }
      }
    },
  });
  return found;
}

/** `{...{ name: value }}`: an attribute under its HTML name, which Qwik's types leave unchecked. */
function untypedSpread(name: string, value: AstExpression): JsxAttribute {
  return js.jsxSpreadAttribute(js.objectExpression([[name.toLowerCase(), value]]));
}
