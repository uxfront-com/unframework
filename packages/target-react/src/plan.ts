// What React needs to know about a component before it prints one statement (ADR-0046):
// which state client code writes (a mirror ref beside it, so every client read after a write sees
// it), which derived values client code reads (a live getter over the mirrors), which props and
// events deferred code reads (a prop mirror, synced after every render), which setup values and
// functions capture nothing of the component (hoisted to module scope), which local functions a
// template calls (printed for render, with a client variant where client code needs mirrors),
// and which listeners React's synthetic events cannot keep the DOM's semantics for (native). The
// names the output introduces are claimed here, after the source's own, in a fixed order (P8).
import {
  codeKind,
  ImportSet,
  parseCodeSource,
  pascalCase,
  sourceNames,
} from "@unframework/codegen";
import {
  codeOf,
  expressionsOf,
  functionsOf,
  summarize,
  summarizeCode,
  walk,
} from "@unframework/ir";
import type {
  Binding,
  BindingId,
  BindingKind,
  Code,
  ElementNode,
  EventAttribute,
  FunctionCode,
  FunctionSummary,
  Parameter,
  RefAttribute,
  RenderNode,
  Span,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { elementInterface } from "./elements.ts";
import { synthetic } from "./events.ts";

/** A `state` binding: `const [count, setCount] = useState(…)`, and its mirror when written. */
export interface StatePlan {
  name: string;
  /** The setter: absent when no code writes the state (an unused setter fails L5). */
  setter?: string;
  /** The mirror ref client code reads and writes, `countRef`: present when client code writes. */
  mirror?: string;
}

/** A `derived` binding: `const total = useMemo(…)`, and its live getter when client code reads it. */
export interface DerivedPlan {
  name: string;
  /** Whether render code reads the memo: otherwise only the live getter is printed. */
  memo: boolean;
  /** `currentTotal()`: the getter over the mirrors, which client code calls. */
  current?: string;
}

/** An event the component declares (ADR-0012): the prop a consumer passes as its listener. */
export interface EventPlan {
  /** The prop: `onChange` for `change`. */
  prop: string;
  /** How code reads it: the destructured local (`onChange`, renamed where taken), or `props.onChange`. */
  local: string;
  /** The prop mirror deferred code calls it through, `onChangeRef`. */
  mirror?: string;
  /** Whether any code emits it: only those are destructured. */
  emitted: boolean;
}

/** How each listener is attached: React's synthetic prop, or a native listener. */
export type ListenerMode = "synthetic" | "native";

/**
 * An element with native listeners: its ref callback adds them. The callback is declared once
 * for the instance's life (`const [nameListeners] = useState(() => …)`), so React never removes
 * and adds the listeners again as it renders; one written in place, a new function each render,
 * only where a listener reads the list row the element is in, or a value its branch narrows.
 */
export interface NativeElement {
  /** The native listeners in attribute order, those of one event and phase together. */
  groups: EventAttribute[][];
  /** The ref callback's name, when it is declared once. */
  callback?: string;
}

/** The analysis of one component for the React target. */
export interface ReactPlan {
  readonly component: UfComponent;
  readonly module: UfModule;
  /** The output file's imports and names. */
  readonly names: ImportSet;
  readonly bindings: ReadonlyMap<BindingId, Binding>;
  readonly summaries: ReadonlyMap<BindingId, FunctionSummary>;
  readonly state: ReadonlyMap<BindingId, StatePlan>;
  readonly derived: ReadonlyMap<BindingId, DerivedPlan>;
  /** The `localConst` and `localFn` bindings printed at module scope. */
  readonly hoisted: ReadonlySet<BindingId>;
  /** The props deferred code reads, by binding: their mirror refs. */
  readonly propMirrors: ReadonlyMap<BindingId, string>;
  /** The events, by name, in declaration order. */
  readonly events: ReadonlyMap<string, EventPlan>;
  /** The generated interface of the events' props, `CounterEvents`. */
  readonly eventsInterface?: string;
  /** The local functions a template or the setup's values call: printed for render. */
  readonly renderFunctions: ReadonlySet<BindingId>;
  /** The client variants of render functions whose client spelling differs. */
  readonly clientVariants: ReadonlyMap<BindingId, string>;
  /** Each listener's element and how it is attached. */
  readonly listeners: ReadonlyMap<EventAttribute, { element: ElementNode; mode: ListenerMode }>;
  /** The guards of the listeners that run once, by listener. */
  readonly onceGuards: ReadonlyMap<EventAttribute, string>;
  /** The elements with native listeners, in render order. */
  readonly nativeElements: ReadonlyMap<ElementNode, NativeElement>;
  /** The DOM interface of the element each template ref attribute is on (`HTMLInputElement`). */
  readonly refInterfaces: ReadonlyMap<RefAttribute, string>;
  /**
   * The reads, by their start, that a conditional of the template narrows for a handler written
   * in its branch: they read the rendered value, which TypeScript narrows there as in the
   * source, never a mirror.
   */
  readonly narrowedReads: ReadonlySet<number>;
  /** How each local function that takes an event is attached: what its parameter is typed as. */
  readonly eventModes: ReadonlyMap<BindingId, ReadonlySet<ListenerMode>>;
  /** Where each write that is a statement stands: in a list of statements, or alone. */
  readonly writePositions: ReadonlyMap<number, "list" | "single">;
  /** The local `nextTick`, from `useNextTick()`, when code calls it. */
  readonly nextTick?: string;
  /** The inline helpers, claimed as they are needed. */
  readonly helpers: { listen?: string; once?: string; nextTick?: string };
}

/** Plans a component's React output. */
export function planComponent(component: UfComponent, module: UfModule): ReactPlan {
  const bindings = new Map(component.bindings.map((binding) => [binding.id, binding]));
  const kindOf = (id: BindingId) => bindings.get(id)?.kind;
  const summaries = summarize(component);

  const listeners = listenerModes(component);
  const eventModes = eventParameterModes(component, listeners);
  const names = new ImportSet(reservedNames(component, module, listeners, eventModes));
  const nativeElements = nativeElementsOf(listeners);
  const narrowedReads = narrowedReadsOf(component);
  const stable = (groups: readonly EventAttribute[][]) =>
    stableCallback(groups, kindOf, narrowedReads);

  // Client code: the inline handlers, the functions handlers name or client code calls, and
  // every watch callback, effect and hook.
  const clientFunctions = new Set<FunctionCode>();
  const functionItems = new Map<BindingId, FunctionCode>();
  for (const item of component.setup) {
    if (item.kind === "Function") functionItems.set(item.binding, item.function);
  }
  for (const { function: fn, role } of functionsOf(component)) {
    if (role === "handler" || role === "watch" || role === "watchEffect" || role === "lifecycle") {
      clientFunctions.add(fn);
    }
  }
  for (const [listener] of listeners) {
    if (listener.handler.kind === "Function") {
      const fn = functionItems.get(listener.handler.binding);
      if (fn) clientFunctions.add(fn);
    }
  }
  for (const [id, summary] of summaries) {
    if (summary.escapes) clientFunctions.add(functionItems.get(id)!);
  }
  // What client code calls, transitively.
  for (const fn of clientFunctions) {
    for (const reference of fn.body.refs) {
      if (reference.kind !== "Binding" || kindOf(reference.binding) !== "localFn") continue;
      const callee = functionItems.get(reference.binding);
      if (callee) clientFunctions.add(callee);
    }
  }

  // State that client code writes gets a mirror: every write updates it before the setter, and
  // every client read reads it (ADR-0046).
  const written = new Set<BindingId>();
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) {
      if (reference.kind === "Write" && kindOf(reference.binding) === "state") {
        written.add(reference.binding);
      }
    }
  }

  // Derived values client code reads get a live getter, and so do those a live getter reads.
  const getters = new Map<BindingId, FunctionCode>();
  for (const item of component.setup) {
    if (item.kind === "Derived") getters.set(item.binding, item.getter);
  }
  const live = new Set<BindingId>();
  const pendingLive: BindingId[] = [];
  const needLive = (id: BindingId) => {
    if (live.has(id)) return;
    live.add(id);
    pendingLive.push(id);
  };
  // `watchEffect` reads what it depends on as its effect event's parameters (UF2015 keeps them in
  // its own straight-line code): only what the functions it calls read is live.
  const effects = new Set<FunctionCode>();
  for (const item of component.setup) if (item.kind === "WatchEffect") effects.add(item.effect);
  for (const fn of clientFunctions) {
    if (effects.has(fn)) continue;
    for (const reference of fn.body.refs) {
      if (reference.kind === "Binding" && kindOf(reference.binding) === "derived") {
        needLive(reference.binding);
      }
    }
  }
  for (let id = pendingLive.pop(); id !== undefined; id = pendingLive.pop()) {
    for (const reference of getters.get(id)!.body.refs) {
      if (reference.kind === "Binding" && kindOf(reference.binding) === "derived") {
        needLive(reference.binding);
      }
    }
  }

  // Deferred reads (ADR-0046): code that runs after an `await`, inside a function written in client
  // code (a timer's callback, a cleanup), in a function passed as a value, or called from there,
  // reads props and event props through mirrors, never a render's snapshot.
  const deferred = new Set<FunctionCode>();
  for (const [id, summary] of summaries) {
    if (summary.escapes) deferred.add(functionItems.get(id)!);
  }
  // A ref callback declared once keeps the first render's listeners: they read what changes
  // through mirrors, as a function passed as a value does.
  for (const { groups } of nativeElements.values()) {
    if (!stable(groups)) continue;
    for (const listener of groups.flat()) {
      const fn =
        listener.handler.kind === "Inline"
          ? listener.handler.function
          : functionItems.get(listener.handler.binding);
      if (fn) deferred.add(fn);
    }
  }
  const mirroredProps = new Set<BindingId>();
  const mirroredEvents = new Set<string>();
  const ranges = new Map<FunctionCode, readonly Span[]>();
  for (let grew = true; grew;) {
    grew = false;
    const clientCode = [...clientFunctions, ...[...live].map((id) => getters.get(id)!)];
    for (const fn of clientCode) {
      let spans = ranges.get(fn);
      if (!spans) ranges.set(fn, (spans = deferredRanges(fn)));
      const whole = deferred.has(fn);
      for (const reference of fn.body.refs) {
        if (!whole && !spans.some((span) => inside(reference.span, span))) continue;
        switch (reference.kind) {
          case "Binding": {
            let target: FunctionCode | undefined;
            const kind = kindOf(reference.binding)!;
            switch (kind) {
              case "prop":
                mirroredProps.add(reference.binding);
                break;
              // A function or a live getter that deferred code calls runs deferred all through.
              case "localFn":
                target = functionItems.get(reference.binding);
                break;
              case "derived":
                target = getters.get(reference.binding);
                break;
              case "loopVar":
              case "state":
              case "templateRef":
              case "localConst":
              case "localVar":
              case "emit":
              case "model":
              case "slots":
              case "slotScope":
              case "context":
              case "component":
                break;
              default:
                kind satisfies never;
            }
            if (target && !deferred.has(target)) {
              deferred.add(target);
              grew = true;
            }
            break;
          }
          case "Emit":
            mirroredEvents.add(reference.event);
            break;
          case "Global":
          case "Write":
          case "Api":
          case "Event":
          case "Slot":
            break;
          default:
            reference satisfies never;
        }
      }
    }
  }

  // Render functions: those the template, an initial value or a getter calls, and what they call.
  const renderFunctions = new Set<BindingId>();
  const renderCalls = (code: Code) => {
    for (const reference of code.refs) {
      if (reference.kind === "Binding" && kindOf(reference.binding) === "localFn") {
        renderFunctions.add(reference.binding);
      }
    }
  };
  for (const { expression } of expressionsOf(component)) renderCalls(expression);
  for (const { code, context } of codeOf(component)) if (context === "pure") renderCalls(code);
  for (const { function: fn, role } of functionsOf(component)) {
    if (role === "getter") renderCalls(fn.body);
  }
  for (const id of renderFunctions) {
    for (const reached of summaries.get(id)?.reaches ?? []) renderFunctions.add(reached);
  }

  // Derived values render code reads: a memo each (an unread one fails L5). Render code is the
  // template, the values the setup evaluates, the functions a template calls, the watch sources
  // and the values `watchEffect` reads, which effects list; a memo's getter reads others.
  const memos = new Set<BindingId>();
  const pendingMemos: BindingId[] = [];
  const needMemo = (id: BindingId) => {
    if (kindOf(id) !== "derived" || memos.has(id)) return;
    memos.add(id);
    pendingMemos.push(id);
  };
  const renderReads = (code: Code) => {
    for (const reference of code.refs) {
      if (reference.kind === "Binding") needMemo(reference.binding);
    }
  };
  for (const { expression } of expressionsOf(component)) renderReads(expression);
  for (const { code, context, path } of codeOf(component)) {
    if (context === "pure" && !/^\/setup\/\d+\/getter\//.test(path)) renderReads(code);
  }
  for (const id of renderFunctions) {
    const fn = functionItems.get(id);
    if (fn) renderReads(fn.body);
  }
  for (const item of component.setup) {
    if (item.kind === "Watch") {
      for (const source of item.sources) if (source.kind === "Ref") needMemo(source.binding);
    } else if (item.kind === "WatchEffect") {
      for (const id of summarizeCode(item.effect.body, component).reads) needMemo(id);
    }
  }
  for (let id = pendingMemos.pop(); id !== undefined; id = pendingMemos.pop()) {
    renderReads(getters.get(id)!.body);
  }

  // Hoisting (ADR-0045): a value or a function that captures nothing of the component goes to
  // module scope (`unicorn/consistent-function-scoping` rejects such a function inside it).
  const hoisted = hoistable(component, kindOf);

  // Names, in a fixed order: the events' interface, then each item's, then the props' mirrors.
  const parameter = component.propsParameter;
  const eventProps = (component.emits?.events ?? []).map(({ name }) => `on${pascalCase(name)}`);
  // The props the source's own names take (a function `onChange`): their locals are renamed.
  const taken = new Set(eventProps.filter((prop) => names.scope.has(prop)));
  // Every event's prop is taken, destructured or not, so no name the output claims reads like one.
  names.reserve(...eventProps);
  const eventsInterface = component.emits ? names.claim(`${component.name}Events`) : undefined;
  const emitted = new Set<string>();
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) if (reference.kind === "Emit") emitted.add(reference.event);
  }
  const events = new Map<string, EventPlan>();
  for (const declaration of component.emits?.events ?? []) {
    const prop = `on${pascalCase(declaration.name)}`;
    const isEmitted = emitted.has(declaration.name);
    // A source name the prop's own spelling would capture (a function `onChange`) renames it.
    const local =
      parameter?.form === "object"
        ? `${parameter.name!}.${prop}`
        : isEmitted && taken.has(prop)
          ? names.claim(prop)
          : prop;
    events.set(declaration.name, { prop, local, emitted: isEmitted });
  }

  const state = new Map<BindingId, StatePlan>();
  const derived = new Map<BindingId, DerivedPlan>();
  for (const item of component.setup) {
    if (item.kind === "State") {
      const { name } = bindings.get(item.binding)!;
      const isWritten = written.has(item.binding);
      state.set(item.binding, {
        name,
        ...(isWritten
          ? {
              setter: names.claim(`set${pascalCase(name)}`),
              mirror: names.claim(`${name}Ref`),
            }
          : {}),
      });
    } else if (item.kind === "Derived") {
      const { name } = bindings.get(item.binding)!;
      derived.set(item.binding, {
        name,
        memo: memos.has(item.binding),
        ...(live.has(item.binding) ? { current: names.claim(`current${pascalCase(name)}`) } : {}),
      });
    }
  }

  // A function the template calls and client code calls too gets a client variant where its
  // body reads something client code spells otherwise: a mirror, a live getter, a prop mirror.
  const clientVariants = new Map<BindingId, string>();
  const differs = (id: BindingId): boolean => {
    const summary = summaries.get(id);
    if (!summary) return false;
    for (const read of summary.reads) {
      const kind = kindOf(read)!;
      switch (kind) {
        case "derived":
          return true;
        case "state":
          if (written.has(read)) return true;
          break;
        case "prop":
          if (mirroredProps.has(read)) return true;
          break;
        case "loopVar":
        case "templateRef":
        case "localConst":
        case "localFn":
        case "localVar":
        case "emit":
        case "model":
        case "slots":
        case "slotScope":
        case "context":
        case "component":
          break;
        default:
          kind satisfies never;
      }
    }
    return [...summary.reaches].some((reached) => clientVariants.has(reached));
  };
  for (let grew = true; grew;) {
    grew = false;
    for (const id of renderFunctions) {
      const fn = functionItems.get(id);
      if (!fn || clientVariants.has(id) || hoisted.has(id) || !clientFunctions.has(fn)) continue;
      if (differs(id)) {
        clientVariants.set(id, names.claim(`current${pascalCase(bindings.get(id)!.name)}`));
        grew = true;
      }
    }
  }

  const propMirrors = new Map<BindingId, string>();
  for (const prop of component.props) {
    if (prop.binding && mirroredProps.has(prop.binding)) {
      propMirrors.set(prop.binding, names.claim(`${prop.name}Ref`));
    }
  }
  for (const [name, event] of events) {
    if (mirroredEvents.has(name)) event.mirror = names.claim(`${event.prop}Ref`);
  }

  const onceGuards = new Map<EventAttribute, string>();
  for (const [listener] of listeners) {
    if (listener.once) onceGuards.set(listener, names.claim(`${listener.event}Once`));
  }
  const helpers: ReactPlan["helpers"] = {};
  if (onceGuards.size) helpers.once = names.claim("useOnce");
  for (const [element, native] of nativeElements) {
    if (stable(native.groups)) {
      native.callback = names.claim(`${callbackBase(element, bindings)}Listeners`);
    }
  }

  let nextTick: string | undefined;
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) {
      if (reference.kind === "Api") {
        nextTick ??= code.code.slice(
          reference.span.start - code.span.start,
          reference.span.end - code.span.start,
        );
      }
    }
  }

  if (nextTick) helpers.nextTick = names.claim("useNextTick");

  return {
    component,
    module,
    names,
    bindings,
    summaries,
    state,
    derived,
    hoisted,
    propMirrors,
    events,
    ...(eventsInterface ? { eventsInterface } : {}),
    renderFunctions,
    clientVariants,
    listeners,
    onceGuards,
    nativeElements,
    refInterfaces: refInterfaces(component),
    narrowedReads,
    eventModes,
    writePositions: writePositions(component),
    ...(nextTick ? { nextTick } : {}),
    helpers,
  };
}

/** Whether a binding's value changes as the component runs: a prop, state or a derived value. */
export function reactive(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
    case "state":
    case "derived":
    case "model":
    case "slots":
    case "context":
      return true;
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
    case "slotScope":
    case "component":
      return false;
    default:
      return kind satisfies never;
  }
}

/** Whether a span lies inside another. */
function inside(span: Span, outer: Span): boolean {
  return span.start >= outer.start && span.end <= outer.end;
}

/**
 * Each listener of the component with its element and how it is attached: natively where React's
 * synthetic event differs from the DOM's, and then every listener of that event on an element on
 * the same path, so their order is the DOM's (ADR-0047).
 */
function listenerModes(
  component: UfComponent,
): Map<EventAttribute, { element: ElementNode; mode: ListenerMode }> {
  const found: [EventAttribute, ElementNode][] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event") found.push([attribute, node]);
      }
    },
  });
  // React dispatches its props from the root, after every native listener of the bubble phase
  // and before every one of the capture phase: a listener of an event that an element on its
  // path listens to natively goes native too, so they run in the DOM's order. React's `onFocus`
  // and `onBlur` are its root's `focusin` and `focusout` listeners, so a native listener of
  // those on the path relates to them too: the DOM fires `focus` before `focusin`.
  const entries = found.map(([listener, element]) => ({
    listener,
    element,
    native: !synthetic(listener, element),
  }));
  const paths = elementPaths(component);
  const related = (a: ElementNode, b: ElementNode) =>
    paths.get(a)!.includes(b) || paths.get(b)!.includes(a);
  for (let grew = true; grew;) {
    grew = false;
    for (const entry of entries) {
      if (entry.native) continue;
      const { event } = entry.listener;
      entry.native = entries.some(
        (other) =>
          other.native &&
          (other.listener.event === event || other.listener.event === FED_BY.get(event)) &&
          related(entry.element, other.element),
      );
      grew ||= entry.native;
    }
  }
  return new Map(
    entries.map(({ listener, element, native }) => [
      listener,
      { element, mode: native ? "native" : "synthetic" },
    ]),
  );
}

/**
 * The elements with native listeners, in render order, each with its listeners grouped by event
 * and phase (and passive option) in attribute order: one `listen` call runs a group, so a
 * listener's write that React renders between two listeners never removes the second.
 */
function nativeElementsOf(
  listeners: ReadonlyMap<EventAttribute, { element: ElementNode; mode: ListenerMode }>,
): Map<ElementNode, NativeElement> {
  const found = new Map<ElementNode, NativeElement>();
  for (const [listener, { element, mode }] of listeners) {
    if (mode !== "native") continue;
    let native = found.get(element);
    if (!native) found.set(element, (native = { groups: [] }));
    const group = native.groups.find(
      ([first]) =>
        first!.event === listener.event &&
        Boolean(first!.capture) === Boolean(listener.capture) &&
        Boolean(first!.passive) === Boolean(listener.passive),
    );
    if (group) group.push(listener);
    else native.groups.push([listener]);
  }
  return found;
}

/**
 * Whether an element's ref callback is declared once: none of its listeners reads a list's row,
 * or a value its branch narrows, which only the render that wrote the element holds.
 */
function stableCallback(
  groups: readonly EventAttribute[][],
  kindOf: (id: BindingId) => BindingKind | undefined,
  narrowedReads: ReadonlySet<number>,
): boolean {
  return groups
    .flat()
    .every(
      (listener) =>
        listener.handler.kind !== "Inline" ||
        !listener.handler.function.body.refs.some(
          (reference) =>
            reference.kind === "Binding" &&
            (kindOf(reference.binding) === "loopVar" || narrowedReads.has(reference.span.start)),
        ),
    );
}

/**
 * The reads a conditional of the template narrows for a handler written in its branch (the
 * analyser's `template` paths, ADR-0046): TypeScript narrows them by the condition in the source,
 * and in a handler React writes in the branch too, where it reads the rendered value. UF3029 keeps
 * such a read to an argument of the handler's one call, which runs as the event is dispatched,
 * when the rendered value is the latest. Every other read keeps its client spelling (a mirror, a
 * live getter), whatever condition is around it.
 */
function narrowedReadsOf(component: UfComponent): Set<number> {
  const found = new Set<number>();
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) {
      if (
        reference.kind === "Binding" &&
        reference.narrowed?.some(({ scope }) => scope === "template")
      ) {
        found.add(reference.span.start);
      }
    }
  }
  return found;
}

/**
 * What a ref callback is named after: the element's `name`, its template ref's, its
 * `aria-label`, or its tag (`emailListeners`, `fieldListeners`, `wheelListeners`).
 */
function callbackBase(element: ElementNode, bindings: ReadonlyMap<BindingId, Binding>): string {
  const label = (name: string) => {
    const attribute = element.attributes.find(
      (entry) => entry.kind === "Static" && entry.name === name && typeof entry.value === "string",
    );
    const words =
      attribute?.kind === "Static" ? String(attribute.value).match(/[A-Za-z0-9]+/g) : null;
    if (!words || !/^[A-Za-z]/.test(words[0]!)) return undefined;
    const base = pascalCase(words.join("-"));
    return base.charAt(0).toLowerCase() + base.slice(1);
  };
  const ref = element.attributes.find((attribute) => attribute.kind === "Ref");
  return (
    label("name") ??
    (ref?.kind === "Ref" ? bindings.get(ref.binding)!.name : undefined) ??
    label("aria-label") ??
    element.tag.replace(/-([a-z])/g, (_, next: string) => next.toUpperCase())
  );
}

/** The DOM interface of the element each template ref attribute is on, as the source types it. */
function refInterfaces(component: UfComponent): Map<RefAttribute, string> {
  const found = new Map<RefAttribute, string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Ref") found.set(attribute, elementInterface(node.tag));
      }
    },
  });
  return found;
}

/** The native event each synthetic prop React dispatches from another event is fed by. */
const FED_BY: ReadonlyMap<string, string> = new Map([
  ["focus", "focusin"],
  ["blur", "focusout"],
]);

/** Each element of a render tree with the elements from it up to the root, itself first. */
function elementPaths(component: UfComponent): Map<ElementNode, ElementNode[]> {
  const paths = new Map<ElementNode, ElementNode[]>();
  const stack: ElementNode[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      stack.unshift(node);
      paths.set(node, [...stack]);
    },
    leave(node) {
      if (node.kind === "Element") stack.shift();
    },
  });
  return paths;
}

/**
 * How the events reaching each local function that takes one are attached: the listeners that
 * name it, the inline handlers that pass their event to it, and the functions that do (ADR-0047).
 */
function eventParameterModes(
  component: UfComponent,
  listeners: ReadonlyMap<EventAttribute, { mode: ListenerMode }>,
): Map<BindingId, Set<ListenerMode>> {
  const modes = new Map<BindingId, Set<ListenerMode>>();
  const takesEvent = new Map<BindingId, FunctionCode>();
  for (const item of component.setup) {
    if (item.kind === "Function" && item.function.parameters.some(({ event }) => event)) {
      takesEvent.set(item.binding, item.function);
    }
  }
  const add = (id: BindingId, mode: ListenerMode): boolean => {
    let set = modes.get(id);
    if (!set) modes.set(id, (set = new Set()));
    if (set.has(mode)) return false;
    set.add(mode);
    return true;
  };
  const callees = (fn: FunctionCode) =>
    fn.body.refs.flatMap((reference) =>
      reference.kind === "Binding" && reference.call && takesEvent.has(reference.binding)
        ? [reference.binding]
        : [],
    );
  for (const [listener, { mode }] of listeners) {
    if (listener.handler.kind === "Function") {
      if (takesEvent.has(listener.handler.binding)) add(listener.handler.binding, mode);
    } else if (listener.handler.function.parameters[0]?.event) {
      for (const callee of callees(listener.handler.function)) add(callee, mode);
    }
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const [id, fn] of takesEvent) {
      for (const mode of modes.get(id) ?? []) {
        for (const callee of callees(fn)) grew = add(callee, mode) || grew;
      }
    }
  }
  return modes;
}

/**
 * The names the output must leave alone: the source's (`sourceNames`), but for the DOM event
 * types that only the annotations React rewrites name (`KeyboardEvent` in `(event:
 * KeyboardEvent)` on a synthetic listener), which the output imports from `react` instead.
 */
function reservedNames(
  component: UfComponent,
  module: UfModule,
  listeners: ReadonlyMap<EventAttribute, { mode: ListenerMode }>,
  eventModes: ReadonlyMap<BindingId, ReadonlySet<ListenerMode>>,
): Set<string> {
  const rewritten = new Set<Parameter>();
  for (const item of component.setup) {
    if (item.kind !== "Function" || eventModes.get(item.binding)?.has("native")) continue;
    for (const parameter of item.function.parameters) {
      if (parameter.event && parameter.type) rewritten.add(parameter);
    }
  }
  for (const [listener, { mode }] of listeners) {
    const [first] = listener.handler.kind === "Inline" ? listener.handler.function.parameters : [];
    if (first?.event && first.type && mode === "synthetic") rewritten.add(first);
  }
  if (rewritten.size === 0) return sourceNames(component, module);
  const strip = (fn: FunctionCode): FunctionCode => ({
    ...fn,
    parameters: fn.parameters.map((parameter) => {
      if (!rewritten.has(parameter)) return parameter;
      const { type: _type, ...rest } = parameter;
      return rest;
    }),
  });
  const render = (node: RenderNode): RenderNode =>
    node.kind === "Element"
      ? {
          ...node,
          attributes: node.attributes.map((attribute) =>
            attribute.kind === "Event" && attribute.handler.kind === "Inline"
              ? {
                  ...attribute,
                  handler: { ...attribute.handler, function: strip(attribute.handler.function) },
                }
              : attribute,
          ),
          children: node.children.map(render),
        }
      : node.kind === "If"
        ? {
            ...node,
            branches: node.branches.map((branch) => ({
              ...branch,
              children: branch.children.map(render),
            })),
          }
        : node.kind === "For"
          ? { ...node, body: render(node.body) as ElementNode }
          : node;
  const stripped: UfComponent = {
    ...component,
    setup: component.setup.map((item) =>
      item.kind === "Function" ? { ...item, function: strip(item.function) } : item,
    ),
    render:
      component.render.kind === "Fragment"
        ? { ...component.render, children: component.render.children.map(render) }
        : (render(component.render) as ElementNode),
  };
  return sourceNames(stripped, module);
}

/**
 * The `localConst` and `localFn` bindings that capture nothing of the component: their code reads
 * only globals, its own names and other such bindings, and writes, emits and calls `nextTick`
 * (a hook's result on React) not at all. An `Id` is the instance's, so never.
 */
function hoistable(
  component: UfComponent,
  kindOf: (id: BindingId) => Binding["kind"] | undefined,
): Set<BindingId> {
  const code = new Map<BindingId, Code[]>();
  for (const item of component.setup) {
    if (item.kind === "Const") code.set(item.binding, [item.value]);
    else if (item.kind === "Function") {
      const fn = item.function;
      code.set(item.binding, [
        fn.body,
        ...fn.parameters.flatMap((parameter) => (parameter.default ? [parameter.default] : [])),
      ]);
    }
  }
  const verdicts = new Map<BindingId, boolean>();
  const decide = (id: BindingId): boolean => {
    const known = verdicts.get(id);
    if (known !== undefined) return known;
    // A cycle (local functions do not recurse, UF2024) stays inside the component.
    verdicts.set(id, false);
    const pieces = code.get(id);
    const free =
      pieces !== undefined &&
      pieces.every((piece) =>
        piece.refs.every((reference) => {
          switch (reference.kind) {
            case "Global":
            case "Event":
              return true;
            case "Binding": {
              const kind = kindOf(reference.binding)!;
              switch (kind) {
                case "localConst":
                case "localFn":
                  return decide(reference.binding);
                case "prop":
                case "loopVar":
                case "state":
                case "derived":
                case "templateRef":
                case "localVar":
                case "emit":
                case "model":
                case "slots":
                case "slotScope":
                case "context":
                case "component":
                  return false;
                default:
                  return kind satisfies never;
              }
            }
            case "Write":
            case "Emit":
            case "Api":
            case "Slot":
              return false;
            default:
              return reference satisfies never;
          }
        }),
      );
    verdicts.set(id, free);
    return free;
  };
  return new Set([...code.keys()].filter(decide));
}

/**
 * The spans of a client function's code that run later than its call: after its first `await`
 * (and the whole of a loop that awaits), and inside the functions it writes. Conservative: a
 * read there goes through a mirror, which is right wherever it runs.
 */
function deferredRanges(fn: FunctionCode): Span[] {
  const { body } = fn;
  const offset = body.span.start;
  const kind = fn.expression ? "expression" : "statements";
  const { root } = parseCodeSource(body.code, kind);
  const spans: Span[] = [];
  let firstAwait = Number.POSITIVE_INFINITY;
  const loops = new Set([
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
  ]);
  const functions = new Set([
    "ArrowFunctionExpression",
    "FunctionExpression",
    "FunctionDeclaration",
  ]);
  /** Visits a node; returns whether it awaits outside a nested function. */
  const visit = (node: unknown): boolean => {
    if (Array.isArray(node)) {
      let awaits = false;
      for (const item of node) awaits = visit(item) || awaits;
      return awaits;
    }
    if (!isNode(node)) return false;
    if (functions.has(node.type)) {
      spans.push({ start: offset + node.start, end: offset + node.end });
      return false;
    }
    let awaits =
      node.type === "AwaitExpression" ||
      (node.type === "ForOfStatement" && (node as { await?: boolean }).await === true);
    if (node.type === "AwaitExpression") firstAwait = Math.min(firstAwait, node.start);
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") {
        awaits = visit(value) || awaits;
      }
    }
    if (awaits && loops.has(node.type)) {
      spans.push({ start: offset + node.start, end: offset + node.end });
    }
    return awaits;
  };
  visit(root);
  if (firstAwait !== Number.POSITIVE_INFINITY) {
    spans.push({ start: offset + firstAwait, end: body.span.end });
  }
  return spans;
}

/**
 * Where each write that is a statement stands, by its start: in a list of statements, where a
 * setter call can follow it, or alone (an `if`'s or a loop's body), where the two statements need
 * a block.
 */
function writePositions(component: UfComponent): Map<number, "list" | "single"> {
  const positions = new Map<number, "list" | "single">();
  const lists = new Set(["BlockStatement", "FunctionBody", "SwitchCase", "StaticBlock"]);
  for (const { function: fn } of functionsOf(component)) {
    if (fn.expression) continue;
    const offset = fn.body.span.start;
    const { root } = parseCodeSource(fn.body.code, codeKind(fn.body, component));
    const visit = (node: unknown, list: boolean): void => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item, list);
        return;
      }
      if (!isNode(node)) return;
      if (node.type === "ExpressionStatement") {
        const { expression } = node as unknown as { expression: Node };
        positions.set(offset + expression.start, list ? "list" : "single");
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "type" || key === "parent" || typeof value !== "object") continue;
        visit(value, Array.isArray(value) && lists.has(node.type));
      }
    };
    visit(root, true);
  }
  return positions;
}

/** A node of oxc's AST, as far as a walk reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}
