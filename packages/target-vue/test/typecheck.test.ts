import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { goldenFiles, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };
/** vue-tsc takes about a second; give it room on a loaded machine. */
const checker = { timeout: 60_000 };

afterAll(removeScratch);

describe("vue typecheck", () => {
  it("checks the corpus and an injected error in one run, by file", checker, async () => {
    const golden = goldenFiles();
    expect(golden.length).toBeGreaterThan(0);
    const { "Child.vue": child, "Broken.vue": broken } = writeScratch({
      "Child.vue": "<template>\n  <p>Child</p>\n</template>\n",
      "Broken.vue": [
        '<script setup lang="ts">',
        'import Child from "./Child.vue";',
        "",
        'const count: number = "one";',
        "</script>",
        "",
        "<template>",
        "  <p>{{ greet(count) }}</p>",
        '  <Child unknown-prop="1" />',
        "</template>",
        "",
      ].join("\n"),
    });

    const results = await toolchain.typecheck([...golden, child!, broken!], context);

    expect([...results.keys()].toSorted()).toEqual([...golden, child!, broken!].toSorted());
    for (const path of [...golden, child!]) expect(results.get(path), path).toEqual([]);
    expect(results.get(broken!)).toEqual([
      {
        message: "Type 'string' is not assignable to type 'number'.",
        line: 4,
        column: 7,
        code: "TS2322",
      },
      {
        message: expect.stringMatching(/^Property 'greet' does not exist on type/),
        line: 8,
        column: 9,
        code: "TS2339",
      },
      // Only an error under the toolchain tsconfig's strictTemplates, so it proves the
      // temporary tsconfig extends it.
      {
        message: expect.stringContaining("'unknownProp' does not exist"),
        line: 9,
        column: 10,
        code: "TS2353",
      },
    ]);
  });

  it("reports an error in a file a checked file imports, under that file", checker, async () => {
    const { "Uses.vue": uses, "helper.ts": helper } = writeScratch({
      "helper.ts": 'export const count: number = "one";\n',
      "Uses.vue": [
        '<script setup lang="ts">',
        'import { count } from "./helper";',
        "</script>",
        "",
        "<template>",
        "  <p>{{ count }}</p>",
        "</template>",
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

  it("reports a broken toolchain tsconfig, and errors without a file, too", checker, async () => {
    // Inside the real toolchain directory, so vue-tsc resolves from it.
    const broken = join(toolchainDir, ".uf-tmp", `broken-toolchain-${process.pid}`);
    mkdirSync(broken, { recursive: true });
    try {
      const config = {
        extends: "../../tsconfig.json",
        // An option vue-tsc does not know, and no standard library: global types go missing.
        compilerOptions: { notAnOption: true, lib: [], noLib: true },
      };
      writeFileSync(join(broken, "tsconfig.json"), JSON.stringify(config));
      const [golden] = goldenFiles();
      const results = await toolchain.typecheck([golden!], { toolchainDir: broken, root: broken });
      const own = join(realpathSync(broken), "tsconfig.json");
      const [run, ...rest] = [...results.keys()].filter((key) => key !== golden && key !== own);
      expect(rest).toEqual([]);
      expect(results.get(golden!)).toEqual([]);
      expect(results.get(own)).toEqual([
        expect.objectContaining({
          message: "Unknown compiler option 'notAnOption'.",
          code: "TS5023",
        }),
      ]);
      expect(run).toMatch(/\/\.uf-tmp\/typecheck-[^/]+\/tsconfig\.json$/);
      expect(results.get(run!)).toContainEqual({
        message: "Cannot find global type 'Array'.",
        code: "TS2318",
      });
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });

  it("rejects when a listed file does not exist", async () => {
    const missing = join(toolchainDir, ".uf-tmp", "Missing.vue");
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
