import type { Binding, BindingId, BindingKind, ComponentApi, Slots } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import type { AuthoringApi } from "./authoring.ts";
import type { Reporter } from "./context.ts";
import type { Scopes } from "./scope.ts";
import type { TypeTable } from "./types/from-type.ts";
import type { Kinds } from "./types/kinds.ts";

/**
 * A component's function: a declaration, or the arrow function or function expression a `const`
 * holds, which is reported (UF1102) and still analysed, so that its fix reveals nothing new.
 */
export type ComponentFunction = AST.Function | AST.ArrowFunctionExpression;

/** A prop as expressions read it. */
export interface PropBinding {
  name: string;
  /** The binding expressions read it through: absent when the destructured form leaves it out. */
  id: BindingId | undefined;
  /** Its kinds: the member's type, with `undefined` when optional without a default. */
  kinds: Kinds;
}

/** A component a template may render (ADR-0053): its local name, and its API. */
export interface ComponentInfo {
  readonly name: string;
  readonly api: ComponentApi;
}

/** A list's item or index, or a name a scoped fill's parameter binds (ADR-0054). */
export interface LoopVariable {
  name: string;
  id: BindingId;
  kinds: Kinds;
  /** The parameter that declares it. */
  declaration: object;
}

/** A function the setup declares: `function save() {…}`, or an arrow a `const` holds. */
export type SetupFunction = AST.Function | AST.ArrowFunctionExpression;

/** A binding the component's setup declares (ADR-0045), as code reads it. */
export interface SetupBinding {
  readonly name: string;
  readonly id: BindingId;
  readonly kind: Exclude<BindingKind, "prop" | "loopVar">;
  /**
   * What reading it gives (ADR-0046): a ref's value for `state`, `derived` and `templateRef`
   * (read as `x.value`), a constant's value, a function's result where it is called. The setup
   * fills it in source order, as it walks each item.
   */
  kinds: Kinds;
  /** The identifier that declares it. */
  readonly declaration: AST.BindingIdentifier;
  /** A local function's code. */
  readonly function?: SetupFunction;
  /**
   * What makes a local function's result depend on time, chance or the machine itself, outside
   * the globals its summary lists (`Math.random`, a locale method): UF3019 where a template, a
   * getter or an initial value calls it. Set as its body is walked.
   */
  nondeterministic?: string;
}

/**
 * What the walks of a component's code note for the rules that need every function's summary
 * first (`./rules.ts`, ADR-0045): judged once the setup and the render tree are lowered.
 */
export interface CodeFacts {
  /**
   * The calls of local functions inside an arrow function that runs at once (an array method's
   * callback, a comparator), and the local functions passed as values to a call that may run
   * them at once: Qwik's output calls a local function that touches state as a QRL, which such
   * a callback or call cannot await (UF2024).
   */
  readonly nestedCalls: {
    binding: BindingId;
    span: { start: number; end: number };
    /** For a function passed as a value, the call it is passed to, and whether an array's. */
    passedTo?: string | undefined;
    arrayMethod?: boolean;
  }[];
  /** The kinds each watcher's getter returns, by its IR (UF2015 judges the object ones). */
  readonly getterKinds: Map<object, Kinds>;
  /** The calls of `nextTick` in client code given a callback (UF2025), with their fix. */
  readonly tickCallbacks: AST.CallExpression[];
  /**
   * The functions client code passes to a call that runs them later (the timers,
   * `queueMicrotask`, `requestAnimationFrame`, `requestIdleCallback`, a promise's `then`,
   * `addEventListener`, an observer's constructor, `onCleanup`) or never (`removeEventListener`,
   * the functions that clear a timer), by the start
   * of the argument: an arrow function, or a local function's name. Any other call may run what
   * it is given at once (UF2026, UF2027).
   */
  readonly passed: Map<number, "later" | "never">;
}

/** The DOM interface a function's event parameter takes, and which parameter it is. */
export interface EventParameter {
  /** The parameter's position. */
  readonly index: number;
  /** Its interface: `KeyboardEvent`, or `Event` for one any event fits (ADR-0047). */
  readonly interface: string;
  /** The DOM events it receives, by their names (`click`): what its members must be portable for. */
  readonly events: readonly string[];
}

/** An event's payload, as the walks check an emit of it (UF2017, UF3031). */
export interface EventPayload {
  readonly required: number;
  readonly total: number;
  /** For each member, whether it admits `null` or `undefined`. */
  readonly nullable: readonly boolean[];
}

/** What the setup declares, as every walk of the component's code reads it (ADR-0045). */
export interface SetupScope {
  /** The setup's bindings, by the identifier that declares each. */
  readonly bindings: ReadonlyMap<object, SetupBinding>;
  /**
   * The module's value imports of the authoring API, by the identifier that declares each: the
   * API, or `undefined` for one its import does not give (reported there).
   */
  readonly authoring: ReadonlyMap<object, AuthoringApi | undefined>;
  /**
   * The events `defineEmits` declares, with how many payload members each takes, and whether
   * each member admits `null` or `undefined` (an optional one, or a type that holds either).
   */
  readonly events: ReadonlyMap<string, EventPayload> | undefined;
  /** The parameter of each setup function that receives an event, by the function. */
  readonly eventParameters: ReadonlyMap<SetupFunction, EventParameter>;
}

/** What lowering a component's returned JSX needs to know about the component and module. */
export interface RenderContext {
  readonly source: string;
  readonly reporter: Reporter;
  readonly scopes: Scopes;
  readonly types: TypeTable;
  /** The component's function: its parameters are the props. */
  readonly component: ComponentFunction;
  /** The props, by name: every member of the props type. */
  readonly props: ReadonlyMap<string, PropBinding>;
  /** The destructured props, by the identifier that declares each. */
  readonly propsByDeclaration: ReadonlyMap<object, PropBinding>;
  /** The object form's parameter: what declares it, and its name. */
  readonly propsObject: { declaration: object; name: string } | undefined;
  /** The loop variables of the lists lowered so far, by the parameter that declares each. */
  readonly loopVariables: Map<object, LoopVariable>;
  /** The loop variables of the lists around the node being lowered, outermost first. */
  readonly enclosing: LoopVariable[];
  /** What the setup declares. */
  readonly setup: SetupScope;
  /** The `ref` attribute that attaches each template ref, by the identifier that declares it. */
  readonly attached: Map<object, { start: number; end: number }>;
  /** The bindings the component declares: the props', the setup's, then each list's. */
  readonly bindings: Binding[];
  /** The module's comments: lint directives must not reach an output. */
  readonly comments: readonly AST.Comment[];
  /** What the walks note for the rules judged once everything is lowered. */
  readonly facts: CodeFacts;
  /**
   * The components a template may render, by the identifier that declares each: an import's
   * local name, or a component function of the module, this one included (ADR-0053).
   */
  readonly components: ReadonlyMap<object, ComponentInfo | undefined>;
  /** The slots the component declares with `defineSlots` (ADR-0054). */
  readonly slots: Slots | undefined;
  /**
   * Set while a conditional's condition is checked: the one place a slot's presence,
   * `slots.title`, is read (ADR-0054).
   */
  readonly presence?: true;
}

/** The setup binding an identifier reads, where the component's setup declares it. */
export function setupBindingOf(
  identifier: AST.IdentifierReference,
  render: RenderContext,
): SetupBinding | undefined {
  const resolution = render.scopes.resolve(identifier);
  return resolution.kind === "variable" && resolution.scope === render.component
    ? render.setup.bindings.get(resolution.declaration)
    : undefined;
}
