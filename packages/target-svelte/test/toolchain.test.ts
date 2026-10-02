import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

import defaultToolchain, { toolchain } from "../src/toolchain/index.ts";
import { toolchainDir } from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };

describe("svelte toolchain", () => {
  it("is the default export, named after its target", () => {
    expect(defaultToolchain).toBe(toolchain);
    expect(toolchain.name).toBe("svelte");
  });

  it("names its runtime adapters by their package subpaths", async () => {
    expect(toolchain.client).toBe("@unframework/target-svelte/toolchain/client");
    expect(toolchain.server).toBe("@unframework/target-svelte/toolchain/server");
    expect(await import(toolchain.client)).toHaveProperty("mount", expect.any(Function));
    expect(await import(toolchain.server)).toHaveProperty("renderToString", expect.any(Function));
  });

  it.each(["browser", "ssr"] as const)("adds vite-plugin-svelte (%s)", async (mode) => {
    const config = await toolchain.vite(mode, context);
    const names = (config.plugins as Plugin[]).map((plugin) => plugin.name);
    expect(names).toContain("vite-plugin-svelte");
    expect(config.resolve?.dedupe).toEqual(["svelte"]);
  });

  it("pre-bundles the runtime the compiled output imports, in the browser only", async () => {
    expect((await toolchain.vite("browser", context)).optimizeDeps?.include).toEqual([
      "svelte",
      "svelte/internal/client",
      "svelte/internal/disclose-version",
    ]);
    expect((await toolchain.vite("ssr", context)).optimizeDeps).toBeUndefined();
  });
});
