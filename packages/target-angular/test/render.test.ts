// The emitted component compiled by ngtsc and rendered by Angular's server platform: what the
// ssr:angular project does, and the proof that the emitter's escaping and whitespace handling
// give the DOM the IR describes.
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createText,
} from "@unframework/ir";
import type { RenderNode } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { renderToString } from "../src/toolchain/server.ts";
import {
  component,
  emitModule,
  goldenFiles,
  ngtscPlugin,
  removeScratch,
  scratchDir,
} from "./helpers.ts";

afterAll(removeScratch);

/** Compiles Angular source with the ngtsc plugin and imports the component it exports. */
async function load(name: string, source: string): Promise<unknown> {
  const directory = scratchDir();
  const { transform } = await ngtscPlugin();
  const { code } = await transform(join(directory, `${name}.uf.tsx.ts`), source);
  const file = join(directory, `${name}.js`);
  writeFileSync(file, code);
  return ((await import(pathToFileURL(file).href)) as { default: unknown }).default;
}

const at = { start: 0, end: 0 };
const text = (value: string) => createText(value, at);
const element = (tag: string, children: RenderNode[]) => createElement(tag, [], children, at);

/** Emits a component rendering `<div>{children}</div>` and returns the div's server HTML. */
async function renderEmitted(children: RenderNode[]): Promise<string> {
  const render = element("div", children);
  const module = createModule(
    "Text.uf.tsx",
    [createComponent("Text", render, at)],
    [createExport("default", "Text", at)],
  );
  const [file] = emitModule(module);
  const html = await renderToString(await load("Text", file!.contents), {});
  return /^<uf-text style="display: contents;"><div>([\s\S]*)<\/div><\/uf-text>$/.exec(html)![1]!;
}

describe("renderToString", () => {
  it("renders a golden output as the component's host element and content", async () => {
    const golden = goldenFiles().find((path) => basename(path) === "hello.ts")!;
    const Hello = await load("Hello", readFileSync(golden, "utf8"));
    expect(await renderToString(Hello, {})).toBe(
      '<uf-hello style="display: contents;"><p class="greeting">Hello, world!</p></uf-hello>',
    );
  });

  it("sets inputs before the first change detection", async () => {
    const Greeting = await load(
      "Greeting",
      component(
        "Greeting",
        "<p>Hello, {{ name() }}!</p>",
        "\n  readonly name = input.required<string>();\n",
      ),
    );
    expect(await renderToString(Greeting, { props: { name: "Ada" } })).toBe(
      '<uf-greeting style="display: contents;"><p>Hello, Ada!</p></uf-greeting>',
    );
  });

  it("renders the same HTML twice", async () => {
    const golden = goldenFiles().find((path) => basename(path) === "profile-card.ts")!;
    const Card = await load("ProfileCard", readFileSync(golden, "utf8"));
    expect(await renderToString(Card, {})).toBe(await renderToString(Card, {}));
  });

  it("rejects what is not a compiled Angular component", async () => {
    await expect(renderToString(() => "<p>x</p>", {})).rejects.toThrow(
      /Expected an AOT-compiled Angular component, got the function/,
    );
  });
});

// The emitter escapes text for Angular's template syntax; Angular must render exactly the IR's
// text, spaces between inline elements included.
describe("the emitted template", () => {
  it("renders Angular's and HTML's special characters as written", async () => {
    const value = "{{ a }} {b} {{{c}}} @if (d) <e> & f`${g}` \\h \u00a0i";
    expect(await renderEmitted([element("p", [text(value)])])).toBe(
      "<p>{{ a }} {b} {{{c}}} @if (d) &lt;e&gt; &amp; f`${g}` \\h &nbsp;i</p>",
    );
  });

  it("keeps the space between two inline elements", async () => {
    const html = await renderEmitted([
      element("p", [element("b", [text("a")]), text(" "), element("i", [text("b")])]),
    ]);
    expect(html).toBe("<p><b>a</b> <i>b</i></p>");
  });

  it("keeps whitespace as written inside <pre>", async () => {
    const html = await renderEmitted([
      element("pre", [element("b", [text("a")]), text("\n  "), element("i", [text("b")])]),
    ]);
    expect(html).toBe("<pre><b>a</b>\n  <i>b</i></pre>");
  });
});
