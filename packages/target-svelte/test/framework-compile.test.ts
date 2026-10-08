import { describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { corpus, emitFormatted, toolchainDir } from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };
const RUNES = "<svelte:options runes={true} />\n\n";

/** Compiles one in-memory file and returns its result. */
async function compileOne(contents: string, path = "/virtual/Component.svelte") {
  const results = await toolchain.frameworkCompile([{ path, contents }], context);
  expect([...results.keys()]).toEqual([path]);
  return results.get(path)!;
}

describe("svelte frameworkCompile", () => {
  const cases = corpus();

  it("has corpus cases to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  // What the target emits now, not the committed goldens, which change only with `test:update`.
  // One test per case, so no test's time grows with the corpus. As one test over the cases M2
  // left, it took 0.6 s alone on a laptop and overran Vitest's 5 s default in CI's Unit tests.
  it.each(cases)(
    "accepts what the target emits for $name without a warning",
    async ({ name, module }) => {
      for (const file of await emitFormatted(module)) {
        expect(await compileOne(file.contents, `/virtual/${name}/${file.path}`), name).toEqual({
          errors: [],
          warnings: [],
        });
      }
    },
  );

  it("reports a mismatched closing tag as an error, where it is", async () => {
    expect(await compileOne(`${RUNES}<p class="greeting">Hello</span>\n`)).toEqual({
      errors: [
        {
          message: expect.stringContaining(
            "`</span>` attempted to close an element that was not open",
          ),
          line: 3,
          column: 26,
          code: "element_invalid_closing_tag",
        },
      ],
      warnings: [],
    });
  });

  it("reports an accessibility warning once, though both passes see it", async () => {
    expect(await compileOne(`${RUNES}<img src="/a.png" />\n`)).toEqual({
      errors: [],
      warnings: [
        {
          message: expect.stringContaining("`<img>` element should have an alt attribute"),
          line: 3,
          column: 1,
          code: "a11y_missing_attribute",
        },
      ],
    });
  });

  it("reports a component that would compile in legacy mode", async () => {
    expect(await compileOne('<p class="greeting">Hello</p>\n')).toEqual({
      errors: [{ message: expect.stringContaining("legacy mode"), code: "legacy_mode" }],
      warnings: [],
    });
  });

  it("rejects legacy syntax in a runes-mode component", async () => {
    const result = await compileOne(`${RUNES}<script>\n  export let name;\n</script>\n`);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "legacy_export_invalid", line: 4, column: 3 }),
    ]);
  });

  it("checks every file it is given, independently", async () => {
    const results = await toolchain.frameworkCompile(
      [
        { path: "/virtual/Good.svelte", contents: `${RUNES}<p>Good</p>\n` },
        { path: "/virtual/Bad.svelte", contents: `${RUNES}<p>Bad</span>\n` },
      ],
      context,
    );
    expect(results.get("/virtual/Good.svelte")).toEqual({ errors: [], warnings: [] });
    expect(results.get("/virtual/Bad.svelte")!.errors).toHaveLength(1);
  });

  it("rejects a compile over no files", async () => {
    await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(
      "frameworkCompile received no files: a check over nothing proves nothing.",
    );
  });
});
