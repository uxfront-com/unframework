import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainMessage } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import {
  corpus,
  emitFormatted,
  goldenFiles,
  packageDir,
  removeScratch,
  toolchainDir,
  writeScratch,
} from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };
/** svelte-check takes about a second; give it room on a loaded machine. */
const checker = { timeout: 60_000 };

afterAll(removeScratch);

/**
 * Type-checks a golden output with a toolchain tsconfig that extends the real one with
 * `compilerOptions`. The toolchain sits inside the real toolchain directory, so svelte-check
 * resolves from it; `tsconfig` is where its tsconfig was.
 */
async function checkWithBrokenToolchain(
  compilerOptions: object,
): Promise<{ results: Map<string, ToolchainMessage[]>; tsconfig: string }> {
  const broken = join(toolchainDir, ".uf-tmp", `broken-toolchain-${process.pid}`);
  mkdirSync(broken, { recursive: true });
  try {
    const config = { extends: "../../tsconfig.json", compilerOptions };
    writeFileSync(join(broken, "tsconfig.json"), JSON.stringify(config));
    const [golden] = goldenFiles();
    const tsconfig = join(realpathSync(broken), "tsconfig.json");
    return {
      results: await toolchain.typecheck([golden!], { toolchainDir: broken, root: broken }),
      tsconfig,
    };
  } finally {
    rmSync(broken, { recursive: true, force: true });
  }
}

describe("svelte typecheck", () => {
  it("checks the corpus and an injected error in one run, by file", checker, async () => {
    const golden = goldenFiles();
    expect(golden.length).toBeGreaterThan(0);
    const emitted: Record<string, string> = {};
    for (const { module } of corpus()) {
      for (const file of await emitFormatted(module)) emitted[file.path] = file.contents;
    }
    const fresh = Object.values(writeScratch(emitted));
    const { "Broken.svelte": broken } = writeScratch({
      "Broken.svelte": [
        "<svelte:options runes={true} />",
        "",
        '<script lang="ts">',
        '  const count: number = "one";',
        "</script>",
        "",
        "<p>{greet(count)}</p>",
        '<img src="/a.png" />',
        "",
      ].join("\n"),
    });

    const clean = [...golden, ...fresh];
    const results = await toolchain.typecheck([...clean, broken!], context);

    expect([...results.keys()].toSorted()).toEqual([...clean, broken!].toSorted());
    for (const path of clean) expect(results.get(path), path).toEqual([]);
    // The `<img>` without `alt` is the Svelte compiler's warning, which L3 reports: not a type.
    expect(results.get(broken!)).toEqual([
      {
        message: "Type 'string' is not assignable to type 'number'.",
        line: 4,
        column: 9,
        code: "TS2322",
      },
      { message: "Cannot find name 'greet'.", line: 7, column: 5, code: "TS2304" },
    ]);
  });

  it("leaves the Svelte compiler's warnings to L3", checker, async () => {
    const contents =
      '<svelte:options runes={true} />\n\n<div tabindex="1">a</div>\n<img src="/a.png" />\n';
    const { "A11y.svelte": a11y } = writeScratch({ "A11y.svelte": contents });
    const compiled = await toolchain.frameworkCompile([{ path: a11y!, contents }], context);
    const codes = compiled.get(a11y!)!.warnings.map((warning) => warning.code ?? "");
    expect(codes.toSorted((a, b) => a.localeCompare(b))).toEqual([
      "a11y_missing_attribute",
      "a11y_no_noninteractive_tabindex",
      "a11y_positive_tabindex",
    ]);
    expect(await toolchain.typecheck([a11y!], context)).toEqual(new Map([[a11y!, []]]));
  });

  // L3 reports it too, but a file the checker could not read must not pass L4 unchecked.
  it("reports a file svelte2tsx cannot parse", checker, async () => {
    const { "Unparsable.svelte": unparsable } = writeScratch({
      "Unparsable.svelte": "<svelte:options runes={true} />\n\n<p>Hello</span>\n",
    });
    const results = await toolchain.typecheck([unparsable!], context);
    expect(results.get(unparsable!)).toEqual([
      expect.objectContaining({ line: 3, code: expect.any(String) }),
    ]);
  });

  it("reports an error in a file a checked file imports, under that file", checker, async () => {
    const { "Uses.svelte": uses, "helper.ts": helper } = writeScratch({
      "helper.ts": 'export const count: number = "one";\n',
      "Uses.svelte": [
        "<svelte:options runes={true} />",
        "",
        '<script lang="ts">',
        '  import { count } from "./helper";',
        "</script>",
        "",
        "<p>{count}</p>",
        "",
      ].join("\n"),
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

  it("reports a broken toolchain tsconfig against that tsconfig", checker, async () => {
    const { results, tsconfig } = await checkWithBrokenToolchain({ notAnOption: true });
    expect(results.get(tsconfig)).toEqual([
      expect.objectContaining({
        message: "Unknown compiler option 'notAnOption'.",
        code: "TS5023",
      }),
    ]);
  });

  it("reports an error without a file against the tsconfig the run used", checker, async () => {
    // No standard library: the global types go missing.
    const { results } = await checkWithBrokenToolchain({ lib: [], noLib: true });
    const runs = [...results.keys()].filter((key) =>
      /\/\.uf-tmp\/typecheck-[^/]+\/tsconfig\.json$/.test(key),
    );
    expect(runs).toHaveLength(1);
    expect(results.get(runs[0]!)).toContainEqual(
      expect.objectContaining({ message: "Cannot find global type 'Array'.", code: "TS2318" }),
    );
  });

  // svelte-check returns no diagnostics for a file under node_modules, and counts it as checked.
  it("rejects a file svelte-check would skip, under node_modules", async () => {
    const directory = join(
      packageDir,
      ".uf-tmp",
      `node_modules-${process.pid}`,
      "node_modules",
      "pkg",
    );
    mkdirSync(directory, { recursive: true });
    try {
      const hidden = join(directory, "Hidden.svelte");
      writeFileSync(hidden, "<p>hidden</p>\n");
      await expect(toolchain.typecheck([hidden], context)).rejects.toThrow(
        `svelte-check reports every file under node_modules as clean without checking it, so it cannot type-check:\n${hidden}`,
      );
    } finally {
      rmSync(join(packageDir, ".uf-tmp", `node_modules-${process.pid}`), {
        recursive: true,
        force: true,
      });
    }
  });

  it("rejects when a listed file does not exist", async () => {
    const missing = join(toolchainDir, ".uf-tmp", "Missing.svelte");
    await expect(toolchain.typecheck([missing], context)).rejects.toThrow(
      `typecheck received files that do not exist:\n${missing}`,
    );
  });

  it("rejects a check over no files, before starting anything", async () => {
    await expect(
      toolchain.typecheck([], { toolchainDir: "/nonexistent", root: "/nonexistent" }),
    ).rejects.toThrow("typecheck received no files: a check over nothing proves nothing.");
  });
});
