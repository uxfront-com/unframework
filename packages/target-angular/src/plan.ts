// What the Angular class declares for each of a component's bindings (plan §6, ADR-0046), and the
// names the output file claims beside the source's own.
import { codeKind, codeNames, ImportSet, NameScope, sourceNames } from "@unframework/codegen";
import { summarizeCode } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  BindingKind,
  Code,
  EventDeclaration,
  FunctionCode,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { assertedSetup } from "./narrowing.ts";

/**
 * How the class declares a binding, which decides how code reads it:
 * - `input`: a prop, a signal input (`this.label()`);
 * - `signal`: a state whose initial value reads no input, `signal(initial)`;
 * - `linked`: a state seeded from inputs, `linkedSignal(() => untracked(() => initial))`, read
 *   once in `ngOnInit` so it keeps the inputs' first values (ADR-0046);
 * - `computed`: a derived value, `computed(getter)`;
 * - `once`: a setup `const` that reads inputs or state, `computed(() => untracked(() => value))`,
 *   read once in `ngOnInit` (setup-once, plan §4.5);
 * - `value`: a setup `const` that reads none, or an id: a plain field (`this.rates`);
 * - `query`: a template ref, `viewChild<ElementRef<T>>("name")`;
 * - `method`: a local function, a method (`this.save()`);
 * - `arrow`: a local function passed as a value (`setInterval(tick, 100)`), an arrow-function
 *   field, so it keeps `this`;
 * - `field`: a setup `let`, a mutable field (`this.timer`); one whose initial value reads an
 *   input or a lazy member is assigned in `ngOnInit` (`Plan.seeded`);
 * - `loop`: a list's item or index, the `@for`'s own;
 * - `emit`: the `emit` function: each event is an `output()` of its name.
 */
export type MemberForm =
  | "input"
  | "signal"
  | "linked"
  | "computed"
  | "once"
  | "value"
  | "query"
  | "method"
  | "arrow"
  | "field"
  | "loop"
  | "emit";

/** What the emitter knows about a component before it prints anything. */
export interface Plan {
  component: UfComponent;
  module: UfModule;
  /** The file's module-level names: imports, helpers, directives, beside the source's. */
  imports: ImportSet;
  /** The class's member names: the props, the setup's bindings, the events and Angular's hooks. */
  members: NameScope;
  /**
   * The names `ngOnInit` declares (watchers' locals): none the source's code reads or declares,
   * which its callbacks inside would capture, and none Angular's imports may take. A binding's
   * own name is free: class code reads a binding through `this.`.
   */
  locals: NameScope;
  /**
   * The names a function the emitter writes around one of the source's must leave alone: those
   * the source's function reads or declares, Angular's imports and `Object`.
   */
  reserved(fn: FunctionCode): string[];
  /** How each binding is declared. */
  forms: ReadonlyMap<BindingId, MemberForm>;
  /**
   * The setup `let`s whose initial value reads an input or a lazy member: each is declared
   * without an initialiser and assigned in `ngOnInit`, in source order (ADR-0046).
   */
  seeded: ReadonlySet<BindingId>;
  /** The events by name. */
  events: ReadonlyMap<string, EventDeclaration>;
  /** The names of the list items and indexes: a template statement shadowed by one says `this.`. */
  loopNames: ReadonlySet<string>;
}

/** The names Angular gives a component class's own members: no binding may take them. */
const ANGULAR_MEMBERS = ["constructor", "ngOnInit", "ngOnDestroy", "ngOnChanges", "ngDoCheck"];

/** Every name the output may import from Angular: no local the emitter declares takes one. */
export const ANGULAR_IMPORTS: readonly string[] = [
  "Component",
  "AfterRenderRef",
  "ApplicationRef",
  "DestroyRef",
  "Directive",
  "EffectRef",
  "ElementRef",
  "Injector",
  "OnDestroy",
  "OnInit",
  "PLATFORM_ID",
  "Renderer2",
  "afterNextRender",
  "afterRenderEffect",
  "computed",
  "effect",
  "inject",
  "input",
  "isPlatformBrowser",
  "linkedSignal",
  "output",
  "signal",
  "untracked",
  "viewChild",
];

/**
 * Plans a component's members: how each binding is declared, and the names in use. The plan's
 * component is the source's, with each setup binding an event shares its name with renamed
 * (`withOutputNames`) and each narrowed member path of the setup asserted (./narrowing.ts).
 */
export function planComponent(declared: UfComponent, module: UfModule): Plan {
  const component = assertedSetup(withOutputNames(declared, module));
  const source = sourceNames(component, module);
  // The class takes the component's name, unless an import has it (`Component`): see ./index.ts.
  const imports = new ImportSet(
    new NameScope([...source].filter((name) => name !== component.name)),
  );
  const events = new Map(component.emits?.events.map((event) => [event.name, event]) ?? []);
  const memberNames = [
    ...ANGULAR_MEMBERS,
    ...component.props.map(({ name }) => name),
    ...component.bindings.filter(({ kind }) => !isLoopVariable(kind)).map(({ name }) => name),
    ...events.keys(),
  ];
  const members = new NameScope(memberNames);
  const bindingNames = new Set(component.bindings.map(({ name }) => name));
  const locals = new NameScope([
    ...[...source].filter((name) => !bindingNames.has(name)),
    ...ANGULAR_IMPORTS,
    "Object",
  ]);
  return {
    component,
    module,
    imports,
    members,
    locals,
    reserved: (fn) => [
      ...codeNames(fn.body.code, codeKind(fn.body, component)),
      ...fn.parameters.flatMap((parameter) =>
        parameter.name === undefined ? (parameter.pattern?.names ?? []) : [parameter.name],
      ),
      ...ANGULAR_IMPORTS,
      "Object",
    ],
    ...formsOf(component),
    events,
    loopNames: new Set(
      component.bindings.filter(({ kind }) => isLoopVariable(kind)).map(({ name }) => name),
    ),
  };
}

/**
 * The component with each setup binding whose name an event takes renamed (ADR-0047): the class
 * declares a member for both, and the output keeps the event's name, which is the component's API
 * (angular-eslint's `no-output-rename` rules out an alias). The binding is the class's own, so it
 * takes another name: a local function `onSave`, as Angular names a method that handles and emits,
 * a template ref `fieldElement`, any other value `currentPage`. Every read and write of a binding is
 * a reference the rules spell by its binding's name, so the new name reaches each one.
 */
function withOutputNames(component: UfComponent, module: UfModule): UfComponent {
  const events = new Set(component.emits?.events.map(({ name }) => name) ?? []);
  const clashing = component.bindings.filter(
    ({ name, kind }) =>
      events.has(name) && kind !== "prop" && kind !== "emit" && !isLoopVariable(kind),
  );
  if (clashing.length === 0) return component;
  const taken = new NameScope([
    ...sourceNames(component, module),
    ...events,
    ...ANGULAR_MEMBERS,
    ...ANGULAR_IMPORTS,
  ]);
  const renamed = new Map(
    clashing.map(({ id, name, kind }) => [id, taken.claim(outputSafeName(name, kind))]),
  );
  return {
    ...component,
    bindings: component.bindings.map((binding) => {
      const name = renamed.get(binding.id);
      return name === undefined ? binding : { ...binding, name };
    }),
  };
}

/** The name a binding takes beside an event of its own name. */
function outputSafeName(name: string, kind: BindingKind): string {
  const pascal = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  switch (kind) {
    case "localFn":
      return `on${pascal}`;
    case "templateRef":
      return `${name}Element`;
    case "state":
    case "derived":
    case "localConst":
    case "localVar":
    case "prop":
    case "loopVar":
    case "emit":
      return `current${pascal}`;
    default:
      return unreachable(kind);
  }
}

/**
 * Each binding's form, and the setup `let`s seeded once the inputs are set: setup items in source
 * order, as a later item may read an earlier one.
 */
function formsOf(component: UfComponent): {
  forms: Map<BindingId, MemberForm>;
  seeded: Set<BindingId>;
} {
  const forms = new Map<BindingId, MemberForm>();
  const seeded = new Set<BindingId>();
  const kinds = new Map(component.bindings.map((binding) => [binding.id, binding.kind]));
  // A value read while the class is constructed cannot read an input (NG0950 for a required
  // one, the default for another) or what reads one: `computed` and the seeded members are
  // read lazily instead.
  const lazy = new Set<BindingId>();
  const readsLazily = (code: Code) =>
    [...summarizeCode(code, component).reads].some((id) => {
      const kind = kinds.get(id);
      return lazy.has(id) || (kind !== undefined && readLazily(kind));
    });
  for (const binding of component.bindings) {
    switch (binding.kind) {
      case "prop":
        forms.set(binding.id, "input");
        lazy.add(binding.id);
        break;
      case "loopVar":
        forms.set(binding.id, "loop");
        break;
      case "emit":
        forms.set(binding.id, "emit");
        break;
      case "state":
      case "derived":
      case "templateRef":
      case "localConst":
      case "localFn":
      case "localVar":
        break;
      default:
        unreachable(binding.kind);
    }
  }
  const escaping = escapingFunctions(component);
  for (const item of component.setup) {
    switch (item.kind) {
      case "State": {
        const linked = item.initial !== undefined && readsLazily(item.initial);
        forms.set(item.binding, linked ? "linked" : "signal");
        if (linked) lazy.add(item.binding);
        break;
      }
      case "Derived":
        forms.set(item.binding, "computed");
        break;
      case "TemplateRef":
        forms.set(item.binding, "query");
        break;
      case "Id":
        forms.set(item.binding, "value");
        break;
      case "Const": {
        const once = readsLazily(item.value);
        forms.set(item.binding, once ? "once" : "value");
        if (once) lazy.add(item.binding);
        break;
      }
      case "Variable":
        forms.set(item.binding, "field");
        // A field initialiser runs while the class constructs: one that reads an input would
        // read none (NG0950) or its default, so the field is assigned in `ngOnInit` instead.
        if (item.initial !== undefined && readsLazily(item.initial)) {
          seeded.add(item.binding);
          lazy.add(item.binding);
        }
        break;
      case "Function":
        forms.set(item.binding, escaping.has(item.binding) ? "arrow" : "method");
        break;
      case "Watch":
      case "WatchEffect":
      case "Lifecycle":
        break;
      default:
        unreachable(item);
    }
  }
  return { forms, seeded };
}

/** The local functions code passes as a value (`setTimeout(tick, 100)`), which run later. */
function escapingFunctions(component: UfComponent): Set<BindingId> {
  const escaping = new Set<BindingId>();
  const functions = new Set(
    component.bindings.filter(({ kind }) => isFunction(kind)).map(({ id }) => id),
  );
  const visit = (code: Code) => {
    for (const reference of code.refs) {
      if (reference.kind === "Binding" && !reference.call && functions.has(reference.binding)) {
        escaping.add(reference.binding);
      }
    }
  };
  for (const item of component.setup) {
    switch (item.kind) {
      case "State":
      case "Variable":
        if (item.initial) visit(item.initial);
        break;
      case "Const":
        visit(item.value);
        break;
      case "Derived":
        visit(item.getter.body);
        break;
      case "Function":
        visit(item.function.body);
        break;
      case "Watch":
        for (const source of item.sources) if (source.kind === "Getter") visit(source.getter.body);
        visit(item.callback.body);
        break;
      case "WatchEffect":
        visit(item.effect.body);
        break;
      case "Lifecycle":
        visit(item.callback.body);
        break;
      case "TemplateRef":
      case "Id":
        break;
      default:
        unreachable(item);
    }
  }
  return escaping;
}

/** Whether a binding is a list's item or index, which the `@for` declares: no member. */
export function isLoopVariable(kind: BindingKind): boolean {
  switch (kind) {
    case "loopVar":
      return true;
    case "prop":
    case "state":
    case "derived":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return false;
    default:
      return unreachable(kind);
  }
}

/** Whether a binding is a local function. */
function isFunction(kind: BindingKind): boolean {
  switch (kind) {
    case "localFn":
      return true;
    case "prop":
    case "loopVar":
    case "state":
    case "derived":
    case "templateRef":
    case "localConst":
    case "localVar":
    case "emit":
      return false;
    default:
      return unreachable(kind);
  }
}

/**
 * Whether a binding of this kind is read lazily whatever its item: an input (unset while the
 * class constructs) or a derived value (a `computed` that may read one). A state or a constant
 * is lazy when its own value reads one (`formsOf`).
 */
function readLazily(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
    case "derived":
      return true;
    case "loopVar":
    case "state":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return false;
    default:
      return unreachable(kind);
  }
}

/** The binding a component declares under `id`. */
export function bindingById(plan: Plan, id: BindingId): Binding {
  const binding = plan.component.bindings.find((each) => each.id === id);
  if (!binding) throw new Error(`Component ${plan.component.name} declares no binding ${id}.`);
  return binding;
}

/** A binding's form. */
export function formOf(plan: Plan, binding: Binding): MemberForm {
  const form = plan.forms.get(binding.id);
  if (form === undefined) throw new Error(`No form for the binding ${binding.id}.`);
  return form;
}

/** Whether a form is a signal, read by calling it. */
export function isSignal(form: MemberForm): boolean {
  switch (form) {
    case "input":
    case "signal":
    case "linked":
    case "computed":
    case "once":
      return true;
    case "value":
    case "query":
    case "method":
    case "arrow":
    case "field":
    case "loop":
    case "emit":
      return false;
    default:
      return unreachable(form);
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
export function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
