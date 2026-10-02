import { existsSync } from "node:fs";
import { createRequire } from "node:module";

import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

import defaultToolchain, { toolchain } from "../src/toolchain/index.ts";
import {
  assertSerialisableProps,
  astroComponentRef,
  isAstroComponentRef,
  splitQuery,
} from "../src/toolchain/protocol.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

const context = { toolchainDir, root: integrationRoot };
const pluginNames = (plugins: unknown): string[] =>
  [plugins]
    .flat(Number.POSITIVE_INFINITY)
    .filter((plugin): plugin is Plugin => typeof plugin === "object" && plugin !== null)
    .map((plugin) => plugin.name);

describe("the Astro toolchain", () => {
  it("is the default and the named export", () => {
    expect(defaultToolchain).toBe(toolchain);
    expect(toolchain.name).toBe("astro");
  });

  it("names its runtime entries by package subpath", () => {
    const require = createRequire(import.meta.url);
    for (const specifier of [toolchain.client, toolchain.server]) {
      expect(specifier).toMatch(/^@unframework\/target-astro\/toolchain\//);
      expect(existsSync(require.resolve(specifier))).toBe(true);
    }
  });

  it("builds SSR projects from Astro's own pipeline", async () => {
    const config = await toolchain.vite("ssr", context);
    const names = pluginNames(config.plugins);
    expect(names).toContain("astro:build");
    expect(names).not.toContain("unframework:astro-browser-ref");
  });

  it("keeps Astro's plugins out of browser projects, which get the reference plugin alone", async () => {
    const config = await toolchain.vite("browser", context);
    expect(pluginNames(config.plugins)).toEqual(["unframework:astro-browser-ref"]);
    expect(config.optimizeDeps).toBeUndefined();
  });

  it("gives browser projects the render command, and nothing interactive", () => {
    const commands = toolchain.browserCommands!(context);
    expect(Object.keys(commands)).toEqual(["ufAstroRender"]);
  });
});

describe("the browser protocol", () => {
  it("references a virtual id by its path and component name", () => {
    const ref = astroComponentRef("/abs/cases/ProfileCard.uf.tsx.astro?import");
    expect(ref).toEqual({
      __ufTarget: "astro",
      id: "/abs/cases/ProfileCard.uf.tsx.astro",
      name: "ProfileCard",
    });
    expect(isAstroComponentRef(ref)).toBe(true);
  });

  it("recognises only Astro references", () => {
    expect(isAstroComponentRef({ __ufTarget: "astro", id: "/a/X.uf.tsx", name: "X" })).toBe(false);
    expect(isAstroComponentRef({ __ufTarget: "vue", id: "/a/X.uf.tsx.astro", name: "X" })).toBe(
      false,
    );
    expect(isAstroComponentRef(() => null)).toBe(false);
    expect(isAstroComponentRef(null)).toBe(false);
  });

  it("splits the query off an id", () => {
    expect(splitQuery("/a/X.uf.tsx.astro?astro&type=style")).toEqual([
      "/a/X.uf.tsx.astro",
      "?astro&type=style",
    ]);
    expect(splitQuery("/a/X.uf.tsx.astro")).toEqual(["/a/X.uf.tsx.astro", ""]);
  });

  it("accepts props that survive JSON", () => {
    expect(() =>
      assertSerialisableProps({
        name: "Ada",
        count: 2,
        open: false,
        missing: undefined,
        none: null,
        items: [{ id: 1, tags: ["a"] }],
        bare: Object.create(null),
      }),
    ).not.toThrow();
  });

  it.each([
    ["onClick", () => undefined, "`onClick` is a function"],
    ["ratio", Number.NaN, "`ratio` is NaN"],
    ["when", new Date(0), "`when` is a Date instance"],
    ["nested", { list: [1, Symbol("s")] }, "`nested.list[1]` is a symbol"],
    ["big", 1n, "`big` is a bigint"],
  ])("rejects a prop JSON would change (%s)", (key, value, message) => {
    expect(() => assertSerialisableProps({ [key]: value })).toThrow(message);
  });
});
