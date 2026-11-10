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
    expect(files["vue/Card.vue.d.ts"]).toContain("DefineComponent");
    expect(files["vue/CardTitle.vue.d.ts"]).toContain("label: string");
    expect(JSON.parse(files["package.json"] ?? "").exports["./vue"]).toEqual({
      types: "./vue/index.d.ts",
      default: "./vue/index.ts",
    });
    // Conditions match in order: `default` before `types` would hide the declarations.
    expect(Object.keys(JSON.parse(files["package.json"] ?? "").exports["./vue"])).toEqual([
      "types",
      "default",
    ]);
  });

  it("packages what only the project can declare: a passed-through module, and globals", async () => {
    const root = vue();
    write(root, {
      "src/env.d.ts": 'declare module "virtual:engine" {\n  export function tone(): string;\n}\n',
      // No declaration anywhere the package's scratch project could see, as with Styleframe.
      "src/Styled.uf.tsx": `import { tone } from "virtual:styled";

import "virtual:styled.css";

export default function Styled() {
  return <p class={tone()}>Hi</p>;
}
`,
      "src/Themed.uf.tsx": `import "virtual:engine.css";
import { tone } from "virtual:engine";
import { mode, dev } from "./shared/env";

export default function Themed() {
  return <p class={tone()}>{mode}{dev}</p>;
}
`,
      "src/shared/env.ts": `export const mode: string | undefined = process.env.NODE_ENV;
export const dev: unknown = import.meta.env.DEV;
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(files["vue/Themed.vue"]).toContain('from "virtual:engine"');
    // The SFC keeps its sheet, and the declaration, which a strict consumer reads, doesn't.
    expect(files["vue/Styled.vue"]).toContain("virtual:styled.css");
    expect(files["vue/Styled.vue.d.ts"]).not.toContain("virtual:styled.css");
    expect(files["vue/shared/env.d.ts"]).toContain("mode");
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
      "src/shared/format.ts": `export const formatLabel = (label: string): string => label.trim();
export const Klass = class {
  private y = 1;
};
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("TS4094");
    expect(stderr).toContain("dist/vue/shared/format.ts");
    expect(tree(join(root, "dist", "package"))).toEqual(before);
  });
});
