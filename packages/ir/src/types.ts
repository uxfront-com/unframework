/**
 * The portable IR: what the analyser knows about a `.uf.tsx` module, as plain,
 * serialisable data. Every target emits from this and nothing else.
 *
 * Rules (plan §5.3):
 * - Every node carries a span.
 * - A field is added only when a consumer reads it.
 * - The JSON Schema in `schema/ir.schema.json` is generated from these types
 *   (`pnpm --filter @unframework/ir generate`), and a test fails when it is stale.
 * - What the schema cannot express, `checkInvariants` checks: the compiler emits from no module
 *   that breaks the invariants documented here.
 */

/** A half-open range `[start, end)` of UTF-16 offsets into the source file. */
export interface Span {
  start: number;
  end: number;
}

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

/** A component: an exported PascalCase function whose last statement returns JSX. */
export interface UfComponent {
  /**
   * The function's name, PascalCase in ASCII letters and digits, and unique in the module
   * without case: every target writes it as an identifier and names the output file by it.
   */
  name: string;
  span: Span;
  /** The returned JSX: the component's template. */
  render: ElementNode;
}

/** A node of the render tree. */
export type RenderNode = ElementNode | TextNode;

/** An HTML element such as `<p>`. */
export interface ElementNode {
  kind: "Element";
  /**
   * The tag name, in lower case: an element of the HTML Living Standard.
   * @pattern ^[a-z][a-z0-9]*$
   */
  tag: string;
  /** Each attribute of the element, set once. */
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
   * every JSX implementation reads it. It holds only characters HTML keeps as they are (no
   * carriage return, NUL, lone surrogate, control character or noncharacter). Targets escape
   * it for their own syntax.
   */
  value: string;
  span: Span;
}

/** An attribute on an element. */
export type Attribute = StaticAttribute;

/** An attribute whose value is known at compile time: `class="card"`, `disabled`. */
export interface StaticAttribute {
  kind: "Static";
  /**
   * The HTML attribute name, in lower case (`class`, `for`, `aria-label`): an attribute of the
   * element (its own, a global, an ARIA or a `data-*` attribute). Targets map names to their
   * own spellings by it.
   * @pattern ^[^\sA-Z"'<>/=]+$
   */
  name: string;
  /**
   * The decoded value. `true` for an HTML boolean attribute (`<input disabled />`), which is on
   * by being present and renders without a value, and only for one. Any other attribute
   * written without a value has the string `"true"`, as in Vue's and React's JSX
   * (`<span aria-hidden>`). A `class` holds one or more class names separated by single
   * spaces, as Vue, Svelte and Angular render it. Like text, a value holds only characters
   * HTML keeps as they are.
   */
  value: string | true;
  span: Span;
}
