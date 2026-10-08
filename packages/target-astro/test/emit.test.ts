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
import { compiled, emitSource, emitted } from "./source.ts";
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
  it("declares every capability: what runs in the browser unsupported, `use-id` emulated", () => {
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
        { path: "Hello.astro", contents: '<p class="greeting">Hello, world!</p>\n' },
      ]);
    }
  });

  it("prints nested elements, void elements and boolean attributes as Astro markup", () => {
    expect(emit("Card", card).files[0]!.contents).toBe(
      [
        '<section class="card">',
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

const namedProps = `interface Props { label: string }
export default function Tag({ label }: Props) {
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

/** A component that reads nothing, its parameter written `parameter`. */
const readsNothing = (parameter: string) => `export interface ListProps { title?: string }
export default function List(${parameter}: ListProps) {
  return <p>x</p>;
}
`;

/** A component that reads none of the props of an inline type. */
const readsNothingInline = `export default function List(_props: { title?: string }) {
  return <p>x</p>;
}
`;

/** A component that reads none of the props of a type the source names `Props`. */
const readsNothingNamed = `interface Item { id: string }
interface Props { items: Item[] }
export default function List({ items }: Props) {
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
        "type Props = ProductTileProps;",
        "",
        "const { name, price, available = true } = Astro.props;",
        "---",
        "",
        '<article class="product-tile" aria-label={name}>',
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
        'interface Props { label: string; tone?: "info" | "warn" }',
        "",
        'const { label, tone = "info" } = Astro.props;',
        "---",
        "",
        "<span data-tone={tone}>{label}</span>",
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
        "type Props = TagProps;",
        "",
        "const props = Astro.props;",
        "---",
        "",
        "<span title={props.hint}>{props.label}</span>",
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
          "type Props = TagProps;",
          "",
          "const props = Astro.props;",
          "---",
          "",
          "<span>{props.label}</span>",
        ),
      );
      await expect(renderSource(output, { label: "Hi" })).resolves.toBe("<span>Hi</span>");
    },
  );

  it("reads only the props a printed expression reads, and declares only the types they reach", () => {
    const [other, list] = emitSource(unread);
    expect(other!.contents).toContain("interface Note { text: string }");
    expect(other!.contents).not.toContain("Item");
    // Astro prints no keys: a prop or an index only a key reads is left out.
    expect(list).toEqual({
      path: "List.astro",
      contents: lines(
        "---",
        "interface Item { id: string; label: string }",
        "",
        "export interface ListProps { items: Item[]; title?: string; extra?: number; prefix: string }",
        "",
        "type Props = ListProps;",
        "",
        "const { items } = Astro.props;",
        "---",
        "",
        "<ul>",
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
        "type Props = NoticeProps;",
        "",
        "const {",
        "  message,",
        '  title = "Notice",',
        "  priority = 1,",
        '  tags = ["general"],',
        '  author = { name: "System" },',
        "} = Astro.props;",
        "---",
        "",
        '<p title={title} data-priority={priority}>{message} {tags.join(", ")} {author.name}</p>',
      ),
    );
  });
});

describe("control flow (ADR-0036)", () => {
  it("writes conditionals as ternaries ending in `null`, and lists as `.map` without keys", () => {
    expect(markupOf(emitted(controlFlow))).toBe(
      lines(
        "<div>",
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
        "<div>",
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
        for (const file of emitSource(source)) {
          const contents = format ? (await formatOutput(file)).file.contents : file.contents;
          const path = join(directory, `${name}-${file.path}`);
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
