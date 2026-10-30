// What a component reads of its module and of a composable on Vue (ADR-0069, ADR-0070): a
// composable is its own module, the source's function with Vue's primitives; a caller imports it
// from that module and destructures it as written; a value from a `.ts` module is imported as the
// source does, and a constant of the module is declared with those it reads.
import { afterAll, describe, expect, it } from "vitest";

import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** vue-tsc's messages on a tree of outputs, by file name, empty when it checks clean. */
async function typecheck(outputs: Record<string, string>): Promise<Record<string, string[]>> {
  const paths = writeScratch(outputs);
  const checked = await toolchain.typecheck(Object.values(paths), {
    toolchainDir,
    root: toolchainDir,
  });
  return Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [
      name,
      (checked.get(path) ?? []).map(({ code, message }) => `${code} ${message}`),
    ]),
  );
}

/** Every file of a tree checks clean. */
function clean(outputs: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.keys(outputs).map((name) => [name, []]));
}

/** vue-tsc takes about a second; give it room on a loaded machine. */
const checker = { timeout: 60_000 };

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

describe("vue module bindings' types and names", () => {
  it(
    "imports a constant's imported type, and declares a local type its value names",
    checker,
    async () => {
      const files = {
        "tokens.ts": 'export type Size = "sm" | "md";\n',
        "useSize.uf.ts": [
          'import { ref } from "unframework";',
          'import type { Size } from "./tokens";',
          "",
          'const FALLBACK: Size = "sm";',
          "",
          "export function useSize() {",
          "  const size = ref(FALLBACK);",
          "  return { size };",
          "}",
          "",
        ].join("\n"),
        "Badge.uf.tsx": [
          'import type { Size } from "./tokens";',
          "",
          'type Tone = "info" | "warn";',
          'const FALLBACK: Size = "sm";',
          'const TONES = ["info", "warn"] satisfies Tone[];',
          "",
          "export default function Badge() {",
          "  return <p data-size={FALLBACK}>{TONES.join()}</p>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = {
        ...(await vue(files, "useSize.uf.ts")),
        ...(await vue(files, "Badge.uf.tsx")),
      };
      expect(outputs["Badge.vue"]).toContain('import type { Size } from "./tokens";');
      expect(outputs["Badge.vue"]).toContain('type Tone = "info" | "warn";');
      expect(outputs["useSize.ts"]).toContain('import type { Size } from "./tokens";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it("renames a setup binding that shadows a module constant", checker, async () => {
    const files = {
      "Limit.uf.tsx": [
        'import { ref } from "unframework";',
        "",
        "const LIMITS = { max: 20 };",
        "const caption = (value: number): string => `${value} of ${LIMITS.max}`;",
        "",
        "export default function Limit() {",
        "  const LIMITS = ref(5);",
        "  return <p>{caption(LIMITS.value)}</p>;",
        "}",
        "",
      ].join("\n"),
    };
    const outputs = await vue(files, "Limit.uf.tsx");
    expect(outputs["Limit.vue"]).toContain("const LIMITS_1 = ref(5);");
    expect(outputs["Limit.vue"]).toContain("{{ caption(LIMITS_1) }}");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("imports a Vue API under another name than a constant it reaches", checker, async () => {
    const files = {
      "List.uf.tsx": [
        'import { ref } from "unframework";',
        "",
        'const shallowRef = "items";',
        "const caption = (count: number): string => `${count} ${shallowRef}`;",
        "",
        "export default function List() {",
        "  const items = ref<string[]>([]);",
        "  return <p>{caption(items.value.length)}</p>;",
        "}",
        "",
      ].join("\n"),
    };
    const outputs = await vue(files, "List.uf.tsx");
    expect(outputs["List.vue"]).toContain('import { shallowRef as shallowRef_1 } from "vue";');
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("declares a module name Vue reserves under a name of its own", checker, async () => {
    const files = {
      "Macro.uf.tsx": [
        'const defineProps = "props";',
        "const label = `${defineProps}!`;",
        "",
        "export default function Macro({ title }: { title: string }) {",
        "  return <p title={title}>{label} {defineProps}</p>;",
        "}",
        "",
      ].join("\n"),
    };
    const outputs = await vue(files, "Macro.uf.tsx");
    expect(outputs["Macro.vue"]).toContain('const defineProps_1 = "props";');
    expect(outputs["Macro.vue"]).toContain("const label = `${defineProps_1}!`;");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("expands a shorthand property of a renamed module name", checker, async () => {
    const files = {
      "Macro.uf.tsx": [
        "const defineProps = 1;",
        "const options = { defineProps };",
        "",
        "export default function Macro() {",
        "  return <p>{options.defineProps}</p>;",
        "}",
        "",
      ].join("\n"),
    };
    const outputs = await vue(files, "Macro.uf.tsx");
    expect(outputs["Macro.vue"]).toContain("const options = { defineProps: defineProps_1 };");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("renames nothing in a component that reads none of the module's names", async () => {
    const outputs = await vue(
      {
        "Pair.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'const shallowRef = "items";',
          "",
          "function Count({ format }: { format: string }) {",
          "  const items = ref([1]);",
          "  return <p title={format}>{items.value.length}</p>;",
          "}",
          "",
          "export default function Pair() {",
          '  return <section><p>{shallowRef}</p><Count format="n" /></section>;',
          "}",
          "",
        ].join("\n"),
      },
      "Pair.uf.tsx",
    );
    expect(outputs["Count.vue"]).toContain('import { shallowRef } from "vue";');
    expect(outputs["Count.vue"]).toContain("const { format } = defineProps<{ format: string }>();");
  });

  it(
    "declares unexported a sibling's exported type that the main output re-exports",
    checker,
    async () => {
      const files = {
        "Card.uf.tsx": [
          'export type Tone = "info" | "warn";',
          'const TONES = ["info", "warn"] satisfies Tone[];',
          "",
          "function Badge({ tone }: { tone: Tone }) {",
          "  return <b>{tone}</b>;",
          "}",
          "",
          "export default function Card() {",
          '  return <p>{TONES.join()}<Badge tone="info" /></p>;',
          "}",
          "",
        ].join("\n"),
      };
      const outputs = await vue(files, "Card.uf.tsx");
      expect(outputs["Card.vue"]).toContain('export type { Tone } from "./Badge.vue";');
      expect(outputs["Card.vue"]).toContain('\ntype Tone = "info" | "warn";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );
});
