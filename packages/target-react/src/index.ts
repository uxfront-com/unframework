import {
  bindingOf,
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  js,
  jsxContext,
  jsxNode,
  printComponentModule,
  printExpression,
} from "@unframework/codegen";
import type { EmitContext, JsxContext, OutputFile, Target } from "@unframework/codegen";
import type {
  Attribute,
  ElementNode,
  FragmentNode,
  RenderNode,
  TextNode,
  TypeDeclaration,
  UfComponent,
} from "@unframework/ir";

import { compilerBailout, declaredNames } from "./bailouts.ts";
import type { ComponentCode } from "./bailouts.ts";
import { placeConditionals } from "./branches.ts";
import { cxHelper, reactDialect } from "./dialect.ts";
import type { ReactNames } from "./dialect.ts";
import { nextTickHelper } from "./helpers.ts";
import type { NextTickHooks } from "./helpers.ts";
import { listenerHelpers, ReactListeners } from "./listeners.ts";
import { planComponent } from "./plan.ts";
import type { ReactPlan } from "./plan.ts";
import { reactCode } from "./rules.ts";
import { printSetup } from "./setup.ts";
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
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
  },
  // A function component in TSX (plan §6, ADR-0045 to ADR-0047): the copied type
  // declarations and the events' props, the setup's hooks in source order, and the render tree in
  // React's JSX.
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { module } = context;
    // Every name the source declares or reads is taken before the output claims its own
    // (`cx`, `setCount`, `CSSProperties`, `_props`), so none captures another (ADR-0035).
    const plan = planComponent(component, module);
    const code = reactCode(plan);
    const names: ReactNames = { imports: plan.names };
    const listeners = new ReactListeners(plan, code);
    const jsx = jsxContext({
      component,
      dialect: reactDialect(names, listeners),
      rules: code.rules,
    });
    const setup = printSetup(plan, code);
    const hooks = hookCalls(plan).map((text) => ({ text, group: -1, compact: true }));
    // The ref callbacks declared once, after the guards their listeners call.
    const callbacks = listeners
      .declarations()
      .map((text, index) => ({ text, group: -2 - index, compact: false }));
    const body = [...setup.body, ...hooks, ...callbacks];
    // The returned JSX first, while its placeholders are the only ones: it prints on its own for
    // the opt-out check below.
    const tree = jsxNode(rootForReact(component.render, jsx), jsx);
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
    const hoisted = setup.module.map((statement) => jsx.placeholders.statements(`${statement}\n`));
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports: names.imports,
            types: [...componentTypes(component, module), ...eventsInterface(plan)],
            body: [
              ...hoisted,
              ...exportDeclaration(component.name, fn, exportsOf(component.name, module.exports)),
            ],
            helpers: [
              ...(names.cx ? [cxHelper(names.cx)] : []),
              ...listenerHelpers(plan),
              ...(plan.helpers.nextTick
                ? [nextTickHelper(plan.helpers.nextTick, nextTickHooks(plan))]
                : []),
            ],
            placeholders: jsx.placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

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
  const { names } = plan;
  const events = plan.eventsInterface;
  const typeCode = parameter
    ? events
      ? `${parameter.type.code} & ${events}`
      : parameter.type.code
    : events;
  if (!typeCode) return [];
  const type = context.placeholders.type(typeCode);
  const read = (parameter ? component.props : []).filter(
    (prop) => prop.binding !== undefined && context.referenced.has(prop.binding),
  );
  if (parameter?.form === "object") {
    // A name `_` and more says it is unused already: it stays the source's (oxlint still
    // reports a bare `_`).
    const emitted = [...plan.events.values()].some((event) => event.emitted);
    const name =
      read.length || emitted || /^_./.test(parameter.name!)
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
  if (!properties.length) return [js.bindingIdentifier(names.claim("_props"), type)];
  return [js.objectPattern(properties, type)];
}

/** A property of an object pattern, `onChange` or `onChange: onChange_1` where the name is taken. */
function renamedProperty(key: string, local: string): BindingProperty {
  if (key === local) return js.bindingProperty(key);
  const property = js.bindingProperty(key);
  return { ...property, shorthand: false, value: js.bindingIdentifier(local) };
}

/** {@link forReact} over the render root: an element, or a fragment's roots. */
function rootForReact(
  root: ElementNode | FragmentNode,
  context: JsxContext,
): ElementNode | FragmentNode {
  if (root.kind === "Element") return forReact(root, context);
  return { ...root, children: placed(root.children.map((child) => childForReact(child, context))) };
}

/** Children as their parent prints them, their keyed conditionals placed (`placeConditionals`). */
function placed(children: RenderNode[]): RenderNode[] {
  placeConditionals(children);
  return children;
}

/** {@link forReact} over a node, inside conditionals and lists too. */
function childForReact(node: RenderNode, context: JsxContext): RenderNode {
  switch (node.kind) {
    case "Element":
      return forReact(node, context);
    case "If":
      return {
        ...node,
        branches: node.branches.map((branch) => ({
          ...branch,
          children: branch.children.map((child) => childForReact(child, context)),
        })),
      };
    case "For":
      return { ...node, body: forReact(node.body, context) };
    case "Text":
    case "Interpolation":
      return node;
    default:
      return node satisfies never;
  }
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
function forReact(node: ElementNode, context: JsxContext): ElementNode {
  if (node.tag === "title") return { ...node, children: titleChildren(node.children, context) };
  if (node.tag !== "textarea" || node.children.length === 0) {
    return {
      ...node,
      children: placed(node.children.map((child) => childForReact(child, context))),
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
