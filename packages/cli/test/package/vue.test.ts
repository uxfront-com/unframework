import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree, write } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const vue = () =>
  designSystem({
    config: { targets: ["vue"], package: { resolveFrom: inRepository("tests/toolchains/vue") } },
    frameworks: ["vue"],
  });

describe("build --package: Vue", () => {
  it("holds the SFC sources, with vue-tsc's declarations beside them", async () => {
    const root = vue();
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "vue/Card.uf.tsx.css",
        "vue/Card.vue",
        "vue/Card.vue.d.ts",
        "vue/CardTitle.vue",
        "vue/CardTitle.vue.d.ts",
        "vue/index.d.ts",
        "vue/index.ts",
        "vue/shared/format.d.ts",
        "vue/shared/format.ts",
        "vue/useToggle.d.ts",
        "vue/useToggle.ts",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    expect(files["vue/Card.vue"]).toEqual(tree(join(root, "dist", "vue"))["Card.vue"]);
    expect(JSON.parse(files["package.json"] ?? "").exports["./vue"]).toEqual({
      types: "./vue/index.d.ts",
      default: "./vue/index.ts",
    });
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = vue();
    expect((await run(root, "build", "--package")).code).toBe(0);
    const directory = consumer(root, "vue", {
      "Consumer.vue": `<script setup lang="ts">
import { Card, useToggle } from "demo-ds/vue";

const { on } = useToggle(true);
</script>

<template>
  <Card :label="String(on)" />
  <!-- @vue-expect-error label is a string. -->
  <Card :label="1" />
</template>
`,
    });
    const { code, output } = check("tests/toolchains/vue", "vue-tsc", ["-p", directory]);
    expect(output).toBe("");
    expect(code).toBe(0);
  });

  it("reports vue-tsc's own error as UF7009, and keeps the last good package", async () => {
    const root = vue();
    expect((await run(root, "build", "--package")).code).toBe(0);
    const before = tree(join(root, "dist", "package"));
    // A shared module is copied as written, so only the packager reads this.
    write(root, {
      "src/shared/format.ts": 'export const formatLabel = (label: string): number => "no";\n',
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("TS2322");
    expect(tree(join(root, "dist", "package"))).toEqual(before);
  });
});
