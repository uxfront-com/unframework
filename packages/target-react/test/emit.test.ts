import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";

import { formatOutput } from "@unframework.dev/codegen";
import { checkInvariants, createComponent, createExport, createModule } from "@unframework.dev/ir";
import type { ElementNode, UfModule } from "@unframework.dev/ir";
import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import {
  AVATAR,
  el,
  emit,
  emitComponent,
  hello,
  lower,
  packageDir,
  profileCard,
  toolchainDir,
} from "./fixtures.ts";
import type { Emitted } from "./fixtures.ts";

/** The one file emitted, formatted as the compiler formats it; the target reports nothing. */
async function formattedFile({ files, reported }: Emitted) {
  expect(reported).toEqual([]);
  expect(files).toHaveLength(1);
  const outcome = await formatOutput(files[0]!);
  expect(outcome.error).toBeUndefined();
  return outcome.file;
}

async function formatted(render: ElementNode, options?: Parameters<typeof emit>[1]) {
  return formattedFile(emit(render, options));
}

/** The formatted React output of a source's first component (or the one named). */
async function output(source: string, name?: string): Promise<string> {
  return (await formattedFile(emitComponent(lower(source), name))).contents;
}

/** The cx helper as every output that needs it prints it, under its name. */
const cxHelper = (name = "cx") =>
  [
    "/** Joins class names, and the keys of an object's truthy entries, into one `className`. */",
    `function ${name}(...parts: unknown[]): string {`,
    "  const names: string[] = [];",
    "  for (const part of parts) {",
    '    if (typeof part === "string") {',
    "      if (part) names.push(part);",
    '    } else if (part && typeof part === "object") {',
    "      for (const [key, on] of Object.entries(part)) {",
    "        if (on) names.push(key);",
    "      }",
    "    }",
    "  }",
    '  return names.join(" ");',
    "}",
    "",
  ].join("\n");

/**
 * SVG titles of one part and of several: React's server renderer writes a `<title>` whose
 * children are an array as an empty one (ADR-0040), so the output joins several into one string.
 */
const TITLES = `export interface P { label: string; note?: string; count: number; on: boolean; xs: string[] }
export default function Icon({ label, note, count, on, xs }: P) {
  return (
    <svg viewBox="0 0 10 10" role="img">
      <title>{label} icon</title>
      <g><title>{note}, {count + 1}, {count}</title></g>
      <g><title>{on ? <>On: {note}</> : "Off"}</title></g>
      <g><title>[{on && " on"}{count === 0 ? "none" : count === 1 ? <>one {label}</> : <>{count} of {label}</>}]</title></g>
      <g><title>{label}{"\`\${x}\` \\\\ \\t"}</title></g>
      <g><title>a{on ? null : undefined}b</title></g>
      <g><title>{on ? "yes" : "no"}: {label.length > 2 ? label : note}</title></g>
      <g><title>{note}</title></g>
      <g><title>{on && note}</title></g>
      <g><title>{note ?? "Untitled"} icon, {on ? note ?? "x" : "y"}, {note ?? undefined}.</title></g>
      <g><title>{on ? <>a {note ?? "x"}</> : "b"}</title></g>
      <g><title>[{on ? note ?? null : null}]</title></g>
      {xs.map((x) => <g key={x}><title>Item {x}</title></g>)}
      {on && <g><title>{label} on</title></g>}
    </svg>
  );
}`;

/** What React renders for {@link TITLES}: the first title, then each title in its `<g>`. */
const titlesHtml = (first: string, ...titles: Array<string>): string =>
  [
    '<svg viewBox="0 0 10 10" role="img">',
    first,
    ...titles.map((title) => `<g><title>${title}</title></g>`),
    "</svg>",
  ].join("");

describe("react target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "async-setup",
      "attribute-spread",
      "bound-attribute",
      "child-root-scope",
      "class-binding",
      "component",
      "component-event",
      "composable-effect-order",
      "composables",
      "conditional",
      "conditional-event-control",
      "context",
      "contextual-root",
      "default-slot",
      "default-slot-presence",
      "directive",
      "dynamic-component",
      "element",
      "event-capture",
      "event-once",
      "event-passive",
      "event-semantics",
      "expose",
      "fallthrough",
      "fragment",
      "generic-components",
      "generic-slot-props",
      "hydration",
      "interactivity",
      "interpolation",
      "keyed-identity",
      "late-prop",
      "list",
      "listbox",
      "model",
      "model-array",
      "model-modifiers",
      "named-slot",
      "next-tick",
      "props",
      "raw-html",
      "reactive-context",
      "scoped-slot",
      "scoped-styles",
      "sheet-order",
      "slot-fallback",
      "slot-forwarding",
      "slotted-styles",
      "static-attribute",
      "style-binding",
      "svg",
      "teleport",
      "text",
      "transition",
      "two-way-binding",
      "use-id",
    ]);
  });

  it("emits basics/hello as its golden output", async () => {
    expect(await formatted(hello(), { name: "Hello" })).toEqual({
      path: "Hello.tsx",
      contents: [
        'import type { ComponentPropsWithRef } from "react";',
        "",
        'export type HelloAttributes = Omit<ComponentPropsWithRef<"p">, "children">;',
        "",
        "export default function Hello({ className, style, ...attributes }: HelloAttributes) {",
        "  return (",
        '    <p className={cx("greeting", className)} style={style} {...attributes}>',
        "      Hello, world!",
        "    </p>",
        "  );",
        "}",
        "",
        "/** Joins class names, and the keys of an object's truthy entries, into one `className`. */",
        "function cx(...parts: unknown[]): string {",
        "  const names: string[] = [];",
        "  for (const part of parts) {",
        '    if (typeof part === "string") {',
        "      if (part) names.push(part);",
        '    } else if (part && typeof part === "object") {',
        "      for (const [key, on] of Object.entries(part)) {",
        "        if (on) names.push(key);",
        "      }",
        "    }",
        "  }",
        '  return names.join(" ");',
        "}",
        "",
      ].join("\n"),
    });
  });

  it("emits basics/nested-and-void as its golden output", async () => {
    expect(await formatted(profileCard(), { name: "ProfileCard" })).toEqual({
      path: "ProfileCard.tsx",
      contents: [
        'import type { ComponentPropsWithRef } from "react";',
        "",
        'export type ProfileCardAttributes = Omit<ComponentPropsWithRef<"article">, "children">;',
        "",
        "export default function ProfileCard({ className, style, ...attributes }: ProfileCardAttributes) {",
        "  return (",
        "    <article",
        '      className={cx("profile", className)}',
        '      aria-labelledby="profile-name"',
        "      style={style}",
        "      {...attributes}",
        "    >",
        '      <header className="profile-header">',
        "        <img",
        "          src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E\"",
        '          alt="Ada\'s avatar"',
        "          width={48}",
        "          height={48}",
        "        />",
        '        <h2 id="profile-name">Ada Lovelace</h2>',
        "      </header>",
        "      <p>",
        "        Mathematician &amp; writer",
        "        <br />",
        "        of the first published program",
        "      </p>",
        "      <hr />",
        '      <label htmlFor="profile-note">Note</label>',
        '      <input id="profile-note" type="text" name="note" placeholder="Say hello" />',
        "    </article>",
        "  );",
        "}",
        "",
        "/** Joins class names, and the keys of an object's truthy entries, into one `className`. */",
        "function cx(...parts: unknown[]): string {",
        "  const names: string[] = [];",
        "  for (const part of parts) {",
        '    if (typeof part === "string") {',
        "      if (part) names.push(part);",
        '    } else if (part && typeof part === "object") {',
        "      for (const [key, on] of Object.entries(part)) {",
        "        if (on) names.push(key);",
        "      }",
        "    }",
        "  }",
        '  return names.join(" ");',
        "}",
        "",
      ].join("\n"),
    });
  });

  it("keeps a named export named", async () => {
    const file = await formatted(hello(), { name: "Hello", kind: "named" });
    expect(file.contents).toMatch(
      /^export function Hello\(\{ className, style, \.\.\.attributes \}: HelloAttributes\) \{$/m,
    );
  });

  // The target reports nothing (ADR-0033): what React renders differently from the
  // other targets is the analyser's to reject, and the IR's invariants keep it out of any IR a
  // plugin returns. M0's target reported these itself.
  it.each([
    ["a static style string", el("p", { style: "color: red" }, "Red")],
    ["an event handler string", el("button", { type: "button", onclick: "go()" }, "Go")],
    ["a selected option", el("select", {}, el("option", { value: "b", selected: true }, "B"))],
    ['`hidden="until-found"`', el("div", { hidden: "until-found" }, "Found")],
    ["a textarea's value beside its text", el("textarea", { value: "A" }, "B")],
  ])("leaves %s to the IR's invariants, which reject it", (_, render) => {
    const at = { start: 0, end: 0 };
    const module = createModule(
      "Fixture.uf.tsx",
      [createComponent("Fixture", render, at)],
      [createExport("default", "Fixture", at)],
    );
    expect(checkInvariants(module)).not.toEqual([]);
  });

  // The analyser rejects an element in a `<textarea>` (UF3003), but the invariants do not yet,
  // so a plugin could return one: the target then fails loudly (the compiler reports a target
  // that throws), never emitting a `defaultValue` that drops the element.
  it("throws on an element in a textarea, which only the analyser rejects so far", () => {
    expect(() => emit(el("textarea", {}, el("b", {}, "bold")))).toThrow(
      "A <textarea> holds only text",
    );
  });
});

// The shapes of the M1 output (plan §6), one construct at a time.
describe("react output shapes", () => {
  it("declares destructured props in source order, with the copied types above", async () => {
    const source = `interface Size {
  width: number;
}

export interface BadgeProps {
  /** What the badge says. */
  label: string;
  tone?: "info" | "warn";
  size?: Size;
}

export default function Badge({ tone = "info", label, size }: BadgeProps) {
  return <p data-tone={tone} data-width={size?.width}>{label}</p>;
}
`;
    expect(await output(source)).toBe(
      [
        'import type { ComponentPropsWithRef } from "react";',
        "",
        "interface Size {",
        "  width: number;",
        "}",
        "",
        "export interface BadgeProps {",
        "  /** What the badge says. */",
        "  label: string;",
        '  tone?: "info" | "warn";',
        "  size?: Size;",
        "}",
        "",
        "export type BadgeAttributes = Omit<",
        '  ComponentPropsWithRef<"p">,',
        '  "label" | "tone" | "size" | "children"',
        ">;",
        "",
        "export default function Badge({",
        '  tone = "info",',
        "  label,",
        "  size,",
        "  className,",
        "  style,",
        "  ...attributes",
        "}: BadgeProps & BadgeAttributes) {",
        "  return (",
        "    <p",
        "      data-tone={tone}",
        "      data-width={size?.width}",
        "      className={className}",
        "      style={style}",
        "      {...attributes}",
        "    >",
        "      {label}",
        "    </p>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
  });

  // An unused binding fails L5 (oxlint's no-unused-vars), and so does an empty pattern. Each
  // component takes no `class` or `style` (ADR-0054), and a ref on it holds nothing of its root,
  // a fragment (ADR-0118), so its own props are all it reads.
  it("leaves out the props nothing reads, defaults included", async () => {
    const props = `import { defineOptions } from "@uxfront/unframework";
export interface P { label: string; count?: number; tone?: string }\n`;
    expect(
      await output(`${props}export default function A({ label, count = 0, tone }: P) {
  defineOptions({ inheritAttrs: false });
  return <><p title={tone}>Hi</p><hr /></>;
}`),
    ).toContain("export default function A({ tone }: P) {");
    expect(
      await output(`${props}export default function A({ label, count = 0 }: P) {
  defineOptions({ inheritAttrs: false });
  return <><p>Hi</p><hr /></>;
}`),
    ).toContain("export default function A(_props: P) {");
    expect(
      await output(`${props}export default function A(props: P) {
  defineOptions({ inheritAttrs: false });
  return <><p>Hi</p><hr /></>;
}`),
    ).toContain("export default function A(_props: P) {");
    // A source name `_` and more says it is unused already; oxlint reports a bare `_`.
    expect(
      await output(`${props}export default function A(_props: P) {
  defineOptions({ inheritAttrs: false });
  return <><p>Hi</p><hr /></>;
}`),
    ).toContain("export default function A(_props: P) {");
    expect(
      await output(`${props}export default function A(_: P) {
  defineOptions({ inheritAttrs: false });
  return <><p>Hi</p><hr /></>;
}`),
    ).toContain("export default function A(__: P) {");
  });

  it("keeps the props object, and an inline props type, as written", async () => {
    expect(
      await output(`export interface PlainProps { label: string; title?: string }
export function Plain(props: PlainProps) {
  return <p title={props.title}>{props.label}</p>;
}`),
    ).toContain(
      [
        "export function Plain(props: PlainProps & PlainAttributes) {",
        "  const { className, style, label: _label, title: _title, ...attributes } = props;",
        "",
        "  return (",
        "    <p title={props.title} className={className} style={style} {...attributes}>",
        "      {props.label}",
        "    </p>",
        "  );",
        "}",
      ].join("\n"),
    );
    expect(
      await output(`export default function Inline({ label }: { label: string }) {
  return <p>{label}</p>;
}`),
    ).toBe(
      [
        'import type { ComponentPropsWithRef } from "react";',
        "",
        'export type InlineAttributes = Omit<ComponentPropsWithRef<"p">, "label" | "children">;',
        "",
        "export default function Inline({",
        "  label,",
        "  className,",
        "  style,",
        "  ...attributes",
        "}: { label: string } & InlineAttributes) {",
        "  return (",
        "    <p className={className} style={style} {...attributes}>",
        "      {label}",
        "    </p>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("prints expressions as the source writes them", async () => {
    expect(
      await output(`export default function Price({ amount }: { amount: number }) {
  return <p title={\`\${amount * 1000} mills\`}>{(amount / 0.50).toFixed(2)}, {amount * 1e3}</p>;
}`),
    ).toContain(
      "<p title={`${amount * 1000} mills`} className={className} style={style} {...attributes}>\n      {(amount / 0.5).toFixed(2)}, {amount * 1e3}\n    </p>",
    );
  });

  // `c && <b />` renders `0` for a zero in React; the IR's If tests truthiness (ADR-0036).
  it("writes conditionals as ternary chains ending in null, never &&", async () => {
    const source = `export interface P { count: number; label?: string; ready: boolean }
export default function Status({ count, label, ready }: P) {
  return (
    <div>
      {count && <b>{count}</b>}
      {ready ? <i>Ready</i> : label ? <><b>{label}</b> waiting</> : "Waiting"}
      {ready ? null : <em>Not ready</em>}
    </div>
  );
}`;
    expect(await output(source)).toContain(
      [
        "    <div className={className} style={style} {...attributes}>",
        "      {count ? <b>{count}</b> : null}",
        "      {ready ? (",
        "        <i>Ready</i>",
        "      ) : label ? (",
        "        <>",
        "          <b>{label}</b> waiting",
        "        </>",
        "      ) : (",
        '        "Waiting"',
        "      )}",
        "      {ready ? null : <em>Not ready</em>}",
        "    </div>",
      ].join("\n"),
    );
  });

  it("writes lists as keyed .map calls, with the index only when something reads it", async () => {
    const source = `export interface Item { id: string; name: string }
export interface P { items: Item[]; tags: string[] }
export default function Lists({ items, tags }: P) {
  return (
    <div>
      <ul>{items.map((item, index) => <li key={item.id}>{item.name}</li>)}</ul>
      <ol>{tags.map((tag, index) => <li key={index}>{tag}</li>)}</ol>
    </div>
  );
}`;
    const contents = await output(source);
    expect(contents).toContain(
      "{items.map((item) => (\n          <li key={item.id}>{item.name}</li>",
    );
    expect(contents).toContain("{tags.map((tag, index) => (\n          <li key={index}>{tag}</li>");
  });

  it("writes a root fragment as <>…</>", async () => {
    expect(
      await output(`export default function Pair({ a }: { a: string }) {
  return (
    <>
      <h2>{a}</h2>
      <p>Value</p>
    </>
  );
}`),
    ).toContain("  return (\n    <>\n      <h2>{a}</h2>\n      <p>Value</p>\n    </>\n  );");
  });

  it("spells attributes, static and bound, the way React's props do", async () => {
    const source = `export interface P { id: string; locked: boolean; order: number; skip: boolean }
export default function Form({ id, locked, order, skip }: P) {
  return (
    <form accept-charset="utf-8" novalidate>
      <label for={id}>Name</label>
      <input id={id} readonly disabled={locked} tabindex={order} maxlength="10" />
      <button type="submit" formnovalidate={skip}>Send</button>
      <table><tbody><tr><td colspan="2" rowspan="1">Wide</td></tr></tbody></table>
      <div role="heading" aria-level="2" tabindex="-1">Title</div>
    </form>
  );
}`;
    const contents = await output(source);
    for (const expected of [
      '<form acceptCharset="utf-8" noValidate className={className} style={style} {...attributes}>',
      "<label htmlFor={id}>Name</label>",
      "<input id={id} readOnly disabled={locked} tabIndex={order} maxLength={10} />",
      '<button type="submit" formNoValidate={skip}>',
      "<td colSpan={2} rowSpan={1}>",
      '<div role="heading" aria-level={2} tabIndex={-1}>',
    ]) {
      expect(contents).toContain(expected);
    }
  });

  it("writes SVG with its case-exact tags and React's attribute names", async () => {
    expect(
      await output(`export default function Icon() {
  return (
    <svg viewBox="0 0 10 10" role="img">
      <title>Done</title>
      <linearGradient id="fade"><stop offset="0" stop-color="#fff" /></linearGradient>
      <circle cx="5" cy="5" r="4" stroke-width="2" fill="url(#fade)" />
    </svg>
  );
}`),
    ).toContain(
      [
        '    <svg viewBox="0 0 10 10" role="img" className={className} style={style} {...attributes}>',
        "      <title>Done</title>",
        '      <linearGradient id="fade">',
        '        <stop offset="0" stopColor="#fff" />',
        "      </linearGradient>",
        '      <circle cx="5" cy="5" r="4" strokeWidth="2" fill="url(#fade)" />',
        "    </svg>",
      ].join("\n"),
    );
  });

  // `?? ""` only where the value may be nullish: TypeScript rejects it where its syntax says the
  // value never is (TS2869), and a prop typed `string` or `number` that is never absent needs none.
  it("joins an SVG <title> of several parts into one string, in branches and lists too", async () => {
    const contents = await output(TITLES);
    for (const expected of [
      "<title>{`${label} icon`}</title>",
      '<title>{`${note ?? ""}, ${count + 1}, ${count}`}</title>',
      // A conditional alone keeps its chain, each branch of several parts joined.
      '<title>{on ? `On: ${note ?? ""}` : "Off"}</title>',
      '<title>{`[${on ? " on" : ""}${count === 0 ? "none" : count === 1 ? `one ${label}` : `${count} of ${label}`}]`}</title>',
      "<title>{`${label}\\`\\${x}\\` \\\\ \\t`}</title>",
      // A part that always renders nothing is left out.
      "<title>ab</title>",
      '<title>{`${on ? "yes" : "no"}: ${(label.length > 2 ? label : note) ?? ""}`}</title>',
      // One part, or a conditional whose branches render one each, is already one value.
      "<title>{note}</title>",
      "<title>{on ? note : null}</title>",
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
    expect(
      await output(`export interface P { label: string; tone?: string }
export default function Icon(props: P) {
  return <svg viewBox="0 0 10 10"><title>{props.label}: {props.tone}</title></svg>;
}`),
    ).toContain('<title>{`${props.label}: ${props.tone ?? ""}`}</title>');
    expect(
      await output(`export default function Icon({ label = "Icon", size = 2 }: { label?: string; size?: number }) {
  return <svg viewBox="0 0 10 10"><title>{label}: {size}</title></svg>;
}`),
    ).toContain("<title>{`${label}: ${size}`}</title>");
  });

  it("joins a class from parts with an inline cx, printed after the component", async () => {
    const source = `export interface P { tone: string; active: boolean; busy: boolean; label: string }
export default function Chip({ tone, active, busy, label }: P) {
  return (
    <p class="chip">
      <b class={["badge", tone, { active, "is-busy": busy }, label.length > 3 && "long"]}>{label}</b>
    </p>
  );
}`;
    expect(await output(source)).toBe(
      [
        'import type { ComponentPropsWithRef } from "react";',
        "",
        "export interface P {",
        "  tone: string;",
        "  active: boolean;",
        "  busy: boolean;",
        "  label: string;",
        "}",
        "",
        "export type ChipAttributes = Omit<",
        '  ComponentPropsWithRef<"p">,',
        '  "tone" | "active" | "busy" | "label" | "children"',
        ">;",
        "",
        "export default function Chip({",
        "  tone,",
        "  active,",
        "  busy,",
        "  label,",
        "  className,",
        "  style,",
        "  ...attributes",
        "}: P & ChipAttributes) {",
        "  return (",
        '    <p className={cx("chip", className)} style={style} {...attributes}>',
        '      <b className={cx("badge", tone, { active, "is-busy": busy, long: label.length > 3 })}>',
        "        {label}",
        "      </b>",
        "    </p>",
        "  );",
        "}",
        "",
        "/** Joins class names, and the keys of an object's truthy entries, into one `className`. */",
        "function cx(...parts: unknown[]): string {",
        "  const names: string[] = [];",
        "  for (const part of parts) {",
        '    if (typeof part === "string") {',
        "      if (part) names.push(part);",
        '    } else if (part && typeof part === "object") {',
        "      for (const [key, on] of Object.entries(part)) {",
        "        if (on) names.push(key);",
        "      }",
        "    }",
        "  }",
        '  return names.join(" ");',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("names the helper, the type import and _props around the source's own names", async () => {
    const contents = await output(`export interface P { cx: string; CSSProperties: string }
export default function A({ cx, CSSProperties }: P) {
  return <p class={[cx]} style={{ "--x": CSSProperties }}>Hi</p>;
}`);
    expect(contents).toContain(
      'import type { CSSProperties as CSSProperties_1, ComponentPropsWithRef } from "react";',
    );
    expect(contents).toContain("className={cx_1(cx, className)}");
    expect(contents).toContain('style={{ "--x": CSSProperties, ...style } as CSSProperties_1}');
    expect(contents).toContain(cxHelper("cx_1"));
    // A type declaration is a name the source declares too. B takes no `class` or `style`
    // (ADR-0054), and no `ref` of its fragment root (ADR-0118), so it reads no
    // prop.
    expect(
      await output(`import { defineOptions } from "@uxfront/unframework";
interface _props { label?: string }
export default function B({ label }: _props) {
  defineOptions({ inheritAttrs: false });
  return <><p>Hi</p><hr /></>;
}`),
    ).toContain("export default function B(_props_1: _props) {");
  });

  it("writes a style as an object, typed as CSSProperties when it sets a custom property", async () => {
    // Neither takes a consumer's \`style\` (ADR-0054), nor a \`ref\` of its fragment root (ADR-0118):
    // its own style is the subject.
    const source = `import { defineOptions } from "@uxfront/unframework";
export interface P { gap?: string; size: number }
export function Plain({ gap }: P) {
  defineOptions({ inheritAttrs: false });
  return <><p style="color: red; margin-top: 4px" /><hr /></>;
}
export function Bound({ gap, size }: P) {
  defineOptions({ inheritAttrs: false });
  return <><p style={{ marginTop: gap, lineHeight: size, "--gap": gap }} /><hr /></>;
}`;
    const module = lower(source);
    const plain = (await formattedFile(emitComponent(module, "Plain"))).contents;
    expect(plain).toContain('<p style={{ color: "red", marginTop: "4px" }} />');
    expect(plain).not.toContain("import");
    const bound = (await formattedFile(emitComponent(module, "Bound"))).contents;
    expect(bound).toMatch(/^import type \{ CSSProperties \} from "react";\n/);
    expect(bound).toContain(
      '<p style={{ marginTop: gap, lineHeight: size, "--gap": gap } as CSSProperties} />',
    );
  });

  it("writes a spread out key by key, merging its class into the element's", async () => {
    const source = `interface Attrs {
  title?: string;
  "aria-label"?: string;
  class?: string;
}
export interface P { attrs: Attrs; extra?: Attrs }
export default function Notes({ attrs, extra }: P) {
  return (
    <div>
      <p class="note" {...attrs}>One</p>
      <p {...extra}>Two</p>
    </div>
  );
}`;
    const contents = await output(source);
    expect(contents).toContain(
      '<p className={cx("note", attrs.class)} title={attrs.title} aria-label={attrs["aria-label"]}>',
    );
    // An optional source without a default may be absent: every key reads through `?.`.
    expect(contents).toContain(
      '<p title={extra?.title} aria-label={extra?.["aria-label"]} className={extra?.class}>',
    );
  });

  it("writes a <textarea>'s text as its defaultValue", async () => {
    expect(
      await output(`import { defineOptions } from "@uxfront/unframework";
export default function Note() {
  defineOptions({ inheritAttrs: false });
  return <textarea name="note">{"  Hello,\\n  world  "}</textarea>;
}`),
    ).toContain(
      String.raw`<textarea name="note" defaultValue={"  Hello,\n  world  "} ref={ref} />`,
    );
  });
});

/** Renders a component element on the server, collecting React's console errors. */
function renderMarkup(element: Parameters<typeof renderToStaticMarkup>[0]) {
  const errors: Array<string> = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: Array<unknown>) => void errors.push(format(...args)));
  try {
    return { html: renderToStaticMarkup(element), errors };
  } finally {
    spy.mockRestore();
  }
}

/** `SetupPending` as every output of a setup that awaits prints it, under its name (ADR-0101). */
const setupPending = (name = "SetupPending") =>
  [
    "/**",
    " * Renders nothing while a setup runs, and tells the component once it settles, so React shows the",
    " * content at once rather than after its fallback throttle. Only a fallback React commits runs it:",
    " * never on the server, and never while the client hydrates.",
    " */",
    `function ${name}({`,
    "  setup,",
    "  onSettled,",
    "}: {",
    "  setup: Promise<unknown>;",
    "  onSettled: (settled: boolean) => void;",
    "}): null {",
    "  useEffect(() => {",
    "    let live = true;",
    "    const settle = () => {",
    "      if (live) onSettled(true);",
    "    };",
    "    setup.then(settle, settle);",
    "    return () => {",
    "      live = false;",
    "    };",
    "  }, [setup, onSettled]);",
    "  return null;",
    "}",
    "",
  ].join("\n");

/** Two awaits, a prop's default, an annotation, and a value only the later await reads. */
const CARD = `const load = async (id: string) => ({ name: id, team: "t" });
export default async function Card({ id, prefix = "u-" }: { id: string; prefix?: string }) {
  const user = await load(prefix + id);
  const team: { name: string } = await load(user.team);
  const label = computed(() => team.name + id);
  return <p>{label.value}</p>;
}`;

/** The object form, whose resolved component reads the promise off the props. */
const TAG = `const load = async (id: string) => ({ name: id });
export interface TagProps { id: string; label: string }
export async function Tag(props: TagProps) {
  const user = await load(props.id);
  return <span>{props.label}: {user.name}</span>;
}`;

/** An await that reads no prop and whose value nothing reads. */
const PING = `const load = async () => "pong";
export default async function Ping() {
  const pong = await load();
  return <p>Ping</p>;
}`;

/** Source names that the output's own would take: `setup`, `settled` and `SetupPending`. */
const TAKEN = `const load = async (id: string) => ({ name: id });
export default async function Taken({ setup }: { setup: string }) {
  const settled = await load(setup);
  function SetupPending() { return settled.name; }
  return <p>{SetupPending()}</p>;
}`;

describe("react async setup (ADR-0101)", () => {
  it("runs the awaits in a setup function the exported component starts, and renders the resolved component in a <Suspense>", async () => {
    expect(await output(`import { computed } from "@uxfront/unframework";\n${CARD}`)).toBe(
      [
        'import { type ComponentPropsWithRef, Suspense, use, useEffect, useMemo, useState } from "react";',
        "",
        'export type CardAttributes = Omit<ComponentPropsWithRef<"p">, "id" | "prefix" | "children">;',
        "",
        'const load = async (id: string) => ({ name: id, team: "t" });',
        "",
        'async function cardSetup({ id, prefix = "u-" }: { id: string; prefix?: string }) {',
        "  const user = await load(prefix + id);",
        "  const team: { name: string } = await load(user.team);",
        "  return { team };",
        "}",
        "",
        "export default function Card(props: { id: string; prefix?: string } & CardAttributes) {",
        "  const [setup] = useState(() => cardSetup(props));",
        "  const [settled, setSettled] = useState(false);",
        "",
        "  return (",
        "    <Suspense fallback={<SetupPending setup={setup} onSettled={setSettled} />}>",
        "      <CardResolved {...props} setup={setup} settled={settled} />",
        "    </Suspense>",
        "  );",
        "}",
        "",
        "function CardResolved({",
        "  id,",
        "  className,",
        "  style,",
        "  prefix: _prefix,",
        "  setup,",
        "  settled: _settled,",
        "  ...attributes",
        "}: { id: string; prefix?: string } & CardAttributes & {",
        "    setup: ReturnType<typeof cardSetup>;",
        "    settled: boolean;",
        "  }) {",
        "  const { team } = use(setup);",
        "",
        "  const label = useMemo(() => team.name + id, [team, id]);",
        "",
        "  return (",
        "    <p className={className} style={style} {...attributes}>",
        "      {label}",
        "    </p>",
        "  );",
        "}",
        "",
        setupPending(),
      ].join("\n"),
    );
  });

  it("keeps the props object, which the resolved component reads the promise off", async () => {
    const printed = await output(TAG);
    expect(printed).toContain(
      [
        "async function tagSetup(props: TagProps) {",
        "  const user = await load(props.id);",
        "  return { user };",
        "}",
        "",
        "export function Tag(props: TagProps & TagAttributes) {",
        "  const [setup] = useState(() => tagSetup(props));",
      ].join("\n"),
    );
    expect(printed).toContain(
      [
        "function TagResolved(",
        "  props: TagProps & TagAttributes & { setup: ReturnType<typeof tagSetup>; settled: boolean },",
        ") {",
        "  const {",
        "    className,",
        "    style,",
        "    id: _id,",
        "    label: _label,",
        "    setup: _setup,",
        "    settled: _settled,",
        "    ...attributes",
        "  } = props;",
        "",
        "  const { user } = use(props.setup);",
      ].join("\n"),
    );
  });

  it("awaits a value nothing reads without a name, and starts a setup that reads no prop without them", async () => {
    const printed = await output(PING);
    expect(printed).toContain("async function pingSetup() {\n  await load();\n}");
    expect(printed).toContain("const [setup] = useState(() => pingSetup());");
    expect(printed).toContain(
      "}: PingAttributes & { setup: ReturnType<typeof pingSetup>; settled: boolean }) {\n  use(setup);\n",
    );
  });

  it("passes nothing on from a component that takes no props", async () => {
    const printed = await output(`const load = async () => "x";
export default async function Frag() {
  const value = await load();
  return <><p>{value}</p><p>two</p></>;
}`);
    expect(printed).toContain("export default function Frag() {");
    expect(printed).toContain("<FragResolved setup={setup} settled={settled} />");
    expect(printed).toContain(
      "function FragResolved({ setup }: { setup: ReturnType<typeof fragSetup>; settled: boolean }) {",
    );
  });

  it("claims its names around the source's", async () => {
    const printed = await output(TAKEN);
    expect(printed).toContain("const [setup_1] = useState(() => takenSetup(props));");
    expect(printed).toContain("const [settled_1, setSettled] = useState(false);");
    expect(printed).toContain(
      "<Suspense fallback={<SetupPending_1 setup={setup_1} onSettled={setSettled} />}>",
    );
    expect(printed).toContain(
      "<TakenResolved {...props} setup_1={setup_1} settled_1={settled_1} />",
    );
    expect(printed).toContain("const { settled } = use(setup_1);");
    expect(printed).toContain(setupPending("SetupPending_1"));
  });

  it("passes React Compiler, the checker and the linter with no message (L3, L4, L5)", async () => {
    const scratch = join(packageDir, ".uf-tmp", `async-${randomUUID()}`);
    mkdirSync(scratch, { recursive: true });
    try {
      const sources = {
        Card: `import { computed } from "@uxfront/unframework";\n${CARD}`,
        Tag: TAG,
        Ping: PING,
        Taken: TAKEN,
      };
      const files = await Promise.all(
        Object.entries(sources).map(async ([name, source]) => {
          const path = join(scratch, `${name}.tsx`);
          const contents = await output(source);
          writeFileSync(path, contents);
          return { path, contents };
        }),
      );
      const context = { toolchainDir, root: packageDir };
      const compiled = await toolchain.frameworkCompile(files, context);
      for (const { path } of files) {
        expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
      }
      const paths = files.map(({ path }) => path);
      for (const [path, messages] of await toolchain.typecheck(paths, context)) {
        expect(messages, path).toEqual([]);
      }
      for (const [path, messages] of await toolchain.lint(paths, context)) {
        expect(messages, path).toEqual([]);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe("react output, rendered by React", () => {
  const scratch = join(packageDir, ".uf-tmp", `emit-${randomUUID()}`);
  beforeAll(() => mkdirSync(scratch, { recursive: true }));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** Formats an emitted file as the compiler does and imports it as Vite compiles TSX. */
  async function load(emitted: Emitted) {
    const outcome = await formatOutput(emitted.files[0]!);
    expect(outcome.error).toBeUndefined();
    const file = join(scratch, `${randomUUID()}.tsx`);
    writeFileSync(file, outcome.file.contents);
    return ((await import(file)) as { default: ComponentType<object> }).default;
  }

  /** Emits the tree and renders it with React. */
  async function renderOutput(tree: ElementNode) {
    const emitted = emit(tree);
    return { ...renderMarkup(createElement(await load(emitted))), reported: emitted.reported };
  }

  /** Emits a source's default export and renders it with React, once per set of props. */
  async function renderSource(source: string, ...props: Array<object>) {
    const module: UfModule = lower(source);
    const emitted = emitComponent(module);
    expect(emitted.reported).toEqual([]);
    const component = await load(emitted);
    return props.map((each) => renderMarkup(createElement(component, each)));
  }

  it("is checked by a console capture that sees React's warnings", () => {
    // The controls the tests below rely on: React warns about the HTML spelling, and it
    // drops a boolean attribute whose value is the empty string.
    expect(renderMarkup(createElement("label", { for: "x" } as object)).errors).toEqual([
      expect.stringContaining("Invalid DOM property `for`. Did you mean `htmlFor`?"),
    ]);
    expect(renderMarkup(createElement("input", { disabled: "" } as object)).html).toBe("<input/>");
  });

  it("renders basics/nested-and-void as the source's HTML, without warnings", async () => {
    expect(await renderOutput(profileCard())).toEqual({
      html: [
        '<article class="profile" aria-labelledby="profile-name">',
        '<header class="profile-header">',
        `<img src="${AVATAR.replaceAll("'", "&#x27;")}" alt="Ada&#x27;s avatar" width="48" height="48"/>`,
        '<h2 id="profile-name">Ada Lovelace</h2>',
        "</header>",
        "<p>Mathematician &amp; writer<br/>of the first published program</p>",
        "<hr/>",
        '<label for="profile-note">Note</label>',
        // React's server renderer writes an input's `name` last.
        '<input id="profile-note" type="text" placeholder="Say hello" name="note"/>',
        "</article>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  it("renders text and attribute values exactly as the IR holds them", async () => {
    const tricky = [
      "{braces} <angles> & ampersands",
      "two  spaces, a no-break space and ‘quotes’",
      " leading and trailing ",
    ];
    const tree = el(
      "div",
      { title: 'say "hi" & {wave}', "data-path": String.raw`a\b<c>` },
      el("p", {}, tricky[0]!),
      el("p", {}, tricky[1]!),
      el("p", {}, "before", el("b", {}, tricky[2]!), "after"),
    );
    const { html, errors, reported } = await renderOutput(tree);
    expect({ errors, reported }).toEqual({ errors: [], reported: [] });
    expect(html).toBe(
      [
        String.raw`<div title="say &quot;hi&quot; &amp; {wave}" data-path="a\b&lt;c&gt;">`,
        "<p>{braces} &lt;angles&gt; &amp; ampersands</p>",
        "<p>two  spaces, a no-break space and ‘quotes’</p>",
        "<p>before<b> leading and trailing </b>after</p>",
        "</div>",
      ].join(""),
    );
  });

  it("renders static boolean attributes as present", async () => {
    const tree = el(
      "fieldset",
      {},
      el("input", { disabled: true }),
      el("input", { readonly: true, required: true }),
      el("details", { open: true }, el("summary", {}, "More")),
      el("div", { inert: true, hidden: true }),
    );
    expect(await renderOutput(tree)).toEqual({
      html: [
        "<fieldset>",
        '<input disabled=""/>',
        '<input readOnly="" required=""/>',
        '<details open=""><summary>More</summary></details>',
        '<div inert="" hidden=""></div>',
        "</fieldset>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  // React's client ignores a `defaultValue` on a submit or reset input, though its server
  // renderer writes one, so a fixed value stays `value`, which React neither controls nor warns
  // about. test/render-parity.browser.test.ts renders it with `createRoot`.
  it("keeps the value of an input whose type React leaves alone", async () => {
    const tree = el(
      "form",
      {},
      el("input", { type: "submit", value: "Send" }),
      el("input", { type: "reset", value: "Clear" }),
      el("input", { type: "hidden", name: "id", value: "7" }),
    );
    const { files } = emit(tree);
    expect(files[0]!.contents).toContain('<input type="submit" value="Send" />');
    expect(files[0]!.contents).toContain('<input type="reset" value="Clear" />');
    expect(await renderOutput(tree)).toEqual({
      html: [
        "<form>",
        '<input type="submit" value="Send"/>',
        '<input type="reset" value="Clear"/>',
        '<input type="hidden" name="id" value="7"/>',
        "</form>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  it("sets a textarea's content as its defaultValue, which React asks for instead", async () => {
    const tree = el("form", {}, el("textarea", { id: "t" }, "  Hello,\n  world  "));
    const { files } = emit(tree);
    expect(files[0]!.contents).toContain(
      String.raw`<textarea id="t" defaultValue={"  Hello,\n  world  "} />`,
    );
    expect(await renderOutput(tree)).toEqual({
      html: '<form><textarea id="t">  Hello,\n  world  </textarea></form>',
      errors: [],
      reported: [],
    });
  });

  it("spells HTML and SVG attributes the way React expects", async () => {
    const tree = el(
      "div",
      { tabindex: "0", accesskey: "d", spellcheck: "false" },
      el("label", { for: "name" }, "Name"),
      el("p", { contenteditable: "true" }),
      el("video", { playsinline: true, crossorigin: "anonymous" }),
      el(
        "svg",
        { viewBox: "0 0 10 10", "aria-hidden": "true" },
        el("path", { d: "M0 0h10", "stroke-width": "2", "fill-rule": "evenodd" }),
      ),
    );
    const { html, errors, reported } = await renderOutput(tree);
    expect({ errors, reported }).toEqual({ errors: [], reported: [] });
    // React's server renderer keeps some React spellings (`accessKey`); HTML attribute names
    // are case-insensitive, and in the DOM React sets them through setAttribute.
    expect(html).toBe(
      [
        '<div tabindex="0" accessKey="d" spellCheck="false">',
        '<label for="name">Name</label>',
        '<p contentEditable="true"></p>',
        '<video playsInline="" crossorigin="anonymous"></video>',
        '<svg viewBox="0 0 10 10" aria-hidden="true">',
        '<path d="M0 0h10" stroke-width="2" fill-rule="evenodd"></path>',
        "</svg>",
        "</div>",
      ].join(""),
    );
  });

  it("takes defaults for absent and undefined props, and keeps null", async () => {
    const renders = await renderSource(
      `export interface P { label?: string; tone?: string | null }
export default function Badge({ label = "New", tone = null }: P) {
  return <p data-tone={tone}>{label}</p>;
}`,
      {},
      { label: undefined, tone: undefined },
      { label: "Old", tone: "warn" },
    );
    expect(renders).toEqual([
      { html: "<p>New</p>", errors: [] },
      { html: "<p>New</p>", errors: [] },
      { html: '<p data-tone="warn">Old</p>', errors: [] },
    ]);
  });

  it("renders nothing for a falsy condition, a zero and the empty string included", async () => {
    const renders = await renderSource(
      `export interface P { count: number; note: string }
export default function Counts({ count, note }: P) {
  return <p>{count && <b>{count}</b>}{note && <i>{note}</i>}{!count ? "none" : null}</p>;
}`,
      { count: 0, note: "" },
      { count: 2, note: "x" },
    );
    expect(renders).toEqual([
      { html: "<p>none</p>", errors: [] },
      { html: "<p><b>2</b><i>x</i></p>", errors: [] },
    ]);
  });

  it("joins a class from its parts with cx", async () => {
    const renders = await renderSource(
      `export interface P { tone?: string | null; on: number; extra: string }
export default function Chip({ tone, on, extra }: P) {
  return <p class={["chip", tone, { on, off: !on }, extra]}>Chip</p>;
}`,
      { tone: "warn", on: 1, extra: "" },
      { tone: null, on: 0, extra: "a  b" },
    );
    expect(renders).toEqual([
      { html: '<p class="chip warn on">Chip</p>', errors: [] },
      { html: '<p class="chip off a  b">Chip</p>', errors: [] },
    ]);
  });

  // Every boolean attribute the IR holds is one of React's boolean props, bound as it is.
  it("renders a bound boolean attribute as present or absent", async () => {
    const renders = await renderSource(
      `export interface P { locked?: boolean | null }
export default function Field({ locked }: P) {
  return <fieldset disabled={locked}><input required={locked} /></fieldset>;
}`,
      { locked: true },
      { locked: false },
      { locked: null },
    );
    expect(renders).toEqual([
      { html: '<fieldset disabled=""><input required=""/></fieldset>', errors: [] },
      { html: "<fieldset><input/></fieldset>", errors: [] },
      { html: "<fieldset><input/></fieldset>", errors: [] },
    ]);
  });

  it("renders the present declarations of a style, custom properties included", async () => {
    const renders = await renderSource(
      `export interface P { colour?: string; size?: number }
export default function Swatch({ colour, size }: P) {
  return <p style={{ color: colour, lineHeight: size, "--size": size, marginTop: "4px" }}>Swatch</p>;
}`,
      { colour: "red", size: 2 },
      { colour: "" },
    );
    expect(renders).toEqual([
      { html: '<p style="color:red;line-height:2;--size:2;margin-top:4px">Swatch</p>', errors: [] },
      { html: '<p style="margin-top:4px">Swatch</p>', errors: [] },
    ]);
  });

  it("renders a spread's declared keys, its class merged", async () => {
    const renders = await renderSource(
      `interface Attrs { title?: string; class?: string; "aria-label"?: string }
export interface P { attrs?: Attrs }
export default function Note({ attrs }: P) {
  return <p class="note" {...attrs}>Note</p>;
}`,
      { attrs: { title: "T", class: "x", "aria-label": "L" } },
      {},
    );
    expect(renders).toEqual([
      { html: '<p class="note x" title="T" aria-label="L">Note</p>', errors: [] },
      { html: '<p class="note">Note</p>', errors: [] },
    ]);
  });

  // Without one string, React's server renderer writes `<title></title>` and warns.
  it("renders an SVG <title> of several parts as their text, nullish parts as nothing", async () => {
    const renders = await renderSource(
      TITLES,
      { label: "Star <&>", count: 0, on: true, xs: ["a"] },
      { label: "L", note: "N", count: 2, on: false, xs: [] },
    );
    expect(renders).toEqual([
      {
        html: titlesHtml(
          "<title>Star &lt;&amp;&gt; icon</title>",
          ", 1, 0",
          "On: ",
          "[ onnone]",
          "Star &lt;&amp;&gt;`${x}` \\ \t",
          "ab",
          "yes: Star &lt;&amp;&gt;",
          "",
          "",
          "Untitled icon, x, .",
          "a x",
          "[]",
          "Item a",
          "Star &lt;&amp;&gt; on",
        ),
        errors: [],
      },
      {
        html: titlesHtml(
          "<title>L icon</title>",
          "N, 3, 2",
          "Off",
          "[2 of L]",
          "L`${x}` \\ \t",
          "ab",
          "no: N",
          "N",
          "",
          "N icon, y, N.",
          "b",
          "[]",
        ),
        errors: [],
      },
    ]);
  });

  it('type-checks a joined <title>, with `?? ""` only where TypeScript allows it (L4)', async () => {
    const outcome = await formatOutput(emitComponent(lower(TITLES)).files[0]!);
    const emitted = join(scratch, "Titles.tsx");
    writeFileSync(emitted, outcome.file.contents);
    // The control: the guard on a value whose syntax is never nullish fails.
    const guarded = join(scratch, "Guarded.tsx");
    writeFileSync(
      guarded,
      'export default function Guarded({ n }: { n: number }) {\n  return <svg><title>{`${n + 1 ?? ""}`}</title></svg>;\n}\n',
    );
    const results = await toolchain.typecheck([emitted, guarded], {
      toolchainDir,
      root: packageDir,
    });
    expect(Object.fromEntries(results)).toEqual({
      [emitted]: [],
      [guarded]: [expect.objectContaining({ line: 2, code: "TS2869" })],
    });
  });
});
