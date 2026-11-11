// plugin-vue's `script.fs`, which the plugin fills on Vue so that `compileScript` reads a props type
// imported from another module without TypeScript's `sys`, which TypeScript 7 doesn't export
// (ADR-0082). plugin-vue stands in by the name it registers, with its `api.options` getter and
// setter and a `configResolved` that rebuilds its options as plugin-vue's does.
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileScript, parse } from "vue/compiler-sfc";

import { NODE_SCRIPT_FS } from "../src/detect.ts";
import type { UnframeworkOptions } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { createProject, HELLO, startServer } from "./fixtures.ts";
import type { Project } from "./fixtures.ts";

const TYPES = "export interface GreetingProps {\n  name: string;\n}\n";

const GREETING =
  '<script setup lang="ts">\nimport type { GreetingProps } from "./types";\n\ndefineProps<GreetingProps>();\n</script>\n';

let project: Project;
beforeAll(() => {
  project = createProject({ "Hello.uf.tsx": HELLO, "types.ts": TYPES });
  mkdirSync(join(project.root, "folder"));
  symlinkSync(join(project.root, "types.ts"), join(project.root, "link.ts"));
  symlinkSync(join(project.root, "loop.ts"), join(project.root, "loop.ts"));
});
afterAll(() => project.remove());

/** Options as plugin-vue holds them: replaced whole through the setter, never changed in place. */
interface StandIn {
  plugin: Plugin;
  /** Each value the setter was given, in order. */
  sets: Record<string, unknown>[];
  current(): Record<string, unknown>;
}

/** plugin-vue's stand-in, whose options start as `raw`, as `vue(raw)` gives them. */
function vueStandIn(raw: Record<string, unknown>): StandIn {
  let options: Record<string, unknown> = { ...raw };
  const sets: Record<string, unknown>[] = [];
  const plugin: Plugin = {
    name: "vite:vue",
    api: {
      get options() {
        return options;
      },
      set options(value: Record<string, unknown>) {
        sets.push(value);
        options = value;
      },
    },
    // plugin-vue 6 rebuilds its options here from the current ones (`...rest`).
    configResolved(config) {
      options = { ...options, root: config.root, isProduction: config.isProduction };
    },
  };
  return { plugin, sets, current: () => options };
}

/** Starts and closes a server whose plugins are `plugins`, and gives back its warnings. */
async function run(plugins: Plugin[]): Promise<string[]> {
  const server = await startServer(project.root, plugins);
  await server.close();
  return server.warnings;
}

const script = (vue: StandIn) => vue.current().script as Record<string, unknown> | undefined;

describe("script.fs on Vue", () => {
  it.each<[string, UnframeworkOptions | undefined]>([
    ["a detected target", undefined],
    ["a named target", { target: "vue" }],
  ])("gives plugin-vue Node's file system on %s when the app set none", async (_, options) => {
    const vue = vueStandIn({ script: { propsDestructure: "error" } });
    const raw = vue.current();
    await run([...unframework(options), vue.plugin]);
    expect(script(vue)).toEqual({ propsDestructure: "error", fs: NODE_SCRIPT_FS });
    expect(vue.current().root).toBe(project.root);
    // The app's own options object stays as it wrote it.
    expect(raw).toEqual({ script: { propsDestructure: "error" } });
  });

  it("fills it when plugin-vue's hook runs first", async () => {
    const vue = vueStandIn({});
    await run([vue.plugin, ...unframework()]);
    expect(script(vue)?.fs).toBe(NODE_SCRIPT_FS);
    expect(vue.current().root).toBe(project.root);
  });

  it("keeps the app's own `script.fs`", async () => {
    const own = { fileExists: () => false, readFile: () => undefined };
    const vue = vueStandIn({ script: { fs: own } });
    await run([...unframework(), vue.plugin]);
    expect(script(vue)?.fs).toBe(own);
    expect(vue.sets).toEqual([]);
  });

  it("leaves plugin-vue alone on a target that emits no Vue", async () => {
    const vue = vueStandIn({});
    const warnings = await run([...unframework({ target: "react" }), vue.plugin]);
    expect(script(vue)).toBeUndefined();
    expect(vue.sets).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("starts with no plugin-vue, or one that exposes no options", async () => {
    await expect(run([...unframework({ target: "vue" })])).resolves.toEqual([]);
    await expect(run([...unframework(), { name: "vite:vue" }])).resolves.toEqual([]);
  });
});

describe("Node's file system for compileScript", () => {
  const path = (name: string) => join(project.root, name);

  it("finds files, and no directory or missing path", () => {
    expect(NODE_SCRIPT_FS.fileExists(path("types.ts"))).toBe(true);
    expect(NODE_SCRIPT_FS.fileExists(path("link.ts"))).toBe(true);
    expect(NODE_SCRIPT_FS.fileExists(path("folder"))).toBe(false);
    expect(NODE_SCRIPT_FS.fileExists(path("missing.ts"))).toBe(false);
    expect(NODE_SCRIPT_FS.fileExists(path("types.ts/below.ts"))).toBe(false);
  });

  it("reads a file's text, and nothing of a directory or a missing path", () => {
    expect(NODE_SCRIPT_FS.readFile(path("types.ts"))).toBe(TYPES);
    expect(NODE_SCRIPT_FS.readFile(path("folder"))).toBeUndefined();
    expect(NODE_SCRIPT_FS.readFile(path("missing.ts"))).toBeUndefined();
    expect(NODE_SCRIPT_FS.readFile(path("types.ts/below.ts"))).toBeUndefined();
  });

  it("throws for any other error, which is no missing file", () => {
    expect(() => NODE_SCRIPT_FS.readFile(path("loop.ts"))).toThrow(/ELOOP/);
    expect(() => NODE_SCRIPT_FS.realpath(path("loop.ts"))).toThrow(/ELOOP/);
  });

  it("resolves a link to its file, and keeps a path that doesn't resolve", () => {
    expect(NODE_SCRIPT_FS.realpath(path("link.ts"))).toBe(path("types.ts"));
    expect(NODE_SCRIPT_FS.realpath(path("missing.ts"))).toBe(path("missing.ts"));
  });

  // The repository runs TypeScript 7, whose `typescript` module has no `sys`: this is the failure
  // a Vue app on TypeScript 7 meets, and what the fill fixes.
  it("lets compileScript resolve a props type from a sibling module on TypeScript 7", () => {
    const { descriptor } = parse(GREETING, { filename: path("Greeting.vue") });
    expect(() => compileScript(descriptor, { id: "greeting" })).toThrow(
      /No fs option provided to `compileScript`/,
    );
    const { content } = compileScript(descriptor, { id: "greeting", fs: NODE_SCRIPT_FS });
    expect(content).toMatch(/props: \{\s*name: \{ type: String, required: true \}/);
  });
});
