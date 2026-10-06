import { readFileSync } from "node:fs";

import type { Plugin } from "vite";
import { afterAll, describe, expect, it } from "vitest";

import defaultToolchain, { toolchain } from "../src/toolchain/index.ts";
import { emitSource, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";
import { SHAPES } from "./shapes.ts";

const context = { toolchainDir, root: toolchainDir };

afterAll(removeScratch);

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

  // Design §5: what the target emits passes Svelte's compiler, svelte-check and the linters with
  // no message. The corpus's own run is the integration `toolchain:svelte` project's.
  it(
    "passes L3, L4 and L5 on what the target emits for each shape",
    { timeout: 60_000 },
    async () => {
      const emitted = await Promise.all(
        Object.entries(SHAPES).map(async ([shape, source]) => {
          const { path, contents } = await emitSource(source, { format: true });
          return [`${shape}-${path}`, contents] as const;
        }),
      );
      const paths = Object.values(writeScratch(Object.fromEntries(emitted)));
      const clean = Object.fromEntries(paths.map((path) => [path, []]));
      const files = paths.map((path) => ({ path, contents: readFileSync(path, "utf8") }));
      const compiled = await toolchain.frameworkCompile(files, context);
      expect(Object.fromEntries(compiled)).toEqual(
        Object.fromEntries(paths.map((path) => [path, { errors: [], warnings: [] }])),
      );
      expect(Object.fromEntries(await toolchain.typecheck(paths, context))).toEqual(clean);
      expect(Object.fromEntries(await toolchain.lint(paths, context))).toEqual(clean);
    },
  );
});
