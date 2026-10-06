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

describe("svelte target", () => {
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

  it("emits one runes-mode component per file, which pins the whitespace it is printed for", () => {
    const { files, reported } = emit();
    expect(reported).toEqual([]);
    expect(files).toEqual([
      {
        path: "Hello.svelte",
        contents: [
          "<svelte:options runes={true} preserveWhitespace={false} />",
          "",
          '<p class="greeting">Hello, world!</p>',
          "",
        ].join("\n"),
      },
    ]);
  });

  it("emits the same file for a named export", () => {
    expect(emit("named").files).toEqual(emit("default").files);
  });

  // Without the declaration, Svelte compiles a component that uses no runes in legacy mode.
  it("compiles in runes mode, for the corpus too", async () => {
    const cases = corpus();
    expect(cases.length).toBeGreaterThan(0);
    for (const { name, module } of cases) {
      for (const file of await emitFormatted(module)) {
        const { metadata, js } = compile(file.contents, { filename: file.path });
        expect(metadata.runes, name).toBe(true);
        expect(js.code, name).not.toContain("svelte/internal/flags/legacy");
      }
    }
  });

  it("adds no text before the markup", async () => {
    const [file] = emit().files;
    const { js } = compile(file!.contents, { filename: file!.path, generate: "server" });
    expect(js.code).toContain('$$renderer.push(`<p class="greeting">Hello, world!</p>`)');
  });
});

// Design §5.3: the instance script declares the copied types and reads the props with `$props()`.
describe("svelte props", () => {
  it("destructures the props it reads, in source order, with their defaults as written", async () => {
    // `count` and `hidden` are read by no expression: declared, they would be unused variables.
    expect((await emitSource(SHAPES.destructured)).contents).toBe(
      svelteFile(
        script(
          '  type Tone = "info" | "warn";',
          "",
          "  export interface BadgeProps {",
          "    label: string;",
          "    tone?: Tone;",
          "    count?: number;",
          "    hidden?: boolean;",
          "  }",
          "",
          '  let { tone = "info", label }: BadgeProps = $props();',
        ),
        "<p class={tone}>{label}</p>",
      ),
    );
  });

  it("keeps the props object and its reads in the object form", async () => {
    expect((await emitSource(SHAPES.objectForm)).contents).toBe(
      svelteFile(
        script(
          "  interface CardProps {",
          "    title: string;",
          "    subtitle?: string;",
          "  }",
          "",
          "  let p: CardProps = $props();",
        ),
        "<h2 title={p.subtitle}>{p.title}</h2>",
      ),
    );
  });

  // Svelte reserves the `$` prefix: `let $: P = $props()` is `dollar_prefix_invalid`.
  it("names a props object `props` where Svelte reserves the source's name", async () => {
    expect((await emitSource(SHAPES.reservedName)).contents).toBe(
      svelteFile(script("  let props: { title: string } = $props();"), "<h2>{props.title}</h2>"),
    );
  });

  // An empty pattern (`let {}: P`) is `no-empty-pattern` (L5).
  it("declares props it never reads under the object form, keeping the props type", async () => {
    expect((await emitSource(SHAPES.unread)).contents).toBe(
      svelteFile(script("  let _props: { label?: string } = $props();"), "<p>Hi</p>"),
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
    const source = `export default function Hi(${name}: { label?: string }) {\n  return <p>Hi</p>;\n}`;
    expect((await emitSource(source)).contents).toBe(
      svelteFile(script(`  let ${declared}: { label?: string } = $props();`), "<p>Hi</p>"),
    );
  });

  it("indents the script but for the lines inside a literal, whose value it would change", async () => {
    expect((await emitSource(SHAPES.multiline)).contents).toBe(
      svelteFile(
        script(
          "  let { text = `roses",
          '  are red`, note = "a\\',
          '  b" }: { text?: string; note?: string } = $props();',
        ),
        "<pre>{text}{note}</pre>",
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

// Design §5.3: blocks, bindings and spreads, laid out so no whitespace reaches the DOM.
describe("svelte markup", () => {
  it("prints a keyed each block, without the index no expression reads, and an if block", async () => {
    expect(await markupOf(SHAPES.lists)).toBe(
      [
        "<ul>",
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
        "<p>",
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
        '<form aria-label="Note">',
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
        "<div>",
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
        "<!--[--><div>",
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
        "<form>",
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
        "<!--[--><form><ol><!--[-->",
        '<li value="2">a</li><li value="1">b</li><li value="0">c</li>',
        '<!--]--></ol><meter min="0" max="10" value="0" title="Score &amp; &quot;rank&quot;">m</meter>',
        '<progress max="10" value="0">p</progress><data value="">d</data>',
        '<button type="button" value="">b</button><input type="checkbox" name="c" value="on"/>',
        "</form><!--]-->",
      ].join(""),
    );
    expect(await render({ steps: ["a"], score: 7, label: "x", mode: "m" })).toBe(
      [
        '<!--[--><form><ol><!--[--><li value="0">a</li><!--]--></ol>',
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
