// Sources beyond the listed composable cases, compiled through `compile()` for Solid
// (src/composable.ts, src/setup.ts; ADR-0068 to ADR-0070): each compiles with no error, every
// output passes babel-preset-solid (L3), tsgo (L4) and the lint rules (L5), and a source's
// outputs join into one module as the unplugin loads them (ADR-0053).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
// The unplugin's join, by path, as it loads a source's script outputs as one module.
import { joinModules } from "../../unplugin/src/assemble.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };

// In the package, so the outputs' `solid-js` imports resolve from its node_modules.
mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "module-sources-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** The sources of each case, by id, under an integration directory of their own. */
const CASES: Record<string, Record<string, string>> = {
  // A composable's parameter type imported from a `.ts` module.
  "composables/imported-parameter-type": {
    "types.ts": "export interface Options {\n  step: number;\n}\n",
    "useStep.uf.ts": [
      'import { ref } from "unframework";',
      'import type { Options } from "./types";',
      "",
      "export function useStep(options: Options) {",
      "  const count = ref(0);",
      "  function bump() {",
      "    count.value += options.step;",
      "  }",
      "  return { count, bump };",
      "}",
      "",
    ].join("\n"),
    "Stepper.uf.tsx": [
      'import { useStep } from "./useStep.uf.ts";',
      "",
      "export default function Stepper() {",
      "  const { count, bump } = useStep({ step: 2 });",
      '  return <button type="button" onClick={() => bump()}>{count.value}</button>;',
      "}",
      "",
    ].join("\n"),
  },
  // A state whose type TypeScript infers as a type parameter, in a composable and a component.
  "generics/inferred-state": {
    "useLatest.uf.ts": [
      'import { ref } from "unframework";',
      "",
      "export function useLatest<T>(initial: T) {",
      "  const latest = ref(initial);",
      "  function set(next: T) {",
      "    latest.value = next;",
      "  }",
      "  return { latest, set };",
      "}",
      "",
    ].join("\n"),
    "Pick.uf.tsx": [
      'import { ref } from "unframework";',
      "",
      "export default function Pick<T>({ first, second }: { first: T; second: T }) {",
      "  const chosen = ref(first);",
      "  function choose() {",
      "    chosen.value = second;",
      "  }",
      '  return <button type="button" onClick={choose}>{String(chosen.value)}</button>;',
      "}",
      "",
    ].join("\n"),
  },
  // Two components of one source that read one constant and overlapping names of one module.
  "modules/two-components": {
    "tokens.ts": "export const SIZE = 4;\nexport const GAP = 2;\n",
    "Pair.uf.tsx": [
      'import { GAP, SIZE } from "./tokens";',
      "",
      "const STEP = 2;",
      "const ONLY_PART = 1;",
      "",
      "export function Part() {",
      "  return <p>{STEP + SIZE + ONLY_PART}</p>;",
      "}",
      "",
      "export default function Pair() {",
      "  return (",
      "    <div>",
      "      <Part />",
      "      <p>{STEP * GAP * SIZE}</p>",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n"),
  },
};

const integrationDir = join(scratch, "integration");
for (const [id, files] of Object.entries(CASES)) {
  for (const [name, contents] of Object.entries(files)) {
    const path = join(integrationDir, "cases", id, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
}
const cases = await compileComposableCases("solid", { ids: Object.keys(CASES), integrationDir });

describe("solid sources beyond the composable cases", () => {
  it.each(cases)("compiles $id and passes L3 to L5", { timeout: 60_000 }, async (each) => {
    expect(each.sources.flatMap(({ diagnostics }) => diagnostics)).toEqual([]);
    const written = each.sources.flatMap(({ outputs }) =>
      outputs.map(({ path, contents }) => {
        const file = join(scratch, "out", each.id, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, contents);
        return { path: file, contents };
      }),
    );
    const paths = [...new Set(written.map(({ path }) => path))];
    const compiled = await toolchain.frameworkCompile(
      paths.map((path) => written.find((file) => file.path === path)!),
      context,
    );
    for (const path of paths) {
      expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
    }
    const checked = await toolchain.typecheck(paths, context);
    for (const path of paths) expect(checked.get(path) ?? [], path).toEqual([]);
    const linted = await toolchain.lint(paths, context);
    for (const [path, messages] of linted) expect(messages, path).toEqual([]);
  });

  it("imports a composable's parameter types", () => {
    const step = outputOf("composables/imported-parameter-type", "useStep.ts");
    expect(step).toContain('import type { Options } from "./types";');
  });

  it("writes a state inferred as a type parameter through an updater", () => {
    expect(outputOf("generics/inferred-state", "useLatest.ts")).toContain("setLatest(() => next);");
    expect(outputOf("generics/inferred-state", "Pick.tsx")).toContain(
      "setChosen(() => props.second);",
    );
  });

  it("declares a value two components of a source read once, in the main one's output", () => {
    const source = cases.find(({ id }) => id === "modules/two-components")!.sources[0]!;
    const files = source.outputs.filter(({ path }) => path.endsWith(".tsx"));
    expect(outputOf("modules/two-components", "Pair.tsx")).toContain("export { SIZE, STEP };");
    const part = outputOf("modules/two-components", "Part.tsx");
    expect(part).toContain('import { SIZE, STEP } from "./Pair";');
    expect(part).toContain("const ONLY_PART = 1;");
    expect(part).not.toContain('from "./tokens"');
    const siblings = source.outputs.map(({ path }) => path);
    expect(joinModules(files, "Pair.uf.tsx compiles to two files", siblings)).not.toHaveProperty(
      "error",
    );
  });
});

/** One output of a case, by its path. */
function outputOf(id: string, path: string): string {
  const found = cases
    .find((each) => each.id === id)!
    .sources.flatMap(({ outputs }) => outputs)
    .find((output) => output.path === path);
  if (!found) throw new Error(`No output ${path} for ${id}.`);
  return found.contents;
}
