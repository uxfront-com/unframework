import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { corpus, emitFormatted, goldenFiles, toolchainDir } from "./helpers.ts";
import { M2_SHAPES } from "./lint-probes.ts";

const context = { toolchainDir, root: toolchainDir };

/** Compiles one in-memory file and returns its result. */
async function compileOne(contents: string, path = "/virtual/Component.vue") {
  const results = await toolchain.frameworkCompile([{ path, contents }], context);
  expect([...results.keys()]).toEqual([path]);
  return results.get(path)!;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("vue frameworkCompile", () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output without a warning", async () => {
    const paths = goldenFiles();
    expect(paths.length).toBeGreaterThan(0);
    const results = await toolchain.frameworkCompile(
      paths.map((path) => ({ path, contents: readFileSync(path, "utf8") })),
      context,
    );
    expect([...results.keys()]).toEqual(paths);
    for (const path of paths) expect(results.get(path), path).toEqual({ errors: [], warnings: [] });
  }, 60_000);

  // One test per case, so no test's time grows with the corpus. As one test over the 172 cases
  // M2 left, it took 0.4 s alone on a laptop and overran Vitest's 5 s default in CI's Unit tests.
  it.each(corpus())("accepts what the target emits today for $name", async ({ name, module }) => {
    for (const file of await emitFormatted(module)) {
      expect(await compileOne(file.contents, `/virtual/${name}/${file.path}`), name).toEqual({
        errors: [],
        warnings: [],
      });
    }
  });

  it("accepts the shapes M2 emits (lint-probes.ts), for the DOM and the server", async () => {
    for (const [name, contents] of Object.entries(M2_SHAPES)) {
      expect(await compileOne(contents, `/virtual/m2/${name}`), name).toEqual({
        errors: [],
        warnings: [],
      });
    }
  });

  // Vue 3.5 compiles a destructured prop into a read of `__props`, so `watch(label, …)` would
  // watch a value: the output always watches a prop through a getter (UF2020 asks the source for
  // one), and the compiler refuses the other form.
  it("refuses a destructured prop passed whole to watch(), where the output writes a getter", async () => {
    const result = await compileOne(
      [
        '<script setup lang="ts">',
        'import { watch } from "vue";',
        "",
        "const { label } = defineProps<{ label: string }>();",
        "",
        "watch(label, () => {});",
        "</script>",
        "",
        "<template>",
        "  <p>{{ label }}</p>",
        "</template>",
        "",
      ].join("\n"),
    );
    expect(result.errors).toEqual([
      expect.objectContaining({ message: expect.stringContaining("destructured prop") }),
    ]);
  });

  it("reports a mismatched closing tag as an error, where it is", async () => {
    const result = await compileOne(
      '<template>\n  <p class="greeting">Hello</span>\n</template>\n',
    );
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([
      { message: "Invalid end tag.", line: 2, column: 28, code: "X_INVALID_END_TAG" },
      { message: "Element is missing end tag.", line: 2, column: 3, code: "X_MISSING_END_TAG" },
    ]);
  });

  it("names the DOM compiler's own error codes", async () => {
    expect(await compileOne("<template>\n  <div v-html></div>\n</template>\n")).toEqual({
      errors: [
        {
          message: "v-html is missing expression.",
          line: 2,
          column: 8,
          code: "X_V_HTML_NO_EXPRESSION",
        },
      ],
      warnings: [],
    });
  });

  it("reports a template warning with its position in the file", async () => {
    const source = [
      '<script setup lang="ts">',
      "const label = 1;",
      "</script>",
      "",
      "<template>",
      "  <p>{{ label }}<div>block</div></p>",
      "</template>",
      "",
    ].join("\n");
    const result = await compileOne(source);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      {
        message: expect.stringContaining("<div> cannot be child of <p>"),
        line: 6,
        column: 17,
      },
    ]);
  });

  it("reports a script warning Vue only prints, without printing it", async () => {
    const warn = vi.spyOn(console, "warn");
    const result = await compileOne(
      [
        '<script setup lang="ts">',
        'import { defineProps } from "vue";',
        "defineProps<{ label: string }>();",
        "</script>",
        "",
        "<template>",
        "  <p>{{ label }}</p>",
        "</template>",
        "",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      { message: expect.stringMatching(/`defineProps` is a compiler macro/) },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  // compiler-sfc raises a script warning once per process (`warnOnce`): each file must still
  // get its own, in one run and across runs.
  it("reports a script warning for every file that has it", async () => {
    const source = [
      '<script setup lang="ts">',
      'import { defineProps } from "vue";',
      "defineProps<{ label: string }>();",
      "</script>",
      "",
      "<template>",
      "  <p>{{ label }}</p>",
      "</template>",
      "",
    ].join("\n");
    const macro = { message: expect.stringMatching(/`defineProps` is a compiler macro/) };
    const files = ["/virtual/A.vue", "/virtual/B.vue"].map((path) => ({ path, contents: source }));
    const first = await toolchain.frameworkCompile(files, context);
    expect(first.get("/virtual/A.vue")).toEqual({ errors: [], warnings: [macro] });
    expect(first.get("/virtual/B.vue")).toEqual({ errors: [], warnings: [macro] });
    expect(await compileOne(source, "/virtual/C.vue")).toEqual({ errors: [], warnings: [macro] });
  });

  it("reports a script syntax error at its position in the file", async () => {
    const result = await compileOne(
      '<template>\n  <p>x</p>\n</template>\n\n<script setup lang="ts">\nconst a = ;\n</script>\n',
    );
    expect(result.errors).toEqual([
      {
        message: expect.stringContaining("Unexpected token"),
        line: 6,
        column: 11,
        code: "BABEL_PARSER_SYNTAX_ERROR",
      },
    ]);
  });

  it("reports a style error at its position in the file", async () => {
    const result = await compileOne(
      "<template>\n  <p>x</p>\n</template>\n\n<style>\np {\n  color: red;\n</style>\n",
    );
    expect(result.errors).toEqual([{ message: "Unclosed block", line: 6, column: 1 }]);
  });

  it("checks every file it is given, independently", async () => {
    const results = await toolchain.frameworkCompile(
      [
        { path: "/virtual/Good.vue", contents: "<template>\n  <p>Good</p>\n</template>\n" },
        { path: "/virtual/Bad.vue", contents: "<template>\n  <p>Bad</span>\n</template>\n" },
      ],
      context,
    );
    expect(results.get("/virtual/Good.vue")).toEqual({ errors: [], warnings: [] });
    expect(results.get("/virtual/Bad.vue")!.errors.length).toBeGreaterThan(0);
  });

  it("rejects a compile over no files", async () => {
    await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(
      "frameworkCompile received no files: a check over nothing proves nothing.",
    );
  });

  it("refuses to run under NODE_ENV=production, which silences Vue's warnings", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      toolchain.frameworkCompile([{ path: "/virtual/A.vue", contents: "" }], context),
    ).rejects.toThrow(/NODE_ENV=production/);
  });
});
