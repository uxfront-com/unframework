import { readFileSync } from "node:fs";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import type { ElementNode, RenderNode, UfExport } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { QWIK_ATTRIBUTE_NAMES, QWIK_BOOLEAN_ATTRIBUTES } from "../src/attributes.ts";
import target from "../src/index.ts";
import { emitSource } from "./lower.ts";
import { TITLES } from "./titles.ts";

const at = { start: 0, end: 0 };

function element(
  tag: string,
  attributes: Record<string, string | true> = {},
  children: RenderNode[] = [],
): ElementNode {
  const list = Object.entries(attributes).map(([name, value]) =>
    createStaticAttribute(name, value, at),
  );
  return createElement(tag, list, children, at);
}

const greeting = element("p", { class: "greeting" }, [createText("Hello, world!", at)]);

function emit(render: ElementNode, exports: UfExport[] = [createExport("default", "Hello", at)]) {
  const component = createComponent("Hello", render, at);
  const module = createModule("Hello.uf.tsx", [component], exports);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  const files = target.emit(component, context);
  expect(reported).toEqual([]);
  return files;
}

/** The single file's contents, formatted as the compiler formats them. */
async function emitted(render: ElementNode, exports?: UfExport[]): Promise<string> {
  const [file, ...rest] = emit(render, exports);
  expect(rest).toEqual([]);
  const outcome = await formatOutput(file!);
  expect(outcome.error).toBeUndefined();
  return outcome.file.contents;
}

const named = (name: string): UfExport => ({ ...createExport("named", "Hello", at), name });

describe("qwik target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "attribute-spread",
      "bound-attribute",
      "class-binding",
      "component",
      "component-event",
      "conditional",
      "conditional-event-control",
      "context",
      "contextual-root",
      "default-slot",
      "default-slot-presence",
      "dynamic-component",
      "element",
      "event-capture",
      "event-once",
      "event-passive",
      "event-semantics",
      "expose",
      "fallthrough",
      "fragment",
      "interactivity",
      "interpolation",
      "late-prop",
      "list",
      "listbox",
      "model",
      "model-array",
      "model-modifiers",
      "named-slot",
      "next-tick",
      "props",
      "reactive-context",
      "scoped-slot",
      "slot-fallback",
      "slot-forwarding",
      "static-attribute",
      "style-binding",
      "svg",
      "text",
      "two-way-binding",
      "use-id",
    ]);
  });

  it("emits one TSX file per component, named after it", () => {
    expect(emit(greeting).map((file) => file.path)).toEqual(["Hello.tsx"]);
  });

  it("emits a default export as `export default component$`", async () => {
    expect(await emitted(greeting)).toBe(
      [
        `import { component$ } from "@qwik.dev/core";`,
        ``,
        `export default component$(() => {`,
        `  return <p class="greeting">Hello, world!</p>;`,
        `});`,
        ``,
      ].join("\n"),
    );
  });

  it("declares a same-named export in place", async () => {
    expect(await emitted(greeting, [named("Hello")])).toContain(
      `export const Hello = component$(() => {`,
    );
  });

  it("keeps aliases and several exports of one component in an export list", async () => {
    const contents = await emitted(greeting, [
      named("Greeting"),
      named("Hello"),
      createExport("default", "Hello", at),
    ]);
    expect(contents).toContain(`\nconst Hello = component$(() => {`);
    expect(contents).toMatch(/\nexport \{ Hello as Greeting, Hello, Hello as default \};\n$/);
  });

  // A component the module does not export is a sibling file, which the module's other
  // components import by its name (ADR-0053).
  it("exports a component the module does not export by its name", async () => {
    const contents = await emitted(greeting, []);
    expect(contents).toContain(`\nexport const Hello = component$(() => {`);
    expect(contents).not.toContain("export default");
  });

  it("writes the attribute names Qwik's JSX types declare on HTML elements", async () => {
    const contents = await emitted(
      element("form", { novalidate: true, class: "f" }, [
        element("label", { for: "x", accesskey: "n" }, [createText("X", at)]),
        element("input", { id: "x", readonly: true, maxlength: "3", "aria-label": "X" }),
      ]),
    );
    expect(contents).toContain(`<form noValidate class="f">`);
    expect(contents).toContain(`<label for="x" accessKey="n">`);
    expect(contents).toContain(`<input id="x" readOnly maxLength={3} aria-label="X" />`);
  });

  it("keeps SVG's case-sensitive names, and returns to HTML inside foreignObject", async () => {
    const contents = await emitted(
      element("div", { tabindex: "0" }, [
        element("svg", { viewBox: "0 0 1 1", tabindex: "0" }, [
          element("foreignObject", { width: "1" }, [element("p", { tabindex: "1" })]),
        ]),
        element("math", { tabindex: "0" }),
      ]),
    );
    expect(contents).toContain(`<div tabIndex={0}>`);
    expect(contents).toContain(`<svg viewBox="0 0 1 1" tabindex={0}>`);
    expect(contents).toContain(`<foreignObject width="1">`);
    expect(contents).toContain(`<p tabIndex={1} />`);
    expect(contents).toContain(`<math tabindex={0} />`);
  });

  it("writes boolean attributes bare and other valueless attributes empty", async () => {
    // Qwik's client renderer turns `true` into "true" on a non-boolean attribute.
    const contents = await emitted(
      element("details", { open: true, "data-state": true, hidden: true, title: true }),
    );
    expect(contents).toContain(`<details open data-state="" hidden title="" />`);
  });

  it("writes a boolean attribute bare whatever its value, as HTML reads it", async () => {
    // Qwik's JSX types these as `boolean`: a string fails type-checking (L4).
    const contents = await emitted(
      element("form", {}, [
        element("input", { disabled: "false", readonly: "" }),
        element("details", { open: "open" }),
        element("div", { hidden: "until-found" }),
        element("div", { hidden: "hidden" }),
      ]),
    );
    expect(contents).toContain("<input disabled readOnly />");
    expect(contents).toContain("<details open />");
    expect(contents).toContain('<div hidden="until-found" />');
    expect(contents).toContain("<div hidden />");
  });

  it("spells the attributes Qwik camel-cases on single elements", async () => {
    const contents = await emitted(
      element("form", {}, [
        element("button", { formenctype: "text/plain" }),
        element("img", { src: "/a.png", alt: "", fetchpriority: "high" }),
      ]),
    );
    expect(contents).toContain('<button formEnctype="text/plain" />');
    expect(contents).toContain('<img src="/a.png" alt="" fetchPriority="high" />');
  });

  it("reads HTML attribute names case-insensitively, as HTML does", async () => {
    const contents = await emitted(element("input", { readOnly: true, TabIndex: "0" }));
    expect(contents).toContain(`<input readOnly tabIndex={0} />`);
  });

  it("keys its tables by lower-case HTML names", () => {
    for (const name of [...Object.keys(QWIK_ATTRIBUTE_NAMES), ...QWIK_BOOLEAN_ATTRIBUTES]) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  it("emits exactly the attribute fixture the server renderer is tested on", async () => {
    const render = element("form", { class: "attributes", novalidate: true }, [
      element("label", { for: "note", accesskey: "n" }, [createText("Note", at)]),
      element("input", { id: "note", readonly: true, "data-state": true, autocomplete: "off" }),
      element("time", { datetime: "2026-10-01", itemprop: "date" }, [createText("Today", at)]),
      element("img", {
        src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        alt: "",
        crossorigin: "anonymous",
        referrerpolicy: "no-referrer",
      }),
      element("button", { type: "submit", formnovalidate: true, disabled: true }, [
        createText("Send", at),
      ]),
      element("svg", { viewBox: "0 0 1 1", "aria-hidden": "true" }, [
        element("foreignObject", { width: "1", height: "1" }, [
          element("p", { contenteditable: "true" }, [createText("Edit", at)]),
        ]),
      ]),
    ]);
    const fixture = readFileSync(new URL("fixtures/Attributes.tsx", import.meta.url), "utf8");
    expect(await emitted(render)).toBe(fixture);
  });
});

// M1's shapes (ADR-0034 to ADR-0040), from sources the analyser lowers.

/** A component in the object form that returns `body`. */
const plain = (body: string) =>
  `interface PlainProps { label: string; title?: string }\nexport function Plain(props: PlainProps) { return ${body}; }`;
describe("qwik target: props and expressions", () => {
  it("destructures the props in `component$<Props>`, with their defaults, in source order", async () => {
    const contents = await emitSource(
      [
        "export interface BadgeProps {",
        "  /** Shown in the badge. */",
        "  label: string;",
        '  tone?: "info" | "warn";',
        "  pill?: boolean;",
        "}",
        "",
        'export default function Badge({ tone = "info", label, pill = false }: BadgeProps) {',
        "  return <p class={{ pill }} data-tone={tone}>{label}</p>;",
        "}",
      ].join("\n"),
    );
    expect(contents).toBe(
      [
        'import { component$ } from "@qwik.dev/core";',
        "",
        "export interface BadgeProps {",
        "  /** Shown in the badge. */",
        "  label: string;",
        '  tone?: "info" | "warn";',
        "  pill?: boolean;",
        "}",
        "",
        'export default component$<BadgeProps>(({ tone = "info", label, pill = false }) => {',
        "  return (",
        "    <p class={{ pill }} data-tone={tone}>",
        "      {label}",
        "    </p>",
        "  );",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("leaves out the props no expression reads, and the parameter when none is read", async () => {
    // An unused binding fails L5 (no-unused-vars); the type argument still types the props.
    const some = await emitSource(
      "export function Card({ label, title }: { label: string; title?: string }) { return <p>{label}</p>; }",
    );
    expect(some).toContain(
      "export const Card = component$<{ label: string; title?: string }>(({ label }) => {",
    );
    const none = await emitSource(
      "interface CardProps { label: string }\nexport function Card({ label }: CardProps) { return <p>Card</p>; }",
    );
    expect(none).toContain("export const Card = component$<CardProps>(() => {");
  });

  it("keeps the `props` object as written, and leaves it out when nothing reads it", async () => {
    expect(await emitSource(plain("<p title={props.title}>{props.label}</p>"))).toContain(
      [
        "export const Plain = component$<PlainProps>((props) => {",
        "  return <p title={props.title}>{props.label}</p>;",
        "});",
      ].join("\n"),
    );
    expect(await emitSource(plain("<p>Plain</p>"))).toContain(
      "export const Plain = component$<PlainProps>(() => {",
    );
  });

  it("writes conditionals as ternaries ending in null, and lists as keyed `.map`", async () => {
    const contents = await emitSource(
      [
        "interface Item { id: string; name: string }",
        "export function List({ items, count, more }: { items: Item[]; count: number; more: boolean }) {",
        "  return (",
        "    <div>",
        "      {count && <b>{count}</b>}",
        '      {more ? <><i>a</i>b</> : count > 1 ? "many" : <s>none</s>}',
        "      <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>",
        "      <ol>{items.map((item, index) => <li key={index}>{index + 1}</li>)}</ol>",
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    // `&&` would render a falsy number (`0`), where the IR's truthiness test renders nothing.
    expect(contents).toContain("{count ? <b>{count}</b> : null}");
    expect(contents).toMatch(
      /\{more \? \(\s*<>\s*<i>a<\/i>b\s*<\/>\s*\) : count > 1 \? \(\s*"many"\s*\) : \(\s*<s>none<\/s>\s*\)\}/,
    );
    // An index no printed expression reads is left out; the key is the body's first attribute.
    expect(contents).toContain("{items.map((item) => (\n");
    expect(contents).toContain("<li key={item.id}>{item.name}</li>");
    expect(contents).toContain("{items.map((item, index) => (\n");
    expect(contents).toContain("<li key={index}>{index + 1}</li>");
  });

  it("writes a root fragment as `<>…</>`", async () => {
    const contents = await emitSource(
      "export function Pair({ a }: { a: string }) { return <><p>{a}</p><p>b</p></>; }",
    );
    expect(contents).toMatch(/return \(\n\s+<>\n\s+<p>\{a\}<\/p>\n\s+<p>b<\/p>\n\s+<\/>\n\s+\);/);
  });

  it("keeps expressions exactly as the source writes them", async () => {
    const contents = await emitSource(
      "export function Price({ price }: { price: number }) { return <p>{price * /* cents */ 1000}</p>; }",
    );
    // oxc-codegen would print `1e3` and drop the comment: expressions are spliced as text.
    expect(contents).toContain("{price * /* cents */ 1000}");
  });

  it("names its import around the names the source uses", async () => {
    // An arrow parameter named like Qwik's import keeps its name; the import takes another.
    const contents = await emitSource(
      'export function Tags({ tags }: { tags: string[] }) { return <p>{tags.filter((component$) => component$ !== "").join()}</p>; }',
    );
    expect(contents).toContain('import { component$ as component$_1 } from "@qwik.dev/core";');
    expect(contents).toContain(
      "export const Tags = component$_1<{ tags: string[] }>(({ tags }) => {",
    );
  });
});

describe("qwik target: attributes", () => {
  it("writes bound attributes under Qwik's names, and number-typed static values as numbers", async () => {
    const contents = await emitSource(
      [
        "export function Field({ order, locked, id }: { order: number; locked: boolean; id: string }) {",
        "  return (",
        '    <div tabindex="-1" spellcheck="false" draggable="true">',
        "      <label for={id}>Name</label>",
        '      <input id={id} tabindex={order} readonly={locked} maxlength="40" />',
        '      <table><tbody><tr><td colspan="2" rowspan={order}>x</td></tr></tbody></table>',
        '      <svg viewBox="0 0 2 2" tabindex="0" aria-valuenow="1"><circle cx="1" cy="1" r="1" stroke-width="2" /></svg>',
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    // Qwik types these as numbers and booleans: their static strings fail L4.
    expect(contents).toContain("<div tabIndex={-1} spellcheck={false} draggable={true}>");
    expect(contents).toContain("<label for={id}>Name</label>");
    expect(contents).toContain(
      "<input id={id} tabIndex={order} readOnly={locked} maxLength={40} />",
    );
    expect(contents).toContain("<td colSpan={2} rowSpan={order}>");
    // SVG keeps its names; `tabindex` and ARIA's numbers are numbers there too.
    expect(contents).toContain('<svg viewBox="0 0 2 2" tabindex={0} aria-valuenow={1}>');
    expect(contents).toContain('<circle cx="1" cy="1" r="1" stroke-width="2" />');
  });

  it("writes `class` from parts in Qwik's own forms", async () => {
    const contents = await emitSource(
      [
        "export function Pill({ tone, active, muted, count, tags }: {",
        '  tone?: "info" | "warn"; active: boolean; muted?: boolean; count: number; tags: string[];',
        "}) {",
        "  return (",
        "    <div>",
        "      <p class={tone}>a</p>",
        '      <p class={{ active, "is-muted": muted, "is-big is-wide": count > 9 }}>b</p>',
        '      <p class={["pill", tone, active && "on", count && "counted", { tagged: tags }]}>c</p>',
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    // A lone dynamic part is itself; toggles alone are one object, keyed as the source keys
    // them (one key per entry, shorthand where the condition is the name).
    expect(contents).toContain("<p class={tone}>a</p>");
    expect(contents).toContain(
      '<p class={{ active, "is-muted": muted, "is-big is-wide": count > 9 }}>b</p>',
    );
    // A condition Qwik's `ClassList` cannot hold (an array) is written `Boolean(…)`.
    expect(contents).toContain(
      '<p class={["pill", tone, { on: active, counted: count, tagged: Boolean(tags) }]}>c</p>',
    );
  });

  it("writes a condition whose type it cannot see as `Boolean(…)`", async () => {
    const contents = await emitSource(
      [
        "interface Todo { id: string; done?: boolean }",
        "export function Todos({ todos }: { todos: Todo[] }) {",
        '  return <ul>{todos.map((todo) => <li key={todo.id} class={{ done: todo.done, first: todo.id === "1" }}>{todo.id}</li>)}</ul>;',
        "}",
      ].join("\n"),
    );
    // A loop item's member: Qwik's types take `boolean | undefined`, but the target cannot
    // tell it from an array. A comparison is certainly a boolean.
    expect(contents).toContain('class={{ done: Boolean(todo.done), first: todo.id === "1" }}');
  });

  it("writes `style` as an object with camelCase keys and custom properties as written", async () => {
    const contents = await emitSource(
      [
        "export function Meter({ colour, width }: { colour?: string; width: number }) {",
        '  return <div style={{ color: colour, lineHeight: 1.5, "--meter-width": width, marginTop: "4px" }} />;',
        "}",
      ].join("\n"),
    );
    expect(contents).toContain(
      'style={{ color: colour, lineHeight: 1.5, "--meter-width": width, marginTop: "4px" }}',
    );
    const parsed = await emitSource(
      'export function Box() { return <div style="margin-top: 4px; color: red" />; }',
    );
    expect(parsed).toContain('<div style={{ marginTop: "4px", color: "red" }} />');
  });

  it("writes an attribute Qwik's types declare under no name as an object spread", async () => {
    const contents = await emitSource(
      [
        "interface Extra { form?: string; title?: string }",
        "export function Form({ listId, editable, extra }: {",
        '  listId: string; editable: "true" | "false"; extra: Extra;',
        "}) {",
        "  return (",
        "    <div>",
        '      <input form="checkout" list={listId} autocorrect="off" />',
        "      <input {...extra} />",
        '      <p contenteditable="true" />',
        "      <p contenteditable={editable} />",
        '      <p contenteditable="plaintext-only" />',
        '      <div enterkeyhint="go" />',
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    // Qwik renders them as written; TypeScript does not check a spread's keys that the
    // element's type lacks. `autoCorrect` is Qwik's name for the string HTML means.
    expect(contents).toContain(
      '<input {...{ form: "checkout" }} {...{ list: listId }} autoCorrect="off" />',
    );
    expect(contents).toContain("<input {...{ form: extra.form }} title={extra.title} />");
    expect(contents).toContain('<div {...{ enterkeyhint: "go" }} />');
    // `contentEditable` takes "true", "false" and "inherit", all a bound value can be.
    expect(contents).toContain('<p contentEditable="true" />');
    expect(contents).toContain("<p contentEditable={editable} />");
    expect(contents).toContain('<p {...{ contenteditable: "plaintext-only" }} />');
  });

  it("writes a spread as one attribute per declared key, merging its `class`", async () => {
    const contents = await emitSource(
      [
        "interface Attrs { title?: string; class?: string; maxlength?: number }",
        "interface Extra { title?: string; class?: string; tabindex?: number }",
        "export function Input({ attrs, extra }: { attrs: Attrs; extra?: Extra }) {",
        "  return (",
        "    <div>",
        '      <input {...attrs} class="field" />',
        "      <p {...extra}>x</p>",
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    // Qwik's names; a `class` key joins the element's own `class`, which Qwik's later-wins
    // spread would replace (ADR-0039).
    expect(contents).toContain(
      '<input title={attrs.title} maxLength={attrs.maxlength} class={["field", attrs.class]} />',
    );
    // An optional source reads every key through `?.`.
    expect(contents).toContain(
      "<p title={extra?.title} class={extra?.class} tabIndex={extra?.tabindex}>",
    );
  });
});

// Qwik types a `<title>`'s children as a string, in SVG as in HTML: a title gets one child that
// types as `string | undefined` (ADR-0040). `?? ""` only where the value may be nullish, which
// TypeScript reads from its syntax (TS2869 rejects it elsewhere) or the target from a prop's type.
describe("qwik target: SVG titles", () => {
  it("joins a title of several parts into one string, in branches and lists too", async () => {
    const contents = await emitSource(TITLES);
    for (const expected of [
      "<title>{`${label} icon`}</title>",
      '<title>{`${note ?? ""}, ${count + 1}, ${count}`}</title>',
      '<title>{`[${on ? " on" : ""}${count === 0 ? "none" : count === 1 ? `one ${label}` : `${count} of ${label}`}]`}</title>',
      "<title>{`${label}\\`\\${x}\\` \\\\ \\t`}</title>",
      // A part that always renders nothing is left out.
      "<title>ab</title>",
      '<title>{`${on ? "yes" : "no"}: ${(label.length > 2 ? label : note) ?? ""}`}</title>',
      // TypeScript reads `a ?? b` by `b` (TS2869, TS2871): no guard after a fallback that is
      // never nullish, and a nullish fallback becomes "" rather than take one.
      '<title>{`${note ?? "Untitled"} icon, ${on ? (note ?? "x") : "y"}, ${note ?? ""}.`}</title>',
      '<title>{on ? `a ${note ?? "x"}` : "b"}</title>',
      '<title>{`[${on ? (note ?? "") : ""}]`}</title>',
      '<title>{`Item ${x ?? ""}`}</title>',
      "<title>{`${label} on`}</title>",
    ]) {
      expect(contents).toContain(expected);
    }
  });

  it("keeps a lone string or undefined, and makes any other lone value one", async () => {
    const contents = await emitSource(TITLES);
    for (const expected of [
      "<title>{note}</title>",
      '<title>{on ? label : "Off"}</title>',
      "<title>{label.toUpperCase()}</title>",
      "<title>{note ?? undefined}</title>",
      '<title>{`${n ?? ""}`}</title>',
      // A number, which Qwik's type does not take, in a template literal; `null` as "".
      "<title>{`${count}`}</title>",
      '<title>{n ?? ""}</title>',
      // A conditional alone: its branches as strings, and `undefined` where Qwik writes `null`.
      '<title>{on ? `On: ${note ?? ""}` : "Off"}</title>',
      "<title>{on ? note : undefined}</title>",
      "<title>{on ? `${count}` : undefined}</title>",
    ]) {
      expect(contents).toContain(expected);
    }
  });

  it("reads the props object and the defaults the same way", async () => {
    expect(
      await emitSource(`export interface P { label: string; tone?: string; size?: number }
export default function Icon(props: P) {
  return <svg viewBox="0 0 10 10"><title>{props.label}: {props.tone}</title><title>{props.size}</title><title>{props.tone}</title></svg>;
}`),
    ).toContain(
      [
        '<title>{`${props.label}: ${props.tone ?? ""}`}</title>',
        '<title>{`${props.size ?? ""}`}</title>',
        "<title>{props.tone}</title>",
      ].join("\n      "),
    );
    expect(
      await emitSource(`export default function Icon({ label = "Icon", size = 2 }: { label?: string; size?: number }) {
  return <svg viewBox="0 0 10 10"><title>{label}: {size}</title><title>{label}</title></svg>;
}`),
    ).toContain("<title>{`${label}: ${size}`}</title>\n      <title>{label}</title>");
  });
});
