import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BUILD_MANIFEST } from "@unframework/testing/node";
import type * as Unplugin from "@unframework/unplugin/vite";
import type { CompileEvent } from "@unframework/unplugin/vite";
import type { InlineConfig, Plugin } from "vite";
import { describe, expect, it, vi } from "vitest";

import { createStorybookConfig } from "../src/preset.ts";
import type { StorybookOptions } from "../src/preset.ts";

const engine: Plugin = { name: "engine" };
const framework: Plugin = { name: "framework" };

function options(overrides: Partial<StorybookOptions> = {}): StorybookOptions {
  return {
    target: "vue",
    root: "/repo/tests/integration",
    stories: ["/stories/*.stories.ts"],
    mainModules: new Set(["/cases/a/A.uf.tsx"]),
    unplugin: { target: "vue" },
    plugins: () => Promise.resolve([engine]),
    vite: () => Promise.resolve({ plugins: [framework], resolve: { dedupe: ["vue"] } }),
    ...overrides,
  };
}

const flat = (config: InlineConfig) => (config.plugins ?? []).flat() as Plugin[];

describe("createStorybookConfig", () => {
  it("is @storybook/html-vite with no addons, telemetry or decorating features", () => {
    const config = createStorybookConfig(options());
    expect(config.framework).toBe("@storybook/html-vite");
    expect(config.stories).toEqual(["/stories/*.stories.ts"]);
    expect(config.addons).toEqual([]);
    expect(config.core.disableTelemetry).toBe(true);
    const { developmentModeForBuild, ...decorating } = config.features;
    expect(developmentModeForBuild).toBe(true);
    expect(Object.values(decorating)).not.toContain(true);
  });

  it("builds in development mode, unminified, from the harness's root", async () => {
    const final = await createStorybookConfig(options()).viteFinal({ root: "/elsewhere" });
    expect(final.root).toBe("/repo/tests/integration");
    expect(final.mode).toBe("development");
    expect(final.build?.minify).toBe(false);
    expect(final.build?.cssMinify).toBe(false);
  });

  it("puts the page host in Vitest's place", async () => {
    const final = await createStorybookConfig(options()).viteFinal({});
    const aliases = final.resolve?.alias as { find: RegExp; replacement: string }[];
    for (const specifier of ["vitest", "vitest/browser"]) {
      const alias = aliases.find(({ find }) => find.test(specifier));
      expect(alias?.replacement.endsWith("/src/hosts/page/vitest.ts"), specifier).toBe(true);
    }
    expect(aliases.some(({ find }) => find.test("vitest/config"))).toBe(false);
  });

  it("orders the engines ahead of the unplugin, and keeps the framework's plugin", async () => {
    const final = await createStorybookConfig(options()).viteFinal({});
    const names = flat(final).map((plugin) => plugin.name);
    expect(names).toContain("framework");
    expect(names).toContain("engine");
    expect(names.indexOf("engine")).toBeLessThan(names.indexOf("unframework"));
    expect(final.resolve?.dedupe).toEqual(["vue"]);
  });

  it("writes each main module's events to the manifest, and still asks the guard", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "uf-visual-"));
    try {
      const onCompile = vi.fn((event: CompileEvent) =>
        event.file.endsWith("Bad.uf.tsx") ? "guard says no" : undefined,
      );
      const final = await createStorybookConfig(
        options({
          mainModules: new Set(["/cases/a/A.uf.tsx", "/cases/b/Mixed.uf.tsx"]),
          unplugin: { target: "vue", onCompile },
        }),
      ).viteFinal({});
      const plugins = flat(final);
      const manifest = plugins.find((plugin) => plugin.name === "uf-visual:build-manifest")!;
      expect(manifest.apply).toBe("build");
      // The unplugin's onCompile, which the preset wrapped: reach it as the unplugin does.
      const wrapped = recordedOnCompile.mock.lastCall?.[0];
      expect(wrapped).toBeTypeOf("function");
      const ir = (events: string[][]) => ({
        components: events.map((names) => ({
          emits: { events: names.map((name) => ({ name, parameters: [] })) },
        })),
      });
      const compile = (file: string, value: unknown) =>
        wrapped!({ id: file, file, target: "vue", files: [], diagnostics: [], ir: value } as never);
      expect(await compile("/cases/a/A.uf.tsx", ir([["change"]]))).toBeUndefined();
      expect(await compile("/cases/a/Child.uf.tsx", ir([["other"]]))).toBeUndefined();
      expect(await compile("/cases/b/Mixed.uf.tsx", ir([["a"], ["b"]]))).toBeUndefined();
      expect(await compile("/cases/c/Bad.uf.tsx", ir([]))).toBe("guard says no");
      expect(onCompile).toHaveBeenCalledTimes(4);
      (manifest.configResolved as (config: unknown) => void)({ build: { outDir } });
      (manifest.closeBundle as () => void)();
      const written = JSON.parse(readFileSync(join(outDir, BUILD_MANIFEST), "utf8"));
      expect(written.target).toBe("vue");
      expect(written.failures).toEqual([{ module: "/cases/c/Bad.uf.tsx", cause: "guard says no" }]);
      expect(Object.keys(written.modules)).toEqual(["/cases/a/A.uf.tsx", "/cases/b/Mixed.uf.tsx"]);
      expect(written.modules["/cases/a/A.uf.tsx"]).toEqual({
        events: [{ name: "change", optional: [] }],
      });
      expect(written.modules["/cases/b/Mixed.uf.tsx"].error).toContain("different events");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

const recordedOnCompile = vi.hoisted(() => vi.fn());
vi.mock("@unframework/unplugin/vite", async (original) => {
  const actual = await original<typeof Unplugin>();
  return {
    ...actual,
    default: (unplugin: { onCompile?: unknown }) => {
      recordedOnCompile(unplugin.onCompile);
      return actual.default(unplugin as never);
    },
  };
});
