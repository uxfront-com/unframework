import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Diagnostic, DiagnosticCode } from "@unframework/diagnostics";
import type { UfComponent, UfModule } from "@unframework/ir";

/**
 * The features a target declares support for. Each name maps to IR features (node and
 * attribute kinds, or a construct such as a single-selection list box) or to a runtime
 * ability; `requiredCapabilities` derives the ones a module uses. The capability check (P4)
 * and the test harness's `requires` read them, so what a framework renders differently is
 * declared here, never discovered.
 */
export type CapabilityName =
  /** Intrinsic elements (`ElementNode`). */
  | "element"
  /** Text nodes (`TextNode`). */
  | "text"
  /** Static attributes (`StaticAttribute`). */
  | "static-attribute"
  /**
   * A `<select>` shown as a single-selection list box: display size above 1, without
   * `multiple`, holding an option a drop-down would select (`listBoxSize`). A bound or spread
   * `size`, and options in a conditional or a list, count: what only the run time knows is
   * taken to be one.
   */
  | "listbox"
  /**
   * Running code in the browser (ADR-0047, ADR-0048): event listeners (`EventAttribute`),
   * template refs (`RefAttribute`), watchers, `watchEffect` and lifecycle hooks, and the state
   * they change.
   */
  | "interactivity"
  /** A listener in the capture phase: `onClickCapture` (`EventAttribute.capture`). */
  | "event-capture"
  /** A listener that runs once, then is removed: `onClickOnce` (`EventAttribute.once`). */
  | "event-once"
  /** A passive listener: `onWheelPassive` (`EventAttribute.passive`). */
  | "event-passive"
  /**
   * A listener that runs when the DOM event of its name fires, with the DOM's own semantics:
   * `change` on a text field when it commits, not per keystroke; `focus` and `blur` that do not
   * bubble (ADR-0047). React's synthetic events differ, so it listens natively where they do.
   */
  | "event-semantics"
  /**
   * An event control (`preventDefault()`, `stopPropagation()`) that runs or not on more than the
   * event as it is dispatched (ADR-0047): one a handler reaches through a call of a local
   * function that is not a statement at the top of the handler before any `await`, nor alone
   * under an `if` there that tests only the event (`if (open.value) close(event)`), or that
   * follows a statement that may leave the handler on more than the event (`if (!open.value)
   * return;`); one in a `once` listener that runs under a condition or after a guard clause; and
   * any in a `once` listener of an element that listens to that event in both phases. A target
   * that runs controls apart from the handler, while the event is dispatched, cannot tell
   * (`handlerControls`).
   */
  | "conditional-event-control"
  /** `useId()`: an id unique to the component's instance, `uf-id-` and the framework's id. */
  | "use-id"
  /** `nextTick()`: a promise that resolves once the DOM has updated (`ApiReference`). */
  | "next-tick"
  /**
   * A prop the parent passes only after the component mounted, which the derived values and
   * watchers that read it follow (ADR-0046): an optional prop, whose key a parent's spread may
   * add later, read by a derived value's getter, a watch source or a `watchEffect`, itself or
   * through the functions it calls.
   */
  | "late-prop"
  /** Props: a component whose props type has members (ADR-0034). */
  | "props"
  /** Expressions rendered as text (`InterpolationNode`). */
  | "interpolation"
  /** Conditionals: `c ? <A/> : <B/>`, `c && <A/>` (`IfNode`). */
  | "conditional"
  /** Keyed lists: `items.map((item) => <li key={…}/>)` (`ForNode`), content and order. */
  | "list"
  /** Several roots: a component's render root that is a `FragmentNode`. */
  | "fragment"
  /** Attributes bound to an expression (`BoundAttribute`). */
  | "bound-attribute"
  /** A `class` built from static names, toggles and dynamic parts (`ClassAttribute`). */
  | "class-binding"
  /** A `style` as declarations, static or bound (`StyleAttribute`). */
  | "style-binding"
  /** A spread of an object whose keys its type declares (`SpreadAttribute`). */
  | "attribute-spread"
  /** SVG: an `<svg>` element and the SVG inside it. */
  | "svg"
  /** A component element (`ComponentNode`): an imported or a local component (ADR-0053). */
  | "component"
  /**
   * A listener of an event a child declares (`ListenerAttribute`): refines `interactivity`, as
   * the handler runs in the browser.
   */
  | "component-event"
  /** The default slot: its outlet, `{slots.default?.()}`, or the children a parent fills it with. */
  | "default-slot"
  /** A named slot without props: its outlet or its fill. */
  | "named-slot"
  /** A slot with props, `{slots.item?.({ item })}`: its outlet or its scoped fill. */
  | "scoped-slot"
  /** A slot outlet with fallback content, rendered when the parent leaves the slot empty. */
  | "slot-fallback"
  /** `slots.default` as a condition, or the default slot forwarded, which keeps its presence. */
  | "default-slot-presence"
  /** A fill that passes on the parent's own slot, `{{ title: slots.title }}` (`SlotFill.forward`). */
  | "slot-forwarding"
  /** `defineModel` (`ModelItem`), and a component's `v-model:name` (`ModelBindingAttribute`). */
  | "model"
  /** An element's `v-model` (`ModelAttribute`): refines `interactivity`. */
  | "two-way-binding"
  /** A `v-model` of a `checkbox-group` or a `select-multiple`, whose value is an array. */
  | "model-array"
  /** A `v-model` that is `trim`, `lazy` or `number`, or of a `number` control. */
  | "model-modifiers"
  /** A `class` or a `style` on a component, which falls through to its root (ADR-0054). */
  | "fallthrough"
  /**
   * A component whose root element HTML or ARIA ties to its parent (`CONTEXTUAL_ROOT_ELEMENTS`):
   * a host element between them breaks the parent's content model (ADR-0056).
   */
  | "contextual-root"
  /** `defineExpose`, and a `ref` on a component, which holds what it exposes. */
  | "expose"
  /** `provide` and `inject` (`ProvideItem`, `InjectItem`) with an injection key. */
  | "context"
  /** A provided `state`, `derived` or `model` binding, which descendants read as it changes. */
  | "reactive-context"
  /** `<component is>` over a statically known set (`DynamicNode`). */
  | "dynamic-component";

/** Every capability name, in a stable order. */
export const CAPABILITY_NAMES: readonly CapabilityName[] = [
  "element",
  "text",
  "static-attribute",
  "listbox",
  "interactivity",
  "event-capture",
  "event-once",
  "event-passive",
  "event-semantics",
  "conditional-event-control",
  "use-id",
  "next-tick",
  "late-prop",
  "props",
  "interpolation",
  "conditional",
  "list",
  "fragment",
  "bound-attribute",
  "class-binding",
  "style-binding",
  "attribute-spread",
  "svg",
  "component",
  "component-event",
  "default-slot",
  "named-slot",
  "scoped-slot",
  "slot-fallback",
  "default-slot-presence",
  "slot-forwarding",
  "model",
  "two-way-binding",
  "model-array",
  "model-modifiers",
  "fallthrough",
  "contextual-root",
  "expose",
  "context",
  "reactive-context",
  "dynamic-component",
];

/**
 * The capabilities that change what code does in the browser, not what renders: a static render
 * is the same without them (ADR-0033, as amended by ADR-0047). The render-parity tests, which
 * compare static renders, do not require a case that uses one its target leaves unsupported to
 * render differently: Astro renders the same DOM with its handlers inert.
 */
export const BEHAVIOURAL_CAPABILITIES: ReadonlySet<CapabilityName> = new Set<CapabilityName>([
  "interactivity",
  "event-capture",
  "event-once",
  "event-passive",
  "event-semantics",
  "conditional-event-control",
  "next-tick",
  "late-prop",
  "component-event",
  "expose",
  "two-way-binding",
  "model-array",
  "model-modifiers",
]);

/**
 * The capability each refining one needs: a listener's options and semantics, `nextTick`, a
 * component's listeners and refs and an element's `v-model` mean nothing on a target without
 * `interactivity`, and reactive context nothing without `context` (ADR-0055). The capability
 * check reports only the one they refine there, once, rather than each at the same use.
 */
export const CAPABILITY_PREREQUISITES: Readonly<Partial<Record<CapabilityName, CapabilityName>>> = {
  "event-capture": "interactivity",
  "event-once": "interactivity",
  "event-passive": "interactivity",
  "event-semantics": "interactivity",
  "conditional-event-control": "interactivity",
  "next-tick": "interactivity",
  "component-event": "interactivity",
  expose: "interactivity",
  "two-way-binding": "interactivity",
  "model-array": "interactivity",
  "model-modifiers": "interactivity",
  "reactive-context": "context",
};

/** How a target supports a capability (plan §5.7). */
export type CapabilityCell =
  | { support: "native" }
  | {
      support: "emulated";
      /** The name of the inline helper the target emits. */
      helper: string;
      note?: string;
    }
  | {
      support: "unsupported";
      /** The portability diagnostic reported where a module first uses the capability. */
      code: DiagnosticCode;
      severity: "error" | "warning" | "info";
      reason: string;
    };

/** A target's capability matrix: one cell per capability. */
export type Capabilities = Readonly<Record<CapabilityName, CapabilityCell>>;

/** A file a target emits. */
export interface OutputFile {
  /** The path relative to the target's output directory, with forward slashes. */
  path: string;
  contents: string;
}

/** What a target's `emit` receives besides the component. */
export interface EmitContext {
  /** The module the component belongs to. */
  module: UfModule;
  /** The target's validated options. */
  options: unknown;
  /** Reports a diagnostic; the compiler sets its file and target. */
  report(diagnostic: Omit<Diagnostic, "file" | "target">): void;
}

/** A compile target: one framework, at one major version. */
export interface Target {
  /** An open string, such as `"react"`; third-party targets are welcome. */
  readonly name: string;
  /** The framework package and the version range the output is tested against. */
  readonly framework: { readonly package: string; readonly range: string };
  readonly capabilities: Capabilities;
  /** Validates the target's options. */
  readonly options?: StandardSchemaV1;
  /** Emits one component as one or more files. Never throws: report problems instead. */
  emit(component: UfComponent, context: EmitContext): OutputFile[];
}

/** Declares a target, checking its shape at compile time. */
export function defineTarget<T extends Target>(target: T): T {
  return target;
}
