// The composable and shared-module cases on Angular (ADR-0069, ADR-0070): each compiles through
// `compile()` with no error, and its outputs, the composables' modules and the copied `.ts`
// modules among them, pass ngtsc with strict templates (L3, L4) and the lint rules (L5) as the
// corpus's toolchain project runs them. The cases wait in `tests/integration/pending/` until every
// target's lane has landed (../../codegen/test/composable-cases.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { kebabCase } from "@unframework/codegen";
import type { OutputFile, ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import type { CompiledCase } from "../../codegen/test/composable-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { context as corpus, packageDir, removeScratch, scratchDir, writeFiles } from "./helpers.ts";

const context: ToolchainContext = { ...corpus, root: packageDir };
const cases = await compileComposableCases("angular");

afterAll(removeScratch);

/**
 * Checks a compiled case: no error, a component file for each `.uf.tsx` source and a module for
 * each `.uf.ts` one, and every output clean through ngtsc (L3), the typecheck (L4) and the lint
 * rules (L5). Returns the outputs by path.
 */
async function expectClean({ sources }: CompiledCase): Promise<Map<string, string>> {
  const errors = sources.flatMap(({ diagnostics }) =>
    diagnostics.filter(({ severity }) => severity === "error"),
  );
  expect(errors).toEqual([]);
  for (const { filename, outputs } of sources) {
    const name = basename(filename).replace(/\.uf\.tsx?$/, "");
    expect(outputs.map(({ path }) => path)).toContain(`${kebabCase(name)}.ts`);
  }
  // Two sources that import one module each copy it, the same.
  const files = new Map<string, string>();
  for (const output of sources.flatMap(({ outputs }): OutputFile[] => outputs)) {
    expect(files.get(output.path) ?? output.contents, output.path).toBe(output.contents);
    files.set(output.path, output.contents);
  }
  const paths = writeFiles(scratchDir(), Object.fromEntries(files));
  const compiled = await toolchain.frameworkCompile(
    [...files].map(([path, contents]) => ({ path: paths[path]!, contents })),
    context,
  );
  for (const path of Object.values(paths)) {
    expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
  }
  const checked = await toolchain.typecheck(Object.values(paths), context);
  for (const [path, messages] of checked) expect(messages, path).toEqual([]);
  const linted = await toolchain.lint(Object.values(paths), context);
  for (const [path, messages] of linted) expect(messages, path).toEqual([]);
  return files;
}

describe("angular composable cases", () => {
  it.each(cases)("compiles $id and passes L3 to L5", { timeout: 60_000 }, async (each) => {
    await expectClean(each);
  });
});

/**
 * Call sites the cases don't reach, each a case of its own, written under a scratch `pending/`
 * and compiled through the same helper.
 */
const CALLS: Record<string, Record<string, string>> = {
  // A getter the composable reads while it sets up, of a required input (NG0950 in a field).
  "calls/getter-input": {
    "useEager.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useEager(name: () => string) {",
      "  const first = ref(name());",
      "  return { first };",
      "}",
    ].join("\n"),
    "Greeting.uf.tsx": [
      'import { useEager } from "./useEager.uf.ts";',
      "",
      "export default function Greeting({ name }: { name: string }) {",
      "  const { first } = useEager(() => name);",
      "  return <p>Hello, {first.value}</p>;",
      "}",
    ].join("\n"),
  },
  // A generic composable whose value argument reads an input: `T` is the input's type.
  "calls/generic-input": {
    "useLatest.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useLatest<T>(initial: T) {",
      "  const current = ref(initial);",
      "  function set(next: T) {",
      "    current.value = next;",
      "  }",
      "  return { current, set };",
      "}",
    ].join("\n"),
    "Counter.uf.tsx": [
      'import { useLatest } from "./useLatest.uf.ts";',
      "",
      "export default function Counter({ start }: { start: number }) {",
      "  const { current, set } = useLatest(start);",
      "  return (",
      '    <button type="button" onClick={() => set(current.value + 1)}>',
      "      {current.value + 1}",
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A generic composable with effects after the caller's own hook: called in the constructor.
  "calls/generic-constructor": {
    "useTracked.uf.ts": [
      'import { onMounted, ref } from "unframework";',
      "",
      "export function useTracked<T>(initial: T) {",
      "  const current = ref(initial);",
      "  onMounted(() => {",
      "    current.value = initial;",
      "  });",
      "  return { current };",
      "}",
    ].join("\n"),
    "Tracker.uf.tsx": [
      'import { onMounted, ref } from "unframework";',
      "",
      'import { useTracked } from "./useTracked.uf.ts";',
      "",
      "export default function Tracker() {",
      "  const mounted = ref(false);",
      "  onMounted(() => {",
      "    mounted.value = true;",
      "  });",
      "  const { current } = useTracked(1);",
      "  return (",
      "    <p>",
      '      {current.value + 1} {mounted.value ? "Mounted" : "Waiting"}',
      "    </p>",
      "  );",
      "}",
    ].join("\n"),
  },
  // Module values named like an event and the `style` input, and module constants named as a
  // watcher's locals would be.
  "calls/module-names": {
    "api.ts": ["export function save(text: string): string {", "  return `${text}!`;", "}"].join(
      "\n",
    ),
    "Editor.uf.tsx": [
      'import { defineEmits, ref, watch } from "unframework";',
      "",
      'import { save } from "./api";',
      "",
      'const style = "Plain";',
      "const currentCount = 3;",
      "const lastCount = 4;",
      "",
      "export default function Editor() {",
      "  const emit = defineEmits<{ save: [text: string] }>();",
      "  const count = ref(0);",
      "  watch(count, (next, previous) => {",
      "    console.log(next, previous, currentCount, lastCount);",
      "  });",
      "  return (",
      '    <button type="button" onClick={() => emit("save", save(style))}>',
      '      {style} {save("draft")} {count.value}',
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
  // A holder named like the `style` input a root element takes.
  "calls/holder-style": {
    "useStyle.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useStyle() {",
      '  const color = ref("red");',
      "  function toggle() {",
      '    color.value = color.value === "red" ? "blue" : "red";',
      "  }",
      "  return { color, toggle };",
      "}",
    ].join("\n"),
    "Swatch.uf.tsx": [
      'import { useStyle } from "./useStyle.uf.ts";',
      "",
      "export default function Swatch() {",
      "  const { color, toggle } = useStyle();",
      "  return (",
      '    <button type="button" onClick={() => toggle()}>',
      "      {color.value}",
      "    </button>",
      "  );",
      "}",
    ].join("\n"),
  },
};

describe("angular composable call sites", () => {
  const integrationDir = scratchDir();
  for (const [id, files] of Object.entries(CALLS)) {
    const dir = join(integrationDir, "pending", id);
    mkdirSync(dir, { recursive: true });
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), `${contents}\n`);
    }
  }
  const compiled = compileComposableCases("angular", { ids: Object.keys(CALLS), integrationDir });
  /** A case's component output, once the whole case passes L3 to L5. */
  const component = async (id: string, path: string) => {
    const files = await expectClean((await compiled).find((entry) => entry.id === id)!);
    return files.get(path)!;
  };

  it(
    "calls a composable in `ngOnInit` where a getter argument reads an input",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/getter-input", "greeting.ts");
      expect(code).toContain("ngOnInit()");
      expect(code).toMatch(/runInInjectionContext\(this\.\w+, \(\) => this\.createEager\(\)\)/);
      expect(code).not.toMatch(/= useEager\(/);
    },
  );

  it(
    "keeps a generic composable's type argument where `ngOnInit` calls it",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/generic-input", "counter.ts");
      expect(code).toMatch(/runInInjectionContext\(this\.\w+, \(\) => this\.createLatest\(\)\)/);
      expect(code).toContain("ReturnType<typeof this.createLatest>");
    },
  );

  it(
    "keeps a generic composable's type argument where the constructor calls it",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/generic-constructor", "tracker.ts");
      expect(code).toMatch(/constructor\(\) \{[^]*this\.tracked\w* = /);
      expect(code).toContain("ReturnType<typeof this.createTracked>");
    },
  );

  it(
    "reads module values by their module names, and the template through free members",
    { timeout: 60_000 },
    async () => {
      const code = await component("calls/module-names", "editor.ts");
      expect(code).toContain('import { save } from "./api";');
      expect(code).toContain('const style = "Plain";');
      // The watcher's locals leave the module's constants alone.
      expect(code).toContain("console.log(next, previous, currentCount, lastCount)");
      expect(code).not.toMatch(/^\s+(?:const|let) (?:currentCount|lastCount)\b/m);
    },
  );

  it("names a holder past the `class` and `style` inputs", { timeout: 60_000 }, async () => {
    const code = await component("calls/holder-style", "swatch.ts");
    expect(code).not.toMatch(/readonly style = useStyle\(/);
  });
});
