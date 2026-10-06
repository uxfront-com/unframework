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
   * The local type declarations the components' props use, in source order, each name once:
   * the targets that print types copy them into the outputs of the components that use them.
   */
  types: TypeDeclaration[];
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
   * props' types reach, in source order.
   */
  types: string[];
  /**
   * Every binding the component declares, by the start of its span: the props (each
   * destructured prop, or every prop in the object form) and the loop variables. Expressions
   * refer to them by id.
   */
  bindings: Binding[];
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
  /** Where the binding is declared: the destructured name, the props member, or the parameter. */
  span: Span;
}

/**
 * What declares a binding: a prop, or the item or index parameter of a list's callback. Only
 * the kinds the analyser lowers: the coverage gate requires a corpus case for each.
 */
export type BindingKind = "prop" | "loopVar";

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
export type Reference = BindingReference | GlobalReference;

/** A read of one of the component's bindings. */
export interface BindingReference {
  kind: "Binding";
  binding: BindingId;
  /**
   * What a target replaces with its own spelling of the binding: the identifier, or the whole
   * `props.label` in the object form.
   */
  span: Span;
  /** Set for a shorthand property (`{ label }`), which a rewrite must expand to `label: …`. */
  shorthand?: true;
}

/**
 * A read of a global every target can reach (`ALLOWED_GLOBALS`): Angular templates see only
 * the component's members, so its target declares one for each.
 */
export interface GlobalReference {
  kind: "Global";
  /** The global's name: one of `ALLOWED_GLOBALS`. */
  name: string;
  /** The identifier. */
  span: Span;
}

/** A node of the render tree. */
export type RenderNode = ElementNode | TextNode | InterpolationNode | IfNode | ForNode;

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
  /** The callback's root element, without its `key`. */
  body: ElementNode;
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
  | SpreadAttribute;

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
