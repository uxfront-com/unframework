// A composable's call and what a module or a composable gives are declared before the targets
// emit them (ADR-0069, ADR-0070): until each target's composables lane lands, the target reports
// a component that uses one, and emits nothing for it (P2).
import type { OutputFile } from "@unframework/codegen";
import type { Diagnostic } from "@unframework/diagnostics";
import type { UfComposable, UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { modules } from "../../ir/test/modules-fixture.ts";
import { builtinTargets, compile, createFileResolver, TARGET_NAMES } from "../src/index.ts";
import type { TargetName } from "../src/index.ts";

function emit(name: TargetName, module: UfModule) {
  const reported: Omit<Diagnostic, "file" | "target">[] = [];
  const files = builtinTargets[name].emit(module.components[0]!, {
    module,
    options: undefined,
    report: (diagnostic) => reported.push(diagnostic),
  });
  return { files, reported };
}

/** The targets whose composables lane has not landed: Vue's and Svelte's have (ADR-0069). */
const WAITING = TARGET_NAMES.filter((name) => name !== "vue" && name !== "svelte");

describe("composables and shared modules before each target's lane", () => {
  it.each(WAITING)("%s reports UF1002 where a component first reads a module's value", (name) => {
    const module = modules();
    expect(emit(name, module)).toEqual({
      files: [],
      reported: [
        {
          code: "UF1002",
          severity: "error",
          message: `The ${name} target does not emit a value imported from a \`.ts\` module yet: it lands with this target's composables lane.`,
          span: module.components[0]!.bindings[0]!.span,
        },
      ],
    });
  });

  it.each(WAITING)("%s reports UF1002 at a composable's call", (name) => {
    const module = modules();
    const list = module.components[0]!;
    list.bindings = list.bindings.filter(({ kind }) => kind !== "import" && kind !== "moduleConst");
    expect(emit(name, module).reported).toEqual([
      expect.objectContaining({ code: "UF1002", span: list.setup[0]!.span }),
    ]);
  });

  it("vue emits a component that reads a module's values and calls a composable", () => {
    const { files, reported } = emit("vue", modules());
    expect(reported).toEqual([]);
    expect(files.map(({ path }) => path)).toEqual(["List.vue"]);
    expect(files[0]!.contents).toContain('import { sizes } from "./tokens";');
    expect(files[0]!.contents).toContain('import { useToggle } from "./useToggle";');
    expect(files[0]!.contents).toContain("const GAP = sizes.sm * 2;");
  });

  it("svelte emits a component that reads a module's values and calls a composable", () => {
    const { files, reported } = emit("svelte", modules());
    expect(reported).toEqual([]);
    expect(files.map(({ path }) => path)).toEqual(["List.svelte"]);
    expect(files[0]!.contents).toContain('import { sizes } from "./tokens";');
    expect(files[0]!.contents).toContain('import { useToggle } from "./useToggle.svelte";');
    expect(files[0]!.contents).toContain("const GAP = sizes.sm * 2;");
  });
});

const TOGGLE = [
  'import { onMounted, ref } from "unframework";',
  "export function useToggle(initial: boolean) {",
  "  const on = ref(initial);",
  "  function toggle() {",
  "    on.value = !on.value;",
  "  }",
  "  onMounted(() => console.log(on.value));",
  "  return { on, toggle };",
  "}",
  "",
].join("\n");

const CALLER = [
  'import { useToggle } from "../composables/useToggle.uf.ts";',
  "export default function Toggle() {",
  "  const { on, toggle } = useToggle(false);",
  "  return <button onClick={() => toggle()}>{on.value ? 'On' : 'Off'}</button>;",
  "}",
  "",
].join("\n");

/** A resolver over in-memory files under `/project`. */
function memoryResolver(files: Record<string, string>) {
  return createFileResolver({
    root: "/project",
    readFile: (path) => Promise.resolve(files[`${path}`]),
  });
}

describe("a module of composables", () => {
  it("is resolved to its composables' API, its file relative to the importer", async () => {
    const resolve = memoryResolver({ "/project/src/composables/useToggle.uf.ts": TOGGLE });
    const api = await resolve({
      specifier: "../composables/useToggle.uf.ts",
      importer: "src/components/Toggle.uf.tsx",
    });
    expect(api).toEqual({
      file: "../composables/useToggle.uf.ts",
      components: [],
      keys: [],
      composables: [
        {
          name: "useToggle",
          parameters: [{ name: "initial", kind: "value", type: "boolean" }],
          members: [
            { name: "on", kind: "state" },
            { name: "toggle", kind: "function", client: true },
          ],
          hasEffects: true,
        },
      ],
    });
  });

  it("compiles a caller through the resolver, and lists the composable among its dependencies", async () => {
    const result = await compile(CALLER, {
      filename: "src/components/Toggle.uf.tsx",
      targets: ["vue"],
      resolve: memoryResolver({ "/project/src/composables/useToggle.uf.ts": TOGGLE }),
    });
    expect(result.ir?.components[0]?.setup[0]).toMatchObject({
      kind: "Use",
      composable: "useToggle",
      hasEffects: true,
    });
    expect(result.dependencies).toEqual(["src/composables/useToggle.uf.ts"]);
    expect(result.diagnostics).toEqual([]);
    // The caller imports the composable's own output, beside its module (ADR-0069).
    expect(result.outputs.vue![0]!.contents).toContain(
      'import { useToggle } from "../composables/useToggle";',
    );
  });

  it("compiles a module of composables for vue, one module each", async () => {
    const result = await compile(TOGGLE, { filename: "src/useToggle.uf.ts", targets: ["vue"] });
    expect(result.diagnostics).toEqual([]);
    expect(result.outputs.vue!.map(({ path }) => path)).toEqual(["useToggle.ts"]);
    expect(result.owners.vue).toEqual({ "useToggle.ts": "useToggle" });
  });

  it("compiles to nothing, with UF1002 for each composable, on a target without `emitComposable`", async () => {
    const result = await compile(TOGGLE, {
      filename: "src/useToggle.uf.ts",
      targets: WAITING,
    });
    expect(result.ir?.composables?.map(({ name }) => name)).toEqual(["useToggle"]);
    const span = result.ir!.composables![0]!.span;
    // Sorted by target, as every diagnostic at one span is.
    expect(result.diagnostics).toEqual(
      WAITING.toSorted().map((target) =>
        expect.objectContaining({
          code: "UF1002",
          severity: "error",
          target,
          span,
          message: `The ${target} target does not emit a composable yet: it lands with this target's composables lane.`,
        }),
      ),
    );
    for (const target of WAITING) expect(result.outputs[target]).toEqual([]);
  });

  it("calls each target's `emitComposable`, and formats what it emits", async () => {
    const seen: string[] = [];
    const target = {
      ...builtinTargets.vue,
      name: "fake",
      emitComposable(composable: UfComposable, context: { module: UfModule }) {
        seen.push(`${context.module.file}#${composable.name}`);
        return [
          {
            path: `${composable.name}.ts`,
            contents: `export function ${composable.name}( ) { return {} }`,
          },
        ];
      },
    };
    const result = await compile(TOGGLE, { filename: "useToggle.uf.ts", targets: [target] });
    expect(seen).toEqual(["useToggle.uf.ts#useToggle"]);
    expect(result.diagnostics).toEqual([]);
    expect(result.outputs.fake).toEqual([
      { path: "useToggle.ts", contents: "export function useToggle() {\n  return {};\n}\n" },
    ]);
    expect(result.owners.fake).toEqual({ "useToggle.ts": "useToggle" });
  });

  it("reports a target whose `emitComposable` throws (UF9001), and keeps the others", async () => {
    const target = {
      ...builtinTargets.vue,
      name: "broken",
      emitComposable(): OutputFile[] {
        throw new Error("boom");
      },
    };
    const result = await compile(TOGGLE, {
      filename: "useToggle.uf.ts",
      targets: [target, "react"],
    });
    expect(
      result.diagnostics.map(({ code, target: name, message }) => [code, name, message]),
    ).toEqual([
      ["UF9001", "broken", "The broken target failed on useToggle: boom"],
      [
        "UF1002",
        "react",
        "The react target does not emit a composable yet: it lands with this target's composables lane.",
      ],
    ]);
  });
});
