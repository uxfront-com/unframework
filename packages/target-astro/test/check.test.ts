import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { astroTypecheck } from "../src/toolchain/check.ts";
import { scratchDirectory } from "./astro.ts";
import { goldenAstroFiles, integrationRoot, toolchainDir } from "./workspace.ts";

const context = { toolchainDir, root: integrationRoot };
const scratch = scratchDirectory("check");
afterAll(() => scratch.remove());

function write(name: string, contents: string): string {
  const path = join(scratch.path, name);
  writeFileSync(path, contents);
  return path;
}

describe("astro check over output (L4)", { timeout: 60_000 }, () => {
  it("passes every golden output, in one run, with an entry per file", async () => {
    const files = goldenAstroFiles().map((golden) => golden.path);
    const results = await astroTypecheck(files, context);
    expect([...results]).toEqual(files.map((file) => [file, []]));
  });

  it("reports each type error against its own file, in TypeScript 6's words", async () => {
    const clean = write("Clean.astro", '<p class="greeting">Hello, world!</p>\n');
    const script = write("Script.astro", '---\nconst n: number = "s";\n---\n\n<p>{n}</p>\n');
    const template = write("Template.astro", "<p>{greet()}</p>\n");
    const results = await astroTypecheck([clean, script, template], context);
    expect(Object.fromEntries(results)).toEqual({
      [clean]: [],
      [script]: [
        {
          message: "Type 'string' is not assignable to type 'number'.",
          line: 2,
          column: 7,
          code: "TS2322",
        },
      ],
      [template]: [{ message: "Cannot find name 'greet'.", line: 1, column: 5, code: "TS2304" }],
    });
  });

  it("leaves out hints, which are editor suggestions", async () => {
    const unused = write("Unused.astro", "---\nconst unused = 1;\n---\n\n<p>x</p>\n");
    expect(await astroTypecheck([unused], context)).toEqual(new Map([[unused, []]]));
  });

  it("removes its temporary tsconfig", async () => {
    const clean = write("Tidy.astro", "<p>tidy</p>\n");
    await astroTypecheck([clean], context);
    const leftovers = readdirSync(join(toolchainDir, ".uf-tmp")).filter((name) =>
      name.includes(`.${process.pid}.`),
    );
    expect(leftovers).toEqual([]);
  });

  it("rejects when the toolchain has no checker", async () => {
    const empty = mkdtempSync(join(tmpdir(), "uf-astro-toolchain-"));
    try {
      writeFileSync(join(empty, "tsconfig.json"), "{}\n");
      const clean = write("NoChecker.astro", "<p>x</p>\n");
      await expect(astroTypecheck([clean], { toolchainDir: empty, root: empty })).rejects.toThrow(
        `@astrojs/check is not installed in ${empty}`,
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("rejects when the checker resolves a TypeScript without a JS API (TypeScript 7)", async () => {
    const toolchain = mkdtempSync(join(tmpdir(), "uf-astro-toolchain-"));
    const install = (name: string, manifest: object, code: string) => {
      const directory = join(toolchain, "node_modules", name);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "package.json"), JSON.stringify({ name, ...manifest }));
      writeFileSync(join(directory, "index.js"), code);
    };
    try {
      writeFileSync(join(toolchain, "tsconfig.json"), "{}\n");
      install("@astrojs/check", { main: "index.js" }, "module.exports = {};\n");
      install("typescript", { version: "7.0.2", main: "index.js" }, 'exports.version = "7.0.2";\n');
      const clean = write("Typescript7.astro", "<p>x</p>\n");
      await expect(
        astroTypecheck([clean], { toolchainDir: toolchain, root: toolchain }),
      ).rejects.toThrow("resolves TypeScript 7.0.2, which has no JS API");
    } finally {
      rmSync(toolchain, { recursive: true, force: true });
    }
  });

  it("rejects when the toolchain has no tsconfig.json", async () => {
    const clean = write("NoConfig.astro", "<p>x</p>\n");
    await expect(
      astroTypecheck([clean], { toolchainDir: scratch.path, root: scratch.path }),
    ).rejects.toThrow("the toolchain has no tsconfig.json");
  });

  it("reports a toolchain tsconfig that does not parse, which AstroCheck ignores", async () => {
    // Inside the real toolchain directory, so the checker itself resolves.
    const broken = join(toolchainDir, ".uf-tmp", `broken-toolchain-${process.pid}`);
    mkdirSync(broken, { recursive: true });
    try {
      const config = { extends: "../../tsconfig.json", compilerOptions: { notAnOption: true } };
      writeFileSync(join(broken, "tsconfig.json"), JSON.stringify(config));
      const clean = write("BrokenConfig.astro", "<p>x</p>\n");
      const results = await astroTypecheck([clean], {
        toolchainDir: broken,
        root: integrationRoot,
      });
      expect(Object.fromEntries(results)).toEqual({
        [clean]: [],
        [join(broken, "tsconfig.json")]: [
          {
            message: "Unknown compiler option 'notAnOption'.",
            line: 1,
            column: expect.any(Number),
            code: "TS5023",
          },
        ],
      });
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });

  it("reports a tsconfig error without a position against the tsconfig it ran with", async () => {
    const broken = join(toolchainDir, ".uf-tmp", `missing-base-${process.pid}`);
    mkdirSync(broken, { recursive: true });
    try {
      writeFileSync(join(broken, "tsconfig.json"), '{ "extends": "./missing.json" }\n');
      const clean = write("MissingBase.astro", "<p>x</p>\n");
      const results = await astroTypecheck([clean], {
        toolchainDir: broken,
        root: integrationRoot,
      });
      const [other, ...rest] = [...results.keys()].filter((key) => key !== clean);
      expect(rest).toEqual([]);
      expect(other).toMatch(/\/\.uf-tmp\/tsconfig\.astro-check\.\d+\.\d+\.json$/);
      expect(results.get(other!)).toEqual([
        expect.objectContaining({
          message: expect.stringContaining("missing.json"),
          code: expect.stringMatching(/^TS\d+$/),
        }),
      ]);
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });

  it("rejects a missing file instead of reporting it clean", async () => {
    const missing = join(scratch.path, "Missing.astro");
    await expect(astroTypecheck([missing], context)).rejects.toThrow(
      `typecheck received files that do not exist:\n${missing}`,
    );
  });

  it("rejects a relative path", async () => {
    await expect(astroTypecheck(["Hello.astro"], context)).rejects.toThrow(
      "typecheck needs absolute paths, got: Hello.astro",
    );
  });

  it("rejects a check over no files", async () => {
    await expect(astroTypecheck([], context)).rejects.toThrow(
      "typecheck received no files: a check over nothing proves nothing.",
    );
  });
});
