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

  it("renames a module constant a setup binding shadows, never the setup's", checker, async () => {
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
    expect(outputs["Limit.vue"]).toContain("const LIMITS_1 = { max: 20 };");
    expect(outputs["Limit.vue"]).toContain("`${value} of ${LIMITS_1.max}`");
    expect(outputs["Limit.vue"]).toContain("const LIMITS = ref(5);");
    expect(outputs["Limit.vue"]).toContain("{{ caption(LIMITS) }}");
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

  // A constant only a type names is not in the IR (the analyser keeps those a component reads), so
  // a type reaches through `typeof` what the module imports.
  it("imports a value that a type names through `typeof`", checker, async () => {
    const files = {
      "limits.ts": "export const LIMITS = { a: 3 };\nexport const SIZES = { sm: 1, md: 2 };\n",
      "useCopy.uf.ts": [
        'import { ref } from "unframework";',
        'import { LIMITS } from "./limits";',
        "",
        "const COPY: typeof LIMITS = { a: 1 };",
        "",
        "export function useCopy() {",
        "  const copy = ref(COPY.a);",
        "  return { copy };",
        "}",
        "",
      ].join("\n"),
      "Size.uf.tsx": [
        'import { SIZES } from "./limits";',
        "",
        "type Size = keyof typeof SIZES;",
        'const DEFAULT: Size = "sm";',
        "",
        "export default function Size() {",
        "  return <p>{DEFAULT}</p>;",
        "}",
        "",
      ].join("\n"),
    };
    const outputs = {
      ...(await vue(files, "useCopy.uf.ts")),
      ...(await vue(files, "Size.uf.tsx")),
    };
    expect(outputs["useCopy.ts"]).toContain('import { LIMITS } from "./limits";');
    expect(outputs["Size.vue"]).toContain('import { SIZES } from "./limits";');
    expect(outputs["Size.vue"]).toContain("type Size = keyof typeof SIZES;");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
    const paths = writeScratch(outputs);
    const linted = await toolchain.lint(Object.values(paths), { toolchainDir, root: toolchainDir });
    expect([...linted.values()].flat()).toEqual([]);
  });

  it(
    "re-exports from the main output an exported type only a sibling's constant reaches",
    checker,
    async () => {
      const files = {
        "Card.uf.tsx": [
          'export type Tone = "info" | "warn";',
          'const TONES: Tone[] = ["info", "warn"];',
          "",
          "function Badge() {",
          "  return <b>{TONES.join()}</b>;",
          "}",
          "",
          "export default function Card() {",
          "  return <p><Badge /></p>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs: Record<string, string> = {
        ...(await vue(files, "Card.uf.tsx")),
        "Use.vue": [
          '<script setup lang="ts">',
          'import Card, { type Tone } from "./Card.vue";',
          "",
          'const tone: Tone = "warn";',
          "</script>",
          "",
          "<template>",
          '  <Card :data-tone="tone" />',
          "</template>",
          "",
        ].join("\n"),
      };
      expect(outputs["Card.vue"]).toContain('export type { Tone } from "./Badge.vue";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "renames a module name that `emit`, `slots` or a template ref shadows, never the setup's",
    checker,
    async () => {
      const files = {
        "Form.uf.tsx": [
          'import { defineEmits, defineSlots, useTemplateRef } from "unframework";',
          "",
          'const emit = "sent";',
          'const slots = "slots";',
          'const box = "box";',
          "const label = `${emit} ${slots} ${box}`;",
          "",
          "export default function Form() {",
          "  const emit = defineEmits<{ change: [value: string] }>();",
          "  const slots = defineSlots<{ title?: () => any }>();",
          "  const box = useTemplateRef<HTMLInputElement>();",
          "  return (",
          "    <form>",
          "      {slots.title && <h2>{label}</h2>}",
          '      <input ref={box} onInput={() => emit("change", box.value?.value ?? "")} />',
          "    </form>",
          "  );",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = await vue(files, "Form.uf.tsx");
      const form = outputs["Form.vue"]!;
      expect(form).toContain('const emit_1 = "sent";');
      expect(form).toContain('const slots_1 = "slots";');
      expect(form).toContain('const box_1 = "box";');
      expect(form).toContain("const label = `${emit_1} ${slots_1} ${box_1}`;");
      expect(form).toContain("const emit = defineEmits<");
      expect(form).toContain("const slots = defineSlots<");
      expect(form).toContain('const box = useTemplateRef<HTMLInputElement>("box");');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it("claims no name a constant's own code already uses", async () => {
    const outputs = await vue(
      {
        "Sum.uf.tsx": [
          "const defineProps = 1;",
          "const add = (defineProps_1: number): number => defineProps + defineProps_1;",
          "",
          "export default function Sum() {",
          "  return <p>{add(10)}</p>;",
          "}",
          "",
        ].join("\n"),
      },
      "Sum.uf.tsx",
    );
    expect(outputs["Sum.vue"]).toContain("const defineProps_2 = 1;");
    expect(outputs["Sum.vue"]).toContain(
      "const add = (defineProps_1: number): number => defineProps_2 + defineProps_1;",
    );
  });

  it("declares no module value a nested parameter only shares a name with", checker, async () => {
    const files = {
      "util.ts": "export const format = (value: number): string => `${value}`;\n",
      "C.uf.tsx": [
        'import { format } from "./util";',
        "",
        'const label = "Total";',
        "",
        "function Head() {",
        "  return <h1>{label} {format(1)}</h1>;",
        "}",
        "",
        "export default function C() {",
        "  const describe = (label: string) => label.toUpperCase();",
        "  const count = (format: number) => format + 1;",
        '  return <div><Head />{describe("x")} {count(1)}</div>;',
        "}",
        "",
      ].join("\n"),
    };
    const outputs = await vue(files, "C.uf.tsx");
    expect(outputs["C.vue"]).not.toContain('const label = "Total";');
    expect(outputs["C.vue"]).not.toContain("./util");
    expect(outputs["Head.vue"]).toContain('const label = "Total";');
    const paths = writeScratch(outputs);
    const linted = await toolchain.lint(Object.values(paths), { toolchainDir, root: toolchainDir });
    expect([...linted.values()].flat()).toEqual([]);
  });

  it(
    "renames a module name inside `typeof` in a constant's annotation and a module type",
    checker,
    async () => {
      const files = {
        "t.ts": "export const step = { a: 1 };\n",
        "C.uf.tsx": [
          'import { step } from "./t";',
          "",
          "type Step = typeof step;",
          "const COPY: typeof step = { a: 2 };",
          "const OTHER: Step = { a: 3 };",
          "const LABEL = `${step.a}`;",
          "",
          "export default function C() {",
          '  const step = "x";',
          "  return <p>{COPY.a} {OTHER.a} {LABEL} {step}</p>;",
          "}",
          "",
        ].join("\n"),
        "useX.uf.ts": [
          'import { ref } from "unframework";',
          'import { step } from "./t";',
          "",
          "type Step = typeof step;",
          "",
          "export function useX(step: Step) {",
          "  const value = ref(step.a);",
          "  return { value };",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = {
        ...(await vue(files, "C.uf.tsx")),
        ...(await vue(files, "useX.uf.ts")),
      };
      expect(outputs["C.vue"]).toContain('import { step as step_1 } from "./t";');
      expect(outputs["C.vue"]).toContain("type Step = typeof step_1;");
      expect(outputs["C.vue"]).toContain("const COPY: typeof step_1 = { a: 2 };");
      expect(outputs["useX.ts"]).toContain('import { step as step_1 } from "./t";');
      expect(outputs["useX.ts"]).toContain("type Step = typeof step_1;");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  // A `typeof` reads what is in scope where it sits, as TypeScript scopes it.
  describe("`typeof` in scope", () => {
    const T = 'export const step = { a: 1 };\nexport const Intl = { tag: "x" };\n';

    it("leaves a `typeof` a function type's own parameter binds", checker, async () => {
      const files = {
        "t.ts": T,
        "C.uf.tsx": [
          'import { step } from "./t";',
          "",
          "type F = (step: number) => typeof step;",
          "interface G {",
          "  get(step: number): typeof step;",
          "}",
          "const id: F = (n) => n;",
          "const twice: G = { get: (n) => n * 2 };",
          "const LABEL = `${step.a}`;",
          "",
          "export default function C() {",
          '  const step = "x";',
          "  const n: number = id(2) + twice.get(1);",
          "  return <p>{n} {LABEL} {step}</p>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = await vue(files, "C.uf.tsx");
      expect(outputs["C.vue"]).toContain("type F = (step: number) => typeof step;");
      expect(outputs["C.vue"]).toContain("get(step: number): typeof step;");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    });

    it("declares no module value a later parameter's `typeof` names", checker, async () => {
      const files = {
        "C.uf.tsx": [
          "const value = 10;",
          "",
          "function Head() {",
          "  return <h1>{value}</h1>;",
          "}",
          "",
          "export default function C() {",
          "  const clamp = (value: number, max: typeof value) => Math.min(value, max);",
          "  return <div><Head />{clamp(1, 2)}</div>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = await vue(files, "C.uf.tsx");
      expect(outputs["C.vue"]).not.toContain("const value = 10;");
      const paths = writeScratch(outputs);
      const linted = await toolchain.lint(Object.values(paths), {
        toolchainDir,
        root: toolchainDir,
      });
      expect([...linted.values()].flat()).toEqual([]);
    });

    it("renames and reaches a `typeof` in a constant's value", checker, async () => {
      const files = {
        "t.ts": T,
        "C.uf.tsx": [
          'import { step } from "./t";',
          "",
          "const COPY = { a: 2 } as typeof step;",
          "const LABEL = `${step.a}`;",
          "",
          "export default function C() {",
          '  const step = "x";',
          "  return <p>{COPY.a} {LABEL} {step}</p>;",
          "}",
          "",
        ].join("\n"),
        "D.uf.tsx": [
          'import { step } from "./t";',
          "",
          "const TABLE = { a: 3 } satisfies typeof step;",
          "",
          "export default function D() {",
          "  return <p>{TABLE.a}</p>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = { ...(await vue(files, "C.uf.tsx")), ...(await vue(files, "D.uf.tsx")) };
      expect(outputs["C.vue"]).toContain("const COPY = { a: 2 } as typeof step_1;");
      expect(outputs["D.vue"]).toContain('import { step } from "./t";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    });

    it("reaches and renames a `typeof` in a composable's parameter types", checker, async () => {
      const files = {
        "t.ts": T,
        "useX.uf.ts": [
          'import { ref } from "unframework";',
          'import { step } from "./t";',
          "",
          "export function useX(s: typeof step) {",
          "  const step = ref<number>(s.a);",
          "  return { step };",
          "}",
          "",
        ].join("\n"),
        "useY.uf.ts": [
          'import { ref } from "unframework";',
          'import { step } from "./t";',
          "",
          "const BASE = step.a;",
          "",
          "export function useY(s: typeof step) {",
          "  const step = ref<number>(s.a + BASE);",
          "  return { step };",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = { ...(await vue(files, "useX.uf.ts")), ...(await vue(files, "useY.uf.ts")) };
      expect(outputs["useX.ts"]).toContain("export function useX(s: typeof step_1)");
      expect(outputs["useY.ts"]).toContain("export function useY(s: typeof step_1)");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    });

    it(
      "renames a `typeof` in the setup's annotations of a name Vue reserves",
      checker,
      async () => {
        const files = {
          "t.ts": T,
          "C.uf.tsx": [
            'import { Intl } from "./t";',
            "",
            "export default function C() {",
            '  const copy: typeof Intl = { tag: "y" };',
            "  return <p>{copy.tag} {Intl.tag}</p>;",
            "}",
            "",
          ].join("\n"),
        };
        const outputs = await vue(files, "C.uf.tsx");
        expect(outputs["C.vue"]).toContain("const copy: typeof Intl_1 =");
        expect(await typecheck(outputs)).toEqual(clean(outputs));
      },
    );

    it("reads a type parameter's `typeof` as the outer value", checker, async () => {
      const files = {
        "t.ts": T,
        "C.uf.tsx": [
          'import { step } from "./t";',
          "",
          "type T<step> = typeof step;",
          "const LABEL = `${step.a}`;",
          "",
          "export default function C() {",
          '  const step = "x";',
          "  const t: T<number> = { a: 2 };",
          "  return <p>{t.a} {LABEL} {step}</p>;",
          "}",
          "",
        ].join("\n"),
        "D.uf.tsx": [
          'import { step } from "./t";',
          "",
          "interface I<step> {",
          "  v: typeof step;",
          "}",
          "",
          "export default function D() {",
          "  const i: I<number> = { v: { a: 2 } };",
          "  return <p>{i.v.a}</p>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = { ...(await vue(files, "C.uf.tsx")), ...(await vue(files, "D.uf.tsx")) };
      expect(outputs["C.vue"]).toContain("type T<step> = typeof step_1;");
      expect(outputs["D.vue"]).toContain('import { step } from "./t";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    });

    it("binds a `switch` case's declarations over the switch", checker, async () => {
      const files = {
        "t.ts": T,
        "C.uf.tsx": [
          'import { step } from "./t";',
          "",
          "export default function C() {",
          "  const pick = (n: number): number => {",
          "    switch (n) {",
          "      case 1:",
          "        const step = 2;",
          "        const k: typeof step = step;",
          "        return k;",
          "      default:",
          "        return 0;",
          "    }",
          "  };",
          "  return <p>{pick(1)}</p>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = await vue(files, "C.uf.tsx");
      expect(outputs["C.vue"]).not.toContain("./t");
      const paths = writeScratch(outputs);
      const linted = await toolchain.lint(Object.values(paths), {
        toolchainDir,
        root: toolchainDir,
      });
      expect([...linted.values()].flat()).toEqual([]);
    });

    it("lets no template variable shadow the setup's `typeof`", checker, async () => {
      const files = {
        "t.ts": T,
        "C.uf.tsx": [
          'import { step } from "./t";',
          "",
          "export default function C() {",
          "  const n: typeof step = { a: 1 };",
          "  const items = [1, 2];",
          "  return <ul>{n.a}{items.map((step) => <li key={step}>{step}</li>)}</ul>;",
          "}",
          "",
        ].join("\n"),
      };
      const outputs = await vue(files, "C.uf.tsx");
      expect(outputs["C.vue"]).toContain('import { step } from "./t";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    });
  });
});
