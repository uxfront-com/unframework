// defineTestConfig with the Vue target's `vapor` on (ADR-0112): its projects hand the config's
// `targetOptions` to the unframework plugin, so the tests compile the Vapor components `build`
// writes, and mount them with the Vapor toolchain, whose adapter registers for the project's `vue`.
// Each project's own Vite configuration compiles the case's component, as its run would.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";
import type { InlineConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { defineTestConfig, isVaporTarget, loadToolchain } from "../src/config/index.ts";

const VUE_VAPOR = fileURLToPath(new URL("../../../tests/toolchains/vue-vapor", import.meta.url));

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A project that tests Vue with `targetOptions`, with one case. */
function vueProject(targetOptions: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uf-test-vapor-")));
  roots.push(root);
  const files = {
    "unframework.config.mjs": `export default { targets: ["vue"], targetOptions: ${targetOptions} };\n`,
    "test/badge/Badge.uf.tsx": "export default function Badge() {\n  return <b>New</b>;\n}\n",
    "test/badge/badge.test.ts": 'import { it } from "@unframework.dev/testing";\n',
  };
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

/** What the unframework plugin of a project's own Vite configuration loads for a `.uf.tsx`. */
async function compiled(project: TestProjectInlineConfiguration, file: string): Promise<string> {
  const { test: _test, ...vite } = project as TestProjectInlineConfiguration & InlineConfig;
  const server = await createServer({
    ...(vite as InlineConfig),
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const loaded = await server.environments.client.pluginContainer.load(`${file}.vue`);
    return typeof loaded === "string" ? loaded : (loaded?.code ?? "");
  } finally {
    await server.close();
  }
}

async function projectsOf(root: string): Promise<TestProjectInlineConfiguration[]> {
  const projects = (await defineTestConfig({ root, toolchainDirs: { vue: VUE_VAPOR } })).test
    ?.projects;
  return projects as TestProjectInlineConfiguration[];
}

describe("defineTestConfig with Vue's `vapor` on", () => {
  it("hands the config's targetOptions to the unframework plugin of each project", async () => {
    const root = vueProject("{ vue: { vapor: true } }");
    const projects = await projectsOf(root);
    expect(projects.map((each) => each.test?.name)).toEqual(["browser:vue", "ssr:vue"]);
    for (const project of projects) {
      expect(await compiled(project, join(root, "test/badge/Badge.uf.tsx"))).toMatch(
        /^<template vapor>\n/,
      );
    }
    const [plain] = await projectsOf(vueProject("{ vue: { vapor: false } }"));
    expect(await compiled(plain!, join(roots.at(-1)!, "test/badge/Badge.uf.tsx"))).toMatch(
      /^<template>\n/,
    );
  });

  it("mounts with the Vapor toolchain, registered for the project's vue", async () => {
    const [browser, ssr] = await projectsOf(vueProject("{ vue: { vapor: true } }"));
    expect(browser!.test?.setupFiles).toEqual([
      expect.stringMatching(/src\/setup\.ts$/),
      expect.stringMatching(/src\/targets\/vue-vapor\.ts$/),
    ]);
    expect(browser!.test?.provide).toMatchObject({
      target: "vue",
      ufCapabilities: { directive: { support: "emulated", helper: "queueHook" } },
    });
    expect(ssr!.test?.provide).toMatchObject({
      ufServer: "@unframework.dev/target-vue/toolchain/vapor/server",
    });
  });

  it("keeps Vue's own toolchain with `vapor` off", async () => {
    const [browser, ssr] = await projectsOf(vueProject("{ vue: { vapor: false } }"));
    expect(browser!.test?.setupFiles).toEqual([
      expect.stringMatching(/src\/setup\.ts$/),
      expect.stringMatching(/src\/targets\/vue\.ts$/),
    ]);
    expect(browser!.test?.provide).toMatchObject({
      ufCapabilities: { directive: { support: "native" } },
    });
    expect(ssr!.test?.provide).toMatchObject({
      ufServer: "@unframework.dev/target-vue/toolchain/server",
    });
  });
});

describe("loadToolchain", () => {
  it("loads Vue's Vapor toolchain where the options turn `vapor` on, and only Vue's", async () => {
    expect((await loadToolchain("vue", { vue: { vapor: true } })).name).toBe("vue-vapor");
    expect((await loadToolchain("vue", { vue: { vapor: false } })).name).toBe("vue");
    expect((await loadToolchain("vue")).name).toBe("vue");
    expect(isVaporTarget("react", { react: { vapor: true } })).toBe(false);
    expect(isVaporTarget("vue", { vue: { vapor: "yes" } })).toBe(false);
  });
});
