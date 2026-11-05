// The configuration (plan §8.1, ADR-0076): loading a file through Node's type stripping, checking
// its shape, and applying the defaults.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/index.ts";
import type { LoadedConfig } from "../src/index.ts";
import type * as Targets from "../src/targets.ts";

// No built-in target declares a schema yet, so these two lend React and Vue one each.
vi.mock("../src/targets.ts", async (original) => {
  const module = await original<typeof Targets>();
  const schema = (validate: (value: unknown) => unknown) => ({
    "~standard": { version: 1, vendor: "test", validate },
  });
  return {
    ...module,
    builtinTargets: {
      ...module.builtinTargets,
      react: {
        ...module.builtinTargets.react,
        options: schema((value) =>
          (value as { compiler?: unknown }).compiler === true
            ? { value: { compiler: true, normalized: true } }
            : {
                issues: [
                  { message: "Expected true", path: ["compiler"] },
                  { message: "Expected a list", path: [{ key: "a/b" }, 0] },
                ],
              },
        ),
      },
      vue: {
        ...module.builtinTargets.vue,
        options: schema(() => {
          throw new Error("schema broke");
        }),
      },
    },
  };
});

const SEVEN = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];
const ENTRY = new URL("../src/index.ts", import.meta.url).href;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Runs `loadConfig` in Node itself: Vitest's module runner compiles what it imports, so only a
 * real `import()` meets the type stripping a project's config goes through.
 */
function load(
  files: Record<string, string>,
  file?: string,
): { root: string; result: LoadedConfig } {
  const root = mkdtempSync(join(tmpdir(), "uf-config-"));
  directories.push(root);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  const script = `import { loadConfig } from ${JSON.stringify(ENTRY)};
console.log(JSON.stringify(await loadConfig(...process.argv.slice(1))));`;
  const run = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script, root, ...(file === undefined ? [] : [file])],
    { encoding: "utf8" },
  );
  expect(run.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  return { root, result: JSON.parse(run.stdout) as LoadedConfig };
}

/** The only diagnostic of a config that fails to load. */
function failure(files: Record<string, string>, file?: string) {
  const { result } = load(files, file);
  expect(result.raw).toBeUndefined();
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({ code: "UF7001", severity: "error" });
  return result.diagnostics[0]!;
}

/** The codes and messages of a raw config's diagnostics. */
async function problems(raw: unknown): Promise<[string, string][]> {
  const { config, diagnostics } = await resolveConfig(raw);
  expect(config).toBeUndefined();
  return diagnostics.map(({ code, message }) => [code, message]);
}

describe("loadConfig", { timeout: 30_000 }, () => {
  it("imports a TypeScript config through Node's type stripping", () => {
    const { root, result } = load({
      "unframework.config.ts": `const targets: string[] = ["vue"];
export default { targets } satisfies { targets: string[] };
`,
    });
    expect(result).toEqual({
      raw: { targets: ["vue"] },
      directory: root,
      file: "unframework.config.ts",
      diagnostics: [],
    });
  });

  it.each(["unframework.config.mts", "unframework.config.js", "unframework.config.mjs"])(
    "finds %s",
    (name) => {
      const { result } = load({ [name]: `export default { strict: true };\n` });
      expect(result.file).toBe(name);
      expect(result.raw).toEqual({ strict: true });
    },
  );

  it("takes the first file in the documented order", () => {
    const { result } = load({
      "unframework.config.mjs": `export default { outDir: "mjs" };\n`,
      "unframework.config.js": `export default { outDir: "js" };\n`,
      "unframework.config.mts": `export default { outDir: "mts" };\n`,
    });
    expect(result.raw).toEqual({ outDir: "mts" });
  });

  it("gives an empty config when the project has no file", () => {
    const { root, result } = load({ "other.ts": "export default {};\n" });
    expect(result).toEqual({ raw: {}, directory: root, diagnostics: [] });
  });

  it("loads a named file, whose directory is the config's", () => {
    const { root, result } = load(
      { "config/custom.ts": `export default { srcDir: "components" };\n` },
      "config/custom.ts",
    );
    expect(result.raw).toEqual({ srcDir: "components" });
    expect(result.directory).toBe(join(root, "config"));
    expect(result.file).toBe(join("config", "custom.ts"));
  });

  describe("UF7001", () => {
    it("reports syntax type stripping cannot erase, and says why", () => {
      const { file, message } = failure({
        "unframework.config.ts": `enum Target { React }\nexport default { targets: [Target.React] };\n`,
      });
      expect(file).toBe("unframework.config.ts");
      expect(message).toContain("unframework.config.ts could not be loaded");
      expect(message).toContain("stripping its types");
      expect(message).toContain("such as an enum");
    });

    it("reports a named file that is missing", () => {
      const { file, message } = failure({}, "missing.config.ts");
      expect(file).toBe("missing.config.ts");
      expect(message).toContain("missing.config.ts could not be loaded");
    });

    it("reports a file that throws", () => {
      const { message } = failure({
        "unframework.config.js": `throw new Error("config exploded");\n`,
      });
      expect(message).toContain("config exploded");
      expect(message).not.toContain("stripping its types");
    });

    it("reports a file that throws something other than an error", () => {
      expect(failure({ "unframework.config.mjs": `throw null;\n` }).message).toContain("null");
    });

    it("reports a syntax error", () => {
      expect(failure({ "unframework.config.mjs": `export default {\n` }).code).toBe("UF7001");
    });

    it("reports a file that throws a value with no text", () => {
      const { message } = failure({
        "unframework.config.mjs": `throw Object.create(null);\n`,
      });
      expect(message).toContain("no text");
    });

    it("reports a file with no default export", () => {
      const { message } = failure({ "unframework.config.mjs": `export const targets = [];\n` });
      expect(message).toContain("no default export");
    });
  });
});

describe("resolveConfig", () => {
  it("applies the defaults", async () => {
    const { config, diagnostics } = await resolveConfig({}, { directory: "/project" });
    expect(diagnostics).toEqual([]);
    expect(config).toEqual({
      targets: SEVEN,
      srcDir: resolve("/project", "src"),
      outDir: resolve("/project", "dist"),
      targetOptions: {},
      typeOracle: "syntactic",
      strict: false,
    });
  });

  it("resolves against the working directory without an origin", async () => {
    const { config } = await resolveConfig({});
    expect(config?.srcDir).toBe(resolve("src"));
  });

  it("keeps what the config sets, in its order, and treats undefined as absent", async () => {
    const { config, diagnostics } = await resolveConfig(
      {
        targets: ["vue", "react"],
        srcDir: "../components",
        outDir: "/elsewhere/out",
        typeOracle: "tsgo",
        strict: true,
        targetOptions: { react: undefined },
        package: undefined,
      },
      { directory: "/project/config" },
    );
    expect(diagnostics).toEqual([]);
    expect(config).toEqual({
      targets: ["vue", "react"],
      srcDir: resolve("/project", "components"),
      outDir: resolve("/elsewhere/out"),
      targetOptions: {},
      typeOracle: "tsgo",
      strict: true,
    });
  });

  it("resolves package.resolveFrom against the config's directory", async () => {
    const one = await resolveConfig(
      { package: { resolveFrom: "../tools", targets: ["vue"] } },
      { directory: "/project/config" },
    );
    expect(one.config?.package).toEqual({
      targets: ["vue"],
      resolveFrom: resolve("/project", "tools"),
    });
    const each = await resolveConfig(
      { package: { resolveFrom: { vue: "tools/vue", react: "/abs", svelte: undefined } } },
      { directory: "/project" },
    );
    expect(each.config?.package).toEqual({
      resolveFrom: { vue: resolve("/project", "tools/vue"), react: resolve("/abs") },
    });
  });

  it("names the origin's file in its diagnostics", async () => {
    const { diagnostics } = await resolveConfig({ strict: 1 }, { file: "config/custom.ts" });
    expect(diagnostics[0]?.file).toBe("config/custom.ts");
  });

  describe("UF7002", () => {
    it.each([
      [undefined, ""],
      [null, ""],
      [[], ""],
      [() => ({}), ""],
      [new Date(0), ""],
      [{ targets: "react" }, "/targets"],
      [{ targets: [] }, "/targets"],
      [{ targets: [1] }, "/targets/0"],
      [{ targets: ["react", "react"] }, "/targets/1"],
      [{ srcDir: 1 }, "/srcDir"],
      [{ srcDir: "" }, "/srcDir"],
      [{ srcDir: null }, "/srcDir"],
      [{ outDir: false }, "/outDir"],
      [{ targetOptions: [] }, "/targetOptions"],
      [{ typeOracle: "ts" }, "/typeOracle"],
      [{ typeOracle: "toString" }, "/typeOracle"],
      [{ strict: "yes" }, "/strict"],
      [{ strict: null }, "/strict"],
      [{ package: "x" }, "/package"],
      [{ package: { targets: "react" } }, "/package/targets"],
      [{ package: { targets: ["vue", "vue"] } }, "/package/targets/1"],
      [{ targets: ["react"], package: { targets: ["vue"] } }, "/package/targets/0"],
      [{ package: { resolveFrom: 1 } }, "/package/resolveFrom"],
      [{ package: { resolveFrom: "" } }, "/package/resolveFrom"],
      [{ package: { resolveFrom: [] } }, "/package/resolveFrom"],
      [{ package: { resolveFrom: { vue: 1 } } }, "/package/resolveFrom/vue"],
      [{ package: { extra: 1 } }, "/package/extra"],
    ])("reports %j at its JSON pointer", async (raw, pointer) => {
      const reported = await problems(raw);
      expect(reported).toHaveLength(1);
      expect(reported[0]![0]).toBe("UF7002");
      expect(reported[0]![1]).toContain(`The configuration at ${JSON.stringify(pointer)} `);
    });

    it("reports a field that throws as it is read", async () => {
      const raw = {
        get targets(): never {
          throw new Error("getter broke");
        },
      };
      const reported = await problems(raw);
      expect(reported).toHaveLength(1);
      expect(reported[0]![0]).toBe("UF7002");
      expect(reported[0]![1]).toContain("getter broke");
    });

    it("suggests the field a misspelt one means, and escapes its pointer", async () => {
      expect(await problems({ tragets: ["vue"] })).toEqual([
        [
          "UF7002",
          'The configuration at "/tragets" is not a field of the configuration. Did you mean `targets`?',
        ],
      ]);
      expect(await problems({ "a/b~c": 1 })).toEqual([
        ["UF7002", 'The configuration at "/a~1b~0c" is not a field of the configuration.'],
      ]);
    });

    it("reports every invalid field", async () => {
      const reported = await problems({ strict: 1, srcDir: 1, targets: ["reac"] });
      expect(reported.map(([code]) => code)).toEqual(["UF7003", "UF7002", "UF7002"]);
    });
  });

  describe("UF7003", () => {
    it("suggests the target a typo means", async () => {
      expect(await problems({ targets: ["vue", "reac"] })).toEqual([
        [
          "UF7003",
          'The configuration at "/targets/1" names the unknown target "reac". Did you mean `react`?',
        ],
      ]);
    });

    it("lists the targets when none is close", async () => {
      const [[code, message] = []] = await problems({ targets: ["flutter"] });
      expect(code).toBe("UF7003");
      expect(message).toContain(
        "The built-in targets are react, vue, svelte, solid, angular, qwik, astro.",
      );
    });

    it("does not take an inherited name for a target", async () => {
      const [[code] = []] = await problems({ targets: ["toString"] });
      expect(code).toBe("UF7003");
    });

    it.each([
      [{ package: { targets: ["sevlte"] } }, "/package/targets/0", "svelte"],
      [{ targetOptions: { sold: {} } }, "/targetOptions/sold", "solid"],
      [{ targetOptions: { constructor_: {} } }, "/targetOptions/constructor_", ""],
      [{ package: { resolveFrom: { qwk: "x" } } }, "/package/resolveFrom/qwk", "qwik"],
    ])("reports the name in %j", async (raw, pointer, meant) => {
      const reported = await problems(raw);
      expect(reported).toHaveLength(1);
      expect(reported[0]![0]).toBe("UF7003");
      expect(reported[0]![1]).toContain(`at ${JSON.stringify(pointer)} `);
      if (meant) expect(reported[0]![1]).toContain(`Did you mean \`${meant}\`?`);
    });
  });

  describe("UF7004", () => {
    it("reports each issue the target's schema raises, with the option's path", async () => {
      expect(await problems({ targetOptions: { react: { compiler: 1 } } })).toEqual([
        [
          "UF7004",
          'The configuration at "/targetOptions/react/compiler" is not valid: Expected true',
        ],
        [
          "UF7004",
          'The configuration at "/targetOptions/react/a~1b/0" is not valid: Expected a list',
        ],
      ]);
    });

    it("reports a schema that throws", async () => {
      const [[code, message] = []] = await problems({ targetOptions: { vue: {} } });
      expect(code).toBe("UF7004");
      expect(message).toContain('"/targetOptions/vue"');
      expect(message).toContain("schema broke");
    });

    it("keeps what the schema returns", async () => {
      const { config } = await resolveConfig({ targetOptions: { react: { compiler: true } } });
      expect(config?.targetOptions).toEqual({ react: { compiler: true, normalized: true } });
    });

    it("passes the options of a target without a schema through", async () => {
      const { config } = await resolveConfig({ targetOptions: { solid: { any: "thing" } } });
      expect(config?.targetOptions).toEqual({ solid: { any: "thing" } });
    });
  });
});
