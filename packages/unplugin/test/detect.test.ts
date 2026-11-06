// Target detection and the host's options (ADR-0075). The framework plugins are not dependencies of
// this package, so each stands in by the name it registers.
import { writeFileSync } from "node:fs";

import { compile } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";
import { resolveConfig } from "vite";
import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ID_SUFFIXES, unframeworkUnplugin } from "../src/index.ts";
import type { UnframeworkOptions } from "../src/index.ts";
import unframework from "../src/vite.ts";
import { codeOf, createProject, fakeVue, HELLO, startServer } from "./fixtures.ts";
import type { Project, TestServer } from "./fixtures.ts";

const TOGGLE =
  'import { ref } from "unframework";\n\nexport function useToggle() {\n  const on = ref(false);\n  return { on };\n}\n';

let project: Project;
beforeAll(() => {
  project = createProject({
    "Hello.uf.tsx": HELLO,
    "useToggle.uf.ts": TOGGLE,
    "main.ts": 'import Hello from "./Hello.uf.tsx";\nexport default Hello;\n',
  });
});
afterAll(() => project.remove());

const hello = () => `${project.root}/Hello.uf.tsx`;
const main = () => `${project.root}/main.ts`;

/** Stands in for a framework's plugin, by the name it registers. */
const named = (name: string): Plugin => ({ name });

/** plugin-vue's stand-in under the name plugin-vue registers, for Vite's whole pipeline. */
const vueStandIn: Plugin = { ...fakeVue, name: "vite:vue" };

/** Runs `fn` against a server whose plugins are this plugin, then `others`. */
async function withPlugins<T>(
  options: UnframeworkOptions | undefined,
  others: Plugin[],
  fn: (server: TestServer) => Promise<T>,
): Promise<T> {
  const server = await startServer(project.root, [...unframework(options), ...others]);
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}

/** A server's start, which fails with what `configResolved` reports. */
const starting = (others: Plugin[], options?: UnframeworkOptions) =>
  withPlugins(options, others, () => Promise.resolve());

describe("target detection", () => {
  it.each<[TargetName, string]>([
    ["vue", "vite:vue"],
    ["svelte", "vite-plugin-svelte"],
    ["react", "vite:react-refresh"],
    ["solid", "solid"],
    ["qwik", "vite-plugin-qwik"],
    ["astro", "astro:build"],
    ["angular", "@analogjs/vite-plugin-angular"],
  ])("detects %s from a plugin named %s", async (target, name) => {
    const expected = await compile(HELLO, { filename: "Hello.uf.tsx", targets: [target] });
    await withPlugins(undefined, [named(name)], async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./Hello.uf.tsx", main());
      expect(resolved?.id).toBe(`${hello()}${ID_SUFFIXES[target]}`);
      expect(codeOf(await client.pluginContainer.load(resolved!.id))).toBe(
        expected.outputs[target]![0]!.contents,
      );
    });
  });

  it("gives every plugin of one framework one target", async () => {
    const plugins = ["vite:react-babel", "vite:react-refresh", "vite:react-compiler"].map(named);
    await withPlugins({}, plugins, async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./Hello.uf.tsx", main());
      expect(resolved?.id).toBe(hello());
    });
  });

  it("loads a detected target's composables under that target's id", async () => {
    await withPlugins(undefined, [named("vite-plugin-svelte")], async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./useToggle.uf.ts", main());
      expect(resolved?.id).toBe(`${project.root}/useToggle.uf.ts.svelte.ts`);
      expect(codeOf(await client.pluginContainer.load(resolved!.id))).toContain("useToggle");
    });
  });

  it("leaves the ids of every other target alone once the target is known", async () => {
    await withPlugins(undefined, [named("vite:vue")], async ({ client }) => {
      for (const id of [`${hello()}.svelte`, `${hello()}.astro`, `${hello()}.ts`]) {
        expect(await client.pluginContainer.load(id), id).toBeNull();
        expect(await client.pluginContainer.resolveId(id), id).toBeNull();
      }
    });
    await withPlugins(undefined, [named("solid")], async ({ client }) => {
      expect(await client.pluginContainer.load(`${hello()}.vue`)).toBeNull();
    });
  });

  // The hooks' filters take every target's ids until the target is known. These are the hooks a
  // named target's filter takes its own ids to, and the corpus always names its target.
  it.each<[TargetName, string]>([
    ["vue", "vite:vue"],
    ["svelte", "vite-plugin-svelte"],
    ["astro", "astro:build"],
    ["angular", "@analogjs/vite-plugin-angular"],
  ])("maps a detected %s id back from a root-relative URL", async (target, name) => {
    const id = `${hello()}${ID_SUFFIXES[target]}`;
    await withPlugins(undefined, [named(name)], async ({ client }) => {
      const url = `/Hello.uf.tsx${ID_SUFFIXES[target]}`;
      expect((await client.pluginContainer.resolveId(url))?.id).toBe(id);
      expect((await client.pluginContainer.resolveId(`${url}?x`))?.id).toBe(`${id}?x`);
    });
  });

  it("watches the file of a detected target's module, so an edit invalidates it", async () => {
    const watched = project.write("Watched.uf.tsx", HELLO);
    const id = `${watched}.vue`;
    await withPlugins(undefined, [vueStandIn], async ({ client }) => {
      expect((await client.transformRequest(id))?.code).toContain("Hello, world!");
      const [node] = client.moduleGraph.getModulesByFile(watched) ?? [];
      expect([...(node?.importers ?? [])].map((parent) => parent.id)).toEqual([id]);

      writeFileSync(watched, HELLO.replace("Hello, world!", "Hello, edit!"));
      client.moduleGraph.onFileChange(watched);
      expect(client.moduleGraph.getModuleById(id)?.transformResult).toBeNull();
      expect((await client.transformRequest(id))?.code).toContain("Hello, edit!");
    });
  });

  it("replaces a detected target's module that the guard fails", async () => {
    const options = { onCompile: () => "stale golden" };
    await withPlugins(options, [vueStandIn], async ({ client }) => {
      expect((await client.transformRequest(`${hello()}.vue`))?.code).toBe(
        'throw new Error("stale golden");\nexport default undefined;\n',
      );
    });
  });

  it("reads past a plugin with no name, which Vite runs", async () => {
    const nameless = { transform: () => null } as unknown as Plugin;
    await withPlugins(undefined, [nameless, named("vite:vue")], async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./Hello.uf.tsx", main());
      expect(resolved?.id).toBe(`${hello()}.vue`);
    });
    await expect(starting([nameless])).rejects.toThrow("error[UF7005]");
  });

  it("fails the authored file on a detected target whose ids have a suffix", async () => {
    await withPlugins(undefined, [named("vite:vue")], async ({ client }) => {
      await expect(client.pluginContainer.load(hello())).rejects.toThrow("reached Vite as itself");
    });
  });

  it("keeps an `extension` on a detected target", async () => {
    await withPlugins({ extension: ".client.vue" }, [named("vite:vue")], async ({ client }) => {
      const id = `${hello()}.client.vue`;
      expect((await client.pluginContainer.resolveId("./Hello.uf.tsx", main()))?.id).toBe(id);
      expect(codeOf(await client.pluginContainer.load(id))).toContain("<template>");
      expect(await client.pluginContainer.load(`${hello()}.vue`)).toBeNull();
    });
  });

  it("refuses an invalid `extension` when it is created, with no target", () => {
    expect(() => unframework({ extension: "vue" })).toThrow("is not a file extension");
  });

  it("detects nothing when `target` is given", async () => {
    const plugins = ["vite:vue", "vite-plugin-svelte"].map(named);
    await withPlugins({ target: "react" }, plugins, async ({ client }) => {
      const resolved = await client.pluginContainer.resolveId("./Hello.uf.tsx", main());
      expect(resolved?.id).toBe(hello());
    });
    await expect(withPlugins({ target: "react" }, [], () => Promise.resolve())).resolves.toBe(
      undefined,
    );
  });

  it("reports UF7005 when no plugin belongs to a framework it knows", async () => {
    // What only looks like a framework's plugin names none.
    const lookalikes = [
      "vite:vue-jsx",
      "vite-plugin-qwik-post",
      "vite-plugin-svelte-inspector",
      "vite:react",
      "solid-start",
      "astro",
      "@analogjs/platform",
    ].map(named);
    await expect(starting(lookalikes)).rejects.toThrow(/error\[UF7005\]: .*no plugin/);
    await expect(starting(lookalikes)).rejects.toThrow("pass `target`");
  });

  it("names the configuration file it read", async () => {
    project.write("vite.config.mjs", "export default {};\n");
    const resolving = resolveConfig(
      {
        root: project.root,
        configFile: `${project.root}/vite.config.mjs`,
        logLevel: "silent",
        plugins: unframework(),
      },
      "serve",
    );
    await expect(resolving).rejects.toThrow(" --> vite.config.mjs");
    await expect(starting([])).rejects.toThrow(" --> inline Vite configuration");
  });

  it("reports UF7006 when plugins of two frameworks are present, and names them", async () => {
    const start = starting(["vite:vue", "vite:react-babel"].map(named));
    await expect(start).rejects.toThrow(
      /error\[UF7006\]: .*react \(vite:react-babel\) and vue \(vite:vue\)/,
    );
  });

  it("asks for `target` on a bundler with nothing to detect it from", () => {
    expect(() => unframeworkUnplugin.rollup()).toThrow("Only Vite detects");
    expect(() => unframeworkUnplugin.rolldown({})).toThrow("pass `target` on rolldown");
  });
});

/** plugin-vue as `configResolved` finds it, with `api.options` holding what the app passed. */
const vueWith = (whitespace?: string): Plugin => ({
  name: "vite:vue",
  api: { options: { template: { compilerOptions: whitespace ? { whitespace } : {} } } },
});

describe("UF7010 host-option-incompatible", () => {
  it.each<[string, UnframeworkOptions | undefined]>([
    ["a detected target", undefined],
    ["a named target", { target: "vue" }],
  ])('warns of plugin-vue\'s whitespace "preserve" on %s, and still loads', async (_, options) => {
    await withPlugins(options, [vueWith("preserve")], async ({ client, warnings }) => {
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("warning[UF7010]");
      expect(warnings[0]).toContain('`template.compilerOptions.whitespace` is "preserve"');
      expect(codeOf(await client.pluginContainer.load(`${hello()}.vue`))).toContain("<template>");
    });
  });

  it.each([["condense"], [undefined]])("says nothing of %s", async (whitespace) => {
    await withPlugins(undefined, [vueWith(whitespace)], async ({ warnings }) => {
      expect(warnings).toEqual([]);
    });
  });

  it("says nothing where plugin-vue exposes no options", async () => {
    await withPlugins({ target: "vue" }, [named("vite:vue")], async ({ warnings }) => {
      expect(warnings).toEqual([]);
    });
  });

  it("says nothing on a target that emits no Vue", async () => {
    await withPlugins({ target: "react" }, [vueWith("preserve")], async ({ warnings }) => {
      expect(warnings).toEqual([]);
    });
  });
});
