// Source components that show each shape the Svelte target emits (design §5.3): emit.test.ts pins
// what it prints for them, and toolchain.test.ts runs L3, L4 and L5 over that output.

/** The shapes, by name. */
export type Shape =
  | "destructured"
  | "objectForm"
  | "reservedName"
  | "unread"
  | "multiline"
  | "lists"
  | "bindings"
  | "untyped"
  | "runtimeText"
  | "assignedValues"
  | "svgAndFragment";

/** Source by shape. */
export const SHAPES: Readonly<Record<Shape, string>> = {
  /** Copied types, destructured props in source order, defaults, props no expression reads. */
  destructured: [
    'type Tone = "info" | "warn";',
    "",
    "export interface BadgeProps {",
    "  label: string;",
    "  tone?: Tone;",
    "  count?: number;",
    "  hidden?: boolean;",
    "}",
    "",
    'export default function Badge({ tone = "info", label, count, hidden = false }: BadgeProps) {',
    "  return <p class={tone}>{label}</p>;",
    "}",
  ].join("\n"),
  /** The props object under the source's name. */
  objectForm: [
    "interface CardProps {",
    "  title: string;",
    "  subtitle?: string;",
    "}",
    "",
    "export default function Card(p: CardProps) {",
    "  return <h2 title={p.subtitle}>{p.title}</h2>;",
    "}",
  ].join("\n"),
  /** A props object under a name Svelte reserves. */
  reservedName: [
    "export default function Card($: { title: string }) {",
    "  return <h2>{$.title}</h2>;",
    "}",
  ].join("\n"),
  /** Props no expression reads. */
  unread: [
    "export default function Hi({ label }: { label?: string }) {",
    "  return <p>Hi</p>;",
    "}",
  ].join("\n"),
  /** Defaults whose literals run over several lines. */
  multiline: [
    "export default function Poem({",
    "  text = `roses",
    "  are red`,",
    '  note = "a\\',
    '  b",',
    "}: { text?: string; note?: string }) {",
    "  return <pre>{text}{note}</pre>;",
    "}",
  ].join("\n"),
  /** A keyed list whose index no expression reads, and a conditional. */
  lists: [
    "export default function List({",
    "  items,",
    "  empty,",
    "}: {",
    "  items: { id: string; name: string }[];",
    "  empty: string;",
    "}) {",
    "  return (",
    "    <ul>",
    "      {items.map((item, index) => <li key={item.id}>{item.name}</li>)}",
    "      {items.length === 0 ? <li>{empty}</li> : null}",
    "    </ul>",
    "  );",
    "}",
  ].join("\n"),
  /** Bound attributes, every form of class and style, and spreads, one of them optional. */
  bindings: [
    "interface LinkAttrs {",
    "  title?: string;",
    "  class?: string;",
    "}",
    "",
    "interface LinkProps {",
    "  href: string;",
    "  attrs: LinkAttrs;",
    "  extra?: LinkAttrs;",
    "  active: boolean;",
    "  tone?: string;",
    "  gap?: string;",
    "  color?: string;",
    "}",
    "",
    "export default function Link({ href, attrs, extra, active, tone, gap, color }: LinkProps) {",
    "  return (",
    "    <p>",
    '      <a href={href} class={["link", { active }, tone]} style={{ color, marginTop: gap, display: "block" }} {...attrs}>',
    "        a",
    "      </a>",
    '      <a href="/b" class={{ active }} style={{ display: "block", "--gap": gap }} {...extra}>',
    "        b",
    "      </a>",
    '      <b class={tone} title={tone ?? "none"} style={{ display: "block" }}>',
    "        c",
    "      </b>",
    "    </p>",
    "  );",
    "}",
  ].join("\n"),
  /** An attribute Svelte's element types declare on some elements only: written, bound, spread. */
  untyped: [
    'type Toggle = "on" | "off";',
    "",
    "interface Hints {",
    "  autocorrect?: Toggle;",
    "}",
    "",
    "export default function Note({ mode, hints }: { mode?: Toggle; hints: Hints }) {",
    "  return (",
    '    <form aria-label="Note">',
    '      <p autocorrect="off">a</p>',
    "      <input autocorrect={mode} />",
    "      <div {...hints}>b</div>",
    "    </form>",
    "  );",
    "}",
  ].join("\n"),
  /**
   * Static text Svelte's server renders through its runtime: `style:` directives, the attributes
   * of an element with a spread and of an `<option>`; and a static style with a run of spaces.
   */
  runtimeText: [
    "export default function Quote({ tone }: { tone: string }) {",
    "  return (",
    "    <div>",
    "      <blockquote style={{ fontFamily: '\"Segoe UI\", serif', content: \"'a  b'\", color: tone }}>",
    "        q",
    "      </blockquote>",
    '      <p autocorrect="off" title=\'Name & "title" <x>\' class="q&r" style=\'content: "&"\'>',
    "        c",
    "      </p>",
    '      <select aria-label="Pick">',
    "        <option value='a & \"b\"'>a</option>",
    "      </select>",
    "      <p style=\"content: 'a  b'; color: red\">p</p>",
    "    </div>",
    "  );",
    "}",
  ].join("\n"),
  /**
   * Bound values Svelte's `set_value` would skip writing when they equal the element's own,
   * never nullish: the analyser reports one that may be there (UF1002).
   */
  assignedValues: [
    "export default function Steps({",
    "  steps,",
    "  score,",
    "  label,",
    "  mode,",
    "}: {",
    "  steps: string[];",
    "  score: number;",
    "  label: string;",
    "  mode: string;",
    "}) {",
    "  return (",
    "    <form>",
    "      <ol>",
    "        {steps.map((step, index) => (",
    "          <li key={step} value={steps.length - 1 - index}>",
    "            {step}",
    "          </li>",
    "        ))}",
    "      </ol>",
    '      <meter min="0" max="10" value={score} title=\'Score & "rank"\'>',
    "        m",
    "      </meter>",
    '      <progress max="10" value={score}>p</progress>',
    "      <data value={label}>d</data>",
    '      <button type="button" value={label}>',
    "        b",
    "      </button>",
    '      <input type="checkbox" name="c" value={mode} />',
    "    </form>",
    "  );",
    "}",
  ].join("\n"),
  /** A root fragment holding SVG (an empty `<title>` too), a conditional and text. */
  svgAndFragment: [
    "export default function Icon({ r, label }: { r: number; label?: string }) {",
    "  return (",
    "    <>",
    '      <svg viewBox="0 0 2 2">',
    "        <title></title>",
    '        <circle cx="1" cy="1" r={r} />',
    "      </svg>",
    '      {label && <p>{label}</p>}{" "}tail',
    "    </>",
    "  );",
    "}",
  ].join("\n"),
};
