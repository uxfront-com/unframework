import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { BUILD_MANIFEST } from "@unframework/testing/node";
import type { BuildManifest } from "@unframework/testing/node";
import type { CompileEvent } from "@unframework/unplugin/vite";
import { build as viteBuild, mergeConfig } from "vite";
import type { InlineConfig, Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ABORTS_ENV, buildIsolated, isolateFailures } from "../src/isolate.ts";
import { createStorybookConfig } from "../src/preset.ts";

const component = (text: string) =>
  `export default function Case() {\n  return <p>${text}</p>;\n}\n`;
const stories = (source: string) =>
  `import Case from "${source}";\nexport default { component: Case };\nexport const story = { name: "story" };\n`;

/** Stands in for plugin-vue, so the chunks need no Vue under Node: it throws on what it's told to. */
function framework(fails: RegExp = /Framework\.uf\.tsx\.vue$/): Plugin {
  return {
    name: "framework-stand-in",
    transform: {
      filter: { id: /\.uf\.tsx\.vue$/ },
      handler(code, id) {
        if (fails.test(id)) this.error(`framework cannot compile ${id}`);
        return { code: `export default ${JSON.stringify(code)};\n`, moduleType: "js" };
      },
    },
  };
}

let root: string;
const onCompile = (event: CompileEvent) =>
  event.file.endsWith("Guard.uf.tsx") ? "guard: differs from its golden file" : undefined;

function write(file: string, contents: string): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), contents);
}

/** A fixture case and its stories file. */
function addCase(name: string, source: string): string {
  write(`cases/${name}/${name}.uf.tsx`, source);
  write(`${name}.stories.ts`, stories(`./cases/${name}/${name}.uf.tsx`));
  return `${name}.stories`;
}

/** The preset's build of some stories files, as Storybook runs it, through Vite's own `build`. */
async function build(
  entries: readonly string[],
  plugins: Plugin[] = [framework()],
  engines: Plugin[] = [],
): Promise<void> {
  const final = await createStorybookConfig({
    target: "vue",
    root,
    stories: [],
    mainModules: new Set(),
    unplugin: { target: "vue", onCompile },
    plugins: () => Promise.resolve(engines),
    vite: () => ({ plugins }),
  }).viteFinal({});
  await viteBuild(
    mergeConfig(final, {
      configFile: false,
      logLevel: "silent",
      build: {
        outDir: join(root, "dist"),
        modulePreload: false,
        rolldownOptions: {
          input: Object.fromEntries(entries.map((name) => [name, join(root, `${name}.ts`)])),
          preserveEntrySignatures: "strict",
          output: { entryFileNames: "[name].mjs", chunkFileNames: "[name]-[hash].mjs" },
        },
      },
    } satisfies InlineConfig),
  );
}

const chunk = (name: string) =>
  import(/* @vite-ignore */ pathToFileURL(join(root, "dist", `${name}.mjs`)).href);
const manifest = () =>
  JSON.parse(readFileSync(join(root, "dist", BUILD_MANIFEST), "utf8")) as BuildManifest;
const failedModules = () => manifest().failures.map(({ module }) => module.replace(`${root}/`, ""));
const causeOf = (ending: string) =>
  manifest().failures.find(({ module }) => module.endsWith(ending))?.cause;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "uf-visual-isolate-")));
  mkdirSync(join(root, "dist"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("a build of good and failing cases", () => {
  it("builds, and only each bad chunk rejects at import(), naming its cause", async () => {
    const good = addCase("Good", component("good"));
    // A value import of a missing file: UF1202, through `this.error` in the unplugin's `load`.
    const load = addCase(
      "Load",
      `import { missing } from "./missing.ts";\n${component("{missing}")}`,
    );
    const inFramework = addCase("Framework", component("framework"));
    const guard = addCase("Guard", component("guard"));

    await build([good, load, inFramework, guard]);

    const story = await chunk(good);
    expect(story.story).toEqual({ name: "story" });
    expect(story.default.component).toContain("good");
    await expect(chunk(load)).rejects.toThrow("UF1202");
    await expect(chunk(inFramework)).rejects.toThrow(/framework cannot compile .*Framework/);
    await expect(chunk(guard)).rejects.toThrow("guard: differs from its golden file");

    expect(failedModules()).toEqual([
      "cases/Framework/Framework.uf.tsx.vue",
      "cases/Guard/Guard.uf.tsx.vue",
      "cases/Load/Load.uf.tsx.vue",
    ]);
    const causes = Object.fromEntries(
      manifest().failures.map(({ module, cause }) => [module.replace(`${root}/`, ""), cause]),
    );
    expect(causes["cases/Load/Load.uf.tsx.vue"]).toContain("UF1202");
    expect(causes["cases/Framework/Framework.uf.tsx.vue"]).toContain("framework cannot compile");
    expect(causes["cases/Guard/Guard.uf.tsx.vue"]).toBe("guard: differs from its golden file");
  });

  it("prints each failure, since the build exits 0", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const guard = addCase("Guard", component("guard"));
    const good = addCase("Good", component("good"));
    await build([guard, good]);
    const lines = log.mock.calls.map(([line]) => String(line));
    log.mockRestore();
    expect(lines).toEqual([
      `[uf] ${join(root, "cases/Guard/Guard.uf.tsx.vue")}: guard: differs from its golden file`,
    ]);
  });

  it("keeps a guard's verdict when the framework then fails on that output", async () => {
    const guard = addCase("Guard", component("guard"));
    await build([guard], [framework(/Guard/)]);
    await expect(chunk(guard)).rejects.toThrow(/framework cannot compile[^]*guard: differs/);
    expect(manifest().failures[0]?.cause).toMatch(/framework cannot compile[^]*guard: differs/);
  });

  it("records a guard that throws", async () => {
    const event = { id: "/cases/a/A.uf.tsx.vue" } as CompileEvent;
    const isolation = isolateFailures(root, undefined);
    const guarded = isolation.guarded(() => {
      throw new Error("guard broke");
    });
    await expect(guarded(event)).rejects.toThrow("guard broke");
    expect(isolation.failures()).toEqual([{ module: event.id, cause: "guard broke" }]);
  });

  it("names a verdict that has no text, and records no module that passed", async () => {
    const event = { id: "/cases/a/A.uf.tsx.vue" } as CompileEvent;
    const passes = isolateFailures(root, undefined);
    await passes.guarded(() => undefined)(event);
    expect(passes.failures()).toEqual([]);
    const silent = isolateFailures(root, undefined);
    await expect(silent.guarded(() => "")(event)).resolves.toBe("");
    expect(silent.failures()[0]?.cause).toContain("without a message");
  });
});

describe("the hooks it wraps", () => {
  it("isolates a plain throw in a function-form load, and a transform after it runs on nothing", async () => {
    const good = addCase("Good", component("good"));
    const bad = addCase("Bad", component("bad"));
    const after = vi.fn(() => null);
    await build(
      [good, bad],
      [
        framework(/$^/),
        {
          name: "load-throws",
          enforce: "pre",
          load(id) {
            if (id.endsWith("Bad.uf.tsx.vue")) throw new Error("load threw");
            return null;
          },
        },
        {
          name: "after",
          transform(_code, id) {
            if (id.endsWith("Bad.uf.tsx.vue")) after();
            return null;
          },
        },
      ],
    );
    await expect(chunk(bad)).rejects.toThrow("load threw");
    await expect(chunk(good)).resolves.toMatchObject({ story: { name: "story" } });
    expect(after).not.toHaveBeenCalled();
  });

  it("isolates a throw that isn't an Error", async () => {
    const bad = addCase("Bad", component("bad"));
    await build(
      [bad],
      [
        framework(/$^/),
        {
          name: "throws-text",
          transform(_code, id) {
            // oxlint-disable-next-line no-throw-literal -- what a plugin may do
            if (id.endsWith("Bad.uf.tsx.vue")) throw "just text";
            return null;
          },
        },
      ],
    );
    await expect(chunk(bad)).rejects.toThrow("just text");
  });

  it("isolates a failed resolve into a module of its own", async () => {
    write("Bad.stories.ts", `import part from "virtual:part";\nexport default { part };\n`);
    await build(
      ["Bad.stories"],
      [
        {
          name: "resolve-throws",
          resolveId(source) {
            if (source === "virtual:part") throw new Error("resolve threw");
            return null;
          },
        },
      ],
    );
    await expect(chunk("Bad.stories")).rejects.toThrow("resolve threw");
    expect(manifest().failures).toEqual([
      {
        module: `\0uf-visual:failed:virtual:part from ${join(root, "Bad.stories.ts")}`,
        cause: "resolve threw",
      },
    ]);
  });

  it("throws from a stylesheet too, past Vite's CSS pipeline", async () => {
    write("Bad.stories.ts", `import "./sheet.css";\nexport default { good: true };\n`);
    write("sheet.css", "p { color: red }\n");
    await build(
      ["Bad.stories"],
      [
        {
          name: "css-throws",
          load(id) {
            if (id.endsWith("sheet.css")) throw new Error("sheet threw");
            return null;
          },
        },
      ],
    );
    await expect(chunk("Bad.stories")).rejects.toThrow("sheet threw");
    expect(failedModules()).toEqual(["sheet.css"]);
  });

  it("throws from a package that declares no side effects", async () => {
    write("package.json", `{ "sideEffects": false }\n`);
    write("Bad.stories.ts", `import part from "./part.ts";\nexport default { part };\n`);
    write("part.ts", `export default 1;\n`);
    await build(
      ["Bad.stories"],
      [
        {
          name: "part-throws",
          load(id) {
            if (id.endsWith("part.ts")) throw new Error("part threw");
            return null;
          },
        },
      ],
    );
    await expect(chunk("Bad.stories")).rejects.toThrow("part threw");
  });

  it("strips terminal colours from a cause", async () => {
    const bad = addCase("Bad", component("bad"));
    await build(
      [bad],
      [
        framework(/$^/),
        {
          name: "colours",
          transform(_code, id) {
            if (id.endsWith("Bad.uf.tsx.vue")) throw new Error("\u001B[31mred\u001B[0m");
            return null;
          },
        },
      ],
    );
    expect(manifest().failures[0]?.cause).toBe("red");
  });

  it("isolates a throw in an engine's plugin", async () => {
    const good = addCase("Good", component("good"));
    const bad = addCase("Bad", component("bad"));
    await build(
      [good, bad],
      [framework(/$^/)],
      [
        {
          name: "engine-throws",
          enforce: "pre",
          load(id) {
            if (id.endsWith("Bad.uf.tsx.vue")) throw new Error("the engine threw");
            return null;
          },
        },
      ],
    );
    await expect(chunk(good)).resolves.toMatchObject({ story: { name: "story" } });
    await expect(chunk(bad)).rejects.toThrow("the engine threw");
    expect(failedModules()).toEqual(["cases/Bad/Bad.uf.tsx.vue"]);
  });

  it("keeps a filter the plugin sets later on its own hook object", async () => {
    const seen: string[] = [];
    const plugin: Plugin = {
      name: "late-filter",
      options() {
        (plugin.transform as { filter: unknown }).filter = { id: /Bad\.uf\.tsx\.vue$/ };
      },
      transform: {
        handler(_code, id) {
          seen.push(id);
          return null;
        },
      },
    };
    const good = addCase("Good", component("good"));
    const bad = addCase("Bad", component("bad"));
    await build([good, bad], [framework(/$^/), plugin]);
    expect(seen.map((id) => id.replace(`${root}/`, ""))).toEqual(["cases/Bad/Bad.uf.tsx.vue"]);
  });

  it("flattens nested and promised plugins, and leaves empty options out", async () => {
    const isolation = isolateFailures(root, undefined);
    const a: Plugin = { name: "a" };
    const b: Plugin = { name: "b" };
    await expect(isolation.wrap([a, null, Promise.resolve([b, false])])).resolves.toEqual([a, b]);
  });

  it("leaves a dev server's errors alone", async () => {
    const isolation = isolateFailures(root, undefined);
    const [plugin] = await isolation.wrap({
      name: "throws",
      load() {
        throw new Error("load threw");
      },
      transform: {
        handler() {
          throw new Error("transform threw");
        },
      },
      resolveId() {
        throw new Error("resolve threw");
      },
    });
    const call = (hook: unknown, ...args: unknown[]) =>
      (hook as (...rest: unknown[]) => Promise<unknown>)(...args);
    await expect(call(plugin!.resolveId, "x")).rejects.toThrow("resolve threw");
    await expect(call(plugin!.load, "x")).rejects.toThrow("load threw");
    await expect(
      call((plugin!.transform as { handler: unknown }).handler, "", "x"),
    ).rejects.toThrow("transform threw");
    expect(isolation.plugin.apply).toBe("build");
    expect(isolation.failures()).toEqual([]);
  });
});

describe("a build that still aborts", () => {
  /** Runs `build` with an exit code, as `storybook build` gives, in this process. */
  const attempts = (entries: readonly string[], plugins: () => Plugin[]) => {
    const file = join(root, "aborts.json");
    let count = 0;
    const run = () =>
      buildIsolated(file, async (env) => {
        count += 1;
        vi.stubEnv(ABORTS_ENV, env[ABORTS_ENV]!);
        try {
          await build(entries, plugins());
          return 0;
        } catch {
          return 1;
        }
      });
    return { run, count: () => count };
  };

  it("rebuilds without a module Rolldown can't link, which the manifest names", async () => {
    const good = addCase("Good", component("good"));
    addCase("Failed", `import { missing } from "./missing.ts";\n${component("{missing}")}`);
    // A failed module has lost its named exports: this importer aborts the link.
    write(
      "Importer.stories.ts",
      `import { named } from "./cases/Failed/Failed.uf.tsx";\nexport default { named };\n`,
    );
    const { run, count } = attempts([good, "Importer.stories"], () => [framework()]);

    await expect(run()).resolves.toBe(0);

    expect(count()).toBe(2);
    await expect(chunk(good)).resolves.toMatchObject({ story: { name: "story" } });
    // The importer's failure says why the export has gone, not only that it has.
    await expect(chunk("Importer.stories")).rejects.toThrow(/MISSING_EXPORT[^]*UF1202/);
    expect(failedModules()).toEqual(["Importer.stories.ts", "cases/Failed/Failed.uf.tsx.vue"]);
    expect(causeOf("Failed.uf.tsx.vue")).toContain("UF1202");
  });

  it("still names a guard's verdict on a module only a failed importer reached", async () => {
    addCase("Guard", component("guard"));
    addCase("Failed", `import { missing } from "./missing.ts";\n${component("{missing}")}`);
    write(
      "Importer.stories.ts",
      [
        `import guard from "./cases/Guard/Guard.uf.tsx";`,
        `import { named } from "./cases/Failed/Failed.uf.tsx";`,
        `export default { guard, named };`,
        ``,
      ].join("\n"),
    );
    const { run } = attempts(["Importer.stories"], () => [framework()]);

    await expect(run()).resolves.toBe(0);

    expect(failedModules()).toEqual([
      "Importer.stories.ts",
      "cases/Failed/Failed.uf.tsx.vue",
      "cases/Guard/Guard.uf.tsx.vue",
    ]);
    expect(causeOf("Guard.uf.tsx.vue")).toBe("guard: differs from its golden file");
  });

  it("rebuilds without a module with a syntax error, which Vite names only in its message", async () => {
    write("Good.stories.ts", `export default { good: true };\n`);
    write("Bad.stories.ts", `const = 1;\n`);
    write("Tsx.stories.ts", `import part from "./part.tsx";\nexport default { part };\n`);
    write("part.tsx", `const = <p />;\n`);
    const { run, count } = attempts(["Good.stories", "Bad.stories", "Tsx.stories"], () => []);

    await expect(run()).resolves.toBe(0);

    expect(count()).toBe(2);
    await expect(chunk("Good.stories")).resolves.toMatchObject({ default: { good: true } });
    await expect(chunk("Bad.stories")).rejects.toThrow("Unexpected token");
    await expect(chunk("Tsx.stories")).rejects.toThrow("Unexpected token");
    expect(failedModules()).toEqual(["Bad.stories.ts", "part.tsx"]);
    expect(causeOf("Bad.stories.ts")).toContain("Unexpected token");
  });

  it("rebuilds without each module with a bare import of a missing package", async () => {
    write("Good.stories.ts", `export default { good: true };\n`);
    write("Bad.stories.ts", `import "no-such-package-uf";\nexport default {};\n`);
    write("Helped.stories.ts", `import "./helper.ts";\nexport default {};\n`);
    write("helper.ts", `import "no-such-helper-uf";\n`);
    const entries = ["Good.stories", "Bad.stories", "Helped.stories"];
    const { run, count } = attempts(entries, () => []);

    await expect(run()).resolves.toBe(0);

    // Vite throws on the first miss it hears of, so each build finds one.
    expect(count()).toBe(3);
    await expect(chunk("Good.stories")).resolves.toMatchObject({ default: { good: true } });
    await expect(chunk("Bad.stories")).rejects.toThrow("no-such-package-uf");
    await expect(chunk("Helped.stories")).rejects.toThrow("no-such-helper-uf");
    expect(failedModules()).toEqual(["Bad.stories.ts", "helper.ts"]);
  });

  it("hears only of an unresolved import, and only inside the root", () => {
    const file = join(root, "aborts.json");
    const { plugin } = isolateFailures(root, file);
    const onLog = plugin.onLog as (level: string, log: unknown) => void;
    onLog("warn", { code: "CIRCULAR", id: join(root, "a.ts"), message: "only a warning" });
    onLog("warn", { code: "UNRESOLVED_IMPORT", id: "/outside/lib.js", message: "missed" });
    expect(existsSync(file)).toBe(false);
  });

  it("stays aborted on an error whose message names no file", () => {
    const file = join(root, "aborts.json");
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
    const { plugin } = isolateFailures(root, file);
    const buildEnd = plugin.buildEnd as (error: unknown) => void;
    buildEnd({ errors: [{ message: "[builtin:vite-json] plugin threw an error" }] });
    // What a syntax error in a virtual module says: its banner isn't a path.
    buildEnd({ errors: [{ message: "Unexpected token\n   ╭─[ virtual:engine.ts:1:7 ]\n" }] });
    cwd.mockRestore();
    expect(existsSync(file)).toBe(false);
  });

  it("rebuilds as long as each abort names another module", async () => {
    write("base.ts", `export default 1;\n`);
    write("middle.ts", `import { one } from "./base.ts";\nexport const two = one;\n`);
    write("Top.stories.ts", `import { two } from "./middle.ts";\nexport default { two };\n`);
    const { run, count } = attempts(["Top.stories"], () => []);

    await expect(run()).resolves.toBe(0);

    expect(count()).toBe(3);
    await expect(chunk("Top.stories")).rejects.toThrow("MISSING_EXPORT");
    expect(failedModules()).toEqual(["Top.stories.ts", "middle.ts"]);
  });

  it("rebuilds without a sheet Vite's own CSS plugin can't read", async () => {
    write("Bad.stories.ts", `import "./sheet.css";\nexport default {};\n`);
    write("sheet.css", `@import "./nothing-here.css";\n`);
    const { run, count } = attempts(["Bad.stories"], () => []);

    await expect(run()).resolves.toBe(0);

    expect(count()).toBe(2);
    await expect(chunk("Bad.stories")).rejects.toThrow("nothing-here.css");
    expect(failedModules()).toEqual(["sheet.css"]);
  });

  it("stops when an abort names nothing new", async () => {
    const error = { errors: [{ id: join(root, "Top.stories.ts"), message: "again" }] };
    let count = 0;
    const code = await buildIsolated(join(root, "aborts.json"), (env) => {
      count += 1;
      const { plugin } = isolateFailures(root, env[ABORTS_ENV]);
      (plugin.renderError as (error: unknown) => void)(error);
      return Promise.resolve(1);
    });

    expect(code).toBe(1);
    expect(count).toBe(2);
  });

  it("stays aborted when one of its errors is outside the root", async () => {
    const file = join(root, "aborts.json");
    const { plugin } = isolateFailures(root, file);
    (plugin.buildEnd as (error: unknown) => void)({
      errors: [
        { id: join(root, "A.ts"), message: "in the root" },
        { id: "/outside/lib.js", message: "outside it" },
      ],
    });
    expect(existsSync(file)).toBe(false);
    (plugin.buildEnd as (error: unknown) => void)({
      errors: [{ id: join(root, "A.ts"), message: "in the root" }, { message: "no module" }],
    });
    expect(existsSync(file)).toBe(false);
  });

  it("stays aborted on a module outside the root, which is no case's", async () => {
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "uf-visual-outside-")));
    try {
      writeFileSync(join(outside, "bad.js"), `export const = 1;\n`);
      write("Top.stories.ts", `import "${outside}/bad.js";\nexport default {};\n`);
      const { run, count } = attempts(["Top.stories"], () => []);

      await expect(run()).resolves.toBe(1);

      expect(count()).toBe(1);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("aborts with no rebuild when no one asked for one", async () => {
    write("base.ts", `export default 1;\n`);
    write("Top.stories.ts", `import { one } from "./base.ts";\nexport default { one };\n`);
    await expect(build(["Top.stories"], [])).rejects.toThrow("MISSING_EXPORT");
  });

  it("starts from nothing, whatever an earlier command left", async () => {
    write("Top.stories.ts", `export default {};\n`);
    const file = join(root, "aborts.json");
    writeFileSync(
      file,
      JSON.stringify([{ module: join(root, "Top.stories.ts"), cause: "from an earlier command" }]),
    );
    const { run } = attempts(["Top.stories"], () => []);

    await expect(run()).resolves.toBe(0);

    await expect(chunk("Top.stories")).resolves.toBeDefined();
    expect(manifest().failures).toEqual([]);
  });

  it("merges every error one module raises into one cause", async () => {
    write("base.ts", `export default 1;\n`);
    write("Top.stories.ts", `import { a, b } from "./base.ts";\nexport default { a, b };\n`);
    const { run } = attempts(["Top.stories"], () => []);

    await expect(run()).resolves.toBe(0);

    const [failure, ...rest] = manifest().failures;
    expect(rest).toEqual([]);
    expect(failure?.cause).toMatch(/"a" is not exported[^]*"b" is not exported/);
  });
});
