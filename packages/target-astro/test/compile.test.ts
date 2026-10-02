import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { assertCompilerMatchesAstro, astroFrameworkCompile } from "../src/toolchain/compile.ts";
import { scratchDirectory } from "./astro.ts";
import { goldenAstroFiles, integrationRoot } from "./workspace.ts";

const context = { toolchainDir: integrationRoot, root: integrationRoot };
const scratch = scratchDirectory("compile");
afterAll(() => scratch.remove());

const file = (name: string, contents: string) => ({
  path: join(integrationRoot, "cases", "probe", name),
  contents,
});

describe("Astro's compiler over output (L3)", () => {
  it("accepts every golden output without a diagnostic", async () => {
    const files = goldenAstroFiles();
    expect(files.map((golden) => golden.path.slice(integrationRoot.length))).toContain(
      "/cases/basics/hello/__output__/astro/Hello.astro",
    );
    const results = await astroFrameworkCompile(files, context);
    expect([...results.keys()]).toEqual(files.map((golden) => golden.path));
    for (const result of results.values()) expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("reports a mismatched closing tag as errors, with 1-based positions", async () => {
    const broken = file("Mismatched.astro", '<div>\n  <p class="greeting">Hello</span>\n</div>\n');
    const results = await astroFrameworkCompile([broken], context);
    const { errors, warnings } = results.get(broken.path)!;
    expect(warnings).toEqual([]);
    expect(errors[0]).toEqual({
      message: "Closing tag '</span>' has no matching opening tag.",
      line: 2,
      column: 30,
    });
  });

  it("reports a syntax error in the frontmatter", async () => {
    const broken = file("Frontmatter.astro", "---\nconst a = ;\n---\n\n<p>{a}</p>\n");
    const results = await astroFrameworkCompile([broken], context);
    expect(results.get(broken.path)).toEqual({
      errors: [{ message: "Unexpected token", line: 2, column: 11 }],
      warnings: [],
    });
  });

  it("reports each file under its own path", async () => {
    const clean = file("Clean.astro", "<p>clean</p>\n");
    const broken = file("Broken.astro", "<div><p>broken</span></div>\n");
    const results = await astroFrameworkCompile([clean, broken], context);
    expect(results.get(clean.path)).toEqual({ errors: [], warnings: [] });
    expect(results.get(broken.path)!.errors.length).toBeGreaterThan(0);
  });

  it("checks with the compiler the project's astro uses", () => {
    expect(() => assertCompilerMatchesAstro(integrationRoot)).not.toThrow();
  });

  it("rejects when the project's astro compiles with another version", async () => {
    const root = join(scratch.path, "other-version");
    const astro = join(root, "node_modules", "astro");
    const compiler = join(astro, "node_modules", "@astrojs", "compiler-rs");
    mkdirSync(compiler, { recursive: true });
    writeFileSync(join(root, "package.json"), '{ "name": "project" }\n');
    writeFileSync(join(astro, "package.json"), '{ "name": "astro", "version": "7.3.5" }\n');
    writeFileSync(
      join(compiler, "package.json"),
      '{ "name": "@astrojs/compiler-rs", "version": "0.4.0" }\n',
    );
    await expect(
      astroFrameworkCompile([file("Clean.astro", "<p>clean</p>\n")], { toolchainDir: root, root }),
    ).rejects.toThrow("astro compiles with @astrojs/compiler-rs@0.4.0, but the toolchain checks");
  });

  it("rejects a compile over no files", async () => {
    await expect(astroFrameworkCompile([], context)).rejects.toThrow(
      "frameworkCompile received no files: a check over nothing proves nothing.",
    );
  });

  it("rejects when the project has no astro", () => {
    const root = mkdtempSync(join(tmpdir(), "uf-astro-"));
    try {
      expect(() => assertCompilerMatchesAstro(root)).toThrow("astro is not installed in");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
