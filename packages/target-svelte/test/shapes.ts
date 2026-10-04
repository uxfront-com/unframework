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
  /** A root fragment holding SVG, a conditional and text. */
  svgAndFragment: [
    "export default function Icon({ r, label }: { r: number; label?: string }) {",
    "  return (",
    "    <>",
    '      <svg viewBox="0 0 2 2">',
    '        <circle cx="1" cy="1" r={r} />',
    "      </svg>",
    '      {label && <p>{label}</p>}{" "}tail',
    "    </>",
    "  );",
    "}",
  ].join("\n"),
};
