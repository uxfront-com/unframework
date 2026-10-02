import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

import defaultToolchain, { toolchain } from "../src/toolchain/index.ts";
import { toolchainDir } from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };

/** plugin-vue's resolved options, which it exposes on its plugin's `api`. */
type VuePlugin = Plugin & { api: { options: { template?: { transformAssetUrls?: unknown } } } };

describe("vue toolchain", () => {
  it("is the default export, named after its target", () => {
    expect(defaultToolchain).toBe(toolchain);
    expect(toolchain.name).toBe("vue");
  });

  it("names its runtime adapters by their package subpaths", async () => {
    expect(toolchain.client).toBe("@unframework/target-vue/toolchain/client");
    expect(toolchain.server).toBe("@unframework/target-vue/toolchain/server");
    expect(await import(toolchain.client)).toHaveProperty("mount", expect.any(Function));
    expect(await import(toolchain.server)).toHaveProperty("renderToString", expect.any(Function));
  });

  it.each(["browser", "ssr"] as const)(
    "configures plugin-vue to keep asset URLs as written (%s)",
    async (mode) => {
      const config = await toolchain.vite(mode, context);
      const plugins = config.plugins as VuePlugin[];
      expect(plugins.map((plugin) => plugin.name)).toEqual(["vite:vue"]);
      expect(plugins[0]!.api.options.template?.transformAssetUrls).toBe(false);
      expect(config.resolve?.dedupe).toEqual(["vue"]);
    },
  );

  it("pre-bundles the runtime the compiled output imports, in the browser only", async () => {
    expect((await toolchain.vite("browser", context)).optimizeDeps?.include).toEqual(["vue"]);
    expect((await toolchain.vite("ssr", context)).optimizeDeps).toBeUndefined();
  });
});
