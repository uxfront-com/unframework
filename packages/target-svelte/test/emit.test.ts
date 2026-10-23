import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { indent } from "../src/script.ts";
import { renderToString } from "../src/toolchain/server.ts";
import {
  corpus,
  emitFormatted,
  emitSource,
  importScratch,
  packageDir,
  removeScratch,
} from "./helpers.ts";
import { SHAPES } from "./shapes.ts";

afterAll(removeScratch);

const at = { start: 0, end: 0 };

function emit(kind: "default" | "named" = "default") {
  const render = createElement(
    "p",
    [createStaticAttribute("class", "greeting", at)],
    [createText("Hello, world!", at)],
    at,
  );
  const component = createComponent("Hello", render, at);
  const module = createModule("Hello.uf.tsx", [component], [createExport(kind, "Hello", at)]);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  return { files: target.emit(component, context), reported };
}

const OPTIONS = "<svelte:options runes={true} preserveWhitespace={false} />";

/** A Svelte file: the options, then each block, a blank line between them. */
const svelteFile = (...blocks: string[]) => `${[OPTIONS, ...blocks].join("\n\n")}\n`;

/** A `<script lang="ts">` block holding these lines. */
const script = (...lines: string[]) => `<script lang="ts">\n${lines.join("\n")}\n</script>`;

/** The lines that end the script of a component whose root takes its styled parents' scope. */
const SCOPE_HELPER = [
  "",
  "  /** The scope attributes of the styled parents that render this component, for its root. */",
  '  function scopeAttributes(props: object): Record<string, ""> {',
  '    const scope: Record<string, ""> = {};',
  '    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";',
  "    return scope;",
  "  }",
];

describe("svelte target", () => {
  it("declares every capability, natively but for once listeners, fallthrough, model modifiers, reactive context, the child root and a style bound to a value", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "attribute-spread",
      "bound-attribute",
      "child-root-scope",
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
      "scoped-styles",
      "sheet-order",
      "slot-fallback",
      "slot-forwarding",
      "slotted-styles",
      "static-attribute",
      "style-binding",
      "svg",
      "text",
      "two-way-binding",
      "use-id",
    ]);
    const helpers: Readonly<Record<string, string>> = {
      "child-root-scope": "scopeAttributes",
      "event-once": "once",
      fallthrough: "mergeStyle",
      "model-modifiers": "modelText",
      "reactive-context": "refObject",
      "style-binding": "styleText",
    };
    for (const [name, cell] of Object.entries(target.capabilities)) {
      const helper = helpers[name];
      if (helper) expect(cell).toMatchObject({ support: "emulated", helper });
      else expect(cell).toEqual({ support: "native" });
    }
  });

  it("emits one runes-mode component per file, which pins the whitespace it is printed for", () => {
    const { files, reported } = emit();
    expect(reported).toEqual([]);
    expect(files).toEqual([
      {
        path: "Hello.svelte",
        contents: [
          "<svelte:options runes={true} preserveWhitespace={false} />",
          "",
          '<script lang="ts">',
          '  import type { ClassValue } from "svelte/elements";',
          "",
          "  type Props = {",
          "    class?: ClassValue;",
          "    style?: string;",
          "  };",
          "",
          "  let { class: className, style, ...attributes }: Props = $props();",
          ...SCOPE_HELPER,
          "</script>",
          "",
          '<p class={["greeting", className]} {style} {...scopeAttributes(attributes)}>Hello, world!</p>',
          "",
        ].join("\n"),
      },
    ]);
  });

  it("emits the same file for a named export", () => {
    expect(emit("named").files).toEqual(emit("default").files);
  });

  const cases = corpus();

  it("has corpus cases to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  // Without the declaration, Svelte compiles a component that uses no runes in legacy mode.
  // One test per case, so no test's time grows with the corpus. As one test over the cases M2
  // left, it took 0.6 s alone on a laptop and overran Vitest's 5 s default in CI's Unit tests.
  it.each(cases)("compiles $name in runes mode", async ({ name, modules }) => {
    for (const file of (await Promise.all(modules.map(emitFormatted))).flat()) {
      const { metadata, js } = compile(file.contents, { filename: file.path });
      expect(metadata.runes, name).toBe(true);
      expect(js.code, name).not.toContain("svelte/internal/flags/legacy");
    }
  });

  it("adds no text before the markup", async () => {
    const [file] = emit().files;
    const { js } = compile(file!.contents, { filename: file!.path, generate: "server" });
    expect(js.code).toMatch(/\$\$renderer\.push\(`<p\b/);
  });
});

// The instance script declares the copied types and reads the props with `$props()`.
describe("svelte props", () => {
  it("destructures the props it reads, in source order, with their defaults as written", async () => {
    // `count` and `hidden` are read by no expression: declared, they would be unused variables.
    expect((await emitSource(SHAPES.destructured)).contents).toBe(
      svelteFile(
        script(
          '  import type { ClassValue } from "svelte/elements";',
          "",
          '  type Tone = "info" | "warn";',
          "",
          "  export interface BadgeProps {",
          "    label: string;",
          "    tone?: Tone;",
          "    count?: number;",
          "    hidden?: boolean;",
          "  }",
          "",
          "  type Props = BadgeProps & {",
          "    class?: ClassValue;",
          "    style?: string;",
          "  };",
          "",
          '  let { tone = "info", label, class: className, style, ...attributes }: Props = $props();',
          ...SCOPE_HELPER,
        ),
        "<p class={[tone, className]} {style} {...scopeAttributes(attributes)}>{label}</p>",
      ),
    );
  });

  it("keeps the props object and its reads in the object form", async () => {
    expect((await emitSource(SHAPES.objectForm)).contents).toBe(
      svelteFile(
        script(
          '  import type { ClassValue } from "svelte/elements";',
          "",
          "  interface CardProps {",
          "    title: string;",
          "    subtitle?: string;",
          "  }",
          "",
          "  type Props = CardProps & {",
          "    class?: ClassValue;",
          "    style?: string;",
          "  };",
          "",
          "  let { class: className, style, ...p }: Props = $props();",
          ...SCOPE_HELPER,
        ),
        "<h2 title={p.subtitle} class={className} {style} {...scopeAttributes(p)}>{p.title}</h2>",
      ),
    );
  });

  // Svelte reserves the `$` prefix: `let $: P = $props()` is `dollar_prefix_invalid`.
  it("names a props object `props` where Svelte reserves the source's name", async () => {
    expect((await emitSource(SHAPES.reservedName)).contents).toBe(
      svelteFile(
        script(
          '  import type { ClassValue } from "svelte/elements";',
          "",
          "  type Props = {",
          "    title: string;",
          "    class?: ClassValue;",
          "    style?: string;",
          "  };",
          "",
          "  let { class: className, style, ...props }: Props = $props();",
          ...SCOPE_HELPER,
        ),
        "<h2 class={className} {style} {...scopeAttributes(props)}>{props.title}</h2>",
      ),
    );
  });

  // An empty pattern (`let {}: P`) is `no-empty-pattern` (L5).
  it("declares props it never reads under the object form, keeping the props type", async () => {
    expect((await emitSource(SHAPES.unread)).contents).toBe(
      svelteFile(script("  let _props: { label?: string } = $props();"), "<p>Hi</p\n><p>Bye</p>"),
    );
  });

  // An unread binding is `no-unused-vars` (L5); a name starting with `_` says it is unused on
  // purpose, and a `$` would be a rune's.
  it.each([
    ["props", "_props"],
    ["$p", "_p"],
    ["_props", "_props"],
    ["_", "__"],
  ])("names an object form %s that nothing reads %s", async (name, declared) => {
    // A root of several nodes takes no fallthrough (ADR-0054) and no scope attributes
    // (ADR-0063), so nothing else is bound.
    const source = `export default function Hi(${name}: { label?: string }) {\n  return <><p>Hi</p><p>Bye</p></>;\n}`;
    expect((await emitSource(source)).contents).toBe(
      svelteFile(
        script(`  let ${declared}: { label?: string } = $props();`),
        "<p>Hi</p\n><p>Bye</p>",
      ),
    );
  });

  it("indents the script but for the lines inside a literal, whose value it would change", async () => {
    expect((await emitSource(SHAPES.multiline)).contents).toBe(
      svelteFile(
        script(
          '  import type { ClassValue } from "svelte/elements";',
          "",
          "  type Props = {",
          "    text?: string; note?: string;",
          "    class?: ClassValue;",
          "    style?: string;",
          "  };",
          "",
          "  let { text = `roses",
          '  are red`, note = "a\\',
          '  b", class: className, style, ...attributes }: Props = $props();',
          ...SCOPE_HELPER,
        ),
        "<pre class={className} {style} {...scopeAttributes(attributes)}>{text}{note}</pre>",
      ),
    );
  });

  it.each([
    { what: "a line comment", code: "a; // it's\nb", expected: "  a; // it's\n  b" },
    { what: "a block comment", code: '/* "\n*/ a', expected: '  /* "\n  */ a' },
    { what: "an escaped quote", code: '"a\\"\nb"', expected: '  "a\\"\nb"' },
    {
      what: "a template's substitutions",
      code: 'type T = `${"}"}\n${{ a: "`" }["a"]}`\nx',
      expected: '  type T = `${"}"}\n${{ a: "`" }["a"]}`\n  x',
    },
    { what: "a nested template", code: "`${`\n`}\n`\nx", expected: "  `${`\n`}\n`\n  x" },
  ])("tells a literal's lines from code's, past $what", ({ code, expected }) => {
    expect(indent(code, "  ")).toBe(expected);
  });
});

/** The markup of a shape's output: what follows the script. */
async function markupOf(source: string): Promise<string> {
  return (await emitSource(source)).contents.split("</script>\n\n")[1]!;
}

// Blocks, bindings and spreads, laid out so no whitespace reaches the DOM (ADR-0026).
describe("svelte markup", () => {
  it("prints a keyed each block, without the index no expression reads, and an if block", async () => {
    expect(await markupOf(SHAPES.lists)).toBe(
      [
        "<ul class={className} {style} {...scopeAttributes(attributes)}>",
        "  {#each items as item (item.id)}",
        "    <li>{item.name}</li>",
        "  {/each}{#if items.length === 0}",
        "    <li>{empty}</li>",
        "  {/if}",
        "</ul>",
        "",
      ].join("\n"),
    );
  });

  // Never `class:` directives, which remove a token a dynamic part produces (ADR-0038); never
  // `style={{…}}`, which Svelte renders as `[object Object]`.
  it("prints bindings, one class, style directives and spreads key by key", async () => {
    expect(await markupOf(SHAPES.bindings)).toBe(
      [
        "<p class={className} {style} {...scopeAttributes(attributes)}>",
        "  <a",
        "    {href}",
        '    class={["link", { active }, tone, attrs.class]}',
        "    style:color",
        "    style:margin-top={gap}",
        '    style:display="block"',
        "    title={attrs.title}",
        "  >a</a",
        "  ><a",
        '    href="/b"',
        "    class={[{ active }, extra?.class]}",
        '    style:display="block"',
        "    style:--gap={gap}",
        "    title={extra?.title}",
        "  >b</a",
        '  ><b class={tone} title={tone ?? "none"} style="display: block">c</b>',
        "</p>",
        "",
      ].join("\n"),
    );
  });

  // svelte-check rejects an attribute `svelte/elements` does not declare on its element, written
  // or bound; an object spread renders it alike and is not checked for excess properties.
  it("writes an attribute Svelte's types lack on its element as an object spread", async () => {
    expect(await markupOf(SHAPES.untyped)).toBe(
      [
        '<form aria-label="Note" class={className} {style} {...scopeAttributes(attributes)}>',
        '  <p {...{ autocorrect: "off" }}>a</p',
        "  ><input autocorrect={mode}",
        "  /><div {...{ autocorrect: hints.autocorrect }}>b</div>",
        "</form>",
        "",
      ].join("\n"),
    );
  });

  // Svelte's server renders every `style:` directive, and every attribute of an `<option>` or
  // of an element with a spread, through its runtime, which escaped their static text twice
  // and folded a style's whitespace; it folds a static `style`'s whitespace too (5.57). Its
  // client does neither, so that text is an expression, which both render as written.
  it("writes static text Svelte's server would escape twice or fold as expressions", async () => {
    expect(await markupOf(SHAPES.runtimeText)).toBe(
      [
        "<div class={className} {style} {...scopeAttributes(attributes)}>",
        "  <blockquote",
        '    style:font-family={"\\"Segoe UI\\", serif"}',
        `    style:content={"'a  b'"}`,
        "    style:color={tone}",
        "  >q</blockquote",
        "  ><p",
        '    {...{ autocorrect: "off" }}',
        '    title={"Name \\u0026 \\"title\\" \\u003cx\\u003e"}',
        '    class={"q\\u0026r"}',
        '    style={"content: \\"\\u0026\\""}',
        "  >c</p",
        '  ><select aria-label="Pick">',
        '    <option value={"a \\u0026 \\"b\\""}>a</option>',
        "  </select",
        `  ><p style={"content: 'a  b'; color: red"}>p</p>`,
        "</div>",
        "",
      ].join("\n"),
    );
  });

  it("renders that text on the server escaped once, with its whitespace", async () => {
    const { path, contents } = await emitSource(SHAPES.runtimeText);
    const { js } = compile(contents, { filename: path, generate: "server" });
    const module = await importScratch<{ default: Component }>("Quote.js", js.code);
    expect(await renderToString(module.default, { props: { tone: "red" } })).toBe(
      [
        '<!--[--><div class="">',
        `<blockquote style="font-family: &quot;Segoe UI&quot;, serif; content: 'a  b'; color: red;">q</blockquote>`,
        '<p autocorrect="off" title="Name &amp; &quot;title&quot; &lt;x>" class="q&amp;r" style="content: &quot;&amp;&quot;">c</p>',
        '<select aria-label="Pick"><option value="a &amp; &quot;b&quot;">a</option></select>',
        `<p style="content: 'a  b'; color: red">p</p>`,
        "</div><!--]-->",
      ].join(""),
    );
  });

  // Svelte's client sets a bound `value` with `set_value`, which writes nothing while the
  // element's own `value` already holds it (0 on an `<li>` or a `<meter>`, "" on a `<button>`):
  // an object spread assigns it on every render. The fixture is this output, which
  // assigned-values.browser.test.ts mounts.
  it("writes a bound value Svelte would skip writing as an object spread", async () => {
    const { contents } = await emitSource(SHAPES.assignedValues);
    expect(contents).toBe(readFileSync(join(packageDir, "test/fixtures/Steps.svelte"), "utf8"));
    expect(await markupOf(SHAPES.assignedValues)).toBe(
      [
        "<form class={className} {style} {...scopeAttributes(attributes)}>",
        "  <ol>",
        "    {#each steps as step, index (step)}",
        "      <li {...{ value: steps.length - 1 - index }}>{step}</li>",
        "    {/each}",
        "  </ol",
        '  ><meter min="0" max="10" {...{ value: score }} title={"Score \\u0026 \\"rank\\""}>m</meter',
        '  ><progress max="10" value={score}>p</progress><data {...{ value: label }}>d</data',
        '  ><button type="button" {...{ value: label }}>b</button',
        '  ><input type="checkbox" name="c" {...{ value: mode }} />',
        "</form>",
        "",
      ].join("\n"),
    );
  });

  it("renders those values on the server, the element's own defaults included", async () => {
    const { path, contents } = await emitSource(SHAPES.assignedValues);
    const { js } = compile(contents, { filename: path, generate: "server" });
    const module = await importScratch<{ default: Component }>("Steps.js", js.code);
    const render = (props: Record<string, unknown>) => renderToString(module.default, { props });
    expect(await render({ steps: ["a", "b", "c"], score: 0, label: "", mode: "on" })).toBe(
      [
        '<!--[--><form class=""><ol><!--[-->',
        '<li value="2">a</li><li value="1">b</li><li value="0">c</li>',
        '<!--]--></ol><meter min="0" max="10" value="0" title="Score &amp; &quot;rank&quot;">m</meter>',
        '<progress max="10" value="0">p</progress><data value="">d</data>',
        '<button type="button" value="">b</button><input type="checkbox" name="c" value="on"/>',
        "</form><!--]-->",
      ].join(""),
    );
    expect(await render({ steps: ["a"], score: 7, label: "x", mode: "m" })).toBe(
      [
        '<!--[--><form class=""><ol><!--[--><li value="0">a</li><!--]--></ol>',
        '<meter min="0" max="10" value="7" title="Score &amp; &quot;rank&quot;">m</meter>',
        '<progress max="10" value="7">p</progress><data value="x">d</data>',
        '<button type="button" value="x">b</button><input type="checkbox" name="c" value="m"/>',
        "</form><!--]-->",
      ].join(""),
    );
  });

  // Svelte tells SVG elements from HTML ones by name, and warns on `<title />`
  // (`element_invalid_self_closing_tag`), whose name is HTML's too.
  it("closes childless SVG elements, but for a `<title>`, and keeps a root fragment's text", async () => {
    expect(await markupOf(SHAPES.svgAndFragment)).toBe(
      [
        '<svg viewBox="0 0 2 2">',
        "  <title></title",
        '  ><circle cx="1" cy="1" {r} />',
        "</svg",
        ">{#if label}<p>{label}</p>{/if} tail",
        "",
      ].join("\n"),
    );
  });

  it.each(Object.entries(SHAPES))(
    "emits %s so Svelte compiles it without a warning, formatted or not",
    async (_, source) => {
      for (const format of [false, true]) {
        const { path, contents } = await emitSource(source, { format });
        for (const generate of ["client", "server"] as const) {
          const { warnings } = compile(contents, { filename: path, generate });
          expect(warnings.map(({ code }) => code)).toEqual([]);
        }
      }
    },
  );
});

/** The script block of a source's output, without its tags. */
async function scriptOf(source: string): Promise<string> {
  const { contents } = await emitSource(source);
  return contents.slice(
    contents.indexOf('<script lang="ts">\n') + 19,
    contents.indexOf("\n</script>"),
  );
}

// ADR-0045 to ADR-0049: the setup in source order, as runes; listeners, template refs and ids. The
// fixtures are this output, which behaviour.browser.test.ts mounts.
describe("svelte setup", () => {
  it.each([
    ["state", "Stepper"],
    ["watchers", "Pager"],
    ["effects", "Ticker"],
    ["listeners", "Panel"],
    ["refs", "Disclosure"],
    ["objectEvents", "Chip"],
    ["watchEdges", "WatchEdges"],
    ["teardown", "Closing"],
  ] as const)("emits the %s shape as test/fixtures/%s.svelte", async (shape, name) => {
    const { path, contents } = await emitSource(SHAPES[shape]);
    expect(path).toBe(`${name}.svelte`);
    expect(contents).toBe(readFileSync(join(packageDir, `test/fixtures/${name}.svelte`), "utf8"));
  });

  // `$state` proxies an object deeply; state is replaced whole (ADR-0008), so anything not
  // known to be a primitive is raw, which keeps the source's own object.
  it.each([
    ["ref(0)", "$state(0)"],
    ['ref("a")', '$state("a")'],
    ["ref(-1 + 2)", "$state(-1 + 2)"],
    ["ref(`a${1}`)", "$state(`a${1}`)"],
    ["ref<number>()", "$state<number>()"],
    ['ref<"a" | "b" | undefined>()', '$state<"a" | "b" | undefined>()'],
    ['ref<Mode>("on")', '$state<Mode>("on")'],
    ["ref(mode)", "$state(untrack(() => mode))"],
    ["ref(LIMIT)", "$state(LIMIT)"],
    ["ref<string[]>([])", "$state.raw<string[]>([])"],
    ["ref({ a: 1 })", "$state.raw({ a: 1 })"],
    ["ref(item)", "$state.raw(untrack(() => item))"],
    ["ref<Item>()", "$state.raw<Item>()"],
    [
      'ref(mode === "on" ? item : undefined)',
      '$state.raw(untrack(() => mode === "on" ? item : undefined))',
    ],
    // A call, by its function's declared return type.
    ["ref(label())", "$state(label())"],
    ["ref(first())", "$state.raw(first())"],
    // Built-ins by what they return, and a `computed` by its getter's value.
    ["ref(Math.round(LIMIT * 100))", "$state(Math.round(LIMIT * 100))"],
    ["ref(Number(title))", "$state(untrack(() => Number(title)))"],
    ["ref(items.length)", "$state(untrack(() => items.length))"],
    ["ref(title.trim())", "$state(untrack(() => title.trim()))"],
    ["ref(title.slice(1))", "$state(untrack(() => title.slice(1)))"],
    ["ref(LIMIT.toFixed(2))", "$state(LIMIT.toFixed(2))"],
    ["ref(items.includes(item))", "$state(untrack(() => items.includes(item)))"],
    ["ref(doubled.value)", "$state(untrack(() => doubled))"],
    ["ref(tier.value)", "$state(untrack(() => tier))"],
    ["ref(firstItem.value)", "$state.raw(untrack(() => firstItem))"],
    ["ref(items.slice(1))", "$state.raw(untrack(() => items.slice(1)))"],
    ['ref(title.split(","))', '$state.raw(untrack(() => title.split(",")))'],
  ])("declares %s as %s", async (written, declared) => {
    const source = [
      'import { computed, ref } from "unframework";',
      "",
      'type Mode = "on" | "off";',
      "",
      "interface Item {",
      "  id: string;",
      "}",
      "",
      "export default function Probe({",
      "  mode,",
      "  item,",
      "  title,",
      "  items,",
      "}: { mode: Mode; item: Item; title: string; items: Item[] }) {",
      "  const LIMIT = 3;",
      "  function label(): string {",
      "    return `${LIMIT}`;",
      "  }",
      "  function first(): Item {",
      "    return { id: `${LIMIT}` };",
      "  }",
      "  const doubled = computed(() => LIMIT * 2);",
      "  const tier = computed(() => {",
      '    if (title.length > 10) return "long";',
      '    return "short";',
      "  });",
      "  const firstItem = computed(() => ({ id: title }));",
      `  const value = ${written};`,
      "  return (",
      "    <p>",
      "      {String(value.value)}{mode}{item.id}{label()}{first().id}{title}{items.length}",
      "      {doubled.value}{tier.value}{firstItem.value.id}",
      "    </p>",
      "  );",
      "}",
    ].join("\n");
    expect(await scriptOf(source)).toContain(`let value = ${declared};`);
  });

  it("reads props and state at the top of the script once, through untrack", async () => {
    const code = await scriptOf(SHAPES.state);
    expect(code).toContain('import { untrack } from "svelte";');
    expect(code).toContain("let count = $state(untrack(() => initial));");
    // A getter reads them inside a function: no untrack.
    expect(code).toContain("const doubled = $derived(count * 2);");
  });

  it("joins the events' callback props to the props type and destructures those it calls", async () => {
    const code = await scriptOf(SHAPES.watchers);
    expect(code).toContain("onresize?: (value: number, previous?: number) => void;");
    expect(code).toContain(
      "let { size, onturn, onleft, onspan, onrange, onresize, class: className, style, ...attributes }: Props = $props();",
    );
  });

  it("calls a callback prop through the props object in the object form", async () => {
    expect(await markupOf(SHAPES.objectEvents)).toBe(
      [
        "<button",
        '  type="button"',
        "  onclick={() => props.onremove?.(props.label)}",
        "  class={className}",
        "  {style}",
        "  {...scopeAttributes(props)}",
        ">{props.label}</button>",
        "",
      ].join("\n"),
    );
  });

  // `props_duplicate`: one `$props.id()` per component, on a declaration of its own. Each id has
  // a suffix of its own, so the source's `${fieldId}-1` never spells `panelId`.
  it("takes one id from $props.id() and derives every id from it with a suffix", async () => {
    const code = await scriptOf(SHAPES.refs);
    expect(code.match(/\$props\.id\(\)/g)).toHaveLength(1);
    expect(code).toContain(
      [
        "const uid = $props.id();",
        "  const fieldId = `uf-id-${uid}-0`;",
        "  const panelId = `uf-id-${uid}-1`;",
      ].join("\n"),
    );
  });

  // `non_reactive_update`: an element a condition renders changes after the first render. Either
  // way the ref holds `null` until its element is there and again once it is removed (`bind:this`
  // sets `null`), as the source's `T | null` says, so a read kept as `T | null` type-checks.
  it("declares a template ref `T | null`, with $state only where a condition renders its element", async () => {
    const code = await scriptOf(SHAPES.refs);
    expect(code).toContain("let field: HTMLInputElement | null = null;");
    expect(code).toContain("let panel = $state<HTMLUListElement | null>(null);");
    expect(code).toContain("const input: HTMLInputElement | null = field;");
    expect(code).toContain("shown = panel;");
  });

  it("declares an untyped template ref `unknown`, holding null", async () => {
    const code = await scriptOf(
      [
        'import { onMounted, useTemplateRef } from "unframework";',
        "",
        "export default function Plain() {",
        "  const box = useTemplateRef();",
        "  onMounted(() => {",
        "    console.log(box.value);",
        "  });",
        "  return <p ref={box}>Box</p>;",
        "}",
      ].join("\n"),
    );
    expect(code).toContain("let box: unknown = null;");
  });

  it("writes the listeners Svelte has no attribute for as attachments, in the source's order", async () => {
    const markup = await markupOf(SHAPES.listeners);
    expect(markup).toContain('onclickcapture={() => record("capture")}');
    expect(markup).toContain(
      [
        '    {@attach (node) => on(node, "click", pressed)}',
        '    {@attach (node) => on(node, "click", once(() => record("once")))}',
      ].join("\n"),
    );
    expect(markup).toContain(
      '<section role="presentation" {@attach (node) => on(node, "click", once(() => record("claimed")))}>',
    );
    expect(markup).toContain('{@attach (node) => on(node, "touchstart", () => record("touch"))}');
    expect(markup).toContain(
      '{@attach (node) => on(node, "wheel", (event) => record(`wheel ${event.deltaY}`), { passive: true })}',
    );
    expect(markup).toContain(
      '{@attach (node) => on(node, "animationcancel", () => record("cancelled"))}',
    );
  });

  // svelte-check: `oninput` hands its handler an `Event`, `onclick` a `MouseEvent`.
  it("annotates a handler's event with what Svelte's types hand it", async () => {
    const code = await scriptOf(SHAPES.listeners);
    expect(code).toContain("function updateDraft(event: Event) {");
    expect(code).toContain("function pressed(event: MouseEvent) {");
  });

  // A union keeps its members where each event the parameter receives extends one of them, and
  // takes the nearest interface they all extend where one does not (`oninput` hands an `Event`).
  it("keeps a union event parameter Svelte's events fit, and widens one they do not", async () => {
    const { contents } = await emitSource(SHAPES.unionEvents);
    expect(contents).toContain("function activate(event: MouseEvent | KeyboardEvent) {");
    expect(contents).toContain("function edited(event: Event) {");
    expect(contents).toContain("oninput={(event: Event) => onactivated?.(event.type)}");
  });

  // `on` runs the handlers Svelte delegated below its element inside its own listener, so
  // `{ once: true }` would be used up by a click one of them stopped: the `once` helper's guard is
  // set only when the handler runs (Svelte's migration guide writes `once` as such a wrapper).
  it("guards a once listener with the once helper, never the option", async () => {
    const code = await scriptOf(SHAPES.listeners);
    expect(code).toContain(
      [
        "function once<E extends Event>(handler: (event: E) => unknown): (event: E) => void {",
        "    let ran = false;",
        "    return (event) => {",
        "      if (ran) return;",
        "      ran = true;",
        "      handler(event);",
        "    };",
        "  }",
      ].join("\n"),
    );
    expect(await markupOf(SHAPES.listeners)).not.toContain("once: true");
  });

  // ADR-0048: an immediate array watcher's first call has `[]` for its previous value. An array
  // source's values are a mutable tuple, which a callback may annotate as Vue types them.
  it("starts an immediate array watcher's previous value empty", async () => {
    const code = await scriptOf(SHAPES.watchEdges);
    expect(code).toContain("let previousAB = untrack((): [typeof a, typeof b] => [a, b]);");
    expect(code).toContain("const values: [typeof a, typeof b] = [a, b];");
    expect(code).toContain(
      "const [before]: [number | undefined, number | undefined] = (aBWatched ? previousAB : []) as [typeof a | undefined, typeof b | undefined];",
    );
    expect(code).toContain("const [first, second]: [number, number] = values;");
  });

  // At the top of the script, `typeof open` reads `false` after `let open = $state(false)`,
  // where the effect reads `boolean` (svelte-check TS2322): a source's type is queried inside a
  // function only, and an immediate watcher's previous value starts as the source's.
  it("never queries a source's type at the top of the script", async () => {
    const code = await scriptOf(SHAPES.flagWatchers);
    expect(code).toContain(
      [
        "  let previousOpen = untrack(() => open);",
        "  let openWatched = false;",
        "  $effect.pre(() => {",
        "    const value = open;",
        "    if (openWatched && Object.is(value, previousOpen)) return;",
        "    const previous = openWatched ? previousOpen : undefined;",
        "    openWatched = true;",
        "    previousOpen = value;",
      ].join("\n"),
    );
    expect(code).toContain(
      "let previousLabelLoading = untrack((): [typeof label, typeof loading] => [label, loading]);",
    );
    expect(code).toContain("const previous = valuesWatched ? previousValues : [];");
    const topLevel = code.split("\n").filter((line) => /^ {2}(?:let|const) /.test(line));
    expect(topLevel.length).toBeGreaterThan(5);
    expect(topLevel.filter((line) => /^ {2}(?:let|const) [\w$]+: [^=]*typeof /.test(line))).toEqual(
      [],
    );
  });

  it("types a watcher's array source as a mutable tuple, never as const", async () => {
    const code = await scriptOf(SHAPES.watchers);
    expect(code).toContain(
      "let previousLowHigh = untrack((): [typeof low, typeof high] => [low, high]);",
    );
    expect(code).toContain("const values: [typeof low, typeof high] = [low, high];");
    expect(code).toContain("const [first, last]: [number, number] = values;");
    expect(code).not.toContain("as const");
  });

  // Svelte runs the function an effect returns as its teardown, before the next run and at
  // unmount: every way out returns the one that runs what the effect registered.
  it("returns an effect's teardown from every way out of it", async () => {
    const code = await scriptOf(SHAPES.effectReturns);
    expect(code).toContain('    if (text === "") return cleanUp;');
    expect(code).toMatch(/onseen\?\.\(text\);\n {4}return cleanUp;\n {2}\}\);/);
  });

  // Vue drops what `watchEffect` and `onMounted` return; Svelte would call a returned function
  // as a teardown.
  it("drops the value an effect or a synchronous onMounted returns", async () => {
    const code = await scriptOf(SHAPES.effectReturns);
    expect(code).not.toContain("return () =>");
    expect(code).toContain('    if (name === "") {\n      return;\n    }');
  });

  // Svelte reads the markup's code as TypeScript only in a component with a TypeScript script.
  it("declares an empty TypeScript script for a handler's cast in a component without one", async () => {
    const { contents } = await emitSource(SHAPES.typedMarkup);
    expect(contents).toContain('<script lang="ts"></script>');
  });
});

/** What the target emits for a corpus case's sources, by file name. */
async function caseOutputs(name: string): Promise<Record<string, string>> {
  const found = corpus().find((each) => each.name === name);
  if (!found) throw new Error(`no corpus case ${name}`);
  const files = (await Promise.all(found.modules.map(emitFormatted))).flat();
  return Object.fromEntries(files.map((file) => [file.path, file.contents]));
}

// ADR-0053 to ADR-0055: composition, from the corpus's IR, whose parents read their children's
// API through the resolver.
describe("svelte composition", () => {
  it("imports a child's file and passes it props and callback props", async () => {
    const { "Form.svelte": form } = await caseOutputs("components/props-and-events");
    expect(form).toContain('import Field from "./Field.svelte";');
    expect(form).toContain('<Field label="Street" onclear={clear}');
    expect(form).toContain(
      '<Field label={city} tone="warn" onclear={(label) => clear(label.toUpperCase())}',
    );
  });

  it("passes slots as snippets, renders them with their fallback, and tests their presence", async () => {
    const {
      "Box.svelte": box,
      "Frame.svelte": frame,
      "Gallery.svelte": gallery,
    } = await caseOutputs("slots/forwarding");
    expect(box).toContain("title?: Snippet;");
    expect(box).toContain("{#if title}{@render title()}{:else}Untitled{/if}");
    // Forwarding passes the parent's own snippets on, so the child sees what the parent got.
    expect(frame).toContain("<Box {children} {title} />");
    expect(gallery).toContain("{#snippet title()}Sunset{/snippet}");
    const { "Card.svelte": card } = await caseOutputs("slots/presence");
    expect(card).toContain("{#if title}");
  });

  it("names a slot's snippet apart from a source name its prop would capture", async () => {
    const { "List.svelte": list } = await caseOutputs("slots/scoped");
    expect(list).toContain("item: itemSnippet,");
    expect(list).toContain("{@render itemSnippet?.({ item, index })}");
  });

  it("writes the default slot's content between the tags beside named snippets", async () => {
    const { "Post.svelte": post } = await caseOutputs("slots/named");
    expect(post).not.toContain("{#snippet children()}");
    expect(post).toContain("{#snippet header()}");
  });

  it("declares a model $bindable and binds it from a parent", async () => {
    const { "Stepper.svelte": stepper, "Order.svelte": order } =
      await caseOutputs("models/component");
    expect(stepper).toContain("value = $bindable(0)");
    expect(stepper).toContain("value?: number;");
    expect(order).toContain("bind:value={cups}");
  });

  it("binds native controls, and modified or number fields through modelText", async () => {
    expect((await caseOutputs("models/checkbox-group"))["Drinks.svelte"]).toContain(
      "bind:group={drinks}",
    );
    const profile = (await caseOutputs("models/modifiers"))["Profile.svelte"]!;
    expect(profile).toContain("function modelText<T>(");
    expect(profile).toContain(
      "{@attach modelText(() => name, (value) => (name = value), { trim: true })}",
    );
    expect(profile).toContain("value={untrack(() => name)}");
  });

  it("declares a module's keys in <script module>, provides and injects them", async () => {
    const outputs = await caseOutputs("context/static");
    expect(outputs["ThemeProvider.svelte"]).toContain('<script lang="ts" module>');
    expect(outputs["ThemeProvider.svelte"]).toContain(
      'export const ThemeKey = Symbol("uf.theme") as symbol & { readonly __value: Theme };',
    );
    expect(outputs["ThemeProvider.svelte"]).toContain("setContext(ThemeKey, {");
    expect(outputs["Badge.svelte"]).toContain('import { ThemeKey } from "./ThemeProvider.svelte";');
    expect(outputs["Badge.svelte"]).toContain(
      'getContext<(typeof ThemeKey)["__value"] | undefined>(ThemeKey)',
    );
  });

  it("provides a ref through refObject, and falls back to one", async () => {
    const { "Counter.svelte": counter, "Display.svelte": display } =
      await caseOutputs("context/reactive");
    expect(counter).toMatch(/setContext\(\s*CountKey,\s*refObject\(\(\) => count\),?\s*\);/);
    expect(display).toMatch(
      /hasContext\(CountKey\)\s*\? getContext<\(typeof CountKey\)\["__value"\]>\(CountKey\)\s*: refObject\(\(\) => none\)/,
    );
  });

  it("exports the functions defineExpose exposes", async () => {
    const { "Counter.svelte": counter } = await caseOutputs("expose/several");
    expect(counter).toContain("export function increment()");
    expect(counter).toContain("export const reset = () =>");
  });

  it("renders <component is> over tags as svelte:element, over components as a $derived", async () => {
    expect((await caseOutputs("dynamic/tags"))["Section.svelte"]).toContain(
      '<svelte:element this={nested ? "h3" : "h2"}',
    );
    const tag = (await caseOutputs("dynamic/components"))["Tag.svelte"]!;
    expect(tag).toContain("const Component = $derived(compact ? Chip : Card);");
    expect(tag).toContain("<Component {label}");
  });

  it("merges a consumer's class and style into the root, or passes them on to a root component", async () => {
    const { "Tag.svelte": tag } = await caseOutputs("fallthrough/class-and-style");
    expect(tag).toContain('class={["tag", className]}');
    expect(tag).toContain(
      'style={mergeStyle({ padding: "2px 6px", color: "rgb(30, 30, 30)" }, style)}',
    );
    const { "Primary.svelte": primary } = await caseOutputs("fallthrough/to-component-root");
    expect(primary).toContain('class={["primary", className]}');
    const { "Field.svelte": field } = await caseOutputs("fallthrough/inherit-attrs-false");
    expect(field).not.toContain("className");
  });
});
