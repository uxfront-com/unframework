// The generic hooks on their own (ADR-0075): nothing here builds with another bundler. The hooks run
// on the context a bundler without Rollup's resolver or Vite's environments gives them.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type * as Compiler from "@unframework/compiler";
import type { CompilerPlugin } from "@unframework/compiler";
import type { UnpluginContextMeta, UnpluginOptions } from "unplugin";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { unframeworkUnplugin } from "../src/index.ts";
import type { UnframeworkOptions } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { codeOf, createProject, HELLO, startServer } from "./fixtures.ts";
import type { Project } from "./fixtures.ts";

const update = vi.hoisted(() => ({ fails: false, calls: 0 }));

// `project.update` fails only for the test that asks it to.
vi.mock("@unframework/compiler", async (importActual) => {
  const actual = await importActual<typeof Compiler>();
  return {
    ...actual,
    createProject: (options: Parameters<typeof actual.createProject>[0]) => {
      const created = actual.createProject(options);
      return {
        ...created,
        update: (files: readonly string[]) => {
          update.calls++;
          if (update.fails) return Promise.reject(new Error("The update failed."));
          return created.update(files);
        },
      };
    },
  };
});

let project: Project;

beforeAll(() => {
  project = createProject({
    "Hello.uf.tsx": HELLO,
    "useToggle.uf.ts":
      'import { ref } from "unframework";\n\nexport function useToggle() {\n  const on = ref(false);\n  return { on };\n}\n',
    "Both.uf.tsx": HELLO,
    "Both.uf.ts": "export const notAComposable = 1;\n",
  });
});

afterAll(() => project.remove());

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  update.fails = false;
  update.calls = 0;
});

/** The two raw plugins of a bundler, with the working directory as `root`. */
const rawPlugins = (
  options: UnframeworkOptions,
  root = project.root,
  framework: UnpluginContextMeta["framework"] = "esbuild",
): [UnpluginOptions, UnpluginOptions] => {
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const meta = { framework, versions: {} } as UnpluginContextMeta;
  const [pre, post] = unframeworkUnplugin.raw(options, meta);
  return [pre!, post!];
};

/** What the generic hooks record on the context of a bundler with no resolver. */
const createContext = () => {
  const context = {
    warnings: [] as string[],
    errors: [] as string[],
    watched: [] as string[],
    warn: (message: unknown) => void context.warnings.push(String(message)),
    error: (message: unknown) => void context.errors.push(String(message)),
    addWatchFile: (file: string) => void context.watched.push(file),
  };
  return context;
};

/** Calls a hook of the generic plugin the way unplugin does, `this` included. */
const call = (hook: unknown, context: object, ...args: unknown[]): Promise<unknown> => {
  const { handler } = hook as { handler: (this: object, ...args: unknown[]) => unknown };
  return Promise.resolve(handler.call(context, ...args));
};

const resolveId = (plugin: UnpluginOptions, source: string, importer?: string, context = {}) =>
  call(plugin.resolveId, context, source, importer, { isEntry: false });

const file = (name: string) => join(project.root, name);

describe("the bundler entries", () => {
  it("every bundler entry creates a plugin", async () => {
    // unplugin's Bun factory refuses to run anywhere else.
    vi.stubGlobal("Bun", { version: "1.2.22", semver: { satisfies: () => true } });
    const bundlers = Object.keys(await import("unplugin")).flatMap(
      (name) => /^create(\w+)Plugin$/.exec(name)?.[1]?.toLowerCase() ?? [],
    );
    expect(bundlers).toHaveLength(10);
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      exports: Record<string, unknown>;
      publishConfig: { exports: Record<string, unknown> };
    };
    for (const bundler of bundlers) {
      expect(manifest.exports[`./${bundler}`]).toBe(`./src/${bundler}.ts`);
      expect(manifest.publishConfig.exports[`./${bundler}`]).toEqual({
        types: `./dist/${bundler}.d.ts`,
        default: `./dist/${bundler}.js`,
      });
      const entry = (await import(`../src/${bundler}.ts`)) as {
        default: (options: UnframeworkOptions) => object | object[];
      };
      // Each of unplugin's factories has source of its own, which names its bundler. `./vite` wraps
      // its factory to document it and to type its result.
      if (bundler !== "vite") {
        expect(String(entry.default)).toBe(
          String(unframeworkUnplugin[bundler as keyof typeof unframeworkUnplugin]),
        );
      }
      const plugins = [entry.default({ target: "vue" })].flat();
      expect(plugins.length, bundler).toBeGreaterThan(0);
      for (const plugin of plugins) {
        expect("name" in plugin || "apply" in plugin, bundler).toBe(true);
      }
    }
  });
});

describe("the root", () => {
  const rootRelative = "/Hello.uf.tsx.vue";
  const moved = "/somewhere/else";

  it("is webpack's compiler.context", async () => {
    const [pre] = rawPlugins({ target: "vue" }, moved);
    pre.webpack!({ context: project.root } as never);
    expect(await resolveId(pre, rootRelative)).toBe(`${file("Hello.uf.tsx")}.vue`);
  });

  it("is Rspack's compiler.context", async () => {
    const [pre] = rawPlugins({ target: "vue" }, moved);
    pre.rspack!({ context: project.root } as never);
    expect(await resolveId(pre, rootRelative)).toBe(`${file("Hello.uf.tsx")}.vue`);
  });

  it("is esbuild's absWorkingDir", async () => {
    const [pre] = rawPlugins({ target: "vue" }, moved);
    pre.esbuild!.config!({ absWorkingDir: project.root });
    expect(await resolveId(pre, rootRelative)).toBe(`${file("Hello.uf.tsx")}.vue`);
  });

  it("is the process's working directory otherwise", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    pre.esbuild!.config!({});
    expect(await resolveId(pre, rootRelative)).toBe(`${file("Hello.uf.tsx")}.vue`);
  });

  it("is Vite's config on Vite, whatever the working directory", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(moved);
    const server = await startServer(project.root, unframework({ target: "vue" }));
    try {
      const resolved = await server.client.pluginContainer.resolveId(rootRelative);
      expect(resolved?.id).toBe(`${file("Hello.uf.tsx")}.vue`);
    } finally {
      await server.close();
    }
  });
});

describe("resolveId without a bundler's resolver", () => {
  const importer = () => file("App.uf.tsx.vue");

  it.each(["./Hello.uf.tsx", "./Hello.uf", "./Hello.uf.js", "./Hello.uf.jsx"])(
    "finds the component %s names",
    async (specifier) => {
      const [pre] = rawPlugins({ target: "vue" });
      expect(await resolveId(pre, specifier, file("App.ts"))).toBe(`${file("Hello.uf.tsx")}.vue`);
    },
  );

  it.each(["./useToggle.uf", "./useToggle.uf.ts"])(
    "finds the composables %s names",
    async (specifier) => {
      const [pre] = rawPlugins({ target: "svelte" });
      expect(await resolveId(pre, specifier, file("App.ts"))).toBe(
        `${file("useToggle.uf.ts")}.svelte.ts`,
      );
    },
  );

  it("takes the file a specifier spells out over its sibling", async () => {
    const [pre] = rawPlugins({ target: "svelte" });
    expect(await resolveId(pre, "./Both.uf.ts", file("App.ts"))).toBe(
      `${file("Both.uf.ts")}.svelte.ts`,
    );
    expect(await resolveId(pre, "./Both.uf.tsx", file("App.ts"))).toBe(
      `${file("Both.uf.tsx")}.svelte`,
    );
  });

  it("keeps a query on the id", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    expect(await resolveId(pre, "./Hello.uf.tsx?container", file("App.ts"))).toBe(
      `${file("Hello.uf.tsx")}.vue?container`,
    );
  });

  it("answers an import from a module of ours with the file: a watch edge", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    expect(await resolveId(pre, "./Hello.uf.tsx", importer())).toBe(file("Hello.uf.tsx"));
  });

  it("never takes a file of the other kind for the one a specifier spells out", async () => {
    project.write("OnlyTs.uf.ts", "export const only = 1;\n");
    project.write("OnlyTsx.uf.tsx", HELLO);
    const [pre] = rawPlugins({ target: "vue" });
    expect(await resolveId(pre, "./OnlyTs.uf.tsx", file("App.ts"))).toBeNull();
    expect(await resolveId(pre, "./OnlyTsx.uf.ts", file("App.ts"))).toBeNull();
  });

  it("leaves a package's specifier and a missing file to the bundler", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    expect(await resolveId(pre, "@ds/core/Hello.uf.tsx", file("App.ts"))).toBeNull();
    expect(await resolveId(pre, "./Missing.uf.tsx", file("App.ts"))).toBeNull();
  });

  it("resolves a package's specifier where the context can", async () => {
    const [pre] = rawPlugins({ target: "vue" }, project.root, "rollup");
    const source = join(project.root, "node_modules/@ds/core/src/Hello.uf.tsx");
    const context = { resolve: async () => ({ id: `${source}?v=abc` }) };
    expect(await call(pre.resolveId, context, "@ds/core/hello", file("App.ts"), {})).toBe(
      `${source}.vue`,
    );
    const external = { resolve: async () => ({ id: source, external: true }) };
    expect(await call(pre.resolveId, external, "@ds/core/hello", file("App.ts"), {})).toBeNull();
  });

  it("gives no scan id: the scan is Vite's", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    const options = { isEntry: false, scan: true };
    expect(await call(pre.resolveId, {}, "./Hello.uf.tsx", file("App.ts"), options)).toBe(
      `${file("Hello.uf.tsx")}.vue`,
    );
  });
});

describe("resolveId with Rollup's resolver", () => {
  const resolving = (answer: { id: string; external?: boolean } | null) => ({
    resolve: () => Promise.resolve(answer),
  });

  it("decides by the file the bundler resolves, so aliases work", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    const context = resolving({ id: file("Hello.uf.tsx") });
    expect(await resolveId(pre, "~/Hello.uf", file("App.ts"), context)).toBe(
      `${file("Hello.uf.tsx")}.vue`,
    );
  });

  it("leaves an external, an unresolved import and any other file alone", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    const importer = file("App.ts");
    const external = resolving({ id: file("Hello.uf.tsx"), external: true });
    expect(await resolveId(pre, "~/Hello.uf", importer, external)).toBeNull();
    expect(await resolveId(pre, "~/Hello.uf", importer, resolving(null))).toBeNull();
    const other = resolving({ id: file("Hello.uf.js") });
    expect(await resolveId(pre, "~/Hello.uf", importer, other)).toBeNull();
  });
});

describe("load and the guard, with no environments", () => {
  it("loads a module", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    const context = createContext();
    const loaded = await call(pre.load, context, `${file("Hello.uf.tsx")}.vue`);
    expect(codeOf(loaded)).toContain("Hello, world!");
    expect(context.errors).toEqual([]);
    expect(context.warnings).toEqual([]);
  });

  it("reports a diagnostic below an error through the context, and still loads", async () => {
    const counter = project.write(
      "Clicks.uf.tsx",
      "export default function Clicks() {\n  return <button onClick={() => {}}>Click</button>;\n}\n",
    );
    const [pre] = rawPlugins({ target: "astro" });
    const context = createContext();
    expect(codeOf(await call(pre.load, context, `${counter}.astro`))).toContain("<button");
    expect(context.errors).toEqual([]);
    expect(context.warnings.join("\n")).toContain("UF4");
  });

  it("loads a module of composables", async () => {
    const [pre] = rawPlugins({ target: "svelte" });
    const context = createContext();
    const loaded = await call(pre.load, context, `${file("useToggle.uf.ts")}.svelte.ts`);
    expect(codeOf(loaded)).toContain("useToggle");
    expect(context.errors).toEqual([]);
  });

  // esbuild's `error` only records the message, and drops it when `load` returns no code.
  it("throws on esbuild when a module fails", async () => {
    const broken = project.write("Broken.uf.tsx", "export default function Broken( {\n");
    const [pre] = rawPlugins({ target: "react" });
    await expect(call(pre.load, createContext(), broken)).rejects.toThrow("error[UF");
  });

  it("fails a module through the context on webpack, whose emitError fails the build", async () => {
    const broken = project.write("BrokenPack.uf.tsx", "export default function Broken( {\n");
    const [pre] = rawPlugins({ target: "react" }, project.root, "webpack");
    const context = createContext();
    expect(await call(pre.load, context, broken)).toBeUndefined();
    expect(context.errors.join("\n")).toContain("error[UF");
  });

  it("names the bundler when an authored file reaches load as itself", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    await expect(call(pre.load, createContext(), file("Hello.uf.tsx"))).rejects.toThrow(
      "Hello.uf.tsx reached esbuild as itself",
    );
  });

  it("replaces the final code of a module the guard failed, until it passes", async () => {
    let verdict: string | undefined = "Golden file differs.";
    const [pre, post] = rawPlugins({ target: "vue", onCompile: () => verdict });
    const id = `${file("Hello.uf.tsx")}.vue`;
    const context = createContext();
    expect(codeOf(await call(pre.load, context, id))).toContain("Hello, world!");
    expect(codeOf(await call(post.transform, context, "", id))).toContain(
      'throw new Error("Golden file differs.");',
    );
    verdict = undefined;
    await call(pre.load, context, id);
    expect(await call(post.transform, context, "", id)).toBeNull();
  });

  it("adds a module's watch edges through the context", async () => {
    project.write("Field.uf.tsx", HELLO.replace("Hello", "Field"));
    const form = project.write(
      "Form.uf.tsx",
      'import Field from "./Field.uf.tsx";\n\nexport default function Form() {\n  return <Field />;\n}\n',
    );
    const [pre] = rawPlugins({ target: "vue" });
    const context = createContext();
    await call(pre.load, context, `${form}.vue`);
    expect(await call(pre.transform, context, "", `${form}.vue`)).toBeNull();
    expect(context.watched).toEqual([form, file("Field.uf.tsx")]);
  });
});

describe("watchChange", () => {
  const edit = (path: string) => writeFileSync(path, HELLO.replace("world", "edit"));

  /** A plugin over one fresh file, loaded once, and how many compiles it has run. */
  const loaded = async (name: string) => {
    const path = project.write(`${name}.uf.tsx`, HELLO);
    const compiles = { count: 0 };
    const counter: CompilerPlugin = { name: "counter", ir: () => void compiles.count++ };
    const [pre] = rawPlugins({ target: "vue", plugins: [counter] });
    const id = `${path}.vue`;
    const context = createContext();
    await call(pre.load, context, id);
    expect(compiles.count).toBe(1);
    const change = (changed = path, event: "update" | "delete" = "update") =>
      pre.watchChange!.call(context as never, changed, { event });
    /** A load queues behind what `watchChange` started. */
    const settled = () => call(pre.load, context, id).catch(() => undefined);
    return { path, id, pre, context, compiles, change, settled };
  };

  it("hands an edit to the project before the next load, which compiles nothing", async () => {
    const { path, id, pre, context, compiles, change } = await loaded("Edited");
    edit(path);
    change();
    await vi.waitFor(() => expect(compiles.count).toBe(2));
    expect(codeOf(await call(pre.load, context, id))).toContain("Hello, edit!");
    expect(compiles.count).toBe(2);
  });

  it("hands over nothing when the file holds what the project holds", async () => {
    const { change, settled } = await loaded("Untouched");
    change();
    await settled();
    expect(update.calls).toBe(0);
  });

  it("ignores a file no compile read", async () => {
    const { change, settled } = await loaded("Unrelated");
    change(project.write("Elsewhere.ts", "export const elsewhere = 1;\n"));
    await settled();
    expect(update.calls).toBe(0);
  });

  it("does nothing before the first compile", async () => {
    const [pre] = rawPlugins({ target: "vue" });
    pre.watchChange!.call({} as never, file("Hello.uf.tsx"), { event: "update" });
    await call(pre.load, createContext(), `${file("Hello.uf.tsx")}.vue`);
    expect(update.calls).toBe(0);
  });

  it("hands over a file that a compile read and that is now gone", async () => {
    const { path, id, pre, context, change } = await loaded("Deleted");
    rmSync(path);
    change(path, "delete");
    await vi.waitFor(() => expect(update.calls).toBe(1));
    await expect(call(pre.load, context, id)).rejects.toThrow('The project has no file "Deleted');
  });

  it("leaves a failed update for the next load, which fails loudly", async () => {
    const { path, id, pre, context, change } = await loaded("Failing");
    edit(path);
    update.fails = true;
    change();
    await expect(call(pre.load, context, id)).rejects.toThrow("The update failed.");
    expect(update.calls).toBe(2);
    update.fails = false;
    expect(codeOf(await call(pre.load, context, id))).toContain("Hello, edit!");
  });

  it("runs on Vite too, in every environment's container", async () => {
    const path = project.write("Vited.uf.tsx", HELLO);
    let compiles = 0;
    const counter: CompilerPlugin = { name: "counter", ir: () => void compiles++ };
    const server = await startServer(
      project.root,
      unframework({ target: "vue", plugins: [counter] }),
    );
    try {
      const { client } = server;
      await client.pluginContainer.load(`${path}.vue`);
      edit(path);
      await client.pluginContainer.watchChange(path, { event: "update" });
      await server.server.environments.ssr!.pluginContainer.watchChange(path, { event: "update" });
      await vi.waitFor(() => expect(compiles).toBe(2));
      expect(codeOf(await client.pluginContainer.load(`${path}.vue`))).toContain("Hello, edit!");
      expect(compiles).toBe(2);
    } finally {
      await server.close();
    }
  });
});
