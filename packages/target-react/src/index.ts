import {
  bindingOf,
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  expressionCode,
  js,
  jsxContext,
  jsxNode,
  printComponentModule,
  printExpression,
  spreadStyleExpression,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, OutputFile, Target } from "@unframework/codegen";
import type {
  Attribute,
  ClassAttribute,
  ComponentAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Expression,
  FragmentNode,
  FunctionCode,
  RenderNode,
  SlotFill,
  StyleAttribute,
  TextNode,
  TypeDeclaration,
  UfComponent,
} from "@unframework/ir";

import { compilerBailout, declaredNames } from "./bailouts.ts";
import type { ComponentCode } from "./bailouts.ts";
import { placeConditionals } from "./branches.ts";
import { ReactComposer } from "./compose.ts";
import { exposedType, refValueType, SCOPE_HELPER, slotProp } from "./composition.ts";
import { cxHelper, reactDialect, styleObjectHelper } from "./dialect.ts";
import type { ReactNames } from "./dialect.ts";
import {
  modelTextHelper,
  nextTickHelper,
  refObjectHelper,
  scopeAttributesHelper,
  toggleHelper,
} from "./helpers.ts";
import type { NextTickHooks } from "./helpers.ts";
import { listenerHelpers, ReactListeners } from "./listeners.ts";
import { planComponent } from "./plan.ts";
import type { ReactPlan } from "./plan.ts";
import { reactCode } from "./rules.ts";
import { printSetup, withEventTypes } from "./setup.ts";
import { titleChildren } from "./title.ts";

type Parameter = Parameters<typeof js.functionDeclaration>[1][number];
type BindingProperty = ReturnType<typeof js.bindingProperty>;

/** The React 19 target. */
export const react: Target = defineTarget({
  name: "react",
  framework: { package: "react", range: ">=19.2 <20" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    "event-capture": { support: "native" },
    // React has no `once`: a guard per listener remembers the elements it ran for (ADR-0047).
    "event-once": {
      support: "emulated",
      helper: "useOnce",
      note: "React has no once listener, so a guard remembers each element the listener ran for, as { once: true } removes it from that element only.",
    },
    // react-dom's root listeners of `wheel`, `touchstart` and `touchmove` are passive already.
    "event-passive": { support: "native" },
    // React's synthetic events differ from the DOM's for some events: those listen natively.
    "event-semantics": {
      support: "emulated",
      helper: "listen",
      note: "Where React's synthetic event differs from the DOM's (change on a text field, a checkbox or a radio, focusin, select, non-passive wheel and touch, events React has no prop for, and focus beside a native focusin), the element's ref callback, declared once, listens natively.",
    },
    // Listeners run their handlers as the event is dispatched, controls and calls included.
    "conditional-event-control": { support: "native" },
    "use-id": { support: "native" },
    "next-tick": {
      support: "emulated",
      helper: "useNextTick",
      note: "React has no nextTick: the helper asks for a render at the priority of the code that calls it and resolves once React has rendered it, run its effects and rendered what the component's effects wrote: in the task of the click or key whose handler wrote, as on Vue, and in a later task after a watcher's write, in an effect, a timer or after an await. It resolves when the component unmounts too.",
    },
    // A rerender passes the props again, and the hooks that read one list it.
    "late-prop": { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    // React's `className` takes one string: an inline `cx` joins the parts (ADR-0038).
    "class-binding": {
      support: "emulated",
      helper: "cx",
      note: "React's className takes one string, so an inline helper joins the static names, toggles and dynamic parts.",
    },
    "style-binding": {
      support: "emulated",
      helper: "styleObject",
      note: "React's style takes an object, so a style bound to a value goes through an inline helper, `styleObject`, that splits a declaration list as Vue does (ADR-0065); declarations print as an object.",
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
      note: "A checkbox group's array goes through an inline helper, `toggle`, as Vue's `vModelCheckbox` does (ADR-0054).",
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
      note: "A provided ref is passed as an object with a `value` getter, `refObject`, made again at each render of the provider: descendants render each change, and their deferred code, after an `await` or in a timer, reads the value of their last render (ADR-0054).",
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
  },
  // A function component in TSX (plan §6, ADR-0045 to ADR-0047): the copied type
  // declarations and the events' props, the setup's hooks in source order, and the render tree in
  // React's JSX.
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { module } = context;
    // Every name the source declares or reads is taken before the output claims its own
    // (`cx`, `setCount`, `CSSProperties`, `_props`), so none captures another (ADR-0035).
    const plan = planComponent(component, module);
    const { composition } = plan;
    const code = reactCode(plan);
    const names: ReactNames = {
      imports: plan.names,
      ...(composition.fallthrough ? { style: composition.fallthrough.style } : {}),
    };
    const listeners = new ReactListeners(plan, code);
    const composer = new ReactComposer(plan, code);
    composer.connect(listeners);
    listeners.connect(composer);
    const jsx = jsxContext({
      component,
      module,
      dialect: reactDialect(names, listeners, composer),
      rules: code.rules,
    });
    importChildren(plan);
    const setup = printSetup(plan, code);
    const hooks = hookCalls(plan).map((text) => ({ text, group: -1, compact: true }));
    // The ref callbacks declared once, after the guards their listeners call.
    const callbacks = listeners
      .declarations()
      .map((text, index) => ({ text, group: -2 - index, compact: false }));
    // The returned JSX first, while its placeholders are the only ones: it prints on its own for
    // the opt-out check below. Its `modelText` fields and `<component is>`'s `const`s follow the
    // setup, and the handle of what the component exposes comes last (ADR-0054).
    const root = rootForReact(withFallthrough(component.render, plan, composer), jsx, plan);
    // A lone component or `<component is>` is the root itself, never in a fragment.
    const [only] = root.kind === "Fragment" && root.children.length === 1 ? root.children : [];
    const lone = only?.kind === "Component" || only?.kind === "Dynamic" ? only : root;
    const tree = provided(plan, jsxNode(lone, jsx));
    const rendered = [
      ...[...composition.dynamic.values()]
        .filter(({ hoisted }) => hoisted)
        .map(({ node, name }) => `const ${name} = ${expressionCode(node.is, jsx)};`),
      ...composer.fields,
    ].map((text, index) => ({ text, group: -100 - index, compact: true }));
    const handle = exposeHandle(plan);
    const body = [
      ...setup.body,
      ...hooks,
      ...callbacks,
      ...rendered,
      ...(handle ? [{ text: handle, group: -200, compact: false }] : []),
    ];
    const optOut = compilerOptOut(component, plan, jsx, [
      ...body.map(({ text }) => ({ code: text, kind: "statements" as const })),
      { code: jsx.placeholders.print(() => printExpression(tree)), kind: "expression" },
    ]);
    const parameters = propsParameters(component, jsx, plan);
    // A blank line between groups, unless both are one-line declarations, and before the return.
    const statements = body.map(({ text, group, compact }, index) => {
      const next = body[index + 1];
      const apart = !next || (next.group !== group && !(compact && next.compact));
      return jsx.placeholders.statements(apart ? `${text}\n` : text);
    });
    const fn = js.functionDeclaration(component.name, parameters, [
      ...(optOut ? [jsx.placeholders.statements(`${optOut}\n`)] : []),
      ...statements,
      js.returnStatement(tree),
    ]);
    const hoisted = [...keyDeclarations(plan), ...setup.module].map((statement) =>
      jsx.placeholders.statements(`${statement}\n`),
    );
    const types = [
      ...componentTypes(component, module),
      ...eventsInterface(plan),
      ...compositionInterfaces(plan),
    ];
    const helpers = [
      ...(names.cx ? [cxHelper(names.cx, names.cxCollections)] : []),
      ...(names.styleObject
        ? [
            styleObjectHelper(
              names.styleObject,
              names.imports.add("react", "CSSProperties", { type: true }),
            ),
          ]
        : []),
      ...listenerHelpers(plan),
      ...(plan.helpers.nextTick
        ? [nextTickHelper(plan.helpers.nextTick, nextTickHooks(plan))]
        : []),
      ...compositionHelpers(plan),
    ];
    // The sheet `compile()` emits beside the source, already scoped (ADR-0063), imported after
    // the children's outputs, so a child's sheet loads first, as plugin-vue imports a
    // component's style after its script. Collected last: the types and the helpers import
    // what they name.
    const file = module.file;
    const imports = [
      ...names.imports.toDeclarations(),
      ...(component.styles
        ? [js.importDeclaration(`./${file.slice(file.lastIndexOf("/") + 1)}.css`, [])]
        : []),
    ];
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports,
            types,
            body: [
              ...hoisted,
              ...exportDeclaration(component.name, fn, exportsOf(component.name, module.exports)),
            ],
            helpers,
            placeholders: jsx.placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

/**
 * The children's outputs and the keys' (ADR-0053, ADR-0054): each is the sibling file its
 * component names (`./Field`), imported as the source imports it. A component that renders
 * itself calls its own function.
 */
function importChildren(plan: ReactPlan): void {
  const { names, composition } = plan;
  for (const child of composition.children) {
    if (child.self) continue;
    if (child.export === "default") names.addDefault(child.specifier, child.local, { exact: true });
    else names.add(child.specifier, child.name, { local: child.local, exact: true });
  }
  for (const key of composition.keys) {
    if (key.specifier) names.add(key.specifier, key.name, { local: key.local, exact: true });
  }
}

/**
 * The module's injection keys, declared by the output of its main component (ADR-0054): each a
 * React context of the key's type, `undefined` where nothing provides it; a ref the key holds is
 * passed as `{ value }` (`refObject`).
 */
function keyDeclarations(plan: ReactPlan): string[] {
  if (!plan.composition.ownsKeys) return [];
  const createContext = plan.names.add("react", "createContext");
  return plan.module.keys!.map((key) => {
    const value = refValueType(key.type.code);
    const type = key.ref ? `{ readonly value: ${value} }` : key.type.code;
    return `export const ${key.name} = ${createContext}<${type} | undefined>(undefined);`;
  });
}

/**
 * The root with what it takes from a consumer (ADR-0054): the `className` prop joined to its
 * `class`, and the `style` prop spread after its own declarations, so the consumer's win.
 */
function withFallthrough(
  root: ElementNode | FragmentNode,
  plan: ReactPlan,
  composer: ReactComposer,
): ElementNode | FragmentNode {
  const { fallthrough } = plan.composition;
  if (!fallthrough) return root;
  const target = fallthrough.root;
  const consumer: Expression = { code: fallthrough.className, span: target.span, refs: [] };
  if (target.kind === "Element") {
    return { ...target, attributes: fallthroughAttributes(target, consumer, composer) };
  }
  const attributes = fallthroughAttributes(target, consumer, composer);
  return { ...root, children: [{ ...target, attributes }] };
}

/**
 * The root's attributes with the consumer's `class` joined to its own and its `style` marked to
 * take the consumer's last: added where it has none.
 */
function fallthroughAttributes<T extends Attribute | ComponentAttribute>(
  target: { attributes: readonly T[]; span: ElementNode["span"] },
  consumer: Expression,
  composer: ReactComposer,
): (T | ClassAttribute | StyleAttribute)[] {
  const { span } = target;
  const attributes: (T | ClassAttribute | StyleAttribute)[] = [];
  let classed = false;
  let styled = false;
  for (const attribute of target.attributes) {
    if (attribute.kind === "Class") {
      classed = true;
      attributes.push({
        ...attribute,
        items: [...attribute.items, { kind: "Dynamic", value: consumer, span }],
      });
    } else if (attribute.kind === "Static" && attribute.name === "class") {
      classed = true;
      attributes.push({
        kind: "Class",
        items: [
          { kind: "Static", value: String(attribute.value), span: attribute.span },
          { kind: "Dynamic", value: consumer, span },
        ],
        span: attribute.span,
      });
    } else if (attribute.kind === "Style") {
      styled = true;
      const merged: StyleAttribute = { ...attribute };
      composer.fallthroughStyles.add(merged);
      attributes.push(merged);
    } else if (attribute.kind === "Spread" && attribute.keys.some((key) => key.name === "style")) {
      // A spread's `style` is the root's own (ADR-0065): the consumer's merges over it.
      styled = true;
      const keys = attribute.keys.filter((key) => key.name !== "style");
      const merged: StyleAttribute = {
        kind: "Style",
        declarations: [],
        value: spreadStyleExpression(attribute),
        span: attribute.span,
      };
      composer.fallthroughStyles.add(merged);
      attributes.push({ ...attribute, keys }, merged);
    } else {
      attributes.push(attribute);
    }
  }
  if (!classed) {
    const bare: ClassAttribute = {
      kind: "Class",
      items: [{ kind: "Dynamic", value: consumer, span }],
      span,
    };
    composer.bareClasses.add(bare);
    attributes.push(bare);
  }
  if (!styled) {
    const bare: StyleAttribute = { kind: "Style", declarations: [], span };
    composer.fallthroughStyles.add(bare);
    attributes.push(bare);
  }
  return attributes;
}

/**
 * The template inside the providers of what the setup provides, the first outermost
 * (`<ThemeKey value={themeValue}>`, React 19's context provider, ADR-0054).
 */
function provided(plan: ReactPlan, tree: ReturnType<typeof jsxNode>): ReturnType<typeof jsxNode> {
  let wrapped = tree;
  for (const [item, local] of [...plan.composition.provided].toReversed()) {
    const children =
      wrapped.type === "JSXFragment"
        ? wrapped.children
        : [wrapped.type === "JSXElement" ? wrapped : js.jsxExpressionContainer(wrapped)];
    wrapped = js.jsxElement(
      item.key,
      [js.jsxAttribute("value", js.jsxExpressionContainer(js.identifier(local)))],
      children,
    );
  }
  return wrapped;
}

/** `useImperativeHandle(ref, () => ({ focus }));`: what the component exposes (ADR-0054). */
function exposeHandle(plan: ReactPlan): string | undefined {
  const { expose } = plan.composition;
  const exposes = plan.component.exposes;
  if (!expose || !exposes) return undefined;
  const useImperativeHandle = plan.names.add("react", "useImperativeHandle");
  const members = exposes.functions.map((id) => {
    const { name } = plan.bindings.get(id)!;
    const variant = plan.clientVariants.get(id);
    return variant ? `${name}: ${variant}` : name;
  });
  return `${useImperativeHandle}(${expose.ref}, () => ({ ${members.join(", ")} }));`;
}

/**
 * The interfaces of what composition adds to the props (ADR-0054): the slots (a node each, a
 * render prop for a scoped one), the models (each with its change callback), and the root's
 * `className`, `style` and the `ref` that holds the handle; and the handle's own interface.
 */
function compositionInterfaces(plan: ReactPlan): TypeDeclaration[] {
  const { composition, component } = plan;
  const type = (name: string) => plan.names.add("react", name, { type: true });
  const declarations: TypeDeclaration[] = [];
  const declare = (name: string, members: string[]) => {
    const text = `interface ${name} {\n${members.map((member) => `  ${member}`).join("\n")}\n}`;
    declarations.push({ name, exported: true, code: text, span: component.span });
  };
  const { interfaces } = composition;
  if (interfaces.models) {
    declare(
      interfaces.models,
      [...composition.models.values()].flatMap(({ item, prop, event }) => {
        const valueType = item.type?.code ?? "unknown";
        // Without a default, an unbound model starts \`undefined\`, which a write may hand on.
        const written = item.default || item.required ? valueType : `${valueType} | undefined`;
        return [
          `${prop}${item.required ? "" : "?"}: ${valueType};`,
          `${event}?: (${PARAMETER}: ${written}) => void;`,
        ];
      }),
    );
  }
  if (interfaces.slots) {
    const node = type("ReactNode");
    declare(
      interfaces.slots,
      component.slots!.slots.map((slot) =>
        slot.props
          ? `${slotProp(slot.name, true)}?: (props: ${slot.props.code}) => ${node};`
          : `${slotProp(slot.name, false)}?: ${node};`,
      ),
    );
  }
  if (composition.expose && component.exposes) {
    declare(
      composition.expose.handle,
      component.exposes.functions.map((id) => {
        const { name } = plan.bindings.get(id)!;
        const item = component.setup.find(
          (entry) => entry.kind === "Function" && entry.binding === id,
        );
        const fn =
          item?.kind === "Function" ? withEventTypes(plan, item.function, undefined) : undefined;
        const parameters = fn ? parametersOf(fn) : "";
        return `${name}${fn ? exposedType(fn, parameters) : "(): void"};`;
      }),
    );
  }
  if (interfaces.attributes) {
    const members: string[] = [];
    if (composition.fallthrough) {
      members.push("className?: string;", `style?: ${type("CSSProperties")};`);
    }
    if (composition.expose) members.push(`ref?: ${type("Ref")}<${composition.expose.handle}>;`);
    declare(interfaces.attributes, members);
  }
  return declarations;
}

/** The name a callback's type gives its one parameter: any name, never a keyword's. */
const PARAMETER = "value";

/** A function's parameters as a type writes them: each with its annotation, `unknown` without. */
function parametersOf(fn: FunctionCode): string {
  return fn.parameters
    .map((parameter, index) => {
      // A type takes no pattern with a default (TS2371): a pattern is a placeholder's name.
      const name =
        parameter.name ?? (fn.parameters.length > 1 ? `${PARAMETER}${index + 1}` : PARAMETER);
      const rest = parameter.rest ? "..." : "";
      const optional = parameter.optional || parameter.default ? "?" : "";
      return `${rest}${name}${optional}: ${parameter.type?.code ?? (parameter.rest ? "unknown[]" : "unknown")}`;
    })
    .join(", ");
}

/** The inline helpers composition needs, after the component (ADR-0055). */
function compositionHelpers(plan: ReactPlan): string[] {
  const { helpers, names } = plan;
  return [
    ...(plan.composition.scope ? [scopeAttributesHelper(plan.composition.scope.helper)] : []),
    ...(helpers.refObject ? [refObjectHelper(helpers.refObject)] : []),
    ...(helpers.toggle ? [toggleHelper(helpers.toggle)] : []),
    ...(helpers.modelText
      ? [
          modelTextHelper(helpers.modelText, {
            useState: names.add("react", "useState"),
            ChangeEvent: names.add("react", "ChangeEvent", { type: true }),
            looseToNumber: names.claim("looseToNumber"),
          }),
        ]
      : []),
  ];
}

/** The hooks the listeners call, after the setup's: one guard per listener that runs once. */
function hookCalls(plan: ReactPlan): string[] {
  return [...plan.onceGuards.values()].map((guard) => `const ${guard} = ${plan.helpers.once!}();`);
}

/**
 * The directive that opts the component out of React Compiler, with the comment that says why,
 * where its code holds a shape React Compiler 1.0 cannot compile yet (`compilerBailout`): its
 * parameters' defaults, its body's statements and its returned JSX.
 */
function compilerOptOut(
  component: UfComponent,
  plan: ReactPlan,
  context: JsxContext,
  code: ComponentCode[],
): string | undefined {
  const parameter = component.propsParameter;
  const read = (parameter ? component.props : []).filter(
    (prop) => prop.binding !== undefined && context.referenced.has(prop.binding),
  );
  const defaults: ComponentCode[] = [];
  const locals = declaredNames(code);
  if (parameter?.form === "object") {
    locals.add(parameter.name!);
  } else {
    for (const prop of read) {
      locals.add(prop.name);
      if (prop.default) defaults.push({ code: prop.default.code, kind: "default" });
    }
    for (const event of plan.events.values()) if (event.emitted) locals.add(event.local);
  }
  const reason = compilerBailout([...defaults, ...code], locals);
  if (!reason) return undefined;
  return `// React Compiler 1.0 cannot compile ${reason} yet: the component opts out of it.\n"use no memo";`;
}

/** The local names of the hooks `useNextTick` calls. */
function nextTickHooks(plan: ReactPlan): NextTickHooks {
  return {
    useRef: plan.names.add("react", "useRef"),
    useReducer: plan.names.add("react", "useReducer"),
    useEffect: plan.names.add("react", "useEffect"),
  };
}

/**
 * The interface of the events' props, `CounterEvents` (ADR-0047): a member per event the
 * component declares, `onChange?: (value: number) => void`, with the payload's named members as
 * the listener's parameters. The component's parameter is typed with the props' type and it.
 */
function eventsInterface(plan: ReactPlan): TypeDeclaration[] {
  const { emits } = plan.component;
  if (!emits || !plan.eventsInterface) return [];
  const members = emits.events.map((event) => {
    const parameters = event.parameters
      .map(
        (parameter) => `${parameter.name}${parameter.optional ? "?" : ""}: ${parameter.type.code}`,
      )
      .join(", ");
    return `  ${plan.events.get(event.name)!.prop}?: (${parameters}) => void;`;
  });
  const code = `interface ${plan.eventsInterface} {\n${members.join("\n")}\n}`;
  return [{ name: plan.eventsInterface, exported: true, code, span: emits.span }];
}

/**
 * The component's parameters, as the source declares its props (ADR-0034): the destructured
 * props in source order, with their defaults, then the events' props that code emits (ADR-0047), or
 * the props object, typed as written and with the events' interface. A prop that no printed
 * expression reads is left out with its default, and a parameter nothing reads is named `_props`
 * (or `_` and the object's name): an unused binding, or an empty pattern, fails L5.
 */
function propsParameters(
  component: UfComponent,
  context: JsxContext,
  plan: ReactPlan,
): Parameter[] {
  const parameter = component.propsParameter;
  const { names, composition } = plan;
  const { slots, models, attributes } = composition.interfaces;
  const typeCode = [parameter?.type.code, plan.eventsInterface, models, slots, attributes]
    .filter((part) => part !== undefined)
    .join(" & ");
  const { scope } = composition;
  // A component without props still takes the scope attributes of the styled parents that
  // render it, as an object (ADR-0063).
  if (!typeCode && !scope) return [];
  const type = context.placeholders.type(typeCode || "object");
  const read = (parameter ? component.props : []).filter(
    (prop) => prop.binding !== undefined && context.referenced.has(prop.binding),
  );
  // What composition reads of the props (ADR-0054), each as `[prop, local, default]`.
  const composed: [string, string, Expression?][] = [];
  for (const model of composition.models.values()) {
    if (!model.local && !context.referenced.has(model.item.binding)) continue;
    composed.push([model.prop, model.propLocal, model.local ? undefined : model.item.default]);
    if (model.calls) composed.push([model.event, model.eventLocal]);
  }
  for (const slot of composition.slots.values()) {
    if (slot.read) composed.push([slot.prop, slot.local]);
  }
  const { fallthrough, expose } = composition;
  if (fallthrough)
    composed.push(["className", fallthrough.className], ["style", fallthrough.style]);
  if (expose) composed.push(["ref", expose.ref]);
  // The rest the roots pick their styled parents' scope attributes out of (ADR-0063).
  const rest = scope && parameter?.form !== "object" ? scope.props : undefined;
  if (parameter?.form === "object") {
    // A name `_` and more says it is unused already: it stays the source's (oxlint still
    // reports a bare `_`).
    const emitted = [...plan.events.values()].some((event) => event.emitted);
    const name =
      read.length || emitted || composed.length || scope || /^_./.test(parameter.name!)
        ? parameter.name!
        : names.claim(`_${parameter.name!}`);
    return [js.bindingIdentifier(name, type)];
  }
  const start = (binding: string) => bindingOf(component, binding).span.start;
  const properties: BindingProperty[] = read
    .toSorted((a, b) => start(a.binding!) - start(b.binding!))
    .map((prop) =>
      js.bindingProperty(
        prop.name,
        prop.default && context.placeholders.expression(prop.default.code),
      ),
    );
  for (const event of plan.events.values()) {
    if (event.emitted) properties.push(renamedProperty(event.prop, event.local));
  }
  for (const [prop, local, initial] of composed) {
    properties.push(
      renamedProperty(prop, local, initial && context.placeholders.expression(initial.code)),
    );
  }
  if (!properties.length) return [js.bindingIdentifier(rest ?? names.claim("_props"), type)];
  return [js.objectPattern([...properties, ...(rest ? [js.bindingRestElement(rest)] : [])], type)];
}

/**
 * A property of an object pattern, `onChange` or `onChange: onChange_1` where the name is taken,
 * with its default where it has one (`expanded: open = false`).
 */
function renamedProperty(
  key: string,
  local: string,
  initial?: ReturnType<typeof js.identifier>,
): BindingProperty {
  if (key === local) return js.bindingProperty(key, initial);
  const property = js.bindingProperty(key);
  const value = js.bindingIdentifier(local);
  return {
    ...property,
    shorthand: false,
    value: initial ? js.assignmentPattern(value, initial) : value,
  };
}

/** {@link forReact} over the render root: an element, or a fragment's roots. */
function rootForReact(
  root: ElementNode | FragmentNode,
  context: JsxContext,
  plan: ReactPlan,
): ElementNode | FragmentNode {
  if (root.kind === "Element") return forReact(root, context, plan);
  return {
    ...root,
    children: placed(root.children.map((child) => childForReact(child, context, plan))),
  };
}

/** Children as their parent prints them, their keyed conditionals placed (`placeConditionals`). */
function placed(children: RenderNode[]): RenderNode[] {
  placeConditionals(children);
  return children;
}

/** {@link forReact} over a node, inside conditionals, lists, and composition's content too. */
function childForReact(node: RenderNode, context: JsxContext, plan: ReactPlan): RenderNode {
  const children = (nodes: readonly RenderNode[]) =>
    placed(nodes.map((child) => childForReact(child, context, plan)));
  switch (node.kind) {
    case "Element":
      return forReact(node, context, plan);
    case "If":
      return {
        ...node,
        branches: node.branches.map((branch) => ({
          ...branch,
          children: branch.children.map((child) => childForReact(child, context, plan)),
        })),
      };
    case "For":
      return {
        ...node,
        body:
          node.body.kind === "Element"
            ? forReact(node.body, context, plan)
            : componentForReact(node.body, context, plan),
      };
    case "Component":
      return componentForReact(node, context, plan);
    case "SlotOutlet":
      return { ...node, fallback: children(node.fallback) };
    case "Dynamic":
      return {
        ...node,
        children: children(node.children),
        ...(node.fills
          ? { fills: node.fills.map((fill) => fillForReact(fill, node, context, plan, children)) }
          : {}),
      };
    case "Text":
    case "Interpolation":
      return node;
    default:
      return node satisfies never;
  }
}

/** A component with its fills as React passes them ({@link fillForReact}). */
function componentForReact(
  node: ComponentNode,
  context: JsxContext,
  plan: ReactPlan,
): ComponentNode {
  const children = (nodes: readonly RenderNode[]) =>
    placed(nodes.map((child) => childForReact(child, context, plan)));
  return {
    ...node,
    fills: node.fills.map((fill) => fillForReact(fill, node, context, plan, children)),
  };
}

/**
 * A fill as React passes it. A forwarded default slot is the children React renders, so it is
 * written as the component's own slot rendered there (`<Box>{children}</Box>`): JSX passes
 * children as content, never as a `children` prop. A scoped one stays a render prop.
 */
function fillForReact(
  fill: SlotFill,
  node: ComponentNode | DynamicNode,
  context: JsxContext,
  plan: ReactPlan,
  children: (nodes: readonly RenderNode[]) => RenderNode[],
): SlotFill {
  const own =
    fill.forward && context.component.slots?.slots.find((slot) => slot.name === fill.forward);
  if (fill.slot === "default" && own && !own.props) {
    const { forward: _forward, ...rest } = fill;
    return {
      ...rest,
      children: [{ kind: "SlotOutlet", slot: own.name, fallback: [], span: fill.span }],
    };
  }
  const component =
    node.kind === "Component"
      ? node.component
      : node.candidates.find((candidate) => candidate.kind === "Component")?.component;
  // A scoped default slot filled without a parameter is a render prop all the same: a parameter
  // with no name marks it, so the printer passes it as one (`fillAttribute`).
  if (
    fill.slot === "default" &&
    !fill.parameter &&
    !fill.forward &&
    component !== undefined &&
    plan.composition.scoped(component, "default")
  ) {
    return { ...fill, parameter: { span: fill.span }, children: children(fill.children) };
  }
  return { ...fill, children: children(fill.children) };
}

/**
 * Applies React's rules for the elements whose children React reads as one value. An SVG
 * `<title>` gets one child wherever its content has several parts (see `titleChildren`); the
 * IR holds no HTML `<title>` (UF3002). A `<textarea>`: React warns about its children and takes
 * its initial text from `defaultValue`, so the text becomes a `value` attribute, which the
 * dialect writes as `defaultValue`. The IR holds no `value` on one (form state, M3) and no
 * interpolation, conditional or list in one; the analyser rejects an element there too (UF3003),
 * and the target throws on one rather than drop it (a target that throws is reported by the
 * compiler).
 */
function forReact(node: ElementNode, context: JsxContext, plan: ReactPlan): ElementNode {
  if (node.tag === "title") return { ...node, children: titleChildren(node.children, context) };
  if (node.tag !== "textarea" || node.children.length === 0) {
    return {
      ...node,
      children: placed(node.children.map((child) => childForReact(child, context, plan))),
    };
  }
  const texts = node.children.filter((child): child is TextNode => child.kind === "Text");
  if (texts.length !== node.children.length) {
    throw new Error("A <textarea> holds only text: the analyser rejects anything else (UF3003).");
  }
  const content: Attribute = {
    kind: "Static",
    name: "value",
    value: texts.map((text) => text.value).join(""),
    span: { start: texts[0]!.span.start, end: texts.at(-1)!.span.end },
  };
  return { ...node, attributes: [...node.attributes, content], children: [] };
}

export default react;
