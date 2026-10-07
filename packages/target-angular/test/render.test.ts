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
import { afterAll, describe, expect, it, vi } from "vitest";

import { renderToString } from "../src/toolchain/server.ts";
import {
  component,
  corpusSources,
  emitFormatted,
  emitModule,
  goldenFiles,
  lower,
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

/** A corpus case's output as this target emits it now, compiled and loaded. */
async function loadCase(name: string): Promise<unknown> {
  const { file, source } = corpusSources().find((each) => each.name === name)!;
  const [output] = await emitFormatted(lower(source, file, true));
  return load(basename(file, ".uf.tsx"), output!.contents);
}

/** What the server renders inside the component's host element. */
async function serverHtml(name: string, props: Record<string, unknown> = {}): Promise<string> {
  const html = await renderToString(await loadCase(name), { props });
  return /^<uf-[a-z-]+ style="display: contents;">([\s\S]*)<\/uf-[a-z-]+>$/.exec(html)![1]!;
}

// Effects are client-only (ADR-0048): the server renders the initial state, whatever
// `onMounted`, a watcher, an immediate watcher, `watchEffect` or `onUnmounted` would do in the
// browser, and destroying the server's application runs none of them.
describe("effects on the server", () => {
  it("renders the state before `onMounted` and the watcher it feeds", async () => {
    expect(await serverHtml("semantics/effects-client-only")).toBe(
      '<p role="status" class="network-badge" data-checked="no">Checking the connection</p>',
    );
  });

  it("runs no immediate watcher, `watchEffect` or `onUnmounted` there", async () => {
    const logged: unknown[][] = [];
    const spies = (["log", "warn", "error"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args) => void logged.push(args)),
    );
    try {
      expect(await serverHtml("effects/watch-cleanup")).toContain("Channel: #general");
      expect(await serverHtml("effects/watch-effect", { appName: "Inbox" })).toContain("0 unread");
      expect(await serverHtml("lifecycle/unmount-timers", { interval: 1000 })).toContain("Paused");
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    expect(logged).toEqual([]);
  });

  it("gives every id the compiler's prefix", async () => {
    const html = await serverHtml("ids/label-association", { label: "Email", hint: "Work" });
    const ids = [...html.matchAll(/ (?:id|for|aria-describedby)="([^"]+)"/g)].map(([, id]) => id);
    expect(ids).toHaveLength(4);
    expect(ids.every((id) => id!.startsWith("uf-id-email-field-"))).toBe(true);
  });
});
