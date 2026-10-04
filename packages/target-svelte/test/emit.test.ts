import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import { compile } from "svelte/compiler";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { indent } from "../src/script.ts";
import { corpus, emitFormatted, emitSource } from "./helpers.ts";
import { SHAPES } from "./shapes.ts";

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
      svelteFile(script("  let props: { label?: string } = $props();"), "<p>Hi</p>"),
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

  it("closes childless SVG elements and keeps a root fragment's text", async () => {
    expect(await markupOf(SHAPES.svgAndFragment)).toBe(
      [
        '<svg viewBox="0 0 2 2">',
        '  <circle cx="1" cy="1" {r} />',
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
