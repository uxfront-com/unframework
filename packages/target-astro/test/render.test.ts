import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { astroBrowserRef } from "../src/toolchain/browser.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { closeAstroRenderServers, renderAstroComponent } from "../src/toolchain/render.ts";
import { compiledAstroSource } from "../src/toolchain/sources.ts";

const root = join(import.meta.dirname, "..", ".uf-tmp", `render-${process.pid}`);
const idOf = (name: string) => join(root, `${name}.uf.tsx.astro`);

/** What a browser project does when it imports a component: the ref plugin's transform. */
function compileInBrowserProject(name: string, source: string): unknown {
  const plugin = astroBrowserRef();
  const transform = plugin.transform as {
    handler(this: unknown, code: string, id: string): { code: string };
  };
  const { code } = transform.handler.call(undefined, source, idOf(name));
  return JSON.parse(code.replace(/^export default /, "").replace(/;\n$/, ""));
}

describe("the ufAstroRender command", { timeout: 60_000 }, () => {
  beforeAll(() => mkdirSync(root, { recursive: true }));
  afterAll(async () => {
    await closeAstroRenderServers();
    rmSync(root, { recursive: true, force: true });
  });

  it("turns the browser module into a reference and records its source", () => {
    const source = '<p class="greeting">Hello, world!</p>\n';
    expect(compileInBrowserProject("Hello", source)).toEqual({
      __ufTarget: "astro",
      id: idOf("Hello"),
      name: "Hello",
    });
    expect(compiledAstroSource(idOf("Hello"))).toBe(source);
  });

  it("renders what the browser project compiled, with props, through Astro's pipeline", async () => {
    compileInBrowserProject(
      "Greeting",
      '---\nconst { name = "world" } = Astro.props;\n---\n\n<p class="greeting">Hello, {name}!</p>\n',
    );
    const result = await renderAstroComponent(root, {
      id: idOf("Greeting"),
      props: { name: "<Astro>" },
    });
    // No `data-astro-source-*`: the dev toolbar is off.
    expect(result).toEqual({ html: '<p class="greeting">Hello, &lt;Astro&gt;!</p>', console: [] });
  });

  it("puts the component's own styles first", async () => {
    compileInBrowserProject("Styled", "<p>styled</p>\n<style>p { padding: 8px; }</style>\n");
    const { html } = await renderAstroComponent(root, { id: idOf("Styled"), props: {} });
    expect(html).toMatch(
      /^<style>p\[data-astro-cid-(\w+)\] \{\s*padding: 8px;\s*\}\s*<\/style><p data-astro-cid-\1>styled<\/p>$/,
    );
  });

  it("returns the warnings and errors the render logged, and leaves the console as it was", async () => {
    compileInBrowserProject(
      "Noisy",
      '---\nconsole.warn("careful:", 1);\nconsole.error("broken", { at: "frontmatter" });\n---\n\n<p>noisy</p>\n',
    );
    const { warn, error } = console;
    const result = await renderAstroComponent(root, { id: idOf("Noisy"), props: {} });
    expect(result.console).toEqual([
      { level: "warn", message: "careful: 1" },
      { level: "error", message: "broken { at: 'frontmatter' }" },
    ]);
    expect([console.warn, console.error]).toEqual([warn, error]);
  });

  it("captures only the render's own calls, not those other work makes meanwhile", async () => {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    Object.assign(globalThis, { __ufTestGate: { entered, gate } });
    compileInBrowserProject(
      "Gated",
      '---\nconst { entered, gate } = (globalThis as any).__ufTestGate;\nentered();\nawait gate;\nconsole.warn("inside");\n---\n\n<p>gated</p>\n',
    );
    const original = console.warn;
    const elsewhere: unknown[][] = [];
    console.warn = (...args: unknown[]) => void elsewhere.push(args);
    try {
      const rendering = renderAstroComponent(root, { id: idOf("Gated"), props: {} });
      await started;
      console.warn("outside");
      release();
      expect((await rendering).console).toEqual([{ level: "warn", message: "inside" }]);
      expect(elsewhere).toEqual([["outside"]]);
    } finally {
      console.warn = original;
      Reflect.deleteProperty(globalThis, "__ufTestGate");
    }
  });

  it("renders the new source after the browser project recompiles", async () => {
    compileInBrowserProject("Live", "<p>v1</p>\n");
    expect((await renderAstroComponent(root, { id: idOf("Live"), props: {} })).html).toBe(
      "<p>v1</p>",
    );
    compileInBrowserProject("Live", "<p>v2</p>\n");
    expect((await renderAstroComponent(root, { id: idOf("Live"), props: {} })).html).toBe(
      "<p>v2</p>",
    );
  });

  it("rejects with the component's error when the render throws", async () => {
    compileInBrowserProject("Throws", '---\nthrow new Error("boom");\n---\n\n<p>never</p>\n');
    await expect(renderAstroComponent(root, { id: idOf("Throws"), props: {} })).rejects.toThrow(
      "boom",
    );
  });

  it("rejects with Astro's compile error", async () => {
    compileInBrowserProject("Broken", "<div><p>Hello</span></div>\n");
    await expect(renderAstroComponent(root, { id: idOf("Broken"), props: {} })).rejects.toThrow(
      "Closing tag '</span>' has no matching opening tag.",
    );
  });

  it("rejects a component no browser project compiled", async () => {
    await expect(renderAstroComponent(root, { id: idOf("Unknown"), props: {} })).rejects.toThrow(
      "was never compiled by a browser project",
    );
  });

  it("rejects an id that is not an Astro output", async () => {
    await expect(
      renderAstroComponent(root, { id: join(root, "Hello.uf.tsx"), props: {} }),
    ).rejects.toThrow("is not an Astro output id");
    await expect(
      renderAstroComponent(root, { id: `${idOf("Hello")}?container`, props: {} }),
    ).rejects.toThrow("is not an Astro output id");
  });

  it("is the toolchain's browser command, rendering in the project root", async () => {
    compileInBrowserProject("Command", "<p>from the command</p>\n");
    const commands = toolchain.browserCommands!({ toolchainDir: root, root });
    const render = commands.ufAstroRender as (
      context: unknown,
      request: { id: string; props: Record<string, unknown> },
    ) => Promise<unknown>;
    await expect(render({}, { id: idOf("Command"), props: {} })).resolves.toEqual({
      html: "<p>from the command</p>",
      console: [],
    });
  });
});
