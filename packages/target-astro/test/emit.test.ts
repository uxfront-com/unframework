import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BEHAVIOURAL_CAPABILITIES, CAPABILITY_NAMES, formatOutput } from "@unframework/codegen";
import type { EmitContext } from "@unframework/codegen";
import {
  BINDABLE_BOOLEAN_ATTRIBUTES,
  createBinding,
  createBoundAttribute,
  createComponent,
  createElement,
  createExport,
  createModule,
  createProp,
  createPropsParameter,
  createStaticAttribute,
  createText,
  createTypeText,
  span,
} from "@unframework/ir";
import type { ElementNode, RenderNode } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { expressionAt } from "../../codegen/test/expressions.ts";
import target from "../src/index.ts";
import { astroTypecheck } from "../src/toolchain/check.ts";
import { astroFrameworkCompile } from "../src/toolchain/compile.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";
import { compiled, emitSource, emitted, emittedWithTypes, SCOPE_HELPER } from "./source.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

const at = { start: 0, end: 0 };
const el = (tag: string, children: RenderNode[] = [], attributes: [string, string | true][] = []) =>
  createElement(
    tag,
    attributes.map(([name, value]) => createStaticAttribute(name, value, at)),
    children,
    at,
  );
const text = (value: string) => createText(value, at);

function emit(name: string, render: ElementNode, kind: "default" | "named" = "default") {
  const component = createComponent(name, render, at);
  const module = createModule(`${name}.uf.tsx`, [component], [createExport(kind, name, at)]);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  return { files: target.emit(component, context), reported };
}

/** Markup that needs every escape: Astro expressions, entities, quotes and a no-break space. */
const card = el(
  "section",
  [
    el("h2", [text("a < b & {c} d\u00A0e")], [["title", 'say "hi" & {x}']]),
    el("p", [text("Line one"), el("br"), text("Line two")]),
    el(
      "input",
      [],
      [
        ["type", "checkbox"],
        ["checked", true],
        ["aria-label", "Agree"],
      ],
    ),
  ],
  [["class", "card"]],
);

const scratch = scratchDirectory("emit");
afterAll(() => scratch.remove());

describe("astro target", () => {
  it("declares every capability: what runs in the browser unsupported, `use-id`, the child root and a merged style emulated", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([...CAPABILITY_NAMES].toSorted());
    // Nothing runs in the browser, so these are inert, reported for information (ADR-0047).
    for (const name of [
      "interactivity",
      "event-capture",
      "event-once",
      "event-passive",
      "event-semantics",
      "conditional-event-control",
      "next-tick",
      "component-event",
      "two-way-binding",
      "model-array",
      "model-modifiers",
      "expose",
    ] as const) {
      expect(target.capabilities[name], name).toMatchObject({
        support: "unsupported",
        code: "UF4001",
        severity: "info",
      });
    }
    // A test that checks state across a rerender requires `interactivity`, and its skip
    // names this reason.
    expect(target.capabilities.interactivity).toMatchObject({
      reason: expect.stringContaining("each render is a new instance"),
    });
    expect(target.capabilities["use-id"]).toMatchObject({
      support: "emulated",
      helper: "uniqueId",
    });
    expect(target.capabilities["child-root-scope"]).toMatchObject({
      support: "emulated",
      helper: "scopeAttributes",
    });
    // Context is the one difference a static render shows: `inject` gives its fallback
    // (ADR-0055), a warning.
    const unsupported = CAPABILITY_NAMES.filter(
      (name) =>
        target.capabilities[name].support === "unsupported" && !BEHAVIOURAL_CAPABILITIES.has(name),
    );
    expect(unsupported).toEqual(["context", "reactive-context"]);
    for (const name of unsupported) {
      expect(target.capabilities[name], name).toMatchObject({ severity: "warning" });
    }
  });

  it("emits one file per component, named after it whatever the export", () => {
    const hello = el("p", [text("Hello, world!")], [["class", "greeting"]]);
    for (const kind of ["default", "named"] as const) {
      const { files, reported } = emit("Hello", hello, kind);
      expect(reported).toEqual([]);
      expect(files).toEqual([
        {
          path: "Hello.astro",
          contents: [
            "---",
            "interface Props {",
            "  class?: string;",
            "  style?: Record<string, string | number | undefined>;",
            "}",
            "",
            "const { class: className, style } = Astro.props;",
            "",
            ...SCOPE_HELPER,
            "---",
            "",
            "<p",
            '  class:list={["greeting", className]}',
            "  style={style}",
            "  {...scopeAttributes(Astro.props)}",
            ">Hello, world!</p>",
            "",
          ].join("\n"),
        },
      ]);
    }
  });

  it("prints nested elements, void elements and boolean attributes as Astro markup", () => {
    expect(emit("Card", card).files[0]!.contents).toBe(
      [
        "---",
        "interface Props {",
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        "const { class: className, style } = Astro.props;",
        "",
        ...SCOPE_HELPER,
        "---",
        "",
        '<section class:list={["card", className]} style={style} {...scopeAttributes(Astro.props)}>',
        '  <h2 title="say &quot;hi&quot; &amp; {x}">a &lt; b &amp; &#123;c&#125; d&nbsp;e</h2>',
        "  <p>Line one<br />Line two</p>",
        '  <input type="checkbox" checked aria-label="Agree" />',
        "</section>",
        "",
      ].join("\n"),
    );
  });

  it("emits output Astro's compiler accepts without a diagnostic", async () => {
    const [file] = emit("Card", card).files;
    const path = join(scratch.path, file!.path);
    const results = await astroFrameworkCompile([{ path, contents: file!.contents }], {
      toolchainDir: scratch.path,
      root: scratch.path,
    });
    expect(results.get(path)).toEqual({ errors: [], warnings: [] });
  });

  it("renders the IR's text and attributes, with braces as text, not expressions", async () => {
    const component = await loadAstroComponent(scratch.path, emit("Card", card).files[0]!.contents);
    await expect(renderToString(component, {})).resolves.toBe(
      '<section class="card"><h2 title="say &quot;hi&quot; &amp; {x}">a &lt; b &amp; &#123;c&#125; d&nbsp;e</h2><p>Line one<br>Line two</p><input type="checkbox" checked aria-label="Agree"></section>',
    );
  });
});

// M1: real sources lowered by the analyser, then emitted by this target.

/** Lines of a file, each ending in a line break. */
const lines = (...rows: string[]) => rows.map((row) => `${row}\n`).join("");

/** The markup of an output: what follows its frontmatter. */
const markupOf = (output: string) => output.slice(output.indexOf("---\n\n", 4) + 5);

/** Server-renders Astro source with props, as the `ssr:astro` project does. */
async function renderSource(source: string, props: Record<string, unknown> = {}): Promise<string> {
  return renderToString(await loadAstroComponent(scratch.path, source), { props });
}

const primitives = `export interface ProductTileProps {
  name: string;
  price: number;
  available?: boolean;
}

export default function ProductTile({ name, price, available = true }: ProductTileProps) {
  return (
    <article class="product-tile" aria-label={name}>
      <p>Price: {price} EUR</p>
      <p>{available ? "Available" : "Unavailable"}</p>
      <button type="button" disabled={!available}>Add {name}</button>
    </article>
  );
}
`;

const inline = `export default function Tag({ label, tone = "info" }: { label: string; tone?: "info" | "warn" }) {
  return <span data-tone={tone}>{label}</span>;
}
`;

// Without fallthrough: with it, the source's `Props` is renamed for the `Props` that adds `class`
// and `style`.
const namedProps = `import { defineOptions } from "unframework";
interface Props { label: string }
export default function Tag({ label }: Props) {
  defineOptions({ inheritAttrs: false });
  return <span>{label}</span>;
}
`;

const objectForm = `export interface TagProps { label: string; hint?: string }
export default function Tag(props: TagProps) {
  return <span title={props.hint}>{props.label}</span>;
}
`;

/** The object form, its parameter named `name`. */
const objectNamed = (name: string) => `export interface TagProps { label: string }
export default function Tag(${name}: TagProps) {
  return <span>{${name}.label}</span>;
}
`;

// The three below turn fallthrough off: a root that takes `class` and `style` reads `Astro.props`.

/** A component that reads nothing, its parameter written `parameter`. */
const readsNothing = (parameter: string) => `import { defineOptions } from "unframework";
export interface ListProps { title?: string }
export default function List(${parameter}: ListProps) {
  defineOptions({ inheritAttrs: false });
  return <p>x</p>;
}
`;

/** A component that reads none of the props of an inline type. */
const readsNothingInline = `import { defineOptions } from "unframework";
export default function List(_props: { title?: string }) {
  defineOptions({ inheritAttrs: false });
  return <p>x</p>;
}
`;

/** A component that reads none of the props of a type the source names `Props`. */
const readsNothingNamed = `import { defineOptions } from "unframework";
interface Item { id: string }
interface Props { items: Item[] }
export default function List({ items }: Props) {
  defineOptions({ inheritAttrs: false });
  return <p>x</p>;
}
`;

const unread = `interface Item { id: string; label: string }
interface Note { text: string }
export interface OtherProps { note: Note }
export function Other({ note }: OtherProps) {
  return <p>{note.text}</p>;
}
export interface ListProps { items: Item[]; title?: string; extra?: number; prefix: string }
export default function List({ items, title = "List", extra, prefix }: ListProps) {
  return <ul>{items.map((item, index) => <li key={prefix + item.id + index}>{item.label}</li>)}</ul>;
}
`;

const defaults = `export interface NoticeProps {
  message: string;
  title?: string;
  priority?: number;
  tags?: string[];
  author?: { name: string };
}

export default function Notice({
  message, title = "Notice", priority = 1, tags = ["general"], author = { name: "System" },
}: NoticeProps) {
  return <p title={title} data-priority={priority}>{message} {tags.join(", ")} {author.name}</p>;
}
`;

const controlFlow = `export interface MenuProps { open: boolean; busy: boolean; n: number; items: string[]; rows: string[][] }
export default function Menu({ open, busy, n, items, rows }: MenuProps) {
  return (
    <div>
      {open && <p>open</p>}
      {open ? <p>a</p> : busy ? "b" : <><b>c</b> and <i>d</i></>}
      {open ? null : busy ? <p>busy</p> : <p>idle</p>}
      {n ? <span>{n}</span> : null}
      {items.map((item, index) => <i key={item}>{index}: {item}</i>)}
      {items.map((item, index) => <i key={index}>x</i>)}
      {rows.map((row, r) => <ol key={r}>{row.map((cell, c) => <li key={c}>{cell}</li>)}</ol>)}
    </div>
  );
}
`;

const rootFragment = `export interface HeaderProps { draft: boolean; title: string }
export default function Header({ draft, title }: HeaderProps) {
  return (
    <>
      <h2>{title}</h2>
      {draft ? <p>Draft</p> : null}
      <p>a &gt; b</p>
    </>
  );
}
`;

const attributes = `interface Attrs { id?: string; class?: string; "data-x"?: string; title?: string }
export interface PanelProps { on: boolean; size: string; gap?: string; attrs: Attrs; more?: Attrs; n: number }
export default function Panel({ on, size, gap, attrs, more, n }: PanelProps) {
  return (
    <div>
      <input type="file" multiple={on} disabled={!on} aria-label="Files" />
      <p class="a b">s</p>
      <p class={["a", size, { on }]}>d</p>
      <p class="a" {...attrs}>m</p>
      <p {...more}>o</p>
      <p style="color: red; margin-top: 4px">s</p>
      <p style={{ color: "red", marginTop: gap, "--size": size, lineHeight: n }}>b</p>
      <p autocorrect="off">t</p>
      <svg viewBox="0 0 2 2" aria-hidden="true"><circle cx="1" cy="1" r={n} /></svg>
    </div>
  );
}
`;

describe("props: the frontmatter (ADR-0034)", () => {
  it("copies the types, aliases them as `Props` and destructures `Astro.props`, defaults included", () => {
    expect(emitted(primitives)).toBe(
      lines(
        "---",
        "export interface ProductTileProps {",
        "  name: string;",
        "  price: number;",
        "  available?: boolean;",
        "}",
        "",
        "interface Props extends ProductTileProps {",
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        "const { name, price, available = true, class: className, style } = Astro.props;",
        "",
        ...SCOPE_HELPER,
        "---",
        "",
        "<article",
        '  class:list={["product-tile", className]}',
        "  aria-label={name}",
        "  style={style}",
        "  {...scopeAttributes(Astro.props)}",
        ">",
        "  <p>Price: {price} EUR</p>",
        '  <p>{available ? "Available" : "Unavailable"}</p>',
        '  <button type="button" disabled={!available}>Add {name}</button>',
        "</article>",
      ),
    );
  });

  it("renders the props it is given, and the defaults of the ones it is not", async () => {
    const output = emitted(primitives);
    await expect(renderSource(output, { name: "Lamp", price: 39.5 })).resolves.toBe(
      '<article class="product-tile" aria-label="Lamp"><p>Price: 39.5 EUR</p><p>Available</p><button type="button">Add Lamp</button></article>',
    );
    await expect(renderSource(output, { name: "Desk", price: 0, available: false })).resolves.toBe(
      '<article class="product-tile" aria-label="Desk"><p>Price: 0 EUR</p><p>Unavailable</p><button type="button" disabled>Add Desk</button></article>',
    );
    // Absent and `undefined` are the same (ADR-0034): the default applies.
    await expect(
      renderSource(output, { name: "A", price: 1, available: undefined }),
    ).resolves.toContain("<p>Available</p>");
  });

  it("declares an inline props type as `interface Props`, and copies a type named `Props`", () => {
    expect(emitted(inline)).toBe(
      lines(
        "---",
        'interface Props { label: string; tone?: "info" | "warn"',
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        'const { label, tone = "info", class: className, style } = Astro.props;',
        "",
        ...SCOPE_HELPER,
        "---",
        "",
        "<span",
        "  data-tone={tone}",
        "  class:list={[className]}",
        "  style={style}",
        "  {...scopeAttributes(Astro.props)}",
        ">{label}</span>",
      ),
    );
    expect(emitted(namedProps)).toBe(
      lines(
        "---",
        "interface Props { label: string }",
        "",
        "const { label } = Astro.props;",
        "---",
        "",
        "<span>{label}</span>",
      ),
    );
  });

  it("keeps the object form's object and its references as written", () => {
    expect(emitted(objectForm)).toBe(
      lines(
        "---",
        "export interface TagProps { label: string; hint?: string }",
        "",
        "interface Props extends TagProps {",
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        "const props = Astro.props;",
        "const { class: className, style } = Astro.props;",
        "",
        ...SCOPE_HELPER,
        "---",
        "",
        "<span",
        "  title={props.hint}",
        "  class:list={[className]}",
        "  style={style}",
        "  {...scopeAttributes(Astro.props)}",
        ">{props.label}</span>",
      ),
    );
  });

  it.each(["Astro", "Fragment"])(
    "renames an object named `%s`, which the compiled component already declares",
    async (name) => {
      const output = emitted(objectNamed(name));
      expect(output).toBe(
        lines(
          "---",
          "export interface TagProps { label: string }",
          "",
          "interface Props extends TagProps {",
          "  class?: string;",
          "  style?: Record<string, string | number | undefined>;",
          "}",
          "",
          "const props = Astro.props;",
          "const { class: className, style } = Astro.props;",
          "",
          ...SCOPE_HELPER,
          "---",
          "",
          "<span class:list={[className]} style={style} {...scopeAttributes(Astro.props)}>{props.label}</span>",
        ),
      );
      await expect(renderSource(output, { label: "Hi" })).resolves.toBe("<span>Hi</span>");
    },
  );

  it("reads only the props a printed expression reads, and declares only the types they reach", () => {
    const [other, list] = emitSource(unread);
    expect(other!.contents).toContain("interface Note { text: string }");
    expect(other!.contents).not.toContain("Item");
    // Astro prints no keys: a prop or an index only a key reads is left out. The main output
    // re-exports the type only its sibling declares (ADR-0068).
    expect(list).toEqual({
      path: "List.astro",
      contents: lines(
        "---",
        "interface Item { id: string; label: string }",
        "",
        'export type { OtherProps } from "./Other.astro";',
        "",
        "export interface ListProps { items: Item[]; title?: string; extra?: number; prefix: string }",
        "",
        "interface Props extends ListProps {",
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        "const { items, class: className, style } = Astro.props;",
        "",
        ...SCOPE_HELPER,
        "---",
        "",
        "<ul class:list={[className]} style={style} {...scopeAttributes(Astro.props)}>",
        "  {items.map((item) => (",
        "    <li>{item.label}</li>",
        "  ))}",
        "</ul>",
      ),
    });
  });

  it.each(["{ title }", "props", "_props"])(
    "exports `Props` and reads no prop when the markup reads none (`%s`)",
    (parameter) => {
      // Nothing in the file reads `Props` then, so it is exported: ESLint's unused-variable rule
      // counts Astro's own read of it only in a file that names `Astro` (L5).
      expect(emitted(readsNothing(parameter))).toBe(
        lines(
          "---",
          "export interface ListProps { title?: string }",
          "",
          "export type Props = ListProps;",
          "---",
          "",
          "<p>x</p>",
        ),
      );
    },
  );

  it("exports an inline `Props`, or the source's own `Props`, when the markup reads no prop", () => {
    expect(emitted(readsNothingInline)).toBe(
      lines("---", "export interface Props { title?: string }", "---", "", "<p>x</p>"),
    );
    expect(emitted(readsNothingNamed)).toBe(
      lines(
        "---",
        "interface Item { id: string }",
        "",
        "export interface Props { items: Item[] }",
        "---",
        "",
        "<p>x</p>",
      ),
    );
  });

  it(
    "types the callers of a component that reads no prop by its exported `Props` (L4)",
    { timeout: 60_000 },
    async () => {
      const directory = join(scratch.path, "callers");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "List.astro"), emitted(readsNothingNamed));
      const caller = join(directory, "Caller.astro");
      writeFileSync(
        caller,
        '---\nimport List from "./List.astro";\n---\n\n<div><List /><List items={[]} /></div>\n',
      );
      const results = await astroTypecheck([caller], { toolchainDir, root: integrationRoot });
      expect(results.get(caller)).toEqual([
        expect.objectContaining({ code: "TS2322", message: expect.stringMatching(/'items'/) }),
      ]);
    },
  );

  it("formats the frontmatter as TypeScript, and leaves the markup as printed (ADR-0041)", async () => {
    expect(await compiled(defaults)).toBe(
      lines(
        "---",
        "export interface NoticeProps {",
        "  message: string;",
        "  title?: string;",
        "  priority?: number;",
        "  tags?: string[];",
        "  author?: { name: string };",
        "}",
        "",
        "interface Props extends NoticeProps {",
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        "const {",
        "  message,",
        '  title = "Notice",',
        "  priority = 1,",
        '  tags = ["general"],',
        '  author = { name: "System" },',
        "  class: className,",
        "  style,",
        "} = Astro.props;",
        "",
        ...SCOPE_HELPER,
        "---",
        "",
        "<p",
        "  title={title}",
        "  data-priority={priority}",
        "  class:list={[className]}",
        "  style={style}",
        "  {...scopeAttributes(Astro.props)}",
        '>{message} {tags.join(", ")} {author.name}</p>',
      ),
    );
  });
});

describe("types and generics (ADR-0067, ADR-0068)", () => {
  it("declares a generic component's type parameters on `Props`, as the source writes them", () => {
    // An inline props type, and a named one: Astro infers `T` from a consumer's props.
    expect(
      emitted(
        [
          'export default function Tags<T extends string = "a">({ items }: { items: T[] }) {',
          "  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;",
          "}",
          "",
        ].join("\n"),
      ),
    ).toContain(
      'interface Props<T extends string = "a"> { items: T[]\n  class?: string;\n  style?: Record<string, string | number | undefined>;\n}',
    );
    const picker = [
      'import { defineOptions, defineSlots } from "unframework";',
      'import type { Element } from "unframework";',
      "",
      "export interface PickerProps<T> {",
      "  items: T[];",
      "}",
      "",
      "export default function Picker<T>({ items }: PickerProps<T>) {",
      "  defineOptions({ inheritAttrs: false });",
      "  const slots = defineSlots<{ item?(props: { item: T }): Element }>();",
      "  return <ul>{items.map((item, index) => <li key={index}>{slots.item?.({ item })}</li>)}</ul>;",
      "}",
      "",
    ].join("\n");
    expect(emitted(picker)).toContain(
      "interface Props<T> extends PickerProps<T> {\n  item?: (props: { item: T }) => unknown;\n}",
    );
    // Without a member beside the source's, `Props` is an alias that takes them too.
    expect(
      emitted(
        [
          'import { defineOptions } from "unframework";',
          "",
          "export interface ListProps<T> {",
          "  items: T[];",
          "}",
          "",
          "export default function List<T>({ items }: ListProps<T>) {",
          "  defineOptions({ inheritAttrs: false });",
          "  return <ul>{items.map((item, index) => <li key={index}>{String(item)}</li>)}</ul>;",
          "}",
          "",
        ].join("\n"),
      ),
    ).toContain("type Props<T> = ListProps<T>;");
  });

  it("writes an exported type no component reaches in source order among the copied types", () => {
    const output = emitted(
      [
        'import { defineOptions } from "unframework";',
        "",
        'export type ButtonTone = "primary" | "secondary";',
        "",
        'export type ButtonSize = "small" | "large";',
        "",
        "export interface ButtonProps {",
        "  label: string;",
        "  tone?: ButtonTone;",
        "}",
        "",
        "export default function Button({ label }: ButtonProps) {",
        "  defineOptions({ inheritAttrs: false });",
        '  return <button type="button">{label}</button>;',
        "}",
        "",
      ].join("\n"),
    );
    expect(output).toBe(
      lines(
        "---",
        'export type ButtonTone = "primary" | "secondary";',
        "",
        'export type ButtonSize = "small" | "large";',
        "",
        "export interface ButtonProps {",
        "  label: string;",
        "  tone?: ButtonTone;",
        "}",
        "",
        "type Props = ButtonProps;",
        "",
        "const { label } = Astro.props;",
        "---",
        "",
        '<button type="button">{label}</button>',
      ),
    );
  });
});

/**
 * Sources whose types `types.ts` declares beside them (ADR-0067), each emitted through the type
 * oracle, and each checked through Astro's toolchain below.
 */
const typed: Record<string, { source: string[]; types: string }> = {
  // An imported `Props` inside the annotation, and inside a copied alias.
  importedProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import type { Props } from "./types";',
      "",
      "type CardProps = { item: Props; extra?: Props };",
      "",
      "export default function Card({ item }: CardProps) {",
      "  return <span>{item.label}</span>;",
      "}",
    ],
  },
  // An imported `Props<T>` as the whole annotation, with no member beside it.
  importedGenericProps: {
    types: "export interface Props<T> { items: T[] }\n",
    source: [
      'import { defineOptions } from "unframework";',
      'import type { Props } from "./types";',
      "",
      "export default function Card<T>({ items }: Props<T>) {",
      "  defineOptions({ inheritAttrs: false });",
      "  return <ul>{items.map((item, index) => <li key={index}>{String(item)}</li>)}</ul>;",
      "}",
    ],
  },
  // An imported `Props` in a file that never names `Astro`.
  importedPropsUnread: {
    types: "export interface Props { title?: string }\n",
    source: [
      'import { defineOptions } from "unframework";',
      'import type { Props } from "./types";',
      "",
      "export default function Card(_props: Props) {",
      "  defineOptions({ inheritAttrs: false });",
      "  return <p>x</p>;",
      "}",
    ],
  },
  // An imported `OwnProps` beside the source's own `Props`, which Astro renames.
  importedOwnProps: {
    types: "export interface OwnProps { label: string }\n",
    source: [
      'import type { OwnProps } from "./types";',
      "",
      "interface Props { own: OwnProps }",
      "",
      "export default function Card({ own }: Props) {",
      '  return <div class="card">{own.label}</div>;',
      "}",
    ],
  },
  // A model of an imported type that only a listener reads, and a type only a listener names.
  clientTypes: {
    types: 'export type Tone = "light" | "dark";\n\nexport type Next = Tone;\n',
    source: [
      'import { defineModel } from "unframework";',
      'import type { Next, Tone } from "./types";',
      "",
      "export default function Card() {",
      '  const tone = defineModel<Tone>("tone");',
      "  return (",
      '    <button type="button" onClick={() => { const next: Next = "dark"; tone.value = next; }}>',
      "      Toggle",
      "    </button>",
      "  );",
      "}",
    ],
  },
  // An intersection as the annotation, which an interface cannot extend.
  intersection: {
    types: "export interface Base { label: string }\n",
    source: [
      'import type { Base } from "./types";',
      "",
      "export default function Card({ label, n }: Base & { n: number }) {",
      "  return <span>{label} {n}</span>;",
      "}",
    ],
  },
  // Kept setup code that names an imported `Props`.
  setupProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import { computed } from "unframework";',
      'import type { Props } from "./types";',
      "",
      "export default function Card({ item }: { item?: Props }) {",
      '  const fallback: Props = { label: "none" };',
      "  const shown = computed(() => item ?? fallback);",
      "  return <span>{shown.value.label}</span>;",
      "}",
    ],
  },
  // Kept setup code that names the source's own `Props`, which a model extends on Astro.
  setupLocalProps: {
    types: "export {};\n",
    source: [
      'import { defineModel } from "unframework";',
      "",
      "interface Props { label: string }",
      "",
      "export default function Card({ label }: Props) {",
      '  const open = defineModel<boolean>("open", { required: true });',
      '  const next: Props = { label: "x" };',
      "  return <span>{label} {next.label} {String(open.value)}</span>;",
      "}",
    ],
  },
  // An injection key of an imported `Props`, whose value type Astro exports under the key's name.
  keyProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import { provide } from "unframework";',
      'import type { InjectionKey } from "unframework";',
      'import type { Props } from "./types";',
      "",
      'export const ItemKey: InjectionKey<Props> = Symbol("uf.item");',
      "",
      "export default function Card({ item }: { item: Props }) {",
      "  provide(ItemKey, item);",
      "  return <span>{item.label}</span>;",
      "}",
    ],
  },
  // Injection keys whose value types only the keys name: an imported type, and a `Props`.
  keyOnlyTypes: {
    types:
      'export interface Theme { tone: "light" | "dark" }\n\nexport interface Props { label: string }\n',
    source: [
      'import { provide } from "unframework";',
      'import type { InjectionKey } from "unframework";',
      'import type { Props, Theme } from "./types";',
      "",
      'export const ThemeKey: InjectionKey<Theme> = Symbol("uf.theme");',
      'export const ItemKey: InjectionKey<Props> = Symbol("uf.item");',
      "",
      "export default function Card() {",
      '  provide(ThemeKey, { tone: "dark" });',
      '  provide(ItemKey, { label: "x" });',
      "  return <p>x</p>;",
      "}",
    ],
  },
  // A generic component without props, whose model is of its type parameter.
  genericWithoutProps: {
    types: "export {};\n",
    source: [
      'import { defineModel } from "unframework";',
      "",
      "export default function Card<T>() {",
      '  const value = defineModel<T>("value");',
      "  return <p>{String(value.value)}</p>;",
      "}",
    ],
  },
  // Generic components whose props name no type parameter: none, and an inline literal.
  genericUnnamedWithoutProps: {
    types: "export {};\n",
    source: [
      'import { ref } from "unframework";',
      "",
      "export default function Card<T>() {",
      "  const value = ref<T | undefined>(undefined);",
      "  return <p>{String(value.value)}</p>;",
      "}",
    ],
  },
  // A type parameter only another's constraint and default name, which `Props` declares too.
  genericBoundOnly: {
    types: "export {};\n",
    source: [
      "export default function List<U, T extends U = U>({ items }: { items: T[] }) {",
      "  return <p>{items.length}</p>;",
      "}",
    ],
  },
  genericUnnamedInline: {
    types: "export {};\n",
    source: [
      "export default function List<T>({ n }: { n: number }) {",
      "  return <p>{n}</p>;",
      "}",
    ],
  },
  // A conditional type that infers a `Props` of its own, beside an imported `Props`.
  inferProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import { computed } from "unframework";',
      'import type { Props } from "./types";',
      "",
      "type Unbox<B> = B extends { value: infer Props } ? Props : never;",
      "",
      "export default function Card({ item }: { item: Props }) {",
      "  const size = computed((): Unbox<{ value: number }> => item.label.length);",
      "  return <span>{size.value.toFixed(1)}</span>;",
      "}",
    ],
  },
  // A mapped type whose key is named `Props`, beside an imported `Props`.
  mappedProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import type { Props } from "./types";',
      "",
      'type Flags = { [Props in "a" | "b"]: Props };',
      "",
      "export default function Card({ item }: { item: Props }) {",
      '  const flags: Flags = { a: "a", b: "b" };',
      "  return <span>{item.label} {flags.a}</span>;",
      "}",
    ],
  },
  // A type parameter constrained by an imported `Props`, which the kept setup names.
  constraintProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import { ref } from "unframework";',
      'import type { Props } from "./types";',
      "",
      "export default function List<T extends Props>({ items }: { items: T[] }) {",
      "  const picked = ref<T | undefined>(items[0]);",
      "  return <p>{picked.value?.label}</p>;",
      "}",
    ],
  },
  // A type parameter whose default is an imported `Props`.
  defaultProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import type { Props } from "./types";',
      "",
      "export default function List<T = Props>({ items }: { items: T[] }) {",
      "  return <p>{items.length}</p>;",
      "}",
    ],
  },
  // A nested generic function in the kept setup, which declares a `T` of its own.
  nestedGeneric: {
    types: "export {};\n",
    source: [
      'import { computed } from "unframework";',
      "",
      "export interface ListProps<T> {",
      "  items: T[];",
      "}",
      "",
      "export default function List<T>({ items }: ListProps<T>) {",
      "  const n = computed(() => [items.length].map(<T extends number>(x: T) => x + 1)[0]);",
      "  return <p>{n.value}</p>;",
      "}",
    ],
  },
  // A type parameter named `Props`, beside an imported `Props`.
  parameterProps: {
    types: "export interface Props { label: string }\n",
    source: [
      'import type { Props } from "./types";',
      "",
      "export interface Box<Props> { value: Props }",
      "",
      "export default function Card({ item, box }: { item: Props; box: Box<number> }) {",
      "  return <span>{item.label} {box.value.toFixed(1)}</span>;",
      "}",
    ],
  },
  // A chain of constraints, each naming the next parameter.
  constraintChain: {
    types: "export {};\n",
    source: [
      'import { ref } from "unframework";',
      "",
      "export interface ListProps<T, U, V> {",
      "  items: T[];",
      "  u: U;",
      "  v: V;",
      "}",
      "",
      "export default function List<T extends U, U extends V, V>({ items, u, v }: ListProps<T, U, V>) {",
      "  const picked = ref<T | undefined>(items[0]);",
      "  return <p>{String(picked.value)} {String(u)} {String(v)}</p>;",
      "}",
    ],
  },
  // An intersection of parenthesised types.
  parenthesised: {
    types: "export interface Base { label: string }\n",
    source: [
      'import type { Base } from "./types";',
      "",
      "export default function Card({ label, n }: (Base) & ({ n: number })) {",
      "  return <span>{label} {n}</span>;",
      "}",
    ],
  },
  // A generic component whose kept setup names its type parameters.
  genericSetup: {
    types: "export interface Item { id: string }\n",
    source: [
      'import { computed, ref } from "unframework";',
      'import type { Item } from "./types";',
      "",
      "export interface ListProps<T extends Item, U> {",
      "  items: T[];",
      "  note?: U;",
      "}",
      "",
      "export default function List<T extends Item, U>({ items, note }: ListProps<T, U>) {",
      "  const picked = ref<T | undefined>(items[0]);",
      "  const shown = computed(() => String(note as U | undefined));",
      "  return <p>{picked.value?.id} {shown.value}</p>;",
      "}",
    ],
  },
};

/** The emitted file of each typed source, by its name. */
const emittedTyped = async (name: string) =>
  emittedWithTypes(typed[name]!.source.join("\n") + "\n", { "types.ts": typed[name]!.types });

describe("imported types through the type oracle (ADR-0067)", () => {
  it("imports a `Props` as `OwnProps`, and renames every reference to it", async () => {
    const card = await emittedTyped("importedProps");
    expect(card).toContain('import type { Props as OwnProps } from "./types";');
    expect(card).toContain("type CardProps = { item: OwnProps; extra?: OwnProps };");
    expect(card).toContain("interface Props extends CardProps {");
    // As the whole annotation, `Props` is an alias of it, exported where nothing reads it.
    expect(await emittedTyped("importedGenericProps")).toContain(
      'import type { Props as OwnProps } from "./types";\n---\n'.replace(
        "\n---\n",
        "\n\ntype Props<T> = OwnProps<T>;",
      ),
    );
    expect(await emittedTyped("importedPropsUnread")).toContain("export type Props = OwnProps;");
  });

  it("keeps a `Props` that a scope declares, and renames an injection key's", async () => {
    expect(await emittedTyped("parameterProps")).toContain(
      "export interface Box<Props> { value: Props }",
    );
    expect(await emittedTyped("inferProps")).toContain(
      "type Unbox<B> = B extends { value: infer Props } ? Props : never;",
    );
    expect(await emittedTyped("keyProps")).toContain("export type ItemKey = OwnProps;");
    const keys = await emittedTyped("keyOnlyTypes");
    expect(keys).toContain('import type { Props as OwnProps, Theme } from "./types";');
    expect(keys).toContain("export type ItemKey = OwnProps;");
    expect(await emittedTyped("mappedProps")).toContain(
      'type Flags = { [Props in "a" | "b"]: Props };',
    );
  });

  it("claims `OwnProps` apart from an imported `OwnProps`", async () => {
    const card = await emittedTyped("importedOwnProps");
    expect(card).toContain('import type { OwnProps } from "./types";');
    expect(card).toContain("interface OwnProps_1 { own: OwnProps }");
    expect(card).toContain("interface Props extends OwnProps_1 {");
  });

  it("imports a model's type, which `Props` prints, and no type only a listener names", async () => {
    const card = await emittedTyped("clientTypes");
    expect(card).toContain('import type { Tone } from "./types";');
    expect(card).toContain("  tone?: Tone;");
    expect(card).not.toContain("Next");
  });

  it("writes `Props` for an intersection as an intersection with the members beside it", async () => {
    expect(await emittedTyped("intersection")).toContain(
      "type Props = Base & { n: number } & {\n  class?: string;\n  style?: Record<string, string | number | undefined>;\n};",
    );
    // Parentheses around each part are kept, and an interface would read them as one type.
    expect(await emittedTyped("parenthesised")).toContain(
      "type Props = (Base) & ({ n: number }) & {",
    );
  });

  it("exports `Props` where the source exports its own", () => {
    const output = emitted(
      [
        "export interface Props { label: string }",
        "",
        "export default function Card({ label }: Props) {",
        "  return <span>{label}</span>;",
        "}",
        "",
      ].join("\n"),
    );
    expect(output).toContain("export interface OwnProps { label: string }");
    expect(output).toContain("export interface Props extends OwnProps {");
  });

  it("names an imported `Props` in a type parameter's constraint and default", async () => {
    const constrained = await emittedTyped("constraintProps");
    expect(constrained).toContain("interface Props<T extends OwnProps> {");
    expect(constrained).toContain("type T = OwnProps;");
    expect(await emittedTyped("defaultProps")).toContain("interface Props<T = OwnProps> {");
    expect(await emittedTyped("genericWithoutProps")).toContain(
      "interface Props<T> {\n  value?: T;",
    );
  });

  it("declares on `Props` only the type parameters its members name", async () => {
    const card = await emittedTyped("genericUnnamedWithoutProps");
    expect(card).toContain("interface Props {");
    expect(card).toContain("type T = unknown;");
    expect(await emittedTyped("genericUnnamedInline")).toContain("interface Props { n: number");
    expect(await emittedTyped("genericBoundOnly")).toContain(
      "interface Props<U, T extends U = U> {",
    );
  });

  it("declares no type parameter that only a nested scope declares for itself", async () => {
    const list = await emittedTyped("nestedGeneric");
    expect(list).toContain("<T extends number>(x: T) => x + 1");
    expect(list).not.toContain("type T =");
  });

  it("declares the type parameters the kept setup names as their constraints", async () => {
    const list = await emittedTyped("genericSetup");
    expect(list).toContain("type T = Item;\ntype U = unknown;");
    expect(list).toContain("const picked = items[0] as T | undefined;");
  });

  it(
    "passes astro check and the linters, and types each consumer (L4, L5)",
    { timeout: 60_000 },
    async () => {
      const directory = join(scratch.path, "typed");
      const outputs: string[] = [];
      for (const [name, { types }] of Object.entries(typed)) {
        mkdirSync(join(directory, name), { recursive: true });
        writeFileSync(join(directory, name, "types.ts"), types);
        const path = join(directory, name, "Card.astro");
        writeFileSync(
          path,
          (await formatOutput({ path: "Card.astro", contents: await emittedTyped(name) })).file
            .contents,
        );
        outputs.push(path);
      }
      mkdirSync(join(directory, "exported"), { recursive: true });
      writeFileSync(
        join(directory, "exported", "Card.astro"),
        emitted(
          "export interface Props { label: string }\nexport default function Card({ label }: Props) {\n  return <span>{label}</span>;\n}\n",
        ),
      );
      outputs.push(join(directory, "exported", "Card.astro"));
      // A consumer that misuses each kind of `Props`, and one that imports an exported `Props`.
      const consumer = join(directory, "Consumer.astro");
      writeFileSync(
        consumer,
        [
          "---",
          'import Generic from "./importedGenericProps/Card.astro";',
          'import Unread from "./importedPropsUnread/Card.astro";',
          'import Exported, { type Props } from "./exported/Card.astro";',
          "",
          'const props: Props = { label: "Save" };',
          "---",
          "",
          '<Generic items="x" />',
          "<Unread title={1} />",
          "<Exported {...props} />",
          "",
        ].join("\n"),
      );
      const context = { toolchainDir, root: integrationRoot };
      const [checked, linted] = await Promise.all([
        astroTypecheck([...outputs, consumer], context),
        toolchain.lint(outputs, context),
      ]);
      const clean = Object.fromEntries(outputs.map((path) => [path, []]));
      expect(Object.fromEntries([...checked].filter(([path]) => path !== consumer))).toEqual(clean);
      expect(Object.fromEntries(linted)).toEqual(clean);
      const misuses = checked.get(consumer)!.map(({ code, line }) => [code, line]);
      expect(misuses.toSorted((a, b) => Number(a[1]) - Number(b[1]))).toEqual([
        ["TS2322", 9],
        ["TS2322", 10],
      ]);
    },
  );
});

describe("control flow (ADR-0036)", () => {
  it("writes conditionals as ternaries ending in `null`, and lists as `.map` without keys", () => {
    expect(markupOf(emitted(controlFlow))).toBe(
      lines(
        "<div class:list={[className]} style={style} {...scopeAttributes(Astro.props)}>",
        "  {open ? (",
        "    <p>open</p>",
        "  ) : null}",
        '  {open ? <p>a</p> : busy ? "b" : <><b>c</b> and <i>d</i></>}',
        "  {open ? null : busy ? (",
        "    <p>busy</p>",
        "  ) : (",
        "    <p>idle</p>",
        "  )}",
        "  {n ? (",
        "    <span>{n}</span>",
        "  ) : null}",
        "  {items.map((item, index) => (",
        "    <i>{index}: {item}</i>",
        "  ))}",
        "  {items.map(() => (",
        "    <i>x</i>",
        "  ))}",
        "  {rows.map((row) => (",
        "    <ol>",
        "      {row.map((cell) => (",
        "        <li>{cell}</li>",
        "      ))}",
        "    </ol>",
        "  ))}",
        "</div>",
      ),
    );
  });

  it("renders the first truthy branch, nothing for a falsy `&&`, and every item in order", async () => {
    const output = emitted(controlFlow);
    await expect(
      renderSource(output, {
        open: false,
        busy: false,
        n: 0,
        items: ["x", "y"],
        rows: [["a"], []],
      }),
    ).resolves.toBe(
      "<div><b>c</b> and <i>d</i><p>idle</p><i>0: x</i><i>1: y</i><i>x</i><i>x</i><ol><li>a</li></ol><ol></ol></div>",
    );
    await expect(
      renderSource(output, { open: true, busy: true, n: 2, items: [], rows: [] }),
    ).resolves.toBe("<div><p>open</p><p>a</p><span>2</span></div>");
  });

  it("prints a root fragment's nodes at the top level, and `>` in text as a reference", async () => {
    const output = emitted(rootFragment);
    expect(markupOf(output)).toBe(
      lines("<h2>{title}</h2>", "{draft ? (", "  <p>Draft</p>", ") : null}", "<p>a &gt; b</p>"),
    );
    await expect(renderSource(output, { draft: true, title: "T" })).resolves.toBe(
      "<h2>T</h2><p>Draft</p><p>a &gt; b</p>",
    );
  });

  it("never starts a file without props with `---`, which would read as a frontmatter", async () => {
    const source = "export default function Rule() {\n  return <>---</>;\n}\n";
    expect(emitted(source)).toBe('{"---"}\n');
    expect(await compiled(source)).toBe('{"---"}\n');
    await expect(renderSource(emitted(source))).resolves.toBe("---");
  });
});

describe("attributes (ADR-0037 to ADR-0040)", () => {
  it("writes bindings, `class:list`, style objects and spreads key by key", () => {
    expect(markupOf(emitted(attributes))).toBe(
      lines(
        "<div class:list={[className]} style={style} {...scopeAttributes(Astro.props)}>",
        // Astro's renderer does not read `multiple` as a boolean (ADR-0037).
        '  <input type="file" multiple={on ? "" : undefined} disabled={!on} aria-label="Files" />',
        '  <p class="a b">s</p>',
        '  <p class:list={["a", size, { on }]}>d</p>',
        "  <p",
        '    class:list={["a", attrs.class]}',
        "    id={attrs.id}",
        '    data-x={attrs["data-x"]}',
        "    title={attrs.title}",
        "  >m</p>",
        '  <p id={more?.id} class:list={[more?.class]} data-x={more?.["data-x"]} title={more?.title}>o</p>',
        '  <p style="color: red; margin-top: 4px">s</p>',
        '  <p style={{ color: "red", marginTop: gap, "--size": size, lineHeight: n }}>b</p>',
        // Astro's types declare `autocorrect` on form controls only: a spread keeps it past
        // `astro check` (L4).
        '  <p {...{ autocorrect: "off" }}>t</p>',
        '  <svg viewBox="0 0 2 2" aria-hidden="true">',
        '    <circle cx="1" cy="1" r={n} />',
        "  </svg>",
        "</div>",
      ),
    );
  });

  it("renders absent values as no attribute, and merges a spread's class into the element's", async () => {
    const output = emitted(attributes);
    await expect(
      renderSource(output, { on: false, size: "big", attrs: { class: "s", id: "i" }, n: 2 }),
    ).resolves.toBe(
      [
        '<div><input type="file" disabled aria-label="Files">',
        '<p class="a b">s</p><p class="a big">d</p><p class="a s" id="i">m</p><p>o</p>',
        '<p style="color: red; margin-top: 4px">s</p>',
        '<p style="color:red;--size:big;line-height:2">b</p>',
        '<p autocorrect="off">t</p>',
        '<svg viewBox="0 0 2 2" aria-hidden="true"><circle cx="1" cy="1" r="2"></circle></svg></div>',
      ].join(""),
    );
    await expect(
      renderSource(output, {
        on: true,
        size: "",
        gap: "4px",
        attrs: {},
        more: { "data-x": "1" },
        n: 0,
      }),
    ).resolves.toContain(
      '<input type="file" multiple aria-label="Files"><p class="a b">s</p><p class="a on">d</p><p class="a">m</p><p data-x="1">o</p>',
    );
  });

  it("renders every bindable boolean attribute as present when true, absent when false", async () => {
    // Astro's renderer reads booleans only on the attributes it lists, and writes `="true"` and
    // `="false"` on the others: the dialect prints those in the presence form (ADR-0037).
    const binding = createBinding("on", "prop", span(1, 3));
    const names = [...BINDABLE_BOOLEAN_ATTRIBUTES].toSorted();
    let offset = 10;
    const tree = createElement(
      "div",
      [],
      names.map((name) =>
        createElement(
          "p",
          [createBoundAttribute(name, expressionAt((offset += 10), "on", ["on", binding]), at)],
          [text(name)],
          at,
        ),
      ),
      at,
    );
    const component = createComponent(
      "Flags",
      tree,
      at,
      [createProp("on", false, createTypeText("boolean", at), at, binding.id)],
      createPropsParameter("destructured", createTypeText("{ on: boolean }", at), at),
      [],
      [binding],
    );
    const module = createModule(
      "Flags.uf.tsx",
      [component],
      [createExport("default", "Flags", at)],
    );
    const [file] = target.emit(component, { module, options: undefined, report: () => {} });
    const on = await renderSource(file!.contents, { on: true });
    const off = await renderSource(file!.contents, { on: false });
    for (const name of names) {
      expect.soft(on, name).toContain(`<p ${name}>${name}</p>`);
      expect.soft(off, name).toContain(`<p>${name}</p>`);
    }
  });
});

describe("the M1 output through the toolchain", { timeout: 60_000 }, () => {
  const sources = {
    primitives,
    inline,
    namedProps,
    objectForm,
    objectAstro: objectNamed("Astro"),
    readsNothing: readsNothing("{ title }"),
    readsNothingObject: readsNothing("_props"),
    readsNothingInline,
    readsNothingNamed,
    unread,
    defaults,
    controlFlow,
    rootFragment,
    attributes,
  };

  it.each([false, true])(
    "passes Astro's compiler, astro check and the linters with no finding (formatted: %s)",
    async (format) => {
      const directory = join(scratch.path, `toolchain-${format}`);
      mkdirSync(directory, { recursive: true });
      const files: { path: string; contents: string }[] = [];
      for (const [name, source] of Object.entries(sources)) {
        // A directory per source, where its outputs import each other by their own names.
        mkdirSync(join(directory, name), { recursive: true });
        for (const file of emitSource(source)) {
          const contents = format ? (await formatOutput(file)).file.contents : file.contents;
          const path = join(directory, name, file.path);
          writeFileSync(path, contents);
          files.push({ path, contents });
        }
      }
      const paths = files.map(({ path }) => path);
      const context = { toolchainDir, root: integrationRoot };
      const [compiledFiles, checked, linted] = await Promise.all([
        astroFrameworkCompile(files, context),
        astroTypecheck(paths, context),
        toolchain.lint(paths, context),
      ]);
      const clean = Object.fromEntries(paths.map((path) => [path, []]));
      expect(
        Object.fromEntries(
          [...compiledFiles].map(([path, { errors, warnings }]) => [
            path,
            [...errors, ...warnings],
          ]),
        ),
      ).toEqual(clean);
      expect(Object.fromEntries(checked)).toEqual(clean);
      expect(Object.fromEntries(linted)).toEqual(clean);
    },
  );
});
