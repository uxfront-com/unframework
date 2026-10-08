// The builders write each node's keys in the order of its type, which is the order of every
// `ir.json` snapshot, and leave an absent optional field out: never `key: undefined`, which a
// JSON round trip would drop (ADR-0032).

import type {
  ApiReference,
  Attribute,
  Binding,
  BindingId,
  BindingKind,
  BindingReference,
  BoundAttribute,
  BoundStyle,
  ClassAttribute,
  ClassItem,
  Code,
  CodeReference,
  ConstItem,
  DerivedItem,
  DynamicClass,
  ElementNode,
  EmitReference,
  Emits,
  EventAttribute,
  EventControl,
  EventDeclaration,
  EventParameter,
  EventReference,
  Expression,
  ForNode,
  FragmentNode,
  FunctionCode,
  FunctionHandler,
  FunctionItem,
  GetterSource,
  GlobalReference,
  Handler,
  IdItem,
  IfBranch,
  IfNode,
  InlineHandler,
  InterpolationNode,
  LifecycleItem,
  NarrowedPath,
  Parameter,
  ParameterPattern,
  Prop,
  PropsParameter,
  RefAttribute,
  Reference,
  RefSource,
  RenderNode,
  SetupItem,
  Span,
  SpreadAttribute,
  SpreadKey,
  StateItem,
  StaticAttribute,
  StaticClass,
  StaticStyle,
  StyleAttribute,
  StyleDeclaration,
  TemplateRefItem,
  TextNode,
  ToggleClass,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfExport,
  UfModule,
  VariableItem,
  WatchEffectItem,
  WatchItem,
  WatchSource,
  WriteReference,
} from "./types.ts";
import { IR_VERSION } from "./version.ts";

/** Builds a span. */
export function span(start: number, end: number): Span {
  return { start, end };
}

/** Builds a module. */
export function createModule(
  file: string,
  components: UfComponent[] = [],
  exports: UfExport[] = [],
  types: TypeDeclaration[] = [],
): UfModule {
  return { irVersion: IR_VERSION, file, components, exports, types };
}

/** Builds a type declaration. */
export function createTypeDeclaration(
  name: string,
  exported: boolean,
  code: string,
  at: Span,
): TypeDeclaration {
  return { name, exported, code, span: at };
}

/** Builds a component: without props, types, bindings, setup or events unless given. */
export function createComponent(
  name: string,
  render: ElementNode | FragmentNode,
  at: Span,
  props: Prop[] = [],
  propsParameter?: PropsParameter,
  types: string[] = [],
  bindings: Binding[] = [],
  setup: SetupItem[] = [],
  emits?: Emits,
): UfComponent {
  return {
    name,
    span: at,
    props,
    ...(propsParameter ? { propsParameter } : {}),
    types,
    ...(emits ? { emits } : {}),
    bindings,
    setup,
    render,
  };
}

/** Builds a props parameter: `name` is the parameter's in the object form only. */
export function createPropsParameter(
  form: PropsParameter["form"],
  type: TypeText,
  at: Span,
  name?: string,
): PropsParameter {
  return { form, ...(name === undefined ? {} : { name }), type, span: at };
}

/** Builds a prop. */
export function createProp(
  name: string,
  optional: boolean,
  type: TypeText,
  at: Span,
  binding?: BindingId,
  defaultValue?: Expression,
): Prop {
  return {
    name,
    optional,
    type,
    ...(defaultValue ? { default: defaultValue } : {}),
    ...(binding === undefined ? {} : { binding }),
    span: at,
  };
}

/** Builds a type annotation's text. */
export function createTypeText(code: string, at: Span): TypeText {
  return { code, span: at };
}

/** Builds a binding, with its id: its name and where it is declared. */
export function createBinding(name: string, kind: BindingKind, at: Span): Binding {
  return { id: bindingId(name, at.start), name, kind, span: at };
}

/** A binding's id: `name@offset` (plan §5.3). */
export function bindingId(name: string, offset: number): BindingId {
  return `${name}@${offset}`;
}

/** Builds an expression. */
export function createExpression(code: string, at: Span, refs: Reference[] = []): Expression {
  return { code, span: at, refs };
}

/**
 * Builds a reference to a binding; `shorthand` marks a shorthand property (`{ label }`), `call`
 * the callee of a call (`save()`), and `narrowed` the paths of the read a condition narrows.
 */
export function createBindingReference(
  binding: BindingId,
  at: Span,
  shorthand = false,
  call = false,
  narrowed: NarrowedPath[] = [],
): BindingReference {
  return {
    kind: "Binding",
    binding,
    span: at,
    ...(shorthand ? { shorthand: true as const } : {}),
    ...(call ? { call: true as const } : {}),
    ...(narrowed.length ? { narrowed } : {}),
  };
}

/** Builds a narrowed path of a read (see {@link NarrowedPath}). */
export function createNarrowedPath(at: Span, scope: NarrowedPath["scope"]): NarrowedPath {
  return { span: at, scope };
}

/** Builds a reference to an allowed global. */
export function createGlobalReference(name: string, at: Span): GlobalReference {
  return { kind: "Global", name, span: at };
}

/** Builds setup code: an expression or a function's body, with its references in source order. */
export function createCode(code: string, at: Span, refs: CodeReference[] = []): Code {
  return { code, span: at, refs };
}

/**
 * Builds a write of a `state` or a `localVar` binding (`count.value += step`): `value` is absent
 * for `++` and `--`, `arrowBody` marks the whole expression body of an arrow, and `narrowed` holds
 * the target's path where a condition narrows what the operator reads.
 */
export function createWriteReference(
  binding: BindingId,
  operator: string,
  at: Span,
  target: Span,
  value?: Span,
  arrowBody = false,
  narrowed: NarrowedPath[] = [],
): WriteReference {
  return {
    kind: "Write",
    binding,
    operator,
    span: at,
    target,
    ...(value ? { value } : {}),
    ...(arrowBody ? { arrowBody: true as const } : {}),
    ...(narrowed.length ? { narrowed } : {}),
  };
}

/** Builds a call of `emit`: the event's name and the span of each of its arguments. */
export function createEmitReference(
  binding: BindingId,
  event: string,
  at: Span,
  args: Span[] = [],
): EmitReference {
  return { kind: "Emit", binding, event, span: at, arguments: args };
}

/** Builds a use of an authoring API inside setup code: `nextTick`. */
export function createApiReference(api: ApiReference["api"], at: Span): ApiReference {
  return { kind: "Api", api, span: at };
}

/** Builds a use of a member of a handler's event parameter (`event.key`); `call` for a call. */
export function createEventReference(member: string, at: Span, call = false): EventReference {
  return { kind: "Event", member, span: at, ...(call ? { call: true as const } : {}) };
}

/**
 * Builds a `preventDefault()` or `stopPropagation()` statement of a handler, with the `if` test
 * that makes it conditional.
 */
export function createEventControl(
  method: EventControl["method"],
  at: Span,
  condition?: Code,
): EventControl {
  return { method, ...(condition ? { condition } : {}), span: at };
}

/** What a function is besides its parameters and body: each flag set only when true. */
export interface FunctionOptions {
  async?: boolean;
  returnType?: TypeText;
  /** The body is an arrow's expression rather than a block. */
  expression?: boolean;
  eventControls?: EventControl[];
}

/** Builds a function the source writes: a setup function, a handler, a callback or a getter. */
export function createFunctionCode(
  parameters: Parameter[],
  body: Code,
  at: Span,
  options: FunctionOptions = {},
): FunctionCode {
  const { returnType, eventControls } = options;
  return {
    ...(options.async ? { async: true as const } : {}),
    parameters,
    ...(returnType ? { returnType } : {}),
    body,
    ...(options.expression ? { expression: true as const } : {}),
    ...(eventControls?.length ? { eventControls } : {}),
    span: at,
  };
}

/** What a parameter is besides its name or pattern: each flag set only when true. */
export interface ParameterOptions {
  type?: TypeText;
  optional?: boolean;
  rest?: boolean;
  default?: Expression;
  /** The DOM interface of a handler's event parameter (`KeyboardEvent`). */
  event?: string;
}

/** Builds a parameter: an identifier by its name, or a destructuring pattern. */
export function createParameter(
  binding: string | ParameterPattern,
  at: Span,
  options: ParameterOptions = {},
): Parameter {
  const { type, event } = options;
  return {
    ...(typeof binding === "string" ? { name: binding } : { pattern: binding }),
    ...(type ? { type } : {}),
    ...(options.optional ? { optional: true as const } : {}),
    ...(options.rest ? { rest: true as const } : {}),
    ...(options.default ? { default: options.default } : {}),
    ...(event === undefined ? {} : { event }),
    span: at,
  };
}

/** Builds a parameter's destructuring pattern, with the names it binds in order. */
export function createParameterPattern(code: string, names: string[], at: Span): ParameterPattern {
  return { code, names, span: at };
}

/** Builds `const count = ref(initial)`: no `initial` for `ref()`. */
export function createStateItem(
  binding: BindingId,
  at: Span,
  initial?: Code,
  type?: TypeText,
): StateItem {
  return {
    kind: "State",
    binding,
    ...(type ? { type } : {}),
    ...(initial ? { initial } : {}),
    span: at,
  };
}

/** Builds `const total = computed(() => …)`. */
export function createDerivedItem(
  binding: BindingId,
  getter: FunctionCode,
  at: Span,
  type?: TypeText,
): DerivedItem {
  return { kind: "Derived", binding, ...(type ? { type } : {}), getter, span: at };
}

/** Builds `const input = useTemplateRef<HTMLInputElement>()`. */
export function createTemplateRefItem(
  binding: BindingId,
  at: Span,
  type?: TypeText,
): TemplateRefItem {
  return { kind: "TemplateRef", binding, ...(type ? { type } : {}), span: at };
}

/** Builds `const id = useId()`. */
export function createIdItem(binding: BindingId, at: Span): IdItem {
  return { kind: "Id", binding, span: at };
}

/** Builds a setup `const` holding a value. */
export function createConstItem(
  binding: BindingId,
  value: Code,
  at: Span,
  type?: TypeText,
): ConstItem {
  return { kind: "Const", binding, ...(type ? { type } : {}), value, span: at };
}

/** Builds a setup `let`: no `initial` for `let timer;`. */
export function createVariableItem(
  binding: BindingId,
  at: Span,
  initial?: Code,
  type?: TypeText,
): VariableItem {
  return {
    kind: "Variable",
    binding,
    ...(type ? { type } : {}),
    ...(initial ? { initial } : {}),
    span: at,
  };
}

/** Builds a setup function: `function save() {…}`, or `const save = () => …` as an arrow. */
export function createFunctionItem(
  binding: BindingId,
  form: FunctionItem["form"],
  fn: FunctionCode,
  at: Span,
): FunctionItem {
  return { kind: "Function", binding, form, function: fn, span: at };
}

/** What a watcher is besides its sources and callback: each flag set only when true. */
export interface WatchOptions {
  /** The sources are an array (`watch([a, b], …)`). */
  array?: boolean;
  immediate?: boolean;
  /** `flush: "post"`. */
  post?: boolean;
}

/** Builds `watch(source, callback, options)`. */
export function createWatchItem(
  sources: WatchSource[],
  callback: FunctionCode,
  at: Span,
  options: WatchOptions = {},
): WatchItem {
  return {
    kind: "Watch",
    sources,
    ...(options.array ? { array: true as const } : {}),
    callback,
    ...(options.immediate ? { immediate: true as const } : {}),
    ...(options.post ? { post: true as const } : {}),
    span: at,
  };
}

/** Builds a watch source that is a `state` or `derived` binding itself: `watch(count, …)`. */
export function createRefSource(binding: BindingId, at: Span): RefSource {
  return { kind: "Ref", binding, span: at };
}

/** Builds a watch source that is a getter: `watch(() => step, …)`. */
export function createGetterSource(getter: FunctionCode, at: Span): GetterSource {
  return { kind: "Getter", getter, span: at };
}

/** Builds `watchEffect(effect)`. */
export function createWatchEffectItem(effect: FunctionCode, at: Span): WatchEffectItem {
  return { kind: "WatchEffect", effect, span: at };
}

/** Builds `onMounted(callback)` or `onUnmounted(callback)`. */
export function createLifecycleItem(
  hook: LifecycleItem["hook"],
  callback: FunctionCode,
  at: Span,
): LifecycleItem {
  return { kind: "Lifecycle", hook, callback, span: at };
}

/** Builds the events a component declares with `defineEmits`. */
export function createEmits(
  binding: BindingId,
  type: TypeText,
  events: EventDeclaration[],
  at: Span,
): Emits {
  return { binding, type, events, span: at };
}

/** Builds an event a component declares, with its payload's members. */
export function createEventDeclaration(
  name: string,
  parameters: EventParameter[],
  at: Span,
): EventDeclaration {
  return { name, parameters, span: at };
}

/** Builds a member of an event's payload: `value: number`, or `value?: number` if `optional`. */
export function createEventParameter(
  name: string,
  type: TypeText,
  at: Span,
  optional = false,
): EventParameter {
  return { name, ...(optional ? { optional: true as const } : {}), type, span: at };
}

/** What a listener is besides its event and handler: at most one option, set only when true. */
export interface ListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

/** Builds an event listener: `onClick={save}`, `onKeydownCapture={(event) => …}`. */
export function createEventAttribute(
  event: string,
  handler: Handler,
  at: Span,
  options: ListenerOptions = {},
): EventAttribute {
  return {
    kind: "Event",
    event,
    ...(options.capture ? { capture: true as const } : {}),
    ...(options.once ? { once: true as const } : {}),
    ...(options.passive ? { passive: true as const } : {}),
    handler,
    span: at,
  };
}

/** Builds a handler that names a setup function: `onClick={save}`. */
export function createFunctionHandler(binding: BindingId, at: Span): FunctionHandler {
  return { kind: "Function", binding, span: at };
}

/** Builds a handler written in place: `onClick={() => count.value++}`. */
export function createInlineHandler(fn: FunctionCode, at: Span): InlineHandler {
  return { kind: "Inline", function: fn, span: at };
}

/** Builds `ref={input}`, which attaches the element to a `templateRef` binding. */
export function createRefAttribute(binding: BindingId, at: Span): RefAttribute {
  return { kind: "Ref", binding, span: at };
}

/** Builds an element. */
export function createElement(
  tag: string,
  attributes: Attribute[],
  children: RenderNode[],
  at: Span,
): ElementNode {
  return { kind: "Element", tag, attributes, children, span: at };
}

/** Builds a text node. */
export function createText(value: string, at: Span): TextNode {
  return { kind: "Text", value, span: at };
}

/** Builds an interpolation. */
export function createInterpolation(value: Expression, at: Span): InterpolationNode {
  return { kind: "Interpolation", value, span: at };
}

/** Builds a conditional. */
export function createIf(branches: IfBranch[], at: Span): IfNode {
  return { kind: "If", branches, span: at };
}

/** Builds a branch of a conditional: `condition` is `undefined` for the final else. */
export function createBranch(
  condition: Expression | undefined,
  children: RenderNode[],
  at: Span,
): IfBranch {
  return { ...(condition ? { condition } : {}), children, span: at };
}

/** Builds a list. */
export function createFor(
  source: Expression,
  item: BindingId,
  key: Expression,
  body: ElementNode,
  at: Span,
  index?: BindingId,
): ForNode {
  return {
    kind: "For",
    source,
    item,
    ...(index === undefined ? {} : { index }),
    key,
    body,
    span: at,
  };
}

/** Builds a root fragment. */
export function createFragment(children: RenderNode[], at: Span): FragmentNode {
  return { kind: "Fragment", children, span: at };
}

/** Builds a static attribute. */
export function createStaticAttribute(
  name: string,
  value: string | true,
  at: Span,
): StaticAttribute {
  return { kind: "Static", name, value, span: at };
}

/** Builds a bound attribute. */
export function createBoundAttribute(name: string, value: Expression, at: Span): BoundAttribute {
  return { kind: "Bound", name, value, span: at };
}

/** Builds a `class` from its parts. */
export function createClassAttribute(items: ClassItem[], at: Span): ClassAttribute {
  return { kind: "Class", items, span: at };
}

/** Builds static class names, a part of a `class`. */
export function createStaticClass(value: string, at: Span): StaticClass {
  return { kind: "Static", value, span: at };
}

/** Builds a toggled class name, a part of a `class`. */
export function createToggleClass(name: string, condition: Expression, at: Span): ToggleClass {
  return { kind: "Toggle", name, condition, span: at };
}

/** Builds a dynamic part of a `class`. */
export function createDynamicClass(value: Expression, at: Span): DynamicClass {
  return { kind: "Dynamic", value, span: at };
}

/** Builds a `style` from its declarations. */
export function createStyleAttribute(declarations: StyleDeclaration[], at: Span): StyleAttribute {
  return { kind: "Style", declarations, span: at };
}

/** Builds a static style declaration. */
export function createStaticStyle(property: string, value: string, at: Span): StaticStyle {
  return { kind: "Static", property, value, span: at };
}

/** Builds a bound style declaration. */
export function createBoundStyle(property: string, value: Expression, at: Span): BoundStyle {
  return { kind: "Bound", property, value, span: at };
}

/** Builds a spread of an object with known keys, which may be nullish where it is spread. */
export function createSpreadAttribute(
  value: Expression,
  keys: SpreadKey[],
  nullish: boolean,
  at: Span,
): SpreadAttribute {
  return { kind: "Spread", value, keys, nullish, span: at };
}

/** Builds a key a spread renders. */
export function createSpreadKey(name: string, at: Span): SpreadKey {
  return { name, span: at };
}

/** Builds an export entry. */
export function createExport(kind: UfExport["kind"], local: string, at: Span): UfExport {
  return { kind, name: kind === "default" ? "default" : local, local, span: at };
}
