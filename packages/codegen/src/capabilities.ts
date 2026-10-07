import { listBoxSize, summarizeCode, walk } from "@unframework/ir";
import type {
  Attribute,
  BindingId,
  Code,
  ElementNode,
  EventAttribute,
  FunctionCode,
  SetupItem,
  Span,
  UfComponent,
  UfModule,
  VisitedNode,
} from "@unframework/ir";

import { handedControls, handlerControls } from "./controls.ts";
import type { CapabilityName } from "./target.ts";

// Records, so that a node, attribute or setup item kind added to the IR cannot be left without
// a decision on its capabilities. A root fragment is a node `walk` visits, and needs the
// `fragment` capability.
const NODE_CAPABILITIES: Readonly<Record<VisitedNode["kind"], CapabilityName>> = {
  Element: "element",
  Text: "text",
  Interpolation: "interpolation",
  If: "conditional",
  For: "list",
  Fragment: "fragment",
};
const ATTRIBUTE_CAPABILITIES: Readonly<Record<Attribute["kind"], CapabilityName>> = {
  Static: "static-attribute",
  Bound: "bound-attribute",
  Class: "class-binding",
  Style: "style-binding",
  Spread: "attribute-spread",
  // A listener and a template ref do nothing without code running in the browser (ADR-0047,
  // ADR-0049).
  Event: "interactivity",
  Ref: "interactivity",
};
/**
 * What each kind of setup item needs (ADR-0047): watchers, effects and hooks run only in the
 * browser, and `useId` reads the framework's id. State, derived values and functions need nothing
 * of their own: only what changes them in the browser does, and that is a listener, a watcher, an
 * effect or a hook.
 */
const SETUP_ITEM_CAPABILITIES: Readonly<Record<SetupItem["kind"], readonly CapabilityName[]>> = {
  State: [],
  Derived: [],
  TemplateRef: [],
  Id: ["use-id"],
  Const: [],
  Variable: [],
  Function: [],
  Watch: ["interactivity"],
  WatchEffect: ["interactivity"],
  Lifecycle: ["interactivity"],
};
/** A listener's options, each a capability of its own (ADR-0047). */
const OPTION_CAPABILITIES = {
  capture: "event-capture",
  once: "event-once",
  passive: "event-passive",
} as const satisfies Record<keyof Pick<EventAttribute, "capture" | "once" | "passive">, string>;

/**
 * The capabilities a module uses, derived from its IR, each with the span where it is first
 * used, in that order. The compiler's capability check (P4) reports there a capability a target
 * cannot support, and the render-parity kit leaves out on a target the cases that use one: one
 * derivation, so what the compiler rejects and what the tests skip cannot disagree.
 *
 * For each component, in source order: `props` where a component that takes props declares its
 * parameter; then its setup items (`interactivity` at a watcher, a `watchEffect` or a lifecycle
 * hook, `use-id` at a `useId()`, `next-tick` at a `nextTick` in their code, `late-prop` where a
 * derived value's getter, a watch source or a `watchEffect` reads an optional prop), and
 * `conditional-event-control` where client code hands a local function that makes an event
 * control to a call that may run it, or calls one outside a template listener's top
 * (`handedControls`);
 * then its render tree: the node and attribute kinds (a listener and a template ref need
 * `interactivity`), `svg` at an `<svg>`, `listbox` at what may make a `<select>` a
 * single-selection list box (`listBoxSize`), and at a listener `event-semantics`, its option's
 * capability (`event-capture`, `event-once`, `event-passive`), `next-tick` in an inline handler,
 * and `conditional-event-control` at a control, or a call that reaches one, that is not at the
 * top of the listener, at a `once` listener whose control depends on more than the event
 * (`handlerControls`), or at a capture listener with a control where an element of the
 * component listens to the event in both phases.
 */
export function requiredCapabilities(module: UfModule): ReadonlyMap<CapabilityName, Span> {
  const required = new Map<CapabilityName, Span>();
  const use = (capability: CapabilityName, span: Span) => {
    if (!required.has(capability)) required.set(capability, span);
  };
  const scan = (code: Code) => {
    for (const reference of code.refs) {
      if (reference.kind === "Api") use("next-tick", reference.span);
    }
  };
  for (const component of module.components) {
    const functions = new Map<BindingId, FunctionCode>();
    for (const item of component.setup) {
      if (item.kind === "Function") functions.set(item.binding, item.function);
    }
    const [first] = component.props;
    if (first) use("props", component.propsParameter?.span ?? first.span);
    const optional = new Set(
      component.props.flatMap((prop) =>
        prop.optional && prop.binding !== undefined ? [prop.binding] : [],
      ),
    );
    for (const item of component.setup) {
      for (const capability of SETUP_ITEM_CAPABILITIES[item.kind]) use(capability, item.span);
      for (const code of itemCode(item)) scan(code);
      for (const code of trackedCode(item)) {
        const read = optionalRead(code, component, optional);
        if (read) use("late-prop", read);
      }
    }
    for (const span of handedControls(component)) use("conditional-event-control", span);
    const mixed = bothPhaseEvents(component);
    walk(component.render, {
      enter(node) {
        use(NODE_CAPABILITIES[node.kind], node.span);
        if (node.kind !== "Element") return;
        if (node.tag === "svg") use("svg", node.span);
        for (const attribute of node.attributes) {
          use(ATTRIBUTE_CAPABILITIES[attribute.kind], attribute.span);
          if (attribute.kind !== "Event") continue;
          use("event-semantics", attribute.span);
          for (const option of ["capture", "once", "passive"] as const) {
            if (attribute[option]) use(OPTION_CAPABILITIES[option], attribute.span);
          }
          if (attribute.handler.kind === "Inline") {
            for (const code of functionCode(attribute.handler.function)) scan(code);
          }
          const handler =
            attribute.handler.kind === "Inline"
              ? attribute.handler.function
              : functions.get(attribute.handler.binding);
          if (handler) {
            const { controls, unliftable } = handlerControls(handler, component);
            for (const span of unliftable) use("conditional-event-control", span);
            // A `once` listener's control runs on its first event only: under a condition, or
            // on an element that listens to the event in both phases, a target that runs it
            // apart from the handler cannot tell which event that is. Where an element of the
            // component listens to the event in both phases, a capture listener cannot run at
            // its element's place on such a target (Qwik runs it from the window), and neither
            // can its control.
            if (
              controls.length &&
              ((attribute.once &&
                (controls.some(({ control, tests }) => tests.length || control.condition) ||
                  bothPhases(node, attribute.event))) ||
                (attribute.capture && mixed.has(attribute.event)))
            ) {
              use("conditional-event-control", attribute.span);
            }
          }
        }
        const size = listBoxSize(node);
        if (size) use("listbox", size.span);
      },
    });
  }
  return required;
}

/** The events some element of a component listens to in both phases. */
function bothPhaseEvents(component: UfComponent): Set<string> {
  const events = new Set<string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" && bothPhases(node, attribute.event)) {
          events.add(attribute.event);
        }
      }
    },
  });
  return events;
}

/** Whether an element listens to an event in both phases. */
function bothPhases(element: ElementNode, event: string): boolean {
  const phases = new Set(
    element.attributes.flatMap((attribute) =>
      attribute.kind === "Event" && attribute.event === event ? [attribute.capture === true] : [],
    ),
  );
  return phases.size === 2;
}

/**
 * The code of a setup item whose reads a framework subscribes to as it runs, which runs again
 * when they change: a derived value's getter, a watch's getter sources, a `watchEffect`.
 */
function trackedCode(item: SetupItem): Code[] {
  switch (item.kind) {
    case "Derived":
      return [item.getter.body];
    case "Watch":
      return item.sources.flatMap((source) =>
        source.kind === "Getter" ? [source.getter.body] : [],
      );
    case "WatchEffect":
      return [item.effect.body];
    case "State":
    case "Variable":
    case "Const":
    case "Function":
    case "Lifecycle":
    case "TemplateRef":
    case "Id":
      return [];
    default:
      return unreachable(item);
  }
}

/**
 * Where code reads one of `optional`'s props, itself (the reference) or through the functions it
 * calls (the code), if it does.
 */
function optionalRead(
  code: Code,
  component: UfComponent,
  optional: ReadonlySet<BindingId>,
): Span | undefined {
  if (!optional.size) return undefined;
  const direct = code.refs.find(
    (reference) => reference.kind === "Binding" && optional.has(reference.binding),
  );
  if (direct) return direct.span;
  const { reads } = summarizeCode(code, component);
  return [...reads].some((id) => optional.has(id)) ? code.span : undefined;
}

/** The code of a setup item, in source order. */
function itemCode(item: SetupItem): Code[] {
  switch (item.kind) {
    case "State":
    case "Variable":
      return item.initial ? [item.initial] : [];
    case "Const":
      return [item.value];
    case "Derived":
      return functionCode(item.getter);
    case "Function":
      return functionCode(item.function);
    case "Watch":
      return [
        ...item.sources.flatMap((source) =>
          source.kind === "Getter" ? functionCode(source.getter) : [],
        ),
        ...functionCode(item.callback),
      ];
    case "WatchEffect":
      return functionCode(item.effect);
    case "Lifecycle":
      return functionCode(item.callback);
    case "TemplateRef":
    case "Id":
      return [];
    default:
      return unreachable(item);
  }
}

/** A function's code: its body. Its event controls' conditions repeat a part of it. */
function functionCode(fn: FunctionCode): Code[] {
  return [fn.body];
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
