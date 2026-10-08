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

  it("emulates watchers, nextTick and class bindings with the helpers it prints, the rest natively", () => {
    // Nothing is unsupported: the watchers' scheduler coalesces every shape of a synchronous run
    // of client code (src/helpers.ts).
    const cells = Object.entries(target.capabilities).filter(
      ([, cell]) => cell.support !== "native",
    );
    expect(cells).toEqual([
      ["interactivity", expect.objectContaining({ helper: "createWatcher" })],
      ["next-tick", expect.objectContaining({ helper: "nextTick" })],
      ["class-binding", expect.objectContaining({ helper: "cx" })],
      ["model-array", expect.objectContaining({ helper: "toggle" })],
      ["model-modifiers", expect.objectContaining({ helper: "modelText" })],
      ["reactive-context", expect.objectContaining({ helper: "refObject" })],
    ]);
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

describe("solid props", () => {
  it("merges defaults into the props it never destructures, with the copied types above", async () => {
    const output = await emitSource(
      probe(
        'label: string;\n  tone?: "info" | "warn";\n  count?: number;\n  pill?: boolean;',
        '{ label, pill = false, tone = "info", count }',
        "<span data-tone={tone} data-count={count} aria-pressed={pill}>{label}</span>",
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

  it("types object defaults by the props' own types, which keep their optional members", async () => {
    // `satisfies` would keep `{ title: string }`, and `mergeProps` type `props.attrs` without `id`.
    const output = await emitSource(
      probe(
        'attrs?: Attrs;\n  tone?: "info" | "warn";',
        '{ attrs = { title: "t" }, tone = "info" }',
        "<p {...attrs} data-tone={tone}>a</p>",
        "interface Attrs {\n  title: string;\n  id?: string;\n}\n\n",
      ),
    );
    expect(component(output)).toContain(
      [
        "export default function Probe(rawProps: ProbeProps) {",
        '  const defaults: Required<Pick<ProbeProps, "attrs" | "tone">> = {',
        '    attrs: { title: "t" },',
        '    tone: "info",',
        "  };",
        "  const props = mergeProps(defaults, rawProps);",
      ].join("\n"),
    );
    expect(component(output)).toContain("id={props.attrs.id}");
  });

  it("types array defaults by the props' own types, not the literals they list", async () => {
    // `satisfies` would keep `"info"[]`, and `mergeProps` type `props.tones` as `Tone[] | "info"[]`,
    // whose `includes` takes only `"info"`.
    const output = await emitSource(
      probe(
        "tones?: Tone[];\n  tone: Tone;",
        '{ tones = ["info"], tone }',
        '<p>{tones.includes(tone) ? "y" : "n"}</p>',
        'type Tone = "info" | "warn";\n\n',
      ),
    );
    expect(component(output)).toContain(
      'const defaults: Required<Pick<ProbeProps, "tones">> = { tones: ["info"] };',
    );
    expect(component(output)).toContain("const props = mergeProps(defaults, rawProps);");
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
    const output = await emitSource(probe("tone?: string;", '{ tone = "info" }', "<p>Static</p>"));
    expect(component(output)).toBe(
      "export default function Probe(_props: ProbeProps) {\n  return <p>Static</p>;\n}\n",
    );
  });

  // A source name `_` and more says it is unused already; oxlint reports a bare `_`.
  it.each([
    ["_unused", "_unused"],
    ["_", "_props"],
  ])("keeps an object form %s nothing reads as %s", async (name, declared) => {
    const output = await emitSource(
      `export default function Probe(${name}: { tone?: string }) {\n  return <p>Static</p>;\n}\n`,
    );
    expect(component(output)).toBe(
      `export default function Probe(${declared}: { tone?: string }) {\n  return <p>Static</p>;\n}\n`,
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

describe("solid control flow", () => {
  it("shows a branch under its condition with <Show>, by truthiness", async () => {
    const output = await emitSource(
      probe("count: number;", "{ count }", "<p>{count && <b>New</b>}</p>"),
    );
    expect(output).toContain('import { Show } from "solid-js";');
    expect(component(output)).toContain(
      "<p>\n      <Show when={props.count}>\n        <b>New</b>\n      </Show>\n    </p>",
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

// TypeScript narrows what a condition tests inside its branch, in the source and in the targets
// that write the branch inside the test (a ternary, `{#if}`, `@if`). `<Show>`'s and `<Match>`'s
// children are no branch of their condition to it: a branch that reads a binding its tests
// mention reads it through its callback's accessor, not keyed, so the branch keeps its DOM when
// the value changes (ADR-0036 as M2 amends it); one whose expressions narrow it further takes the
// values themselves, keyed (src/narrowing.ts). test/output.test.ts type-checks these shapes, and
// test/rewrites.browser.test.ts updates them.
describe("solid narrowing (TypeScript narrows what a condition tests)", () => {
  const USER = "interface User {\n  name: string;\n  nick?: string;\n  age?: number;\n}\n\n";

  it("gives a branch the value its one test holds, through the callback's accessor", async () => {
    const output = await emitSource(
      probe(
        "user?: User;\n  subtitle?: string;",
        "{ user, subtitle }",
        "<div>{user && <p>{user.name}</p>}{user ? <b title={user.name}>{user.name}</b> : <i>anon</i>}{!user ? <i>anon</i> : <p>{user.name}</p>}{subtitle && <p>{subtitle}</p>}</div>",
        USER,
      ),
    );
    expect(component(output)).toContain(
      [
        "      <Show when={props.user}>{(user) => <p>{user().name}</p>}</Show>",
        "      <Show when={props.user} fallback={<i>anon</i>}>",
        "        {(user) => <b title={user().name}>{user().name}</b>}",
        "      </Show>",
        // A negated test's else shows where its operand holds.
        "      <Show when={props.user} fallback={<i>anon</i>}>",
        "        {(user) => <p>{user().name}</p>}",
        "      </Show>",
        "      <Show when={props.subtitle}>{(subtitle) => <p>{subtitle()}</p>}</Show>",
      ].join("\n"),
    );
  });

  it("reads a value plainly where no test can narrow it: a comparison, a type with no union", async () => {
    const output = await emitSource(
      probe(
        "count: number;\n  tags: string[];\n  tone: Tone;\n  user: User;",
        "{ count, tags, tone, user }",
        '<div>{count > 2 ? <p>{count} items</p> : null}{tags.length === 0 ? <p>No tags</p> : <ul>{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}{tags.length ? <p>{tags.length} tags</p> : null}{user.name === "Ada" ? <p>{user.name}</p> : null}{tone === "info" ? <p>{tone}</p> : null}</div>',
        `type Tone = "info" | "warning";\n\n${USER}`,
      ),
    );
    expect(component(output)).toContain(
      [
        // `>` narrows nothing; a number, an array and its `length`, and an interface's member
        // typed `string` are no union: their tests narrow nothing either.
        "      <Show when={props.count > 2}>",
        "        <p>{props.count} items</p>",
        "      </Show>",
        "      <Show",
        "        when={props.tags.length === 0}",
        "        fallback={",
        "          <ul>",
        "            <For each={props.tags}>{(tag) => <li>{tag}</li>}</For>",
        "          </ul>",
        "        }",
        "      >",
        "        <p>No tags</p>",
        "      </Show>",
        "      <Show when={props.tags.length}>",
        "        <p>{props.tags.length} tags</p>",
        "      </Show>",
        '      <Show when={props.user.name === "Ada"}>',
        "        <p>{props.user.name}</p>",
        "      </Show>",
        // A union of literals is narrowed by a comparison with one of them.
        '      <Show when={props.tone === "info" ? { tone: props.tone } : undefined}>',
        "        {(narrowed) => <p>{narrowed().tone}</p>}",
        "      </Show>",
      ].join("\n"),
    );
  });

  it("reads state plainly where its type has no union, from its argument or initial value", async () => {
    const output = await emitSource(
      [
        'import { computed, ref } from "unframework";',
        "",
        "export default function Probe() {",
        "  const results = ref<string[]>([]);",
        "  const total = computed(() => results.value.length);",
        "  const user = ref<{ name: string } | null>(null);",
        "  return (",
        "    <div>",
        "      {results.value.length > 0 ? <p>{results.value.join()}</p> : <p>None</p>}",
        "      {total.value > 2 ? <p>{total.value} results</p> : null}",
        "      {user.value ? <p>{user.value.name}</p> : null}",
        "    </div>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    expect(component(output)).toContain(
      [
        "      <Show when={results().length > 0} fallback={<p>None</p>}>",
        "        <p>{results().join()}</p>",
        "      </Show>",
        "      <Show when={total() > 2}>",
        "        <p>{total()} results</p>",
        "      </Show>",
        // A nullable state is narrowed by its truthiness.
        "      <Show when={user()}>{(user) => <p>{user().name}</p>}</Show>",
      ].join("\n"),
    );
  });

  it("keeps <Show> and <Switch> plain where no branch reads what its tests mention", async () => {
    const output = await emitSource(
      probe(
        "on: boolean;\n  user?: User;",
        "{ on, user }",
        "<div>{on ? <b>x</b> : user ? <i>user</i> : null}{!user ? null : <b>x</b>}</div>",
        USER,
      ),
    );
    expect(component(output)).toContain("<Match when={props.user}>");
    expect(component(output)).toContain("<Show when={props.user}>");
    expect(output).not.toContain("keyed");
  });

  it("builds an object of what the branch reads inside the source's own condition", async () => {
    const output = await emitSource(
      probe(
        "count?: number;\n  user?: User;\n  label: string;\n  shape: Circle | Square;",
        "{ count, user, label, shape }",
        "<div>{count !== undefined && <b>{count.toFixed(1)}</b>}{label && user && <p>{user.name}</p>}{user?.nick && <p>{user.name} {user.nick.trim()}</p>}<svg>{shape.kind === `circle` && <circle r={shape.r} />}</svg></div>",
        `${USER}interface Circle {\n  kind: "circle";\n  r: number;\n}\n\ninterface Square {\n  kind: "square";\n  side: number;\n}\n\n`,
      ),
    );
    for (const form of [
      "<Show when={props.count !== undefined ? { count: props.count } : undefined}>",
      "{(narrowed) => <b>{narrowed().count.toFixed(1)}</b>}",
      "<Show when={props.label && props.user ? { user: props.user } : undefined}>",
      "{(narrowed) => <p>{narrowed().user.name}</p>}",
      "<Show when={props.user?.nick ? { user: props.user, nick: props.user?.nick } : undefined}>",
      "{narrowed().user.name} {narrowed().nick.trim()}",
      "<Show when={props.shape.kind === `circle` ? { shape: props.shape } : undefined}>",
      "{(narrowed) => <circle r={narrowed().shape.r} />}",
    ]) {
      expect(component(output), form).toContain(form);
    }
  });

  it("writes an else and a chain that need it as <Match>es repeating the chain", async () => {
    const output = await emitSource(
      probe(
        "value: string | number | null;\n  user?: User;\n  note?: string | null;",
        "{ value, user, note }",
        '<div>{typeof value === "string" ? <b>{value.trim()}</b> : value !== null ? <i>{value.toFixed()}</i> : null}{user ? <p>{user.name}</p> : note ? <em>{note.trim()}</em> : <i>none</i>}</div>',
        USER,
      ),
    );
    expect(component(output)).toContain(
      [
        "      <Switch>",
        '        <Match when={typeof props.value === "string" ? { value: props.value } : undefined}>',
        "          {(narrowed) => <b>{narrowed().value.trim()}</b>}",
        "        </Match>",
        "        <Match",
        "          when={",
        '            typeof props.value === "string"',
        "              ? undefined",
        "              : props.value !== null",
        "                ? { value: props.value }",
        "                : undefined",
        "          }",
        "        >",
        "          {(narrowed) => <i>{narrowed().value.toFixed()}</i>}",
        "        </Match>",
        "      </Switch>",
      ].join("\n"),
    );
    expect(component(output)).toContain(
      [
        "      <Switch fallback={<i>none</i>}>",
        "        <Match when={props.user}>{(user) => <p>{user().name}</p>}</Match>",
        "        <Match when={props.user ? undefined : props.note ? { note: props.note } : undefined}>",
        "          {(narrowed) => <em>{narrowed().note.trim()}</em>}",
        "        </Match>",
        "      </Switch>",
      ].join("\n"),
    );
  });

  it("keys a branch whose expressions narrow its value further, nested ones and lists included", async () => {
    const output = await emitSource(
      probe(
        "user?: User;\n  rows: (User | null)[];\n  on: boolean;",
        "{ user, rows, on }",
        '<div>{user && <p title={user.nick ? user.nick.trim() : "none"}>{user.age !== undefined ? user.age.toFixed() : "-"}{on && <b>{user.name}</b>}{user.age !== undefined && <i>{user.age.toFixed()}</i>}</p>}<ul>{rows.map((row, index) => <li key={index}>{row && row.name}</li>)}</ul></div>',
        USER,
      ),
    );
    for (const form of [
      // TypeScript narrows no call: `user().nick ? user().nick.trim()` would fail L4.
      "<Show keyed when={props.user}>",
      '<p title={user.nick ? user.nick.trim() : "none"}>',
      '{user.age !== undefined ? user.age.toFixed() : "-"}',
      "<Show when={props.on}>\n              <b>{user.name}</b>",
      "<Show when={user.age !== undefined ? { age: user.age } : undefined}>",
      "{(narrowed) => <i>{narrowed().age.toFixed()}</i>}",
      // A list's variable taken whole keeps its own name where no client code reads it: every
      // render read of it is the accessor's.
      "<Show when={row}>{(row) => <>{row().name}</>}</Show>",
    ]) {
      expect(component(output), form).toContain(form);
    }
  });

  it("takes only what its tests read where it renders, the rest of the read as written", async () => {
    // The else may render where `box.inner` is absent: the `when` cannot read `box.inner.title`
    // there, so it takes `box.inner`, and the branch reads through `?.` as the source does.
    const output = await emitSource(
      probe(
        "box: { inner?: { title: string; other?: string } };\n  on: boolean;",
        "{ box, on }",
        '<div>{box.inner && box.inner.title.length > 3 ? <p>{box.inner.title}</p> : <p>{box.inner?.title ?? "anon"}</p>}{box.inner?.title === "t" ? <p>{box.inner.other}</p> : <i>{box.inner?.title}</i>}{!box.inner || on ? <i>{box.inner?.title}</i> : <b>{box.inner.title}</b>}</div>',
      ),
    );
    for (const form of [
      "? { title: props.box.inner.title }",
      "{(narrowed) => <p>{narrowed().title}</p>}",
      "props.box.inner && props.box.inner.title.length > 3\n              ? undefined\n              : { inner: props.box.inner }",
      '{(narrowed) => <p>{narrowed().inner?.title ?? "anon"}</p>}',
      '<Match when={props.box.inner?.title === "t" ? { inner: props.box.inner } : undefined}>',
      "{(narrowed) => <p>{narrowed().inner.other}</p>}",
      '<Match when={props.box.inner?.title === "t" ? undefined : { inner: props.box.inner }}>',
      "{(narrowed) => <i>{narrowed().inner?.title}</i>}",
      "<Match when={!props.box.inner || props.on ? undefined : { inner: props.box.inner }}>",
      "{(narrowed) => <b>{narrowed().inner.title}</b>}",
    ]) {
      expect(component(output), form).toContain(form);
    }
    expect(output).not.toContain("? undefined\n              : { title:");
  });

  it("reads the accessor in a list's callback and an arrow in the branch", async () => {
    const output = await emitSource(
      probe(
        "user?: User;\n  items: string[];",
        "{ user, items }",
        '<div>{user && <ul>{items.map((i) => <li key={i}>{user.name}: {i}</li>)}</ul>}{user && <p>{items.map((i) => user.name + i).join(", ")}</p>}</div>',
        USER,
      ),
    );
    expect(component(output)).toContain(
      [
        "      <Show when={props.user}>",
        "        {(user) => (",
        "          <ul>",
        "            <For each={props.items}>",
        "              {(i) => (",
        "                <li>",
        "                  {user().name}: {i}",
        "                </li>",
        "              )}",
        "            </For>",
        "          </ul>",
        "        )}",
        "      </Show>",
        "      <Show when={props.user}>",
        '        {(user) => <p>{props.items.map((i) => user().name + i).join(", ")}</p>}',
        "      </Show>",
      ].join("\n"),
    );
  });

  it("keeps a branch of one interpolation tracked, in a fragment", async () => {
    // Solid calls a function child untracked: a bare `user.name + props.label` would not update
    // when the label changes and the user stays.
    const output = await emitSource(
      probe(
        "user?: User;\n  count?: number;\n  label: string;",
        "{ user, count, label }",
        "<p>{user && user.name + label}{count !== undefined && count.toFixed(1) + label}</p>",
        USER,
      ),
    );
    expect(component(output)).toContain("{(user) => <>{user().name + props.label}</>}");
    expect(component(output)).toContain(
      "{(narrowed) => <>{narrowed().count.toFixed(1) + props.label}</>}",
    );
  });

  it("writes `|| undefined` after a test that is the value, where a type has a falsy literal", async () => {
    // Solid types the value `NonNullable<T>`, which keeps `""` and `0`.
    const output = await emitSource(
      probe(
        'limit: number | "";\n  rows: (0 | { n: number })[];\n  user?: User;',
        "{ limit, rows, user }",
        "<div>{limit && <p>{limit.toFixed(1)}</p>}{!limit ? <i>none</i> : <b>{limit.toFixed(0)}</b>}<ul>{rows.map((row, index) => <li key={index}>{row && <b>{row.n}</b>}</li>)}</ul>{user && <p>{user.name}</p>}</div>",
        USER,
      ),
    );
    for (const form of [
      "<Show when={props.limit || undefined}>",
      "<Show when={props.limit || undefined} fallback={<i>none</i>}>",
      "<Show when={row || undefined}>",
      "<Show when={props.user || undefined}>",
    ]) {
      expect(component(output), form).toContain(form);
    }
    // Without a falsy literal in the props' types, the test as it is.
    const plain = await emitSource(
      probe("limit?: number;", "{ limit }", "<div>{limit && <p>{limit.toFixed(1)}</p>}</div>"),
    );
    expect(component(plain)).toContain("<Show when={props.limit}>");
    // A `false` literal is falsy too.
    const flag = await emitSource(
      probe("user: User | false;", "{ user }", "<div>{user && <p>{user.name}</p>}</div>", USER),
    );
    expect(component(flag)).toContain("<Show when={props.user || undefined}>");
  });

  it('reads a chain `typeof … !== "undefined"` tests to its end', async () => {
    const output = await emitSource(
      probe(
        "box: { inner?: { other?: string } };",
        "{ box }",
        '<div>{typeof box.inner?.other !== "undefined" && <p>{box.inner.other.trim()}</p>}{typeof box.inner?.other === "undefined" ? <i>none</i> : <b>{box.inner.other.trim()}</b>}</div>',
      ),
    );
    expect(component(output)).toContain("? { other: props.box.inner?.other }");
    expect(component(output)).toContain(
      "? undefined\n              : { other: props.box.inner?.other }",
    );
    expect(component(output)).not.toContain("{ inner:");
  });

  it("takes nothing a callback around it gives at more length", async () => {
    // The inner callback would receive `box` for `box.name`, which reads the outer `name`.
    const output = await emitSource(
      probe(
        "box: { name?: string; note?: string };",
        "{ box }",
        "<div>{box.name && <p>{box.name}{box.note && <b>{box.note}{box.name}</b>}</p>}</div>",
      ),
    );
    expect(component(output)).toContain(
      "<Show when={narrowed().box.note}>\n              {(note) => (\n                <b>\n                  {note()}\n                  {narrowed().name}",
    );
  });

  it("reads a computed key of a template literal as a property", async () => {
    const output = await emitSource(
      probe(
        "user: User;",
        "{ user }",
        "<div>{user[`nick`] && <p>{user[`nick`].trim()}</p>}</div>",
        USER,
      ),
    );
    expect(component(output)).toContain(
      "<Show when={props.user[`nick`]}>{(nick) => <p>{nick().trim()}</p>}</Show>",
    );
  });

  it("names a value apart from every name it could capture", async () => {
    // The object form's parameter shares the prop's name; a nested callback takes another path.
    const object = await emitSource(
      `${USER}export default function Probe(user: { user?: User; title: string; data: { user?: User } }) {\n  return <div>{user.user && <p title={user.title}>{user.user.name}</p>}{user.data.user && <p>{user.data.user.name}{user.user && <i>{user.user.name}{user.data.user.name}</i>}</p>}</div>;\n}\n`,
    );
    expect(component(object)).toContain("{(user_1) => <p title={user.title}>{user_1().name}</p>}");
    expect(component(object)).toMatch(
      /\{\(user_2\) => \([\s\S]*\{\(user_3\) => \([\s\S]*\{user_3\(\)\.name\}\s*\{user_2\(\)\.name\}/,
    );
    // A list's variable the value is named after, read inside, and `class`, no parameter's name.
    const list = await emitSource(
      probe(
        "user?: { a?: { n?: number } };\n  items: string[];\n  attrs: { class?: string };",
        "{ user, items, attrs }",
        '<div><ul>{items.map((a) => <li key={a}>{a === "x" && user && user.a && <i title={a}>{String(user.a.n)}</i>}</li>)}</ul>{attrs.class && <b class={attrs.class}>x</b>}</div>',
      ),
    );
    expect(component(list)).toContain("? { a, a_1: props.user.a } : undefined");
    expect(component(list)).toContain(
      "{(narrowed) => <i title={narrowed().a}>{String(narrowed().a_1.n)}</i>}",
    );
    expect(component(list)).toContain("{(value) => <b class={cx(value())}>x</b>}");
  });

  it("takes a method's object, which keeps the method's `this`", async () => {
    const output = await emitSource(
      probe("label: string;", "{ label }", "<div>{label.trim && <p>{label.trim()}</p>}</div>"),
    );
    expect(component(output)).toContain(
      "<Show when={props.label.trim ? { label: props.label } : undefined}>",
    );
    expect(component(output)).toContain("{(narrowed) => <p>{narrowed().label.trim()}</p>}");
  });
});

describe("solid output for its server compiler", () => {
  it("wraps the literals the server would write unescaped in String(…)", async () => {
    const output = await emitSource(
      probe(
        "on: boolean;\n  label: string;",
        "{ on, label }",
        '<p title={on ? \'say "hi"\' : label} data-a={label + " & more"}>\n    {on ? "<b>" : label}\n    {`<${label}>`}\n    {label + "&"}\n    {on ? "plain" : label}\n  </p>',
      ),
    );
    expect(component(output)).toContain(
      [
        `    <p title={props.on ? String('say "hi"') : props.label} data-a={props.label + String(" & more")}>`,
        '      {props.on ? String("<b>") : props.label}',
        "      {String(`<${props.label}>`)}",
        '      {props.label + String("&")}',
        '      {props.on ? "plain" : props.label}',
      ].join("\n"),
    );
  });
});

describe("solid attributes", () => {
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
        "tone?: string;\n  active: boolean;",
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
    expect(component(output)).toContain("<p class={props.attrs.class} title={props.attrs.title}>");
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
    const attrs = 'interface Attrs {\n  id: string;\n  "aria-label"?: string;\n}\n\n';
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
        "<label for={label}>\n    <textarea readonly={locked} maxlength={limit} aria-disabled={locked} />\n  </label>",
      ),
    );
    expect(component(output)).toContain(
      "<textarea readonly={props.locked} maxlength={props.limit} aria-disabled={props.locked} />",
    );
    expect(component(output)).toContain("<label for={props.label}>");
  });

  it("spreads the attributes Solid's types lack on an element, as Solid renders them alike", async () => {
    const output = await emitSource(
      probe(
        "colour: string;\n  order: number;",
        "{ colour, order }",
        '<div>\n    <svg viewBox="0 0 8 8" role="img">\n      <title>Fill</title>\n      <linearGradient id="g" opacity="0.5">\n        <stop offset="0" fill={colour} />\n        <stop fill="white" />\n      </linearGradient>\n      <path id="p" d="M0 0h8" />\n      <mpath href="#p" />\n    </svg>\n    <dialog open tabindex={order}>Hi</dialog>\n  </div>',
      ),
    );
    // A plain spread beside props the type declares, or children; alone, or where the type
    // forbids the attribute (`tabindex` on <dialog>), from an object typed as any record.
    expect(component(output)).toContain('<linearGradient id="g" {...{ opacity: "0.5" }}>');
    expect(component(output)).toContain('<stop offset="0" {...{ fill: props.colour }} />');
    expect(component(output)).toContain(
      '<stop {...({ fill: "white" } as Record<string, unknown>)} />',
    );
    expect(component(output)).toContain(
      '<mpath {...({ href: "#p" } as Record<string, unknown>)} />',
    );
    expect(component(output)).toContain(
      "<dialog open {...({ tabindex: props.order } as Record<string, unknown>)}>",
    );
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
    expect(component(output)).toContain(
      '<circle cx="4" cy="4" r="3" stroke-width={props.width} />',
    );
  });
});
