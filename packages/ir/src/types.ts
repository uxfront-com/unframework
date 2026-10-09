/**
 * The portable IR: what the analyser knows about a `.uf.tsx` module, as plain,
 * serialisable data. Every target emits from this and nothing else.
 *
 * Rules (plan §5.3):
 * - Every node carries a span.
 * - A field is added only when a consumer reads it.
 * - The JSON Schema in `schema/ir.schema.json` is generated from these types
 *   (`pnpm --filter @unframework/ir generate`), and a test fails when it is stale.
 * - Optional fields, arrays and string patterns only: no tuples, no `| null`, no `Record`, which
 *   the generator turns into keywords `validateModule` does not implement, or does not check.
 *   The builders leave an absent optional field out, never set it to `undefined`.
 * - What the schema cannot express, `checkInvariants` checks: the compiler emits from no module
 *   that breaks the invariants documented here.
 */

/** A half-open range `[start, end)` of UTF-16 offsets into the source file. */
export interface Span {
  start: number;
  end: number;
}

/**
 * A binding's id: its name and the offset where it is declared, `name@offset` (plan §5.3).
 * Unique in a component, and stable for one source, so expressions refer to bindings by it.
 * @pattern ^[A-Za-z_$][A-Za-z0-9_$]*@(0|[1-9][0-9]*)$
 */
export type BindingId = string;

/** One `.uf.tsx` module. */
export interface UfModule {
  /** The IR format version. Bumped, with a migration, on every breaking change. */
  irVersion: 1;
  /** The source file as the caller named it: relative and with forward slashes in snapshots. */
  file: string;
  /** The module's components, in source order. */
  components: UfComponent[];
  /** What the module exports, in source order. Targets keep the same export shape. */
  exports: UfExport[];
  /**
   * The local type declarations the components' props, events and setup code use, in source
   * order, each name once: the targets that print types copy them into the outputs of the
   * components that use them.
   */
  types: TypeDeclaration[];
  /**
   * The module's imports of other `.uf.tsx` modules, in source order, each with the API the
   * resolver gave for it (ADR-0053). Absent when it imports none.
   */
  imports?: ModuleImport[];
  /** The injection keys the module declares and exports, in source order (ADR-0054). */
  keys?: InjectionKeyDeclaration[];
}

/**
 * An import of another `.uf.tsx` module: `import Field from "./Field.uf.tsx"` (ADR-0053). The
 * analyser records the API it resolved, so every target emits from the IR alone (P5, P6).
 */
export interface ModuleImport {
  /** The specifier as written, which ends in `.uf.tsx`. */
  specifier: string;
  /** The resolved `.uf.tsx`, relative to the importer, with forward slashes. */
  file: string;
  /** What the resolver returned for the module. */
  api: ModuleApi;
  /** The names the import binds, in source order. */
  names: ImportedName[];
  /** The import declaration. */
  span: Span;
}

/** A name an import binds: a component, or an injection key. */
export interface ImportedName {
  kind: "Component" | "Key";
  /** The imported name: `default` for a default import. */
  imported: string;
  /** The local name the module uses. */
  local: string;
  span: Span;
}

/**
 * `export const ThemeKey: InjectionKey<Theme> = Symbol("theme")` (ADR-0054): a key `provide` and
 * `inject` name, declared in the providing `.uf.tsx`.
 */
export interface InjectionKeyDeclaration {
  /** The exported `const`'s name. */
  name: string;
  /** The `Symbol`'s description: a string literal's value. */
  description: string;
  /** The value's type, `Theme` in `InjectionKey<Theme>`, as written. */
  type: TypeText;
  span: Span;
}

/**
 * The public API of a `.uf.tsx` module, as the resolver returns it (ADR-0053): what a parent
 * reads of its children. It points into another file, so it holds types as text and no spans.
 */
export interface ModuleApi {
  /** The module's file, relative to the importer, with forward slashes. */
  file: string;
  /** The module's components, in source order, its non-exported ones included. */
  components: ComponentApi[];
  /** The injection keys the module exports, in source order. */
  keys: KeyApi[];
}

/** What a parent reads of a child component (ADR-0053, ADR-0055). */
export interface ComponentApi {
  name: string;
  /** How the module exports it: as the default, by name, or not at all (a sibling file). */
  export: "default" | "named" | "local";
  /** The props, in member order. */
  props: ApiMember[];
  /** The events `defineEmits` declares, in member order. */
  events: ApiEvent[];
  /** The models `defineModel` declares, in source order. */
  models: ApiMember[];
  /** The slots `defineSlots` declares, in member order. */
  slots: ApiSlot[];
  /** The names `defineExpose` exposes, in source order. */
  exposes: string[];
  /** `false` where `defineOptions({ inheritAttrs: false })` turns fallthrough off. */
  inheritAttrs: boolean;
  /**
   * What the component's render root is: one element, one component, or anything else (a
   * fragment, a conditional, a slot outlet). Fallthrough and Angular's host need it (ADR-0056).
   */
  root: "element" | "component" | "other";
  /** The root element's tag, when the root is an element. */
  rootTag?: string;
}

/** A prop or a model of a child's API: its name, its optionality and its type as written. */
export interface ApiMember {
  name: string;
  optional: boolean;
  type: string;
}

/**
 * An event of a child's API: its name and its payload's members, which a target's listener
 * spreads (Angular's tuple payload rule, ADR-0047).
 */
export interface ApiEvent {
  /** @pattern ^[a-z][A-Za-z0-9]*$ */
  name: string;
  parameters: ApiEventParameter[];
}

/** A member of an event's payload in a child's API. */
export interface ApiEventParameter {
  name: string;
  optional?: true;
  type: string;
}

/** A slot of a child's API: its name, its optionality and its props' type as written. */
export interface ApiSlot {
  name: string;
  optional: boolean;
  /** The slot's props' type, for a scoped slot. */
  props?: string;
}

/** An injection key of a child module's API. */
export interface KeyApi {
  name: string;
  description: string;
  type: string;
}

/** An export of a module. */
export interface UfExport {
  /** `default` for `export default function Name`, `named` for `export function Name`. */
  kind: "default" | "named";
  /** The exported name: `"default"` for the default export, and an identifier otherwise. */
  name: string;
  /** The name of the component that is exported: one of the module's components. */
  local: string;
  span: Span;
}

/** A top-level `interface` or `type` declaration that a component's props use (ADR-0034). */
export interface TypeDeclaration {
  /** The declared name, which the props' types refer to. */
  name: string;
  /** Whether the source exports it: the outputs export it too. */
  exported: boolean;
  /**
   * The declaration from `interface` or `type` to its end, without `export`: exactly
   * `source.slice(span.start, span.end)`. Targets copy it as written.
   */
  code: string;
  span: Span;
}

/** A component: an exported PascalCase function whose last statement returns JSX. */
export interface UfComponent {
  /**
   * The function's name, PascalCase in ASCII letters and digits, and unique in the module
   * without case: every target writes it as an identifier and names the output file by it.
   */
  name: string;
  span: Span;
  /** The members of the props type, in member order: none for a component without props. */
  props: Prop[];
  /** The props parameter as written. Absent when the component takes no parameter. */
  propsParameter?: PropsParameter;
  /**
   * The names of the module's `types` this component's output declares: the declarations its
   * props' types, its events' payloads and its setup code's annotations reach, in source order.
   */
  types: string[];
  /**
   * The events the component declares with `const emit = defineEmits<{ … }>()` (ADR-0047).
   * Absent when it declares none.
   */
  emits?: Emits;
  /** The slots the component declares with `const slots = defineSlots<{ … }>()` (ADR-0054). */
  slots?: Slots;
  /** The local functions the component exposes with `defineExpose({ … })` (ADR-0054). */
  exposes?: Exposes;
  /** Set by `defineOptions({ inheritAttrs: false })`: no `class` or `style` falls through. */
  inheritAttrs?: false;
  /**
   * Every binding the component declares, by the start of its span: the props (each
   * destructured prop, or every prop in the object form), the setup's declarations, the `emit`
   * function and the loop variables. Expressions and code refer to them by id.
   */
  bindings: Binding[];
  /**
   * The setup: what the component's body declares and runs before its return, in source order
   * (plan §4.2, ADR-0045). Empty for a component whose body is only its return.
   */
  setup: SetupItem[];
  /** The returned JSX: one element, or several roots in a fragment. */
  render: ElementNode | FragmentNode;
}

/** How a component declares its props: `({ label, tone = "info" }: Props)` or `(props: Props)`. */
export interface PropsParameter {
  /** `destructured` for an object pattern, `object` for an identifier (ADR-0034). */
  form: "destructured" | "object";
  /**
   * The parameter's name, exactly in the object form: the name its uses are written with
   * (`props.label`), which the targets that keep the object form keep too.
   */
  name?: string;
  /** The annotation as written: a reference to a local type, or an object type literal. */
  type: TypeText;
  span: Span;
}

/** A member of a component's props type. */
export interface Prop {
  /**
   * The name a consumer passes: ASCII letters and digits that every target can declare and
   * read as an identifier, and none a target reserves (`RESERVED_PROP_NAMES`).
   */
  name: string;
  /** Whether the member is optional (`label?: string`). */
  optional: boolean;
  /** The member's type annotation as written: the targets that declare inputs print it. */
  type: TypeText;
  /**
   * The default, in the destructured form only: a static value, which references nothing,
   * since Vue hoists defaults out of the component and Angular evaluates them before any input
   * is set. Absent, or explicitly `undefined`, the prop takes it.
   */
  default?: Expression;
  /**
   * The binding expressions read the prop through. Absent when the destructured form leaves
   * the prop out; the object form has one for every prop.
   */
  binding?: BindingId;
  span: Span;
}

/** A type annotation, as written: exactly `source.slice(span.start, span.end)`. */
export interface TypeText {
  code: string;
  span: Span;
}

/** A name a component declares, which its expressions refer to. */
export interface Binding {
  /** `name@span.start`. */
  id: BindingId;
  /** The name as declared. */
  name: string;
  kind: BindingKind;
  /**
   * Where the binding is declared: the destructured name, the props member, the parameter, or
   * the identifier a setup declaration binds.
   */
  span: Span;
}

/**
 * What declares a binding. Only the kinds the analyser lowers: the coverage gate requires a
 * corpus case for each.
 * - `prop`: a prop, destructured or read through the props object;
 * - `loopVar`: the item or index parameter of a list's callback;
 * - `state`: `const count = ref(…)`, read and written through `count.value`;
 * - `derived`: `const total = computed(() => …)`, read through `total.value`;
 * - `templateRef`: `const input = useTemplateRef<HTMLInputElement>()`, read through
 *   `input.value` in client code, and attached with `ref={input}`;
 * - `localConst`: a setup `const` holding a value, `useId()`'s included;
 * - `localFn`: a setup function, `function save() {…}` or `const save = () => …`;
 * - `localVar`: a setup `let`, which holds what no template reads (a timer's id);
 * - `emit`: the function `defineEmits` returns;
 * - `model`: `const open = defineModel<boolean>("open")`, read and written as `open.value`, as
 *   state is (ADR-0054);
 * - `slots`: the object `defineSlots` returns;
 * - `slotScope`: a scoped fill's parameter, or a name its pattern binds;
 * - `context`: `const theme = inject(ThemeKey)`, an injected value, read-only;
 * - `component`: a component named in `<component is>`'s set.
 */
export type BindingKind =
  | "prop"
  | "loopVar"
  | "state"
  | "derived"
  | "templateRef"
  | "localConst"
  | "localFn"
  | "localVar"
  | "emit"
  | "model"
  | "slots"
  | "slotScope"
  | "context"
  | "component";

/**
 * An expression the analyser accepted, with every identifier in it resolved (plan §5.4).
 * Targets print it by splicing their own spelling of each reference into the code.
 */
export interface Expression {
  /** The source text, exactly `source.slice(span.start, span.end)`: never rewritten in the IR. */
  code: string;
  span: Span;
  /** Each reference to a binding or an allowed global, in source order, without overlap. */
  refs: Reference[];
}

/** A resolved identifier in an expression. */
export type Reference = BindingReference | GlobalReference | SlotReference;

/**
 * `slots.title` as a condition (ADR-0054): whether the parent filled the slot. Only a render
 * expression holds one, never setup code; rendering a slot is a {@link SlotOutletNode}.
 */
export interface SlotReference {
  kind: "Slot";
  /** The slot's name, as `defineSlots` declares it. */
  slot: string;
  /** The member expression, `slots.title`. */
  span: Span;
}

/** A read of one of the component's bindings. */
export interface BindingReference {
  kind: "Binding";
  binding: BindingId;
  /**
   * What a target replaces with its own spelling of the binding: the identifier; the whole
   * `props.label` in the object form; and the whole `count.value` for a `state`, `derived`,
   * `templateRef` or `model` binding, or a `context` binding of a key of a ref, whose value is the
   * only thing code reads (ADR-0045, ADR-0054). A key of a ref is provided the ref itself, by its
   * name.
   */
  span: Span;
  /** Set for a shorthand property (`{ label }`), which a rewrite must expand to `label: …`. */
  shorthand?: true;
  /**
   * Set where the reference is the callee of a call (`save()`, `format(total.value)`): only a
   * `localFn` binding is called, and outside client code it is used only so; client code may
   * also pass one as a call's argument (`setTimeout(tick, 100)`, ADR-0045). A target whose
   * functions are asynchronous there (Qwik's QRLs) awaits the call.
   */
  call?: true;
  /**
   * The paths of the read that a condition around it narrows, where the read relies on it
   * (ADR-0046): set on a read of a prop or of a ref's value only, shortest path first.
   */
  narrowed?: NarrowedPath[];
  /**
   * Set where the reference lies in client code that runs later than the code around it (ADR-0048):
   * in a function that code hands to a call that runs it later or never (a timer's or an
   * observer's callback, a promise's `then`, `addEventListener`, `onCleanup`), written in place
   * or held in a local `const` that only such calls are given. No target tracks what it reads
   * while the code around it runs: a `watchEffect` lists only the other reads as its
   * dependencies (`summarizeTracked`).
   */
  later?: true;
}

/**
 * A path of a read that a condition around it narrows (ADR-0046), and that the read then uses as
 * narrowed: a member read through `.`, a call's argument, a local's initial value, an operand.
 * The source's TypeScript narrows it there, and a target whose own spelling of the read it does
 * not narrow (a call: `selected()`, `this.user()`; a property in a closure: `props.user`,
 * `userRef.current`) asserts the path present (`selected()!`, `draft().email!`) or reads a
 * narrowed value of its own. Only a template's condition around a handler may narrow a path to
 * fewer kinds than its declared ones without `null` and `undefined` (`typeof`, a discriminant):
 * the analyser rejects such a narrowing in code (UF3031), where no target keeps it.
 */
export interface NarrowedPath {
  /**
   * The path, from the reference's start: the reference itself (`selected.value`, `user`,
   * `props.user`) or a member path off it written with `.` or a literal key (`draft.value.email`,
   * `contact.email`, `rows.value[0]`), no `?.` in it.
   */
  span: Span;
  /**
   * Where the innermost condition that narrows the path is:
   * - `local`: no function lies between it and the read (an `if`'s or a guard clause's test in
   *   the read's function, or a `?:`, `&&` or `||` in the same expression), where TypeScript
   *   narrows a property (`props.user`, `userRef.current`) too, and never a call;
   * - `closure`: in a function of the setup around the read's: only a destructured prop's own
   *   read, which TypeScript narrows in a closure as a parameter, and a property's not;
   * - `template`: a conditional of the template around the read's handler, whose branch the
   *   targets keep narrowed (UF3029 keeps the read to an argument of the handler's one call). It
   *   may narrow kinds (`typeof`), where an assertion is not enough.
   */
  scope: "local" | "closure" | "template";
}

/**
 * A read of a global every target can reach: in a template expression one of `ALLOWED_GLOBALS`
 * (Angular templates see only the component's members, so its target declares one for each);
 * in setup code one of `PURE_GLOBALS` or, in client code, `CLIENT_GLOBALS` (ADR-0045).
 */
export interface GlobalReference {
  kind: "Global";
  /** The global's name: one of the globals its context may read. */
  name: string;
  /** The identifier. */
  span: Span;
}

/**
 * Code the setup runs (ADR-0045): an expression or a function's body, with every name in it
 * resolved. Like an {@link Expression}, its code is exactly `source.slice(span.start,
 * span.end)` and targets print it by splicing their own spelling of each reference; unlike
 * one, it may write state, call `emit` and `nextTick`, and read what only client code may.
 */
export interface Code {
  /** The source text, exactly `source.slice(span.start, span.end)`. */
  code: string;
  span: Span;
  /**
   * Each reference in source order, by the start of its span. A `Write`'s value and an
   * `Emit`'s arguments hold references of their own, which follow it in the list; no other
   * references overlap.
   */
  refs: CodeReference[];
}

/** A resolved name in setup code. */
export type CodeReference =
  | BindingReference
  | GlobalReference
  | WriteReference
  | EmitReference
  | ApiReference
  | EventReference
  | SlotReference;

/**
 * A write of a `state` or `model` binding's value or of a `localVar`: `count.value = 1`, `count.value += step`,
 * `count.value++`, `timer = setInterval(…)` (ADR-0045). A write is a statement of its own: the
 * whole expression of an expression statement, or the whole body of an arrow function.
 */
export interface WriteReference {
  kind: "Write";
  /** A `state`, a `model` or a `localVar` binding. */
  binding: BindingId;
  /**
   * `=`, an arithmetic or logical compound assignment operator (`+=`, `??=`, …), or `++` or `--`.
   * Bitwise and shift assignments are not accepted (UF1002).
   * @pattern ^(?:=|\+=|-=|\*=|\/=|%=|\*\*=|&&=|\|\|=|\?\?=|\+\+|--)$
   */
  operator: string;
  /**
   * The whole assignment or update expression; for a write that is an arrow's expression body,
   * the whole body, its parentheses included (`() => (open.value = !open.value)`).
   */
  span: Span;
  /** What is written: `count.value`, or the variable. */
  target: Span;
  /** An assignment's value: its references follow this one in the list. Absent for `++`/`--`. */
  value?: Span;
  /** Set where the write is an arrow function's expression body (`() => count.value++`). */
  arrowBody?: true;
  /**
   * The target, where the operator reads it (`+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `++`, `--`)
   * and a condition around the write narrows it present
   * (`if (count.value !== null) count.value += 1`, ADR-0046): one `local` path spanning `target`.
   * A target that reads the written value through a call asserts it (`count()! + 1`).
   */
  narrowed?: NarrowedPath[];
}

/**
 * A use of a handler's event parameter, `event.key` or `event.preventDefault()` (ADR-0047): a
 * member every target's event object has (`PORTABLE_EVENT_MEMBERS`), read or called. The
 * parameter is the one a {@link Parameter} marks with `event`.
 */
export interface EventReference {
  kind: "Event";
  /** The member: `key`, `currentTarget`, `preventDefault`, … */
  member: string;
  /** The member expression, `event.key`. */
  span: Span;
  /** Set where the member is called (`event.preventDefault()`). */
  call?: true;
}

/**
 * A `preventDefault()` or `stopPropagation()` call on a handler's event (ADR-0047): a statement at
 * the top of the handler's body, or the only statement under an `if` there whose test reads only
 * the event, with no statement before it that may leave the body but guard clauses whose tests
 * read only the event (`if (event.key !== "Enter") return;`, which `handlerControls` of
 * `@unframework/codegen` reads). Qwik runs these synchronously (`preventdefault:click`, `sync$`),
 * apart from the lazily loaded handler.
 */
export interface EventControl {
  method: "preventDefault" | "stopPropagation";
  /** The `if`'s test when the call is conditional: code that reads only the event. */
  condition?: Code;
  /** The statement that makes the call: the expression statement, or the whole `if`. */
  span: Span;
}

/**
 * A call of the component's `emit`: `emit("change", count.value)` (ADR-0047). The event is a
 * string literal naming one the component declares.
 */
export interface EmitReference {
  kind: "Emit";
  /** The `emit` binding. */
  binding: BindingId;
  /** The event's name, as `defineEmits` declares it. */
  event: string;
  /** The whole call, from `emit` to its closing parenthesis. */
  span: Span;
  /** The payload's arguments, in order: their references follow this one in the list. */
  arguments: Span[];
}

/**
 * A use of an authoring API inside setup code: only `nextTick` (ADR-0048). The macros and the
 * other APIs are setup items, called at the top level of the body.
 */
export interface ApiReference {
  kind: "Api";
  /** The API: `nextTick`. */
  api: "nextTick";
  /** The identifier. */
  span: Span;
}

/**
 * A function the source writes: a setup function, a handler, a callback or a getter
 * (ADR-0045). Targets print it from its parts: a hoisted handler (Angular's methods) needs them
 * apart, and every other target prints them back as the author wrote them.
 */
export interface FunctionCode {
  /** Set for an `async` function. */
  async?: true;
  /** The parameters, in order. */
  parameters: Parameter[];
  /** The return type annotation as written, without its colon. */
  returnType?: TypeText;
  /** The body: a block `{ … }`, or an arrow's expression. */
  body: Code;
  /** Set where the body is an arrow's expression rather than a block. */
  expression?: true;
  /**
   * The leading `preventDefault()` and `stopPropagation()` calls of a handler's body (see
   * {@link EventControl}), in source order: set on a function that handles an event (an inline
   * handler, or a setup function a handler names) when it makes any. The body may make others
   * while the event is dispatched (in an `if` block beside other statements, a `switch` case,
   * after a guard on state), which every target runs in place and codegen's `handlerControls`
   * reads from the body; never one after an `await` or in a function inside it (UF3033).
   */
  eventControls?: EventControl[];
  /** The whole function, from `async` or its first parameter to the end of its body. */
  span: Span;
}

/**
 * A parameter of a function the source writes: an identifier or a destructuring pattern, with its
 * type and default. A function's own names are not bindings: code refers to them as written.
 */
export interface Parameter {
  /** The name of an identifier parameter. Absent for a pattern. */
  name?: string;
  /** A destructuring pattern (`[first, last]`, `{ id }`), as written. Absent for an identifier. */
  pattern?: ParameterPattern;
  /** The type annotation as written, without its colon. */
  type?: TypeText;
  /** Set for an optional parameter (`label?: string`). */
  optional?: true;
  /** A rest parameter (`...values`). */
  rest?: true;
  /** The default: a static value, which references nothing. */
  default?: Expression;
  /**
   * Set on a handler's event parameter: the DOM interface of its event (`KeyboardEvent`), from
   * its annotation or, unannotated, from the event's own (`DOM_EVENTS`). Code uses it only
   * through {@link EventReference}s.
   */
  event?: string;
  span: Span;
}

/** A destructuring pattern in a parameter: its code, and the names it declares, in order. */
export interface ParameterPattern {
  /** Exactly `source.slice(span.start, span.end)`: its defaults are static. */
  code: string;
  /** The names the pattern binds, each an identifier. */
  names: string[];
  span: Span;
}

/** What a component's setup declares or runs, in source order (ADR-0045). */
export type SetupItem =
  | StateItem
  | DerivedItem
  | TemplateRefItem
  | IdItem
  | ConstItem
  | VariableItem
  | FunctionItem
  | WatchItem
  | WatchEffectItem
  | LifecycleItem
  | ModelItem
  | ProvideItem
  | InjectItem;

/** `const count = ref(initial)`: a `state` binding (ADR-0046). */
export interface StateItem {
  kind: "State";
  binding: BindingId;
  /** The type argument as written (`ref<Item[]>([])`). */
  type?: TypeText;
  /**
   * The initial value: an expression the setup evaluates once, which may read props and the
   * values declared before it. Absent for `ref()`, which starts `undefined`.
   */
  initial?: Code;
  span: Span;
}

/** `const total = computed(() => …)`: a `derived` binding (ADR-0046). */
export interface DerivedItem {
  kind: "Derived";
  binding: BindingId;
  /** The type argument as written (`computed<number>(…)`). */
  type?: TypeText;
  /** The getter: a function without parameters, pure as a template expression is. */
  getter: FunctionCode;
  span: Span;
}

/** `const input = useTemplateRef<HTMLInputElement>()`: a `templateRef` binding (ADR-0049). */
export interface TemplateRefItem {
  kind: "TemplateRef";
  binding: BindingId;
  /** The element type as written (`HTMLInputElement`). */
  type?: TypeText;
  span: Span;
}

/** `const id = useId()`: a `localConst` binding holding an id unique to the instance (ADR-0049). */
export interface IdItem {
  kind: "Id";
  binding: BindingId;
  span: Span;
}

/** `const label = …`: a `localConst` binding, evaluated once when the setup runs (ADR-0045). */
export interface ConstItem {
  kind: "Const";
  binding: BindingId;
  /** The type annotation as written. */
  type?: TypeText;
  value: Code;
  span: Span;
}

/**
 * `let timer: number | undefined`: a `localVar` binding (ADR-0045), which client code writes and
 * reads and no template, getter or watched source reads.
 */
export interface VariableItem {
  kind: "Variable";
  binding: BindingId;
  /** The type annotation as written. */
  type?: TypeText;
  initial?: Code;
  span: Span;
}

/** `function save() {…}` or `const save = () => …`: a `localFn` binding (ADR-0045). */
export interface FunctionItem {
  kind: "Function";
  binding: BindingId;
  /** How the source declares it: a function declaration, or a `const` holding an arrow. */
  form: "declaration" | "arrow";
  function: FunctionCode;
  span: Span;
}

/**
 * `watch(source, (value, previous, onCleanup) => …, options)` (ADR-0048): the callback runs in
 * the browser after the sources change.
 */
export interface WatchItem {
  kind: "Watch";
  /** What it watches: one source, or each element of an array of sources. */
  sources: WatchSource[];
  /** Set for an array of sources (`watch([a, b], …)`): the callback gets arrays of values. */
  array?: true;
  /** The callback: its parameters are the value, the previous value and `onCleanup`. */
  callback: FunctionCode;
  /** `immediate: true`: the callback also runs once when the setup does. */
  immediate?: true;
  /** `flush: "post"`: the callback runs after the DOM has updated. */
  post?: true;
  span: Span;
}

/** What a watcher watches: a `state` or `derived` binding, or a getter. */
export type WatchSource = RefSource | GetterSource;

/** A `state` or `derived` binding, written as the ref itself: `watch(count, …)`. */
export interface RefSource {
  kind: "Ref";
  binding: BindingId;
  span: Span;
}

/** A getter, `watch(() => step, …)`: a function without parameters, pure as a getter is. */
export interface GetterSource {
  kind: "Getter";
  getter: FunctionCode;
  span: Span;
}

/**
 * `watchEffect((onCleanup) => …)` (ADR-0048): runs in the browser after the component mounts,
 * and again after any value it reads changes.
 */
export interface WatchEffectItem {
  kind: "WatchEffect";
  /** The effect: its one parameter, when it has one, is `onCleanup`. */
  effect: FunctionCode;
  span: Span;
}

/** `onMounted(…)` or `onUnmounted(…)` (ADR-0048): runs in the browser only. */
export interface LifecycleItem {
  kind: "Lifecycle";
  hook: "mounted" | "unmounted";
  /** The hook: a function without parameters. */
  callback: FunctionCode;
  span: Span;
}

/**
 * `const open = defineModel<boolean>("open", { default: false })`: a `model` binding (ADR-0054),
 * a prop the parent may bind two ways.
 */
export interface ModelItem {
  kind: "Model";
  binding: BindingId;
  /** The model's name, the string literal `defineModel` takes. */
  name: string;
  /** The type argument as written. */
  type?: TypeText;
  /** The `default` option: a static value, as a prop's default is. */
  default?: Expression;
  /** `required: true`. */
  required?: true;
  span: Span;
}

/** `provide(ThemeKey, theme)` (ADR-0054): a value the component's descendants inject. */
export interface ProvideItem {
  kind: "Provide";
  /** The local name of the module's key or of an imported one. */
  key: string;
  /** The provided value. */
  value: Code;
  span: Span;
}

/** `const theme = inject(ThemeKey, fallback)`: a `context` binding (ADR-0054). */
export interface InjectItem {
  kind: "Inject";
  binding: BindingId;
  /** The local name of the module's key or of an imported one. */
  key: string;
  /** What `inject` gives where no ancestor provides the key. */
  fallback?: Code;
  span: Span;
}

/** The slots a component declares: `const slots = defineSlots<{ title?: () => any }>()`. */
export interface Slots {
  /** The `slots` binding. */
  binding: BindingId;
  /** The type argument as written. */
  type: TypeText;
  /** The slots, in member order, each name once. */
  slots: SlotDeclaration[];
  /** The declaration, from `const` to its end. */
  span: Span;
}

/** A slot a component declares (ADR-0054). */
export interface SlotDeclaration {
  /** `default`, or the name of a named slot. */
  name: string;
  /** Whether the member is optional: every slot is (UF2029), so a parent may leave it empty. */
  optional: boolean;
  /** The props a scoped slot passes, as written: the type of the member's parameter. */
  props?: TypeText;
  span: Span;
}

/** What a component exposes with `defineExpose({ focus, clear })` (ADR-0054). */
export interface Exposes {
  /** The exposed `localFn` bindings, in source order. */
  functions: BindingId[];
  /** The call. */
  span: Span;
}

/** The events a component declares: `const emit = defineEmits<{ change: [value: number] }>()`. */
export interface Emits {
  /** The `emit` binding. */
  binding: BindingId;
  /** The type argument as written: an object type literal, or a reference to a local type. */
  type: TypeText;
  /** The events, in member order, each name once. */
  events: EventDeclaration[];
  /** The declaration, from `const` to its end. */
  span: Span;
}

/** An event a component declares (ADR-0047). */
export interface EventDeclaration {
  /**
   * The name a consumer listens to (`onChange` in the source): camelCase ASCII, which every
   * target spells its own way (ADR-0012).
   * @pattern ^[a-z][A-Za-z0-9]*$
   */
  name: string;
  /** The payload: the members of the event's named tuple, in order. */
  parameters: EventParameter[];
  /** The member that declares the event. */
  span: Span;
}

/** A member of an event's named tuple: `value: number` in `change: [value: number]`. */
export interface EventParameter {
  /** The member's label. */
  name: string;
  /** Set for an optional member (`value?: number`). */
  optional?: true;
  /** The member's type as written. */
  type: TypeText;
  span: Span;
}

/** A node of the render tree. */
export type RenderNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | IfNode
  | ForNode
  | ComponentNode
  | SlotOutletNode
  | DynamicNode;

/**
 * A component element, `<Field label="Name" onClear={reset} />` (ADR-0053): an imported
 * component, one of the module's own, or the component itself.
 */
export interface ComponentNode {
  kind: "Component";
  /** The local name of an imported component, or the name of one of the module's own. */
  component: string;
  /** Each attribute, each name set once. */
  attributes: ComponentAttribute[];
  /** What fills the child's slots: the children as the default slot's, then the named ones. */
  fills: SlotFill[];
  span: Span;
}

/**
 * Where a component renders a slot, `{slots.title?.()}` or `{slots.item?.({ item })}`, with the
 * fallback after `??` (ADR-0054).
 */
export interface SlotOutletNode {
  kind: "SlotOutlet";
  /** The slot's name, as `defineSlots` declares it. */
  slot: string;
  /** The object a scoped slot is called with. */
  props?: Expression;
  /** What renders when the parent leaves the slot empty: nothing when empty. */
  fallback: RenderNode[];
  span: Span;
}

/**
 * `<component is={…} />` over a statically known set (ADR-0054): all tags, or all components.
 * Tag candidates take element attributes and children; component candidates take component
 * attributes and fills, each declared by every candidate.
 */
export interface DynamicNode {
  kind: "Dynamic";
  /** What chooses the candidate: an expression whose value is one of `candidates`. */
  is: Expression;
  /** The set it chooses from, in source order. */
  candidates: DynamicCandidate[];
  attributes: (Attribute | ComponentAttribute)[];
  /** The children of a tag candidate: none for components, whose content is `fills`. */
  children: RenderNode[];
  /** The fills of component candidates. */
  fills?: SlotFill[];
  span: Span;
}

/** A candidate of `<component is>`: a tag, or a component by its local name. */
export type DynamicCandidate = TagCandidate | ComponentCandidate;

/** A tag `<component is>` may render: an HTML element's name. */
export interface TagCandidate {
  kind: "Tag";
  /** @pattern ^[a-z][a-z0-9]*$ */
  tag: string;
}

/** A component `<component is>` may render: a `component` binding's component. */
export interface ComponentCandidate {
  kind: "Component";
  /** The local name of an imported component, or the name of one of the module's own. */
  component: string;
}

/**
 * What fills a child's slot (ADR-0054): the children for the default slot, an arrow function in
 * the slot object for a named one, with its parameter for a scoped one, or the parent's own slot
 * passed on.
 */
export interface SlotFill {
  /** The child's slot: `default`, or a named slot. */
  slot: string;
  /** A scoped fill's parameter, whose names are `slotScope` bindings. */
  parameter?: Parameter;
  /** What fills the slot: none for a forwarded one. */
  children: RenderNode[];
  /** The parent's own slot this fill passes on, `{{ title: slots.title }}`, with no children. */
  forward?: string;
  span: Span;
}

/** An element: an HTML element such as `<p>`, or an SVG element inside an `<svg>`. */
export interface ElementNode {
  kind: "Element";
  /**
   * The tag name: an element of the HTML Living Standard in lower case, or, inside an `<svg>`,
   * an SVG element with its own case (`linearGradient`). The namespace follows from the tree:
   * `<svg>` starts SVG, and everything inside it is SVG.
   * @pattern ^[A-Za-z][A-Za-z0-9]*$
   */
  tag: string;
  /** Each attribute of the element, each name set once. */
  attributes: Attribute[];
  /** None for a void element (`<br>`). */
  children: RenderNode[];
  span: Span;
}

/** A text node. */
export interface TextNode {
  kind: "Text";
  /**
   * The text exactly as the DOM holds it: after JSX whitespace rules and entity decoding, as
   * every JSX implementation reads it, or a string literal's value. It holds only characters
   * HTML keeps as they are (no carriage return, NUL, lone surrogate, control character or
   * noncharacter). Targets escape it for their own syntax. Two Texts are never adjacent: the
   * analyser merges them.
   */
  value: string;
  span: Span;
}

/**
 * An expression rendered as text, `{label}`. Its value is a string or a number, or nothing
 * when nullish: the analyser rejects every other kind of value, which the targets render
 * differently.
 */
export interface InterpolationNode {
  kind: "Interpolation";
  value: Expression;
  span: Span;
}

/**
 * A conditional, `c ? <A/> : <B/>` or `c && <A/>`, with an else-if chain flattened into its
 * branches. A branch renders when its condition is truthy, as `v-if` decides, never by the
 * value JavaScript's `&&` would give (ADR-0036).
 */
export interface IfNode {
  kind: "If";
  /** The branches in order: the first whose condition holds renders, or the final else. */
  branches: IfBranch[];
  span: Span;
}

/** A branch of an `If`. */
export interface IfBranch {
  /** The condition: absent on the final else branch. */
  condition?: Expression;
  /** What the branch renders: nothing for an empty branch, which only the else may not be. */
  children: RenderNode[];
  span: Span;
}

/** A list, `source.map((item, index) => <li key={…}>…</li>)` (ADR-0036). */
export interface ForNode {
  kind: "For";
  /** The array the list renders. */
  source: Expression;
  /** The callback's item parameter: a `loopVar` binding. */
  item: BindingId;
  /** The callback's index parameter, when it has one: a `loopVar` binding. */
  index?: BindingId;
  /** The `key` of the callback's root, lifted off the element: `key` is no attribute. */
  key: Expression;
  /** The callback's root element or component, without its `key` (ADR-0053). */
  body: ElementNode | ComponentNode;
  span: Span;
}

/** Several root nodes, `<>…</>`: only ever a component's render root. */
export interface FragmentNode {
  kind: "Fragment";
  /** The roots, one or more. */
  children: RenderNode[];
  span: Span;
}

/** An attribute on an element. */
export type Attribute =
  | StaticAttribute
  | BoundAttribute
  | ClassAttribute
  | StyleAttribute
  | SpreadAttribute
  | EventAttribute
  | RefAttribute
  | ModelAttribute;

/**
 * An attribute on a component (ADR-0053, ADR-0054): a prop, a listener of an event the child
 * declares, a model's binding, or a `class`, a `style` (fallthrough) or a `ref` (what it exposes).
 */
export type ComponentAttribute =
  | PropAttribute
  | ListenerAttribute
  | ModelBindingAttribute
  | ClassAttribute
  | StyleAttribute
  | RefAttribute;

/** A prop passed to a component, `label="Name"` or `label={name}`: a static value is a literal. */
export interface PropAttribute {
  kind: "Prop";
  /** A prop the child declares. */
  name: string;
  value: Expression;
  span: Span;
}

/**
 * A listener of an event a child declares, `onClear={reset}` (ADR-0053): its handler's
 * parameters are the event's payload, never a DOM event.
 */
export interface ListenerAttribute {
  kind: "Listener";
  /** The event's name, as the child's `defineEmits` declares it. */
  event: string;
  handler: Handler;
  span: Span;
}

/** `v-model:open={open.value}` on a component: binds a model the child declares (ADR-0054). */
export interface ModelBindingAttribute {
  kind: "ModelBinding";
  /** The child's model. */
  model: string;
  /** A `state` or `model` binding's `.value`. */
  value: Expression;
  span: Span;
}

/**
 * `v-model={text.value}` on a form control (ADR-0054): binds the control's value, or its
 * checked state, two ways.
 */
export interface ModelAttribute {
  kind: "Model";
  /** A `state` or `model` binding's `.value`. */
  value: Expression;
  /** The control, from its tag and its `type`. */
  control:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "select-multiple"
    | "checkbox"
    | "checkbox-group"
    | "radio";
  /** `v-model_trim`: the value is trimmed. */
  trim?: true;
  /** `v-model_lazy`: the value is written on `change`, not on `input`. */
  lazy?: true;
  /** `v-model_number`: the value is parsed as a number. */
  number?: true;
  span: Span;
}

/**
 * An event listener, `onClick={save}` or `onKeydownCapture={(event) => …}` (ADR-0047): it renders
 * no attribute, and runs in the browser only.
 */
export interface EventAttribute {
  kind: "Event";
  /**
   * The DOM event's name, as `addEventListener` takes it: the source's name without `on` and
   * its option suffix, in lower case (`onDblclick` → `dblclick`).
   * @pattern ^[a-z][a-z0-9]*$
   */
  event: string;
  /** `onClickCapture`: the listener runs in the capture phase. */
  capture?: true;
  /** `onClickOnce`: the listener runs once, then is removed. */
  once?: true;
  /** `onWheelPassive`: the listener is passive. */
  passive?: true;
  handler: Handler;
  span: Span;
}

/** What an event runs: a setup function by name, or a function written in place. */
export type Handler = FunctionHandler | InlineHandler;

/** `onClick={save}`: a `localFn` binding, which runs with the event as its argument. */
export interface FunctionHandler {
  kind: "Function";
  binding: BindingId;
  /** The identifier. */
  span: Span;
}

/** `onClick={() => count.value++}`: an arrow function, which runs with the event as its argument. */
export interface InlineHandler {
  kind: "Inline";
  function: FunctionCode;
  span: Span;
}

/** `ref={input}` (ADR-0049): attaches the element to a `templateRef` binding. It renders nothing. */
export interface RefAttribute {
  kind: "Ref";
  /** The `templateRef` binding. */
  binding: BindingId;
  span: Span;
}

/** An attribute whose value is known at compile time: `class="card"`, `disabled`. */
export interface StaticAttribute {
  kind: "Static";
  /**
   * The attribute name as HTML spells it (`class`, `for`, `aria-label`), in lower case on an
   * HTML element and with SVG's own case on an SVG element (`viewBox`): an attribute of the
   * element (its own, a global, an ARIA or a `data-*` attribute). Targets map names to their
   * own spellings by it.
   * @pattern ^[^\s"'<>/=]+$
   */
  name: string;
  /**
   * The decoded value. `true` for an HTML boolean attribute (`<input disabled />`), which is on
   * by being present and renders without a value, and only for one. Any other attribute
   * written without a value has the string `"true"`, as in Vue's and React's JSX
   * (`<span aria-hidden>`); SVG has no boolean attributes. A `class` holds one or more class
   * names separated by single spaces, as Vue, Svelte and Angular render it. Like text, a value
   * holds only characters HTML keeps as they are.
   */
  value: string | true;
  span: Span;
}

/**
 * An attribute bound to an expression, `title={label}`: absent when the value is nullish, and
 * its value otherwise, by the rules for its name (ADR-0037).
 */
export interface BoundAttribute {
  kind: "Bound";
  /**
   * As a static attribute's name; never `class` or `style`, which have kinds of their own.
   * @pattern ^[^\s"'<>/=]+$
   */
  name: string;
  value: Expression;
  span: Span;
}

/**
 * A `class` built from parts (ADR-0038): the rendered class names are the union of the static
 * names, the toggles whose condition holds and the names each dynamic part holds, in no
 * particular order. A `class` with no names renders as no `class` attribute.
 */
export interface ClassAttribute {
  kind: "Class";
  items: ClassItem[];
  span: Span;
}

/** A part of a `class`. */
export type ClassItem = StaticClass | ToggleClass | DynamicClass;

/** Class names known at compile time: `"card"` in `class={["card", tone]}`. */
export interface StaticClass {
  kind: "Static";
  /** One or more class names separated by single spaces. */
  value: string;
  span: Span;
}

/** One class name, present when its condition is truthy: `{ active: on }`, `on && "active"`. */
export interface ToggleClass {
  kind: "Toggle";
  /** One class name. */
  name: string;
  condition: Expression;
  span: Span;
}

/** An expression whose string value holds class names separated by whitespace, or nothing. */
export interface DynamicClass {
  kind: "Dynamic";
  value: Expression;
  span: Span;
}

/**
 * A `style` (ADR-0038): `style="color: red"` or `style={{ color: tone }}`, as declarations. The
 * declarations whose value is present render, in no particular order, so no two of them set
 * the same property. A `style` with none renders as no `style` attribute.
 */
export interface StyleAttribute {
  kind: "Style";
  declarations: StyleDeclaration[];
  span: Span;
}

/** A declaration of a `style`. */
export type StyleDeclaration = StaticStyle | BoundStyle;

/** A declaration whose value is known at compile time. */
export interface StaticStyle {
  kind: "Static";
  /** The CSS property name in lower case (`margin-top`), or a custom property (`--gap`). */
  property: string;
  /** The value as written, trimmed: one CSS value, without `!important`. */
  value: string;
  span: Span;
}

/** A declaration bound to an expression: left out when its value is nullish or `""`. */
export interface BoundStyle {
  kind: "Bound";
  /** As a static declaration's property. */
  property: string;
  value: Expression;
  span: Span;
}

/**
 * A spread of an object whose keys the analyser knows from its type, `{...attrs}` (ADR-0039).
 * It renders exactly its declared keys, each as a bound attribute would, and a `class` key
 * merges with the element's own `class`.
 */
export interface SpreadAttribute {
  kind: "Spread";
  /**
   * The object spread: an expression whose type is one object type the module declares, as a
   * prop, a list's item or a member of one is.
   */
  value: Expression;
  /** The keys the object's type declares, in member order. */
  keys: SpreadKey[];
  /**
   * Whether the object may be `null` or `undefined` where the spread is, as its type says once
   * the conditions around the spread narrow it: then it renders no key, and the targets read
   * each key through `?.` (`attrs?.title`). A read through `?.` of an object that cannot be
   * nullish is an error on Angular (NG8107), and one through `.` of an object that may be throws.
   */
  nullish: boolean;
  span: Span;
}

/** A key a spread's type declares: an attribute the spread renders. */
export interface SpreadKey {
  /**
   * The attribute name, as a bound attribute's.
   * @pattern ^[^\s"'<>/=]+$
   */
  name: string;
  /** The member's key in the type. */
  span: Span;
}
