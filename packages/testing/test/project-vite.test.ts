// A project's own Vite config (`vite` in `unframework.config.ts`, ADR-0104): what each server
// gets from it, what it may not set, how it fails, and the declaration that lets Angular take any
// pass-through module. Fixture projects lie under `test/fixtures/`, so seven targets resolve their
// frameworks from this package.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { UnframeworkConfig, ViteContext } from "@unframework.dev/compiler";
import type { Plugin, PluginOption, UserConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import type { TestProjectInlineConfiguration } from "vitest/config";

import {
  defineTestConfig,
  OWNED_KEYS,
  OWNED_SERVER_KEYS,
  PASS_THROUGH_DECLARATIONS,
  passThroughDeclarations,
  projectPlugins,
  withProjectVite,
} from "../src/config/index.ts";

const FIXTURES = fileURLToPath(new URL("fixtures", import.meta.url));
const SEVEN = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"] as const;

const roots: Array<string> = [];
afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * A throwaway project holding `files`: under `test/fixtures/`, where seven targets resolve their
 * frameworks, or in the system's temporary directory.
 */
function project(files: Record<string, string>, { inPackage = false } = {}): string {
  const root = realpathSync(
    mkdtempSync(join(inPackage ? FIXTURES : tmpdir(), inPackage ? ".config-" : "uf-vite-")),
  );
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const COMPONENT = "export default function Badge() {\n  return <b>New</b>;\n}\n";
const SPEC = 'import { it } from "@unframework.dev/testing";\n';
const CASE = { "test/badge/Badge.uf.tsx": COMPONENT, "test/badge/badge.test.ts": SPEC };

async function projectsOf(root: string): Promise<Array<TestProjectInlineConfiguration>> {
  delete process.env.UF_TARGETS;
  return (await defineTestConfig({ root })).test?.projects as Array<TestProjectInlineConfiguration>;
}

/** The names of a config's plugins, in order, at any depth. */
const names = (each: { plugins?: unknown }): Array<string> =>
  ((each.plugins ?? []) as Array<unknown>)
    .flat(Number.POSITIVE_INFINITY)
    .filter(Boolean)
    .map((plugin) => (plugin as Plugin).name);

const context: ViteContext = { target: "vue", mode: "browser" };

describe("defineTestConfig with a project's vite", () => {
  it(
    "calls it once per project with its target and mode, and merges what it gives",
    { timeout: 120_000 },
    async () => {
      const root = project(
        {
          "unframework.config.mjs": `globalThis.ufViteCalls = [];
let made = 0;
export default {
  targets: ${JSON.stringify(SEVEN)},
  vite: (context) => {
    globalThis.ufViteCalls.push(context);
    return {
      plugins: [{ name: "engine", made: ++made }, [{ name: "engine:css" }], false],
      optimizeDeps: { include: ["engine-runtime"] },
    };
  },
  package: { resolveFrom: { angular: "../../../../../tests/toolchains/angular" } },
};
`,
          ...CASE,
        },
        { inPackage: true },
      );
      const projects = await projectsOf(root);
      const calls = (globalThis as { ufViteCalls?: Array<ViteContext> }).ufViteCalls!;
      // One call per project: Astro's render server calls it only once it renders.
      expect(calls.map(({ target, mode }) => `${mode}:${target}`).toSorted()).toEqual(
        SEVEN.flatMap((target) => [`browser:${target}`, `ssr:${target}`]).toSorted(),
      );
      const made = new Set<unknown>();
      for (const each of projects) {
        const name = each.test?.name as string;
        expect(names(each).slice(0, 3), name).toEqual([
          "engine",
          "engine:css",
          expect.stringMatching(/^unframework/),
        ]);
        made.add(Reflect.get((each.plugins ?? []).flat()[0] as Plugin, "made"));
        expect(each.optimizeDeps?.include, name).toContain("engine-runtime");
      }
      // Each project's server holds a set of its own: a plugin may keep one server's state.
      expect(made.size).toBe(14);
      // The harness's own pre-bundled dependencies stay beside the project's.
      const browser = projects.find((each) => each.test?.name === "browser:vue")!;
      expect(browser.optimizeDeps?.include).toContain("@unframework.dev/testing > axe-core");
      expect(browser.test?.provide).toMatchObject({ ufHarness: { liveFonts: [] } });
    },
  );

  it("passes the project's live fonts to the run", async () => {
    const root = project({
      "unframework.config.mjs":
        'export default { targets: ["vue"], liveFonts: ["Inkline Sans"] };\n',
      ...CASE,
    });
    const [browser] = await projectsOf(root);
    expect(browser!.test?.provide).toMatchObject({ ufHarness: { liveFonts: ["Inkline Sans"] } });
  });

  it("adds no plugin of the project's when it gives no vite", async () => {
    const root = project({
      "unframework.config.mjs": 'export default { targets: ["vue"] };\n',
      ...CASE,
    });
    for (const each of await projectsOf(root)) {
      expect(names(each)[0], each.test?.name as string).toMatch(/^unframework/);
    }
  });

  it("refuses a vite that is no function, and one that throws, with the reason", async () => {
    const list = project({
      "unframework.config.mjs": 'export default { targets: ["vue"], vite: { plugins: [] } };\n',
      ...CASE,
    });
    await expect(projectsOf(list)).rejects.toThrow(
      /UF7002 The configuration at "\/vite" must be a function that returns a Vite config/,
    );
    const thrown = project({
      "unframework.config.mjs":
        'export default { targets: ["vue"], vite: () => { throw new Error("no licence key"); } };\n',
      ...CASE,
    });
    await expect(projectsOf(thrown)).rejects.toThrow(
      "[uf] vite in unframework.config.ts threw: no licence key",
    );
  });
});

describe("withProjectVite", () => {
  it("puts the project's plugins first and merges every other key after the server's", async () => {
    const server = {
      root: "/project",
      plugins: [{ name: "unframework" }, { name: "vite:vue" }],
      optimizeDeps: { include: ["axe-core"], exclude: ["@unframework.dev/testing"] },
      resolve: { dedupe: ["vue"] },
      logLevel: "warn",
    };
    const merged = await withProjectVite(
      server,
      () => ({
        plugins: [{ name: "engine" }, [Promise.resolve({ name: "engine:css" }), null]],
        optimizeDeps: { include: ["@styleframe/runtime"] },
        resolve: { alias: { "@": "/src" } },
        logLevel: "error",
      }),
      context,
    );
    expect(names(merged)).toEqual(["engine", "engine:css", "unframework", "vite:vue"]);
    expect(merged).toMatchObject({
      root: "/project",
      optimizeDeps: {
        include: ["axe-core", "@styleframe/runtime"],
        exclude: ["@unframework.dev/testing"],
      },
      resolve: { dedupe: ["vue"], alias: { "@": "/src" } },
      // A scalar the project sets wins.
      logLevel: "error",
    });
    // The server's own config is left as it was.
    expect(names(server)).toEqual(["unframework", "vite:vue"]);
  });

  it("passes the server's target and mode, and leaves the config as it is without a vite", async () => {
    const seen: Array<ViteContext> = [];
    await withProjectVite({}, (each) => (seen.push(each), {}), { target: "qwik", mode: "preview" });
    expect(seen).toEqual([{ target: "qwik", mode: "preview" }]);
    const server = { plugins: [{ name: "unframework" }] };
    expect(await withProjectVite(server, undefined, context)).toEqual(server);
  });

  it.each([
    ...OWNED_KEYS.map((key) => [key, { [key]: key === "test" ? {} : "x" }] as const),
    ...OWNED_SERVER_KEYS.map((key) => [`server.${key}`, { server: { [key]: true } }] as const),
  ])("refuses %s, which the server sets itself", async (key, given) => {
    await expect(withProjectVite({}, () => given, context)).rejects.toThrow(
      `[uf] vite in unframework.config.ts sets \`${key}\`, which the browser server for vue sets itself: leave it out.`,
    );
  });

  it("refuses server.hmr, whose own port would listen beyond this machine", async () => {
    await expect(
      withProjectVite({}, () => ({ server: { hmr: { port: 24_680 } } }), context),
    ).rejects.toThrow(
      "[uf] vite in unframework.config.ts sets `server.hmr`, which the browser server for vue sets itself: leave it out.",
    );
  });

  it.each([true, null, "127.0.0.1", ["fs"]])(
    "refuses a server that is no object (%j), which would replace the server's own",
    async (server) => {
      await expect(withProjectVite({}, () => ({ server }), context)).rejects.toThrow(
        /^\[uf\] vite in unframework\.config\.ts gives `server` as .+, which is no object: give the server keys it may set, such as `\{ fs: \{ allow: \["\.\."\] \} \}`\.$/,
      );
    },
  );

  it("takes the server keys it doesn't own, such as server.fs", async () => {
    const merged = await withProjectVite(
      { server: { host: "127.0.0.1" } },
      () => ({ server: { fs: { allow: [".."] } } }),
      context,
    );
    // Vite's `mergeConfig` also fills in its own `server` defaults.
    expect(merged).toMatchObject({
      server: { host: "127.0.0.1", fs: { allow: [".."] } },
      plugins: [],
    });
  });

  it("names every owned key it sets at once", async () => {
    await expect(
      withProjectVite({}, () => ({ root: "/", server: { host: true, port: 80 } }), context),
    ).rejects.toThrow("sets `root`, `server.host`, `server.port`, which the browser server");
  });

  it("refuses what is no config and no plugin, naming the field and what it gave", async () => {
    const gave = async (made: unknown) =>
      (
        (await withProjectVite({}, () => made as never, context).catch(
          (thrown: unknown) => thrown,
        )) as Error
      ).message;
    const config = (what: string) =>
      `[uf] vite in unframework.config.ts gave ${what}, which is no Vite config: return an object, such as \`{ plugins: [engine()] }\`.`;
    expect(await gave([{ name: "engine" }])).toBe(config("a list"));
    expect(await gave(undefined)).toBe(config("undefined"));
    expect(await gave(null)).toBe(config("null"));
    const plugin = (what: string) =>
      `[uf] vite in unframework.config.ts gave ${what} among its plugins, which is no Vite plugin: a plugin is an object with a name.`;
    expect(await gave({ plugins: [{}] })).toBe(plugin("an object without a name"));
    expect(await gave({ plugins: [{ name: 1 }] })).toBe(
      plugin("an object whose name is no string"),
    );
    expect(await gave({ plugins: ["engine"] })).toBe(plugin('"engine"'));
    expect(await gave({ plugins: [() => ({ name: "late" })] })).toBe(plugin("a function"));
    expect(await gave({ plugins: [Symbol("engine")] })).toBe(plugin("Symbol(engine)"));
  });

  it("says why the function or a promise of its failed, in the message the CLI prints", async () => {
    const thrown = withProjectVite(
      {},
      () => {
        throw new Error("no licence key found in styleframe.config.ts");
      },
      context,
    );
    await expect(thrown).rejects.toThrow(
      /^\[uf\] vite in unframework\.config\.ts threw: no licence key found in styleframe\.config\.ts$/,
    );
    await expect(thrown).rejects.toHaveProperty(
      "cause.message",
      "no licence key found in styleframe.config.ts",
    );
    await expect(
      withProjectVite(
        {},
        () => ({ plugins: [{ name: "a" }, Promise.reject(new Error("engine failed to start"))] }),
        context,
      ),
    ).rejects.toThrow(
      "[uf] vite in unframework.config.ts gave a promise that rejected: engine failed to start",
    );
    // A promise that rejects with something other than an Error is reported too.
    // oxlint-disable-next-line prefer-promise-reject-errors
    await expect(withProjectVite({}, () => Promise.reject("offline"), context)).rejects.toThrow(
      '[uf] vite in unframework.config.ts threw: "offline"',
    );
    await expect(
      withProjectVite(
        {},
        () => {
          throw new Error("");
        },
        context,
      ),
    ).rejects.toThrow("[uf] vite in unframework.config.ts threw: an error with no message");
  });
});

describe("projectPlugins", () => {
  it("makes a fresh set of the project's plugins alone for each call, for its server", async () => {
    let made = 0;
    const seen: Array<ViteContext> = [];
    const plugins = projectPlugins(
      (each) => {
        seen.push(each);
        made += 1;
        return { plugins: [{ name: `engine${made}` }], optimizeDeps: { include: ["x"] } };
      },
      { target: "astro", mode: "ssr" },
    );
    expect((await plugins()).map((each) => each.name)).toEqual(["engine1"]);
    expect((await plugins()).map((each) => each.name)).toEqual(["engine2"]);
    expect(seen).toEqual([
      { target: "astro", mode: "ssr" },
      { target: "astro", mode: "ssr" },
    ]);
    expect(await projectPlugins(undefined, context)()).toEqual([]);
  });
});

describe("passThroughDeclarations", () => {
  it("declares every module under the default prefix, once per root, in a cache Git ignores", () => {
    const root = project({});
    const [file] = passThroughDeclarations(root);
    expect(file).toBe(join(root, "node_modules", ".cache", "unframework", "pass-through.d.ts"));
    expect(readFileSync(file!, "utf8")).toBe(PASS_THROUGH_DECLARATIONS);
    expect(PASS_THROUGH_DECLARATIONS).toContain('declare module "virtual:*";\n');
    // A file another version wrote is written again.
    writeFileSync(file!, "// stale\n");
    expect(passThroughDeclarations(root)).toEqual([file]);
    expect(readFileSync(file!, "utf8")).toBe(PASS_THROUGH_DECLARATIONS);
  });
});

describe("the vite field's type", () => {
  it("takes an object literal with any of Vite's keys, and Vite's own UserConfig", () => {
    const plugin: Plugin = { name: "engine" };
    const option: PluginOption = [plugin, Promise.resolve(plugin), false];
    const literal: UnframeworkConfig = {
      vite: ({ target, mode }) => ({
        plugins: [plugin, option, { name: `${target}:${mode}` }],
        optimizeDeps: { include: ["@styleframe/runtime"] },
      }),
      liveFonts: ["Inkline Sans"],
    };
    const annotated: UnframeworkConfig = {
      vite: async (): Promise<UserConfig> => ({ plugins: [plugin], resolve: { alias: {} } }),
    };
    expect([literal.vite, annotated.vite]).toEqual([expect.any(Function), expect.any(Function)]);
  });
});
