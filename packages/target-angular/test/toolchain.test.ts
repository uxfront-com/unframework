import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import manifest from "../package.json" with { type: "json" };
import { toolchain } from "../src/toolchain/index.ts";
import { strictOptions } from "../src/toolchain/ngtsc.ts";
import { loadCompiler } from "../src/toolchain/tools.ts";
import {
  component,
  context,
  goldenFiles,
  isolatedDir,
  removeScratch,
  scratchDir,
  writeFiles,
} from "./helpers.ts";

afterAll(removeScratch);

const read = (path: string) => ({ path, contents: readFileSync(path, "utf8") });
const codes = (messages: readonly { code?: string }[]) =>
  messages.map((message) => message.code ?? "(no code)");

describe("the toolchain", () => {
  it("names its runtime entries after the package's exports", () => {
    expect(toolchain.name).toBe("angular");
    for (const specifier of [toolchain.client, toolchain.server]) {
      const subpath = specifier.replace("@unframework/target-angular", ".");
      expect(manifest.exports, specifier).toHaveProperty([subpath]);
    }
  });
});

describe("frameworkCompile (L3)", () => {
  const goldens = goldenFiles();

  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output with no errors and no warnings", async () => {
    expect(goldens.length).toBeGreaterThan(0);
    const results = await toolchain.frameworkCompile(goldens.map(read), context);
    expect([...results.keys()].toSorted()).toEqual(goldens.toSorted());
    for (const [path, result] of results)
      expect(result, path).toEqual({ errors: [], warnings: [] });
  }, 60_000);

  it("reports a mismatched closing tag as NG5002 on its file only", async () => {
    const [golden, ...others] = goldens.map(read);
    const broken = { ...golden!, contents: golden!.contents.replace("</p>", "</span>") };
    const results = await toolchain.frameworkCompile([broken, ...others], context);
    const { errors, warnings } = results.get(broken.path)!;
    expect(codes(errors)).toEqual(["NG5002"]);
    expect(errors[0]!.message).toMatch(/Unexpected closing tag "span"/);
    const line = broken.contents.split("\n").findIndex((text) => text.includes("</span>")) + 1;
    expect(errors[0]!.line).toBe(line);
    expect(warnings).toEqual([]);
    for (const other of others) {
      expect(results.get(other.path), other.path).toEqual({ errors: [], warnings: [] });
    }
  });

  it("reports a type error against the file that has it, at 1-based positions", async () => {
    const path = join(scratchDir(), "typed.ts");
    const contents = component("Typed", "<p>x</p>", '\n  readonly count: number = "one";\n');
    const results = await toolchain.frameworkCompile(
      [{ path, contents }, ...goldens.map(read)],
      context,
    );
    expect(results.get(path)).toEqual({
      errors: [
        {
          message: "Type 'string' is not assignable to type 'number'.",
          line: 9,
          column: 12,
          code: "TS2322",
        },
      ],
      warnings: [],
    });
    for (const golden of goldens) expect(results.get(golden)!.errors, golden).toEqual([]);
  });

  // ngtsc silently skips template type-checking for a file whose directory TypeScript believes
  // missing, so files that exist only in memory must not live in a missing directory.
  it("type-checks the template of a file that exists only in memory", async () => {
    const path = join(isolatedDir(), "not", "on", "disk", "missing.ts");
    const results = await toolchain.frameworkCompile(
      [{ path, contents: component("Missing", "<p>{{ nope }}</p>") }],
      context,
    );
    expect(codes(results.get(path)!.errors)).toEqual(["TS2339"]);
  });

  it("reports extended template diagnostics as warnings", async () => {
    const path = join(isolatedDir(), "uninvoked.ts");
    const contents = component(
      "Uninvoked",
      '<button type="button" (click)="go">{{ name }}</button>',
      '\n  readonly name = input("x");\n  protected go(): void {}\n',
    );
    const results = await toolchain.frameworkCompile([{ path, contents }], context);
    expect(results.get(path)!.errors).toEqual([]);
    expect(codes(results.get(path)!.warnings).toSorted()).toEqual(["NG8109", "NG8111", "NG8117"]);
  });

  // ngc skips every semantic check of a program in which any file fails to parse.
  it("still checks the other files when one does not parse", async () => {
    const directory = isolatedDir();
    const broken = join(directory, "broken.ts");
    const template = join(directory, "template.ts");
    const results = await toolchain.frameworkCompile(
      [
        { path: broken, contents: component("Broken", "<p>x</p>", "\n  readonly x = ;\n") },
        { path: template, contents: component("Template", "<p>{{ nope }}</p>") },
      ],
      context,
    );
    expect(codes(results.get(broken)!.errors)).toEqual(["TS1109"]);
    expect(codes(results.get(template)!.errors)).toEqual(["TS2339"]);
  });

  it("rejects a compile over no files", async () => {
    await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(
      "frameworkCompile received no files: a check over nothing proves nothing.",
    );
  });
});

describe("typecheck (L4)", () => {
  const goldens = goldenFiles();

  it("type-checks every committed golden output clean in one run", async () => {
    const results = await toolchain.typecheck(goldens, context);
    expect([...results.keys()].toSorted()).toEqual(goldens.toSorted());
    for (const [path, messages] of results) expect(messages, path).toEqual([]);
  });

  it("reports a type error against the file that has it", async () => {
    const { "typed.ts": typed } = writeFiles(scratchDir(), {
      "typed.ts": component("Typed", "<p>x</p>", '\n  readonly count: number = "one";\n'),
    });
    const results = await toolchain.typecheck([typed!, ...goldens], context);
    expect(results.get(typed!)).toEqual([
      {
        message: "Type 'string' is not assignable to type 'number'.",
        line: 9,
        column: 12,
        code: "TS2322",
      },
    ]);
    for (const golden of goldens) expect(results.get(golden), golden).toEqual([]);
  });

  // The toolchain's tsconfig makes every extended template diagnostic an error.
  it("reports template diagnostics, extended ones included", async () => {
    const { "uninvoked.ts": uninvoked } = writeFiles(scratchDir(), {
      "uninvoked.ts": component(
        "Uninvoked",
        '<button type="button" (click)="go">{{ nope }}</button>',
        "\n  protected go(): void {}\n",
      ),
    });
    const results = await toolchain.typecheck([uninvoked!], context);
    expect(codes(results.get(uninvoked!)!).toSorted()).toEqual(["NG8111", "TS2339"]);
  });

  it("removes the temporary tsconfig it checks with", async () => {
    await toolchain.typecheck(goldens, context);
    const temporary = join(context.toolchainDir, ".uf-tmp");
    const left = existsSync(temporary)
      ? readdirSync(temporary).filter((name) => name.startsWith("tsconfig.typecheck."))
      : [];
    expect(left).toEqual([]);
  });

  it("reports an error in a file a checked file imports, under that file", async () => {
    const directory = scratchDir();
    const { "helper.ts": helper, "uses.ts": uses } = writeFiles(directory, {
      "helper.ts": 'export const label: number = "one";\n',
      "uses.ts": component(
        "Uses",
        "<p>{{ label }}</p>",
        "\n  protected readonly label = label;\n",
      ).replace(
        'from "@angular/core";',
        'from "@angular/core";\nimport { label } from "./helper";',
      ),
    });
    const results = await toolchain.typecheck([uses!], context);
    expect(results.get(uses!)).toEqual([]);
    const others = [...results.keys()].filter((key) => key !== uses);
    expect(others.map((key) => realpathSync(key))).toEqual([realpathSync(helper!)]);
    expect(results.get(others[0]!)).toEqual([
      {
        message: "Type 'string' is not assignable to type 'number'.",
        line: 1,
        column: 14,
        code: "TS2322",
      },
    ]);
  });

  it("reports a broken toolchain tsconfig, and errors without a file, too", async () => {
    // An unknown option, and two that conflict: an options error, which belongs to no file.
    const toolchainDir = brokenToolchain({ notAnOption: true, noLib: true });
    const results = await toolchain.typecheck(goldens, { toolchainDir, root: context.root });
    const own = join(toolchainDir, "tsconfig.json");
    expect(results.get(own)).toEqual([
      expect.objectContaining({
        message: "Unknown compiler option 'notAnOption'.",
        code: "TS5023",
      }),
    ]);
    const runs = [...results.keys()].filter((key) =>
      /\/\.uf-tmp\/tsconfig\.typecheck\.\d+\.\d+\.json$/.test(key),
    );
    expect(runs).toHaveLength(1);
    expect(results.get(runs[0]!)).toEqual([
      { message: "Option 'lib' cannot be specified with option 'noLib'.", code: "TS5053" },
    ]);
  });

  it("rejects when the toolchain directory has no tsconfig.json", async () => {
    const toolchainDir = scratchDir();
    writeFileSync(join(toolchainDir, "package.json"), "{}\n");
    symlinkSync(join(context.toolchainDir, "node_modules"), join(toolchainDir, "node_modules"));
    await expect(
      toolchain.typecheck(goldens, { toolchainDir, root: context.root }),
    ).rejects.toThrow(/Cannot start the Angular type check/);
  });

  it("rejects a check over no files", async () => {
    await expect(toolchain.typecheck([], context)).rejects.toThrow(
      "typecheck received no files: a check over nothing proves nothing.",
    );
  });
});

/** A toolchain directory with Angular's compiler whose tsconfig extends the real one. */
function brokenToolchain(compilerOptions: object): string {
  const toolchainDir = scratchDir();
  writeFileSync(join(toolchainDir, "package.json"), "{}\n");
  symlinkSync(join(context.toolchainDir, "node_modules"), join(toolchainDir, "node_modules"));
  const config = { extends: join(context.toolchainDir, "tsconfig.json"), compilerOptions };
  writeFileSync(join(toolchainDir, "tsconfig.json"), JSON.stringify(config));
  return toolchainDir;
}

describe("a toolchain that cannot start", () => {
  const missing: ToolchainContext = { toolchainDir: "/nonexistent/toolchain", root: context.root };

  it("rejects every gate, naming the directory", async () => {
    const file = { path: goldenFiles()[0]!, contents: "" };
    await expect(toolchain.frameworkCompile([file], missing)).rejects.toThrow(
      /\/nonexistent\/toolchain has no package\.json/,
    );
    await expect(toolchain.typecheck([file.path], missing)).rejects.toThrow(
      /\/nonexistent\/toolchain/,
    );
    await expect(toolchain.vite("browser", missing)).rejects.toThrow(/\/nonexistent\/toolchain/);
  });

  it("rejects a directory without Angular's compiler, naming the package", async () => {
    const toolchainDir = isolatedDir();
    writeFileSync(join(toolchainDir, "package.json"), "{}\n");
    const file = { path: goldenFiles()[0]!, contents: "" };
    await expect(
      toolchain.frameworkCompile([file], { toolchainDir, root: context.root }),
    ).rejects.toThrow(/Cannot load @angular\/compiler-cli/);
  });

  it("rejects a project root that cannot run Angular", async () => {
    const root = isolatedDir();
    writeFileSync(join(root, "package.json"), "{}\n");
    await expect(
      toolchain.vite("browser", { toolchainDir: context.toolchainDir, root }),
    ).rejects.toThrow(/Cannot resolve @angular\/core from/);
  });
});

describe("vite", () => {
  const analogTsconfig = join(context.toolchainDir, ".uf-tmp", "tsconfig.analog.json");

  it("compiles with ngtsc ahead of Analog, and links the pre-bundled runtime", async () => {
    const config = await toolchain.vite("browser", context);
    const names = (config.plugins as { name: string }[]).map((plugin) => plugin.name);
    expect(names[0]).toBe("unframework:angular-ngtsc");
    expect(names).toContain("@analogjs/vite-plugin-angular");
    expect(config.optimizeDeps?.include).toEqual([
      "@angular/core",
      "@angular/common",
      "@angular/platform-browser",
    ]);
    const optimizer = config.optimizeDeps?.rolldownOptions?.plugins as { name: string }[];
    expect(optimizer.map((plugin) => plugin.name)).toEqual(["unframework:angular-linker"]);
    expect(config.resolve?.dedupe).toContain("@angular/core");
  });

  // Rendering with them is tested in server.test.ts, on this configuration.
  it("inlines Angular's packages into the SSR module graph, and links them there", async () => {
    const config = await toolchain.vite("ssr", context);
    const names = (config.plugins as { name: string }[]).map((plugin) => plugin.name);
    expect(names[0]).toBe("unframework:angular-ngtsc");
    expect(names.at(-1)).toBe("unframework:angular-ssr-linker");
    const [angular, ...others] = (config.ssr?.noExternal ?? []) as RegExp[];
    expect(others).toEqual([]);
    // Vite matches the specifier, Vitest the resolved path.
    for (const id of [
      "@angular/common",
      "/repo/node_modules/.pnpm/@angular+common@22.2.1/node_modules/@angular/common/fesm2022/common.mjs",
    ]) {
      expect(angular!.test(id), id).toBe(true);
    }
    expect(angular!.test("rxjs")).toBe(false);
    expect(config.test?.pool).toBe("forks");
    expect(config.optimizeDeps).toBeUndefined();
    expect(config.resolve?.dedupe).toContain("@angular/platform-server");
  });

  it("gives Analog an empty program", async () => {
    await toolchain.vite("browser", context);
    expect(JSON.parse(readFileSync(analogTsconfig, "utf8"))).toMatchObject({ files: [] });
  });
});

// L3 checks in memory with `strictOptions`; L4 reads the toolchain's tsconfig. They must agree
// on everything but where the extended diagnostics land.
describe("the toolchain's tsconfig", () => {
  it("has L3's options, with extended template diagnostics as errors", async () => {
    const compiler = await loadCompiler(context.toolchainDir);
    const project = join(context.toolchainDir, "tsconfig.json");
    const { options, errors } = compiler.cli.readConfiguration(project);
    expect(errors).toEqual([]);
    const { paths, extendedDiagnostics, ...strict } = strictOptions(compiler);
    expect(options).toMatchObject(strict);
    expect(options.extendedDiagnostics).toEqual({ defaultCategory: "error" });
    expect(extendedDiagnostics).toEqual({ defaultCategory: "warning" });
    const base = options.pathsBasePath as string;
    const resolved = (options.paths as Record<string, string[]>)["@angular/*"]!.map((target) =>
      resolve(base, target),
    );
    expect(resolved).toEqual((paths as Record<string, string[]>)["@angular/*"]);
  });
});
