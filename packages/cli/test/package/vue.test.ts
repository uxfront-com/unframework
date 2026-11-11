import { existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { run, tree, write } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const vue = (under?: string) =>
  designSystem({
    config: { targets: ["vue"], package: { resolveFrom: inRepository("tests/toolchains/vue") } },
    frameworks: ["vue"],
    ...(under ? { under } : {}),
  });

/** A component's JS: its module and the module of its `<script setup>`, which Vite splits off. */
const componentJs = (files: Readonly<Record<string, string>>, name: string): string =>
  `${files[`vue/${name}.vue.js`]}${files[`vue/${name}.vue_vue_type_script_setup_true_lang.js`]}`;

/** Every module a packaged JS file imports, by the specifier it writes. */
const specifiers = (code: string): string[] =>
  [...code.matchAll(/^(?:import|export)\b[^"]*?(?:from )?"([^"]+)";$/gm)].map((match) => match[1]!);

const packaged = async (root = vue()) => {
  const { code, stderr } = await run(root, "build", "--package");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return tree(join(root, "dist", "package"));
};

describe("build --package: Vue", () => {
  it("compiles the SFCs to JS, with vue-tsc's declarations beside them", async () => {
    const root = vue();
    const files = await packaged(root);
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "vue/Card.uf.tsx.css",
        "vue/Card.vue.d.ts",
        "vue/Card.vue.js",
        "vue/Card.vue_vue_type_script_setup_true_lang.js",
        "vue/CardTitle.vue.d.ts",
        "vue/CardTitle.vue.js",
        "vue/CardTitle.vue_vue_type_script_setup_true_lang.js",
        "vue/index.d.ts",
        "vue/index.js",
        "vue/shared/format.d.ts",
        "vue/shared/format.js",
        "vue/useToggle.d.ts",
        "vue/useToggle.js",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    // The sheet is the compiler's, beside the component that imports it as written.
    expect(files["vue/Card.uf.tsx.css"]).toEqual(tree(join(root, "dist", "vue"))["Card.uf.tsx.css"]);
    expect(specifiers(files["vue/Card.vue.js"] ?? "")).toContain("./Card.uf.tsx.css");
    expect(files["vue/Card.vue_vue_type_script_setup_true_lang.js"]).toContain("defineComponent");
    expect(files["vue/index.js"]).toContain('from "./Card.vue.js"');
    expect(files["vue/Card.vue.d.ts"]).toContain("DefineComponent");
    expect(files["vue/CardTitle.vue.d.ts"]).toContain("label: string");
    expect(JSON.parse(files["package.json"] ?? "").exports["./vue"]).toEqual({
      types: "./vue/index.d.ts",
      default: "./vue/index.js",
    });
    // Conditions match in order: `default` before `types` would hide the declarations.
    expect(Object.keys(JSON.parse(files["package.json"] ?? "").exports["./vue"])).toEqual([
      "types",
      "default",
    ]);
  });

  it("imports only vue and its own modules, with no file of Vite's (P7)", async () => {
    const files = await packaged();
    const imported = Object.entries(files)
      .filter(([path]) => path.startsWith("vue/") && path.endsWith(".js"))
      .flatMap(([, code]) => specifiers(code));
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.filter((specifier) => specifier !== "vue" && !specifier.startsWith("./"))).toEqual(
      [],
    );
    expect(Object.keys(files).filter((path) => path.endsWith(".vue"))).toEqual([]);
  });

  it("imports a props type from a sibling module, which compileScript reads on TypeScript 7", async () => {
    const root = vue();
    write(root, {
      "src/types.ts": "export interface CardProps {\n  label: string;\n  dense?: boolean;\n}\n",
      "src/CardTitle.uf.tsx": `import type { CardProps } from "./types";

export function CardTitle(props: CardProps) {
  return <h2 class={props.dense ? "dense" : undefined}>{props.label}</h2>;
}
`,
    });
    const files = await packaged(root);
    const title = files["vue/CardTitle.vue_vue_type_script_setup_true_lang.js"] ?? "";
    // The type was read: a boolean prop keeps its runtime type, which Vue's casting needs.
    expect(title).toMatch(/dense: \{\s*type: Boolean/);
    expect(files["vue/CardTitle.vue.d.ts"]).toContain('from "./types"');
    expect(files["vue/types.d.ts"]).toContain("dense?: boolean");
  });

  it.each(["R&D", "C++"])("gives the same package under a directory named %s", async (under) => {
    const expected = await packaged();
    const root = vue(under);
    const files = await packaged(root);
    expect(files).toEqual(expected);
    for (const [path, code] of Object.entries(files)) {
      expect.soft(code, path).not.toContain(root);
      expect.soft(code, path).not.toContain("/private/");
    }
  });

  it.each(["development", "test"])(
    "compiles for production with NODE_ENV=%s, with no file path or devtools hook (P8)",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      try {
        const files = await packaged();
        const code = componentJs(files, "Card");
        expect(code).not.toContain("__file");
        expect(code).not.toContain("__hmrId");
        expect(code).not.toContain("_sfc_main");
        expect(files).toEqual(await packaged());
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it("keeps import.meta.env and process.env for the app's build, and nothing of this one's", async () => {
    vi.stubEnv("VITE_LEAK", "leaked");
    try {
      const root = vue();
      write(root, {
        ".env": "VITE_FROM_FILE=leaked\n",
        "src/shared/format.ts": `export const formatLabel = (label: string): string =>
  label + import.meta.env.VITE_LEAK + import.meta.env.VITE_FROM_FILE + import.meta.env.DEV + process.env.NODE_ENV;
`,
      });
      const format = (await packaged(root))["vue/shared/format.js"] ?? "";
      expect(format).toContain("import.meta.env.VITE_LEAK");
      expect(format).toContain("import.meta.env.DEV");
      expect(format).toContain("process.env.NODE_ENV");
      expect(format).not.toContain("leaked");
      expect(format).not.toContain("__unframework");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    [
      "that rewrites a sheet",
      'export default { plugins: [{ postcssPlugin: "rewrite", Declaration(d) { d.value = "blue"; } }] };\n',
    ],
    ["that throws", 'throw new Error("this config was read");\n'],
  ])("ignores a project's PostCSS config %s", async (_, config) => {
    const root = vue();
    write(root, { "postcss.config.mjs": config });
    expect((await packaged(root))["vue/Card.uf.tsx.css"]).toContain("color: red");
  });

  it("fires UF7008 for a missing @vitejs/plugin-vue, before anything is written", async () => {
    const root = designSystem({
      config: { targets: ["vue"], package: { resolveFrom: "." } },
      frameworks: ["vue"],
    });
    for (const name of ["vite", "vue-tsc"]) {
      const link = join(root, "node_modules", name);
      symlinkSync(inRepository(`tests/toolchains/vue/node_modules/${name}`), link);
    }
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("(vue)");
    expect(stderr).toContain("needs @vitejs/plugin-vue,");
    expect(stderr).not.toContain("needs vite,");
    expect(stderr).not.toContain("needs vue-tsc,");
    expect(existsSync(join(root, "dist"))).toBe(false);
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
    const files = await packaged(root);
    expect(specifiers(componentJs(files, "Themed"))).toContain("virtual:engine");
    // The JS keeps its sheet, and the declaration, which a strict consumer reads, doesn't.
    expect(specifiers(componentJs(files, "Styled"))).toContain("virtual:styled.css");
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
