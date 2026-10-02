import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { afterAll, describe, expect, it } from "vitest";

import { renderToString } from "../src/toolchain/server.ts";
import { corpus, emitFormatted, importScratch, removeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** Compiles a Svelte component for the server, as vite-plugin-svelte would. */
async function ssrComponent(name: string, source: string): Promise<Component> {
  const { js } = compile(source, { filename: name, generate: "server" });
  const module = await importScratch<{ default: Component }>(`${name}.js`, js.code);
  return module.default;
}

describe("svelte renderToString", () => {
  it("returns the body: the component's HTML, with Svelte's hydration anchors", async () => {
    const hello = corpus().find(({ name }) => name === "basics/hello");
    expect(hello).toBeDefined();
    const [file] = await emitFormatted(hello!.module);
    expect(await renderToString(await ssrComponent("Hello.svelte", file!.contents), {})).toBe(
      '<!--[--><p class="greeting">Hello, world!</p><!--]-->',
    );
  });

  it("passes props to the component", async () => {
    const Greeting = await ssrComponent(
      "Greeting.svelte",
      '<script lang="ts">\n  let { name }: { name: string } = $props();\n</script>\n\n<p>Hello, {name}!</p>\n',
    );
    expect(await renderToString(Greeting, { props: { name: "Ada" } })).toBe(
      "<!--[--><p>Hello, Ada!</p><!--]-->",
    );
  });

  it("leaves what the component puts in the document head out", async () => {
    const Titled = await ssrComponent(
      "Titled.svelte",
      "<svelte:head><title>Page</title></svelte:head>\n\n<p>Body</p>\n",
    );
    expect(await renderToString(Titled, {})).toBe("<!--[--><p>Body</p><!--]-->");
  });

  it("rejects when the component throws while rendering", async () => {
    const Broken = await ssrComponent(
      "Broken.svelte",
      '<script lang="ts">\n  throw new Error("render failed");\n</script>\n',
    );
    await expect(renderToString(Broken, {})).rejects.toThrow("render failed");
  });
});
