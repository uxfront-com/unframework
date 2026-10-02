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
import type { ElementNode, RenderNode } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { astroFrameworkCompile } from "../src/toolchain/compile.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";

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
  it("declares every capability, with interactivity unsupported", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
      "text",
    ]);
    expect(target.capabilities.interactivity).toMatchObject({
      support: "unsupported",
      code: "UF4001",
    });
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
