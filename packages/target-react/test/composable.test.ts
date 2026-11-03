// The composable and shared-module cases on React (ADR-0069, ADR-0070): each source compiles
// through `compile()` with no error, a `.uf.ts` one to one custom hook per composable, and every
// output of a case, its components, its hooks and its copied `.ts` modules, passes React Compiler
// (L3), tsgo (L4) and the lint rules, the rules of hooks among them (L5), as the corpus's
// toolchain project runs them. The cases wait in `tests/integration/pending/` until every
// target's lane has landed (../../codegen/test/composable-cases.ts).
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { OutputFile } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";
import { liveReaderNames } from "../src/plan.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

const context = { toolchainDir, root: packageDir };
const scratch = join(packageDir, ".uf-tmp", `composable-${randomUUID()}`);
const cases = await compileComposableCases("react");

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** The output a case's source compiles to, by the output's path. */
const output = (id: string, path: string) =>
  cases
    .find((each) => each.id === id)!
    .sources.flatMap(({ outputs }) => outputs)
    .find((each) => each.path === path)!.contents;

/** The hook a case's composable compiles to. */
const hook = (id: string) =>
  cases.find((each) => each.id === id)!.sources.find(({ filename }) => filename.endsWith(".uf.ts"))!
    .outputs[0]!.contents;

/**
 * Writes outputs under `directory` in the scratch tree, and runs React Compiler (L3), tsgo (L4)
 * and oxlint (L5) on them: each must report nothing, about them or any other file.
 */
async function expectClean(directory: string, outputs: readonly OutputFile[]): Promise<void> {
  const at = join(scratch, directory);
  mkdirSync(at, { recursive: true });
  const files = outputs.map((output) => {
    const absolute = join(at, output.path);
    writeFileSync(absolute, output.contents);
    return { path: absolute, contents: output.contents };
  });
  const compiled = await toolchain.frameworkCompile(files, context);
  for (const { path } of files) {
    expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
  }
  const paths = files.map(({ path }) => path);
  const checked = await toolchain.typecheck(paths, context);
  for (const [path, messages] of checked) expect(messages, path).toEqual([]);
  const linted = await toolchain.lint(paths, context);
  for (const [path, messages] of linted) expect(messages, path).toEqual([]);
}

/**
 * The sources at `files` (paths under `/project`), each `.uf.tsx` and `.uf.ts` one compiled for
 * React through a resolver and a type oracle over them: every output, and each `.ts` source as a
 * copy beside them, by path.
 */
async function compileProject(files: Record<string, string>) {
  const readFile = (path: string) => Promise.resolve(files[path]);
  const resolve = createFileResolver({ root: "/project", readFile });
  const typeOracle = createSyntacticOracle({ root: "/project", readFile });
  const diagnostics = [];
  const outputs = new Map<string, string>();
  for (const [path, source] of Object.entries(files)) {
    const filename = path.slice("/project/".length);
    if (!/\.uf\.tsx?$/.test(filename)) {
      outputs.set(filename, source);
      continue;
    }
    const result = await compile(source, { filename, targets: ["react"], resolve, typeOracle });
    diagnostics.push(...result.diagnostics);
    for (const file of result.outputs.react ?? []) outputs.set(file.path, file.contents);
  }
  return {
    diagnostics,
    outputs: [...outputs].map(([path, contents]) => ({ path, contents })),
    output: (path: string) => outputs.get(path)!,
  };
}

/** One `.uf.ts` source compiled for React. */
async function compileHook(source: string, filename: string) {
  const result = await compile(source, { filename, targets: ["react"] });
  return { diagnostics: result.diagnostics, outputs: result.outputs.react ?? [] };
}

describe("react composable cases", () => {
  it("finds every composable and shared-module case", () => {
    expect(cases.map(({ id }) => id)).toEqual([
      "composables/use-toggle",
      "composables/use-controllable-state",
      "composables/use-media-query",
      "composables/getter-argument",
      "composables/callback-argument",
      "modules/shared-constants",
      "modules/shared-helpers",
      "modules/module-constants",
      "modules/nested-modules",
      "semantics/composable-read-after-write",
      "semantics/composable-effect-order",
      "semantics/composable-unmount-order",
    ]);
  });

  it.each(cases)(
    "compiles $id to outputs that pass L3 to L5",
    { timeout: 60_000 },
    async ({ id, sources }) => {
      const errors = sources.flatMap(({ diagnostics }) =>
        diagnostics.filter(({ severity }) => severity === "error"),
      );
      expect(errors).toEqual([]);
      // Two sources that import one module each copy it, the same.
      const files = new Map<string, string>();
      for (const each of sources.flatMap(({ outputs }) => outputs)) {
        expect(files.get(each.path) ?? each.contents, each.path).toBe(each.contents);
        files.set(each.path, each.contents);
      }
      for (const { filename } of sources) {
        const name = filename.slice(filename.lastIndexOf("/") + 1);
        const path = name.endsWith(".uf.ts")
          ? `${name.slice(0, -6)}.ts`
          : `${name.slice(0, -7)}.tsx`;
        expect(files.has(path), path).toBe(true);
      }
      await expectClean(
        id,
        [...files].map(([path, contents]) => ({ path, contents })),
      );
    },
  );
});

describe("react composable calls", () => {
  it("destructures what render reads, and calls a function the hook returns", () => {
    expect(output("composables/use-toggle", "Disclosure.tsx")).toContain(
      'import { useToggle } from "./useToggle";',
    );
    expect(output("composables/use-toggle", "Disclosure.tsx")).toContain(
      "const { on, toggle, close } = useToggle(false);",
    );
  });

  it("destructures a renamed member under its local, once per call", () => {
    const layout = output("composables/use-media-query", "Layout.tsx");
    expect(layout).toContain('const { matches: wide } = useMediaQuery("(min-width: 1px)");');
    expect(layout).toContain('const { matches: tiny } = useMediaQuery("(max-width: 1px)");');
  });

  it("reads a ref through its live reader in client code, and only what the output reads", () => {
    const cart = output("semantics/composable-read-after-write", "Cart.tsx");
    expect(cart).toContain("const { items, currentItems, currentEmpty, add, clear } = useCart();");
    expect(cart).toContain("onTotal?.(currentItems());");
    expect(cart).toContain("onCleared?.(currentEmpty());");
  });

  it("passes a getter of what the caller renders, and a callback of client code", () => {
    expect(output("composables/getter-argument", "Basket.tsx")).toContain(
      "const { total, label } = useTotal(\n    () => price,\n    () => quantity,\n  );",
    );
    expect(output("composables/callback-argument", "Clicker.tsx")).toContain(
      "useCounter(3, (reached) => {\n    messageRef.current = `Reached ${reached}`;\n    setMessage(messageRef.current);\n    onLimit?.(reached);",
    );
  });

  it("imports a shared module's values, and declares the module's constants", () => {
    expect(output("modules/shared-helpers", "PriceTag.tsx")).toContain(
      'import { formatPrice, pluralise } from "./format";',
    );
    expect(output("modules/module-constants", "Stepper.tsx")).toContain(
      [
        "const STEPS = [1, 5, 10] as const;",
        "const LIMITS = Object.freeze({ min: 0, max: 20 });",
        "const caption = (value: number): string => `${value} of ${LIMITS.max}`;",
        "const START = LIMITS.min + 2;",
      ].join("\n"),
    );
  });
});

describe("react composable hooks", () => {
  it("returns each state with its live reader over the mirror, and stable functions", () => {
    const output = hook("composables/use-toggle");
    expect(output).toContain("const [currentOn] = useState(() => () => onRef.current);");
    expect(output).toContain("const [toggle] = useState(() => () => {");
    expect(output).toContain("return { on, currentOn, toggle, close };");
  });

  it("reads getter arguments through mirrors in a returned derived value's live getter", () => {
    const output = hook("composables/getter-argument");
    expect(output).toContain(
      "const total = useMemo(() => price() * quantity(), [price, quantity]);",
    );
    expect(output).toContain(
      "const [currentTotal] = useState(() => () => priceRef.current() * quantityRef.current());",
    );
  });

  it("calls a callback argument through its mirror, and reads a value argument as passed", () => {
    const output = hook("composables/callback-argument");
    expect(output).toContain("onLimitRef.current = onLimit;");
    expect(output).toContain(
      "if (countRef.current === limit) onLimitRef.current(countRef.current);",
    );
  });
});

describe("react composable calls, narrowed and typed", () => {
  it(
    "asserts a narrowed path of a nullable ref the hook returns, read through its live reader",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/useUser.uf.ts": [
          'import { ref } from "unframework";',
          "",
          "export function useUser() {",
          "  const user = ref<{ name: string } | null>(null);",
          "  function signIn(name: string) {",
          "    user.value = { name };",
          "  }",
          "  return { user, signIn };",
          "}",
          "",
        ].join("\n"),
        "/project/Profile.uf.tsx": [
          'import { defineEmits } from "unframework";',
          "",
          'import { useUser } from "./useUser.uf.ts";',
          "",
          "export default function Profile() {",
          "  const emit = defineEmits<{ name: [name: string] }>();",
          "  const { user, signIn } = useUser();",
          "",
          "  function report() {",
          '    signIn("a");',
          '    if (user.value) emit("name", user.value.name);',
          "  }",
          "",
          "  return (",
          '    <button type="button" onClick={report}>',
          '      {user.value ? user.value.name : "Nobody"}',
          "    </button>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      expect(project.output("Profile.tsx")).toContain(
        "if (currentUser()) onName?.(currentUser()!.name);",
      );
      await expectClean("calls/narrowed", project.outputs);
    },
  );

  it("imports the type a module constant's annotation names", { timeout: 60_000 }, async () => {
    const project = await compileProject({
      "/project/tones.ts": 'export type Tone = "info" | "danger";\n',
      "/project/Badge.uf.tsx": [
        'import type { Tone } from "./tones";',
        "",
        'const DEFAULT: Tone = "info";',
        "",
        "export default function Badge() {",
        "  return <b>{DEFAULT}</b>;",
        "}",
        "",
      ].join("\n"),
    });
    expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    expect(project.output("Badge.tsx")).toContain('import type { Tone } from "./tones";');
    await expectClean("modules/constant-type", project.outputs);
  });

  it(
    "declares a module constant a type reads only through `typeof`",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/Gauge.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          "const LIMITS = { min: 0, max: 9 };",
          "",
          "export default function Gauge() {",
          "  const level = ref<typeof LIMITS.min>(0);",
          "  return <b>{level.value}</b>;",
          "}",
          "",
        ].join("\n"),
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      expect(project.output("Gauge.tsx")).toContain("const LIMITS = { min: 0, max: 9 };");
      await expectClean("modules/type-query", project.outputs);
    },
  );
});

describe("react composable shapes", () => {
  it(
    "returns a function render code calls too as its stable client variant",
    {
      timeout: 60_000,
    },
    async () => {
      const { diagnostics, outputs } = await compileHook(
        [
          'import { ref } from "unframework";',
          "",
          "export function useVariant(seed: () => number) {",
          "  const count = ref(0);",
          "  function double() {",
          "    return count.value * 2 + seed();",
          "  }",
          "  const snapshot = ref(double());",
          "  function inc() {",
          "    count.value++;",
          "  }",
          "  return { count, snapshot, double, inc };",
          "}",
          "",
        ].join("\n"),
        "useVariant.uf.ts",
      );
      expect(diagnostics).toEqual([]);
      const output = outputs[0]!.contents;
      expect(output).toContain(
        "const [currentDouble] = useState(() => () => {\n    return countRef.current * 2 + seedRef.current();",
      );
      expect(output).toContain("double: currentDouble,");
      await expectClean("shapes/variant", outputs);
    },
  );

  it("reports a getter or a callback argument held in a constant (UF1002)", async () => {
    const source = [
      'import { ref } from "unframework";',
      "",
      "export function useAlias(price: () => number, onPick: (value: number) => void) {",
      "  const read = price;",
      "  const n = ref(0);",
      "  function pick() {",
      "    n.value = read();",
      "    onPick(n.value);",
      "  }",
      "  return { n, pick };",
      "}",
      "",
    ].join("\n");
    const { diagnostics, outputs } = await compileHook(source, "useAlias.uf.ts");
    const start = source.indexOf("= price;") + 2;
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "UF1002",
        target: "react",
        span: { start, end: start + "price".length },
      }),
    ]);
    expect(outputs).toEqual([]);
  });

  it(
    "declares the module's constants a hook reads",
    {
      timeout: 60_000,
    },
    async () => {
      const { diagnostics, outputs } = await compileHook(
        [
          'import { ref } from "unframework";',
          "",
          "const STEP = 2;",
          "const LIMIT = STEP * 10;",
          "",
          "export function useStep() {",
          "  const n = ref(0);",
          "  function inc() {",
          "    n.value = Math.min(LIMIT, n.value + STEP);",
          "  }",
          "  return { n, inc };",
          "}",
          "",
        ].join("\n"),
        "useStep.uf.ts",
      );
      expect(diagnostics).toEqual([]);
      expect(outputs[0]!.contents).toContain("const STEP = 2;\nconst LIMIT = STEP * 10;");
      await expectClean("shapes/module-constants", outputs);
    },
  );

  it("calls a getter argument where a constant's value reads it", async () => {
    const { diagnostics, outputs } = await compileHook(
      [
        "export function useFirst(price: () => number) {",
        "  const first = price();",
        "  return { first };",
        "}",
        "",
      ].join("\n"),
      "useFirst.uf.ts",
    );
    expect(diagnostics).toEqual([]);
    expect(outputs[0]!.contents).toContain("const [first] = useState(() => price());");
  });
});

describe("react composable live readers", () => {
  it("names each state's and derived value's reader, past every member's name", () => {
    const readers = liveReaderNames([
      { name: "on", kind: "state" },
      { name: "currentOn", kind: "function" },
      { name: "total", kind: "derived" },
      { name: "toggle", kind: "function" },
      { name: "step", kind: "constant" },
    ]);
    expect([...readers]).toEqual([
      ["on", "currentOn_1"],
      ["total", "currentTotal"],
    ]);
  });
});
