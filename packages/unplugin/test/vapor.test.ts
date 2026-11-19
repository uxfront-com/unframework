// The plugin's `targetOptions` (ADR-0112): they reach `compile()`, which validates them, and with
// the Vue target's `vapor` on, the plugin refuses a plugin-vue that compiles with a Vue older than
// 3.6 (UF7013), whose compiler-sfc would build virtual-DOM components with no warning.
import { createRequire } from "node:module";
import { join } from "node:path";

import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { UnframeworkOptions } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { codeOf, createProject, fakeVue, HELLO, startServer } from "./fixtures.ts";
import type { Project, TestServer } from "./fixtures.ts";

let project: Project;
beforeAll(() => {
  project = createProject({ "Hello.uf.tsx": HELLO });
});
afterAll(() => project.remove());

const helloId = () => `${join(project.root, "Hello.uf.tsx")}.vue`;

async function withServer<T>(
  plugins: Plugin[],
  fn: (server: TestServer) => Promise<T>,
): Promise<T> {
  const server = await startServer(project.root, plugins);
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}

/** This package's own `vue/compiler-sfc`: Vue 3.5's, the reference's. */
const vue35 = createRequire(import.meta.url)("vue/compiler-sfc") as { version: string };

/** A compiler-sfc that marks a `vapor` file Vapor, as Vue 3.6's does. */
const vue36 = {
  version: "3.6.0",
  parse: () => ({ descriptor: { vapor: true } }),
};

/** plugin-vue as `configResolved` finds it, compiling with `compiler` when one is given. */
const pluginVue = (compiler?: unknown): Plugin => ({
  name: "vite:vue",
  api: { options: compiler === undefined ? {} : { compiler } },
});

const vapor: UnframeworkOptions = { target: "vue", targetOptions: { vue: { vapor: true } } };

describe("targetOptions", () => {
  it("reaches compile(): with `vapor` on, the module is a Vapor component", async () => {
    await withServer([...unframework(vapor), fakeVue], async ({ client }) => {
      expect(codeOf(await client.pluginContainer.load(helloId()))).toMatch(/^<template vapor>\n/);
    });
    await withServer([...unframework({ target: "vue" }), fakeVue], async ({ client }) => {
      expect(codeOf(await client.pluginContainer.load(helloId()))).toMatch(/^<template>\n/);
    });
  });

  it.each([[{ vapor: "yes" }], [{ vapour: true }]])(
    "fails the module with %j, naming UF7004",
    async (options) => {
      const plugins = [...unframework({ target: "vue", targetOptions: { vue: options } }), fakeVue];
      await withServer(plugins, async ({ client }) => {
        await expect(client.pluginContainer.load(helloId())).rejects.toThrow(
          /UF7004 \/targetOptions\/vue\/vapou?r is not valid/,
        );
      });
    },
  );
});

describe("UF7013 vapor-compiler-too-old", () => {
  it("refuses plugin-vue's compiler from Vue 3.5, as the server starts", async () => {
    await expect(
      withServer([...unframework(vapor), pluginVue(vue35)], async () => {}),
    ).rejects.toThrow(
      new RegExp(
        `error\\[UF7013\\]: .*plugin-vue's \`compiler\` option, Vue ${vue35.version.replaceAll(".", "\\.")}, doesn't compile Vapor components`,
      ),
    );
  });

  it("refuses the root's when plugin-vue has none, and the root has no Vue 3.6", async () => {
    await expect(withServer([...unframework(vapor), pluginVue()], async () => {})).rejects.toThrow(
      /error\[UF7013\]: .*the `vue\/compiler-sfc` of .* doesn't compile Vapor components/,
    );
  });

  it("starts with a compiler that compiles Vapor components", async () => {
    await withServer([...unframework(vapor), pluginVue(vue36)], async ({ client }) => {
      expect(codeOf(await client.pluginContainer.load(helloId()))).toMatch(/^<template vapor>/);
    });
  });

  it("says nothing with `vapor` off, or on a target other than Vue", async () => {
    await withServer([...unframework({ target: "vue" }), pluginVue(vue35)], async () => {});
    await withServer(
      [
        ...unframework({ target: "react", targetOptions: { vue: { vapor: true } } }),
        pluginVue(vue35),
      ],
      async () => {},
    );
  });
});
