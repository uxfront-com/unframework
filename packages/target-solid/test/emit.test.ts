import { formatOutput } from "@unframework/codegen";
import type { ElementNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { AVATAR, el, emit, emitSource, hello, profileCard } from "./fixtures.ts";

async function formatted(render: ElementNode, options?: Parameters<typeof emit>[1]) {
  const { files, reported } = emit(render, options);
  expect(reported).toEqual([]);
  expect(files).toHaveLength(1);
  const outcome = await formatOutput(files[0]!);
  expect(outcome.error).toBeUndefined();
  return outcome.file;
}

/**
 * A component `Probe` whose props type holds `members`, taking it as `parameter` (a pattern, or
 * a name) and returning `jsx`.
 */
function probe(members: string, parameter: string, jsx: string, head = ""): string {
  return `${head}export interface ProbeProps {\n  ${members}\n}\n\nexport default function Probe(${parameter}: ProbeProps) {\n  return ${jsx};\n}\n`;
}

/** The output's component function, from its signature to its closing brace. */
function component(output: string): string {
  const start = output.indexOf("export default function Probe");
  return output.slice(start, output.indexOf("\n}\n", start) + 3);
}

describe("solid target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "attribute-spread",
      "bound-attribute",
      "class-binding",
      "conditional",
      "element",
      "fragment",
      "interactivity",
      "interpolation",
      "list",
      "listbox",
      "props",
      "static-attribute",
      "style-binding",
      "svg",
      "text",
    ]);
  });

  it("emulates class bindings with the helper it prints, and the rest natively", () => {
    const cells = Object.entries(target.capabilities).filter(([, cell]) => cell.support !== "native");
    expect(cells).toEqual([["class-binding", expect.objectContaining({ helper: "cx" })]]);
  });

  it("emits basics/hello as its golden output", async () => {
    expect(await formatted(hello(), { name: "Hello" })).toEqual({
      path: "Hello.tsx",
      contents: [
        "export default function Hello() {",
        '  return <p class="greeting">Hello, world!</p>;',
        "}",
        "",
      ].join("\n"),
    });
  });

  it("emits basics/nested-and-void as its golden output, with HTML attribute names", async () => {
    expect(await formatted(profileCard(), { name: "ProfileCard" })).toEqual({
      path: "ProfileCard.tsx",
      contents: [
        "export default function ProfileCard() {",
        "  return (",
        '    <article class="profile" aria-labelledby="profile-name">',
        '      <header class="profile-header">',
        "        <img",
        `          src="${AVATAR}"`,
        `          alt="Ada's avatar"`,
        '          width="48"',
        '          height="48"',
        "        />",
        '        <h2 id="profile-name">Ada Lovelace</h2>',
        "      </header>",
        "      <p>",
        "        Mathematician &amp; writer",
        "        <br />",
        "        of the first published program",
        "      </p>",
        "      <hr />",
        '      <label for="profile-note">Note</label>',
        '      <input id="profile-note" type="text" name="note" placeholder="Say hello" />',
        "    </article>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
  });

  it("keeps a named export named", async () => {
    const file = await formatted(hello(), { name: "Hello", kind: "named" });
    expect(file.contents).toMatch(/^export function Hello\(\) \{/);
  });

  it("keeps boolean attributes as written: Solid inlines them into its HTML templates", async () => {
    const file = await formatted(
      el("form", {}, el("input", { disabled: true }), el("input", { readonly: "" })),
    );
    expect(file.contents).toContain('<input disabled />\n      <input readonly="" />');
  });
});

describe("solid props (design §5.4)", () => {
  it("merges defaults into the props it never destructures, with the copied types above", async () => {
    const output = await emitSource(
      probe(
        'label: string;\n  tone?: "info" | "warn";\n  count?: number;\n  pill?: boolean;',
        '{ label, pill = false, tone = "info", count }',
        '<span data-tone={tone} data-count={count} aria-pressed={pill}>{label}</span>',
      ),
    );
    expect(output).toBe(
      [
        'import { mergeProps } from "solid-js";',
        "",
        "export interface ProbeProps {",
        "  label: string;",
        '  tone?: "info" | "warn";',
        "  count?: number;",
        "  pill?: boolean;",
        "}",
        "",
        "export default function Probe(rawProps: ProbeProps) {",
        '  const props = mergeProps({ pill: false, tone: "info" } satisfies Partial<ProbeProps>, rawProps);',
        "  return (",
        "    <span data-tone={props.tone} data-count={props.count} aria-pressed={props.pill}>",
        "      {props.label}",
        "    </span>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("reads destructured props through `props` when none it reads has a default", async () => {
    const output = await emitSource(
      probe("label: string;\n  tone?: string;", '{ label, tone = "info" }', "<p>{label}</p>"),
    );
    expect(component(output)).toBe(
      "export default function Probe(props: ProbeProps) {\n  return <p>{props.label}</p>;\n}\n",
    );
    expect(output).not.toContain("mergeProps");
  });

  it("keeps the object form's own name", async () => {
    const output = await emitSource(
      `export default function Probe(card: { title: string; note?: string }) {\n  return <p title={card.note}>{card.title}</p>;\n}\n`,
    );
    expect(output).toBe(
      [
        "export default function Probe(card: { title: string; note?: string }) {",
        "  return <p title={card.note}>{card.title}</p>;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("types the defaults of an inline props type by that type", async () => {
    const output = await emitSource(
      `export default function Probe({ size = 2 }: { size?: number }) {\n  return <p>{size}</p>;\n}\n`,
    );
    expect(component(output)).toBe(
      [
        "export default function Probe(rawProps: { size?: number }) {",
        "  const props = mergeProps({ size: 2 } satisfies Partial<{ size?: number }>, rawProps);",
        "  return <p>{props.size}</p>;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("names props it never reads `_props`, which keeps their type and no unused variable", async () => {
    const output = await emitSource(probe('tone?: string;', '{ tone = "info" }', "<p>Static</p>"));
    expect(component(output)).toBe(
      "export default function Probe(_props: ProbeProps) {\n  return <p>Static</p>;\n}\n",
    );
  });

  it("takes no parameter without props", async () => {
    const output = await emitSource(
      "export default function Probe() {\n  return <p>Static</p>;\n}\n",
    );
    expect(output).toBe("export default function Probe() {\n  return <p>Static</p>;\n}\n");
  });

  it("expands a shorthand property it rewrites", async () => {
    const output = await emitSource(
      probe("label: string;", "{ label }", "<p>{JSON.stringify({ label })}</p>"),
    );
    expect(output).toContain("<p>{JSON.stringify({ label: props.label })}</p>");
  });

  it("imports under a free name when the source declares the name itself", async () => {
    const output = await emitSource(
      probe(
        "on: boolean;\n  items: For[];",
        "{ on, items }",
        "<ul>{on && items.map((item) => <li key={item.id}>{item.id}</li>)}</ul>",
        "interface For {\n  id: string;\n}\n\n",
      ),
    );
    expect(output).toContain('import { For as For_1, Show } from "solid-js";');
    expect(component(output)).toContain(
      "<Show when={props.on}>\n        <For_1 each={props.items}>{(item) => <li>{item.id}</li>}</For_1>",
    );
  });
});

describe("solid control flow (design §5.4)", () => {
  it("shows a branch under its condition with <Show>, by truthiness", async () => {
    const output = await emitSource(
      probe("count: number;", "{ count }", "<p>{count && <b>{count} new</b>}</p>"),
    );
    expect(output).toContain('import { Show } from "solid-js";');
    expect(component(output)).toContain(
      "<p>\n      <Show when={props.count}>\n        <b>{props.count} new</b>\n      </Show>\n    </p>",
    );
  });

  it("gives <Show> its else branch as the fallback: text, a node or a fragment", async () => {
    const text = await emitSource(
      probe("on: boolean;", "{ on }", '<p>{on ? <b>On</b> : "Off"}</p>'),
    );
    expect(text).toContain('<Show when={props.on} fallback="Off">');
    const element = await emitSource(
      probe("on: boolean;", "{ on }", "<p>{on ? <b>On</b> : <i>Off</i>}</p>"),
    );
    expect(element).toContain("<Show when={props.on} fallback={<i>Off</i>}>");
    const fragment = await emitSource(
      probe("on: boolean;", "{ on }", "<p>{on ? <b>On</b> : <><i>Off</i> now</>}</p>"),
    );
    expect(fragment).toContain(
      "<Show\n        when={props.on}\n        fallback={\n          <>\n            <i>Off</i> now\n          </>\n        }\n      >",
    );
  });

  it("shows the else branch under the negated condition when the first is empty", async () => {
    const output = await emitSource(
      probe("busy: boolean;", "{ busy }", "<p>{busy ? null : <b>Ready</b>}</p>"),
    );
    expect(component(output)).toContain("<Show when={!props.busy}>");
    expect(output).not.toContain("fallback");
  });

  it("writes a longer chain as <Switch> and <Match>, an empty branch holding {null}", async () => {
    const output = await emitSource(
      probe(
        "n: number;",
        "{ n }",
        '<p>{n > 2 ? <b>Many</b> : n > 1 ? null : n > 0 ? "One" : <i>None</i>}</p>',
      ),
    );
    expect(output).toContain('import { Match, Switch } from "solid-js";');
    expect(component(output)).toContain(
      [
        "      <Switch fallback={<i>None</i>}>",
        "        <Match when={props.n > 2}>",
        "          <b>Many</b>",
        "        </Match>",
        "        <Match when={props.n > 1}>{null}</Match>",
        "        <Match when={props.n > 0}>One</Match>",
        "      </Switch>",
      ].join("\n"),
    );
  });

  it("writes an interpolated conditional of a bare name as <Show> (solid/prefer-show)", async () => {
    const output = await emitSource(
      probe(
        "items: string[];\n  on: boolean;",
        "{ items, on }",
        '<ul>{items.map((item) => <li key={item}>{on ? item : "-"}{on ? undefined : item}</li>)}</ul>',
      ),
    );
    expect(component(output)).toContain(
      '<Show when={props.on} fallback={"-"}>\n              {item}\n            </Show>',
    );
    expect(component(output)).toContain("<Show when={!props.on}>{item}</Show>");
  });

  it("keeps an interpolated conditional of values as it is", async () => {
    const output = await emitSource(
      probe("on: boolean;\n  label: string;", "{ on, label }", '<p>{on ? label : "none"}</p>'),
    );
    expect(component(output)).toContain('<p>{props.on ? props.label : "none"}</p>');
  });

  it("lists with <For>, without the key, calling the index accessor", async () => {
    const output = await emitSource(
      probe(
        "steps: string[];",
        "{ steps }",
        "<ol>{steps.map((step, index) => <li key={index} data-step={index + 1}>{step}</li>)}</ol>",
      ),
    );
    expect(output).toContain('import { For } from "solid-js";');
    expect(component(output)).toContain(
      "<For each={props.steps}>{(step, index) => <li data-step={index() + 1}>{step}</li>}</For>",
    );
    expect(output).not.toContain("key=");
  });

  it("leaves out an index read only by the key, and an item read by nothing", async () => {
    const keyed = await emitSource(
      probe(
        "steps: string[];",
        "{ steps }",
        "<ol>{steps.map((step, index) => <li key={index}>{step}</li>)}</ol>",
      ),
    );
    expect(keyed).toContain("{(step) => <li>{step}</li>}");
    const unread = await emitSource(
      probe(
        "steps: string[];",
        "{ steps }",
        "<ol>{steps.map((step, index) => <li key={index}>Step</li>)}</ol>",
      ),
    );
    expect(unread).toContain("{() => <li>Step</li>}");
  });

  it("returns a fragment of several roots", async () => {
    const output = await emitSource(
      probe("title: string;", "{ title }", "<>\n    <h2>{title}</h2>\n    <p>Text</p>\n  </>"),
    );
    expect(component(output)).toContain(
      "  return (\n    <>\n      <h2>{props.title}</h2>\n      <p>Text</p>\n    </>\n  );",
    );
  });
});

describe("solid attributes (design §5.4)", () => {
  it("toggles names with classList beside the static ones, as booleans", async () => {
    const output = await emitSource(
      probe(
        "active: boolean;\n  count: number;",
        "{ active, count }",
        '<p class={["item", { active, "has-count": count, empty: count === 0 }]}>x</p>',
      ),
    );
    expect(component(output)).toContain(
      [
        "    <p",
        '      class="item"',
        "      classList={{",
        "        active: props.active,",
        '        "has-count": Boolean(props.count),',
        "        empty: props.count === 0,",
        "      }}",
        "    >",
      ].join("\n"),
    );
    expect(output).not.toContain("function cx");
  });

  it("joins dynamic parts with an inline helper, printed after the component", async () => {
    const output = await emitSource(
      probe(
        'tone?: string;\n  active: boolean;',
        "{ tone, active }",
        '<p class={["item", tone, { active }]}>x</p>',
      ),
    );
    expect(component(output)).toContain(
      '<p class={cx("item", props.tone, { active: props.active })}>x</p>',
    );
    expect(output.slice(output.indexOf("\n}\n", output.indexOf("function Probe")))).toBe(
      [
        "",
        "}",
        "",
        "/** Joins class names: strings as they are, and the names of an object's truthy entries. */",
        "function cx(...parts: unknown[]): string {",
        "  const names: string[] = [];",
        "  for (const part of parts) {",
        '    if (typeof part === "string") names.push(part);',
        '    else if (part && typeof part === "object") {',
        "      for (const [name, on] of Object.entries(part)) if (on) names.push(name);",
        "    }",
        "  }",
        '  return names.join(" ");',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("writes one string as the class itself", async () => {
    const output = await emitSource(
      probe(
        'tone: "info" | "warn";\n  size: string;',
        "{ tone, size }",
        "<p class={`tone-${tone}`}>\n    <b class={size}>x</b>\n    <i class={tone}>y</i>\n  </p>",
      ),
    );
    expect(component(output)).toContain("<p class={`tone-${props.tone}`}>");
    expect(component(output)).toContain("<b class={props.size}>x</b>");
    expect(component(output)).toContain("<i class={props.tone}>y</i>");
    expect(output).not.toContain("function cx");
  });

  it("gives a nullable class to the helper, whose type takes any part", async () => {
    const output = await emitSource(
      probe("tone?: string | null;", "{ tone }", "<p class={tone}>x</p>"),
    );
    expect(component(output)).toContain("<p class={cx(props.tone)}>x</p>");
  });

  it("names the helper apart from the source's names", async () => {
    const output = await emitSource(
      probe(
        "items: string[];\n  tone?: string | null;",
        "{ items, tone }",
        "<ul class={tone}>{items.map((cx) => <li key={cx}>{cx}</li>)}</ul>",
      ),
    );
    expect(component(output)).toContain("<ul class={cx_1(props.tone)}>");
    expect(output).toContain("function cx_1(...parts: unknown[]): string {");
  });

  it("merges a spread's class into the element's own", async () => {
    const attrs = "interface Attrs {\n  class?: string;\n  title?: string;\n}\n\n";
    const output = await emitSource(
      probe(
        "attrs: Attrs;\n  extra?: Attrs;\n  on: boolean;",
        "{ attrs, extra, on }",
        '<div>\n    <p class="a" {...attrs}>x</p>\n    <p {...extra} class={{ on }}>y</p>\n    <p {...attrs}>z</p>\n  </div>',
        attrs,
      ),
    );
    expect(component(output)).toContain(
      '<p class={cx("a", props.attrs.class)} title={props.attrs.title}>',
    );
    expect(component(output)).toContain(
      "<p title={props.extra?.title} class={cx({ on: props.on }, props.extra?.class)}>",
    );
    expect(component(output)).toContain(
      "<p class={props.attrs.class} title={props.attrs.title}>",
    );
  });

  it("writes a style as an object with kebab-case keys, and number literals as strings", async () => {
    const output = await emitSource(
      probe(
        "gap?: string;\n  level: number;",
        "{ gap, level }",
        '<p style={{ marginTop: gap, lineHeight: 1.5, "--level": level, zIndex: -1, color: "red" }}>x</p>',
      ),
    );
    expect(component(output)).toContain(
      [
        "      style={{",
        '        "margin-top": props.gap,',
        '        "line-height": "1.5",',
        '        "--level": props.level,',
        '        "z-index": "-1",',
        '        color: "red",',
        "      }}",
      ].join("\n"),
    );
  });

  it("writes a static style string as an object too (solid/style-prop)", async () => {
    const output = await emitSource(
      probe("label: string;", "{ label }", '<p style="color: red; margin-top: 4px">{label}</p>'),
    );
    expect(component(output)).toContain('<p style={{ color: "red", "margin-top": "4px" }}>');
  });

  it("writes a spread key by key, through `?.` when its source may be absent", async () => {
    const attrs = "interface Attrs {\n  id: string;\n  \"aria-label\"?: string;\n}\n\n";
    const output = await emitSource(
      probe(
        "attrs: Attrs;\n  more?: Attrs;",
        "{ attrs, more }",
        "<div>\n    <p {...attrs}>x</p>\n    <p {...more}>y</p>\n  </div>",
        attrs,
      ),
    );
    expect(component(output)).toContain(
      '<p id={props.attrs.id} aria-label={props.attrs["aria-label"]}>',
    );
    expect(component(output)).toContain(
      '<p id={props.more?.id} aria-label={props.more?.["aria-label"]}>',
    );
  });

  it("binds attributes by their HTML names, booleans included", async () => {
    const output = await emitSource(
      probe(
        "locked: boolean;\n  limit: number;\n  label: string;",
        "{ locked, limit, label }",
        '<label for={label}>\n    <textarea readonly={locked} maxlength={limit} aria-disabled={locked} />\n  </label>',
      ),
    );
    expect(component(output)).toContain(
      "<textarea readonly={props.locked} maxlength={props.limit} aria-disabled={props.locked} />",
    );
    expect(component(output)).toContain("<label for={props.label}>");
  });

  it("keeps SVG names case-exact", async () => {
    const output = await emitSource(
      probe(
        "width: string;",
        "{ width }",
        '<svg viewBox="0 0 8 8" role="img">\n    <title>Dot</title>\n    <linearGradient id="g" />\n    <circle cx="4" cy="4" r="3" stroke-width={width} />\n  </svg>',
      ),
    );
    expect(component(output)).toContain('<svg viewBox="0 0 8 8" role="img">');
    expect(component(output)).toContain('<linearGradient id="g" />');
    expect(component(output)).toContain('<circle cx="4" cy="4" r="3" stroke-width={props.width} />');
  });
});
