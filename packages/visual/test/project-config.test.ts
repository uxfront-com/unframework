// What a project's `unframework.config.ts` lets into the visual run and the preview: its own Vite
// plugins and declarations (ADR-0104), and fonts other than the bundled one in live captures
// (ADR-0105).
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, resolveConfig } from "@unframework.dev/compiler";
import type { ResolvedConfig } from "@unframework.dev/compiler";
import { resolveConfig as resolveViteConfig } from "vite";
import { describe, expect, it } from "vitest";

import { startFailure, startPreview, targetServerOptions } from "../src/preview/index.ts";
import { targetServerConfig } from "../src/preview/servers.ts";
import { runVisual } from "../src/run.ts";

const fixture = (name: string) =>
  realpathSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)));

const SEVEN = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];

async function projectConfig(root: string): Promise<ResolvedConfig> {
  const loaded = await loadConfig(root);
  const { config, diagnostics } = await resolveConfig(loaded.raw, loaded);
  expect(diagnostics).toEqual([]);
  return config!;
}

describe("a project's Vite plugins", () => {
  it(
    "render an example that imports a module only the project serves on every target",
    { timeout: 300_000 },
    async () => {
      const result = await runVisual({
        root: fixture("project-plugins"),
        env: {},
        stdout: () => undefined,
      });
      const [example] = result.report!.examples;
      expect(example?.id).toBe("examples/Greeting");
      expect(example!.cells.map((cell) => [cell.target, cell.status])).toEqual(
        SEVEN.map((target) => [target, "passed"]),
      );
      expect(result.exitCode).toBe(0);
    },
  );

  it("reach each preview server, before the unframework plugin", async () => {
    const root = fixture("project-plugins");
    const config = await projectConfig(root);
    for (const target of ["vue", "react"] as const) {
      const options = targetServerOptions(root, config, target, {});
      expect(options.declarations).toEqual([fixture("uf-fixture.d.ts")]);
      const { config: server } = await targetServerConfig(options);
      // Vite resolves the configuration as `createServer` would, without listening.
      const resolved = await resolveViteConfig(server, "serve");
      const names = resolved.plugins.map((plugin) => plugin.name);
      expect(names, target).toContain("uf-fixture");
      expect(names.indexOf("uf-fixture"), target).toBeLessThan(
        names.findIndex((name) => name.startsWith("unframework") && name !== "unframework:preview"),
      );
    }
  });
});

describe("a preview whose servers fail to start", () => {
  it("says why, once for the targets that failed alike, when a project's plugins throw", async () => {
    await expect(startPreview({ root: fixture("throwing-plugins") })).rejects.toThrow(
      "[uf:preview] 2 target servers failed to start:\n  vue, react: [uf] vitePlugins in unframework.config.ts threw: no licence key found in styleframe.config.ts",
    );
  });

  it("gives one server's own error, and a line per reason for several", () => {
    const own = new Error("port in use");
    expect(startFailure([{ target: "vue", reason: own }])).toBe(own);
    const several = startFailure([
      { target: "vue", reason: new Error("a") },
      { target: "react", reason: new Error("b") },
      { target: "svelte", reason: new Error("a") },
    ]);
    expect(several).toBeInstanceOf(AggregateError);
    expect((several as AggregateError).message).toBe(
      "[uf:preview] 3 target servers failed to start:\n  vue, svelte: a\n  react: b",
    );
    expect((several as AggregateError).errors).toHaveLength(3);
  });
});

describe("a project's live fonts", () => {
  it(
    "let a live capture draw in the system's font on every target when the project opts in",
    { timeout: 300_000 },
    async () => {
      const result = await runVisual({
        root: fixture("live-fonts"),
        env: {},
        stdout: () => undefined,
      });
      const [example] = result.report!.examples;
      expect(example!.cells.map((cell) => [cell.target, cell.status])).toEqual(
        SEVEN.map((target) => [target, "passed"]),
      );
      expect(result.exitCode).toBe(0);
    },
  );

  it(
    "fail the system's font in a live capture without the opt-in",
    { timeout: 180_000 },
    async () => {
      const result = await runVisual({
        root: fixture("live-fonts-bundled"),
        env: {},
        stdout: () => undefined,
      });
      const [cell] = result.report!.examples[0]!.cells;
      expect(cell).toMatchObject({ target: "vue", status: "failed", outcome: "font-fallback" });
      expect(result.exitCode).toBe(1);
    },
  );

  it(
    "fail the system's font against committed baselines, opt-in or not",
    { timeout: 180_000 },
    async () => {
      const result = await runVisual({
        root: fixture("live-fonts-baseline"),
        pixels: "baseline",
        env: {},
        stdout: () => undefined,
      });
      const [cell] = result.report!.examples[0]!.cells;
      expect(cell).toMatchObject({ target: "vue", status: "failed", outcome: "font-fallback" });
      expect(result.exitCode).toBe(1);
    },
  );
});
