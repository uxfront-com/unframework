import { readFileSync } from "node:fs";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { Component } from "vue";
import { compileTemplate, parse } from "vue/compiler-sfc";

import { renderToString } from "../src/toolchain/server.ts";
import { goldenFiles, importScratch, removeScratch } from "./helpers.ts";

afterAll(removeScratch);
afterEach(() => {
  vi.restoreAllMocks();
});

/** Compiles a single-file component's template for the server, as plugin-vue would. */
async function ssrComponent(path: string): Promise<Component> {
  const { descriptor } = parse(readFileSync(path, "utf8"), { filename: path });
  const { code, errors } = compileTemplate({
    source: descriptor.template!.content,
    filename: path,
    id: "test",
    ssr: true,
    ssrCssVars: [],
    transformAssetUrls: false,
  });
  expect(errors).toEqual([]);
  const { ssrRender } = await importScratch<{ ssrRender: unknown }>("component.mjs", code);
  return { ssrRender } as Component;
}

describe("vue renderToString", () => {
  it("returns the component's HTML alone", async () => {
    const hello = goldenFiles().find((path) =>
      path.endsWith("/basics/hello/__output__/vue/Hello.vue"),
    );
    expect(hello).toBeDefined();
    expect(await renderToString(await ssrComponent(hello!), {})).toBe(
      '<p class="greeting">Hello, world!</p>',
    );
  });

  it("passes props as the root component's props", async () => {
    const Greeting = defineComponent({
      props: { name: { type: String, required: true } },
      render() {
        return h("p", `Hello, ${this.name}!`);
      },
    });
    expect(await renderToString(Greeting, { props: { name: "Ada" } })).toBe("<p>Hello, Ada!</p>");
  });

  it("rejects when the component throws while rendering", async () => {
    // Vue also warns about the unhandled error; the rejection is what must not be lost.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const Broken = defineComponent({
      render() {
        throw new Error("render failed");
      },
    });
    await expect(renderToString(Broken, {})).rejects.toThrow("render failed");
  });
});
