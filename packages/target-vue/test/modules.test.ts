// What a component reads of its module and of a composable on Vue (ADR-0069, ADR-0070): a
// composable is its own module, the source's function with Vue's primitives; a caller imports it
// from that module and destructures it as written; a value from a `.ts` module is imported as the
// source does, and a constant of the module is declared with those it reads.
import { describe, expect, it } from "vitest";

import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";

/** Compiles one file of an in-memory project under `/project` for Vue: its outputs by path. */
async function vue(files: Record<string, string>, filename: string) {
  const readFile = (path: string) => Promise.resolve(files[path.slice("/project/".length)]);
  const result = await compile(files[filename]!, {
    filename,
    targets: ["vue"],
    resolve: createFileResolver({ root: "/project", readFile }),
    typeOracle: createSyntacticOracle({ root: "/project", readFile }),
  });
  expect(result.diagnostics).toEqual([]);
  return Object.fromEntries(result.outputs.vue!.map(({ path, contents }) => [path, contents]));
}

const SELECTION = [
  'import { computed, ref, watchEffect } from "unframework";',
  "",
  "export function useSelection<T>(items: () => T[], onPick: (item: T) => void) {",
  "  const index = ref(0);",
  "  const current = computed(() => items()[index.value]);",
  "  watchEffect(() => console.log(index.value));",
  "  function next() {",
  "    index.value = (index.value + 1) % items().length;",
  "    onPick(items()[index.value]!);",
  "  }",
  "  return { current, next };",
  "}",
  "",
].join("\n");

describe("vue composables", () => {
  it("emits a composable as its own module, generic, with Vue's primitives", async () => {
    const outputs = await vue({ "useSelection.uf.ts": SELECTION }, "useSelection.uf.ts");
    expect(outputs).toEqual({
      "useSelection.ts": [
        'import { computed, ref, watchPostEffect } from "vue";',
        "",
        "export function useSelection<T>(items: () => T[], onPick: (item: T) => void) {",
        "  const index = ref(0);",
        "  const current = computed(() => items()[index.value]);",
        "",
        "  watchPostEffect(() => console.log(index.value));",
        "",
        "  function next() {",
        "    index.value = (index.value + 1) % items().length;",
        "    onPick(items()[index.value]!);",
        "  }",
        "",
        "  return { current, next };",
        "}",
        "",
      ].join("\n"),
    });
  });

  it("calls it with its getter and callback, and reads a renamed ref unwrapped in the template", async () => {
    const outputs = await vue(
      {
        "useSelection.uf.ts": SELECTION,
        "Picker.uf.tsx": [
          'import { defineEmits } from "unframework";',
          'import { useSelection } from "./useSelection.uf.ts";',
          "",
          "export default function Picker({ names }: { names: string[] }) {",
          "  const emit = defineEmits<{ pick: [name: string] }>();",
          "  const { current: name, next } = useSelection(",
          "    () => names,",
          '    (picked) => emit("pick", picked),',
          "  );",
          "  return <button onClick={() => next()}>{name.value}</button>;",
          "}",
          "",
        ].join("\n"),
      },
      "Picker.uf.tsx",
    );
    expect(outputs["Picker.vue"]).toBe(
      [
        '<script setup lang="ts">',
        'import { useSelection } from "./useSelection";',
        "",
        "const { names } = defineProps<{ names: string[] }>();",
        "const emit = defineEmits<{ pick: [name: string] }>();",
        "",
        "const { current: name, next } = useSelection(",
        "  () => names,",
        '  (picked) => emit("pick", picked),',
        ");",
        "</script>",
        "",
        "<template>",
        '  <button @click="next()">{{ name }}</button>',
        "</template>",
        "",
      ].join("\n"),
    );
  });
});

describe("vue module bindings", () => {
  it("imports a module's values as written, and declares the constants it reaches", async () => {
    const outputs = await vue(
      {
        "tokens.ts": "export const sizes = { sm: 4, md: 8 };\nexport const unused = 1;\n",
        "Gap.uf.tsx": [
          'import { sizes, unused } from "./tokens";',
          "",
          "const BASE = sizes.sm;",
          "const GAP = BASE * 2;",
          "const OTHER = unused + 1;",
          "",
          "export default function Gap() {",
          "  return <p data-gap={GAP}>{sizes.md}</p>;",
          "}",
          "",
        ].join("\n"),
      },
      "Gap.uf.tsx",
    );
    // `OTHER` and `unused` reach nothing it renders.
    expect(outputs["Gap.vue"]).toBe(
      [
        '<script setup lang="ts">',
        'import { sizes } from "./tokens";',
        "",
        "const BASE = sizes.sm;",
        "const GAP = BASE * 2;",
        "</script>",
        "",
        "<template>",
        '  <p :data-gap="GAP">{{ sizes.md }}</p>',
        "</template>",
        "",
      ].join("\n"),
    );
    expect(outputs["tokens.ts"]).toBe(
      "export const sizes = { sm: 4, md: 8 };\nexport const unused = 1;\n",
    );
  });
});
