// The composable and shared-module cases on Qwik (ADR-0069, ADR-0070): each source compiles
// through `compile()` with no error, a `.uf.ts` one to one `use*` hook per composable, and every
// output of a case, its components, its hooks and its copied `.ts` modules, passes the real
// optimizer (L3), tsgo (L4) and the lint rules, eslint-plugin-qwik's type-aware ones among them
// (L5), as the corpus's toolchain project runs them. The cases wait in
// `tests/integration/pending/` until every target's lane has landed
// (../../codegen/test/composable-cases.ts).
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createOptimizer } from "@qwik.dev/optimizer";
import { ImportSet, parseCodeSource } from "@unframework/codegen";
import type { OutputFile } from "@unframework/codegen";
import { createComposableParameter, createTypeText } from "@unframework/ir";
import type { ComposableParameter, ComposableParameterKind } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";
import { parameterCode, readGetters } from "../src/composable.ts";
import { callbackFloats, OutputNames } from "../src/plan.ts";
import { toolchain } from "../src/toolchain/index.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context = { toolchainDir: join(repo, "tests/toolchains/qwik"), root: packageDir };
// Scratch files live inside this package, so `@qwik.dev/core` resolves from them.
mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "composable-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const cases = await compileComposableCases("qwik");

/** The output a case's source compiles to, by the output's path. */
function caseOutput(id: string, path: string): string {
  return cases
    .find((each) => each.id === id)!
    .sources.flatMap(({ outputs }) => outputs)
    .find((each) => each.path === path)!.contents;
}

describe("qwik composable cases", () => {
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
    async ({ id, dir, sources }) => {
      const errors = sources.flatMap(({ diagnostics }) =>
        diagnostics.filter(({ severity }) => severity === "error"),
      );
      expect(errors).toEqual([]);
      // A hook per composable, a component per `.uf.tsx`, and each `.ts` copy once, however
      // many sources import it.
      const emitted = [
        ...new Map(
          sources.flatMap(({ outputs }) => outputs).map((each) => [each.path, each]),
        ).values(),
      ];
      // Each source's own output, and each `.ts` of the case as its copy, and nothing else.
      const expected = readdirSync(dir)
        .flatMap((name) => {
          if (name.endsWith(".uf.ts")) return [`${name.slice(0, -6)}.ts`];
          if (name.endsWith(".uf.tsx")) return [`${name.slice(0, -7)}.tsx`];
          return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [name] : [];
        })
        .toSorted();
      expect(emitted.map(({ path }) => path).toSorted()).toEqual(expected);
      await expectToolchainClean(id, emitted);
    },
  );
});

/**
 * Writes outputs into a scratch directory of their own and expects the optimizer (L3), tsgo (L4)
 * and the lint rules (L5) to accept each with no message.
 */
async function expectToolchainClean(name: string, outputs: readonly OutputFile[]): Promise<void> {
  const directory = join(scratch, name);
  mkdirSync(directory, { recursive: true });
  const files = outputs.map(({ path, contents }) => {
    const absolute = join(directory, path);
    writeFileSync(absolute, contents);
    return { path: absolute, contents };
  });
  const compiled = await toolchain.frameworkCompile(files, context);
  for (const { path } of files) {
    expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
  }
  const paths = files.map(({ path }) => path);
  const checked = await toolchain.typecheck(paths, context);
  for (const path of paths) expect(checked.get(path) ?? [], path).toEqual([]);
  const linted = await toolchain.lint(paths, context);
  for (const [path, messages] of linted) expect(messages, path).toEqual([]);
}

/** A composable module's source compiled for Qwik, its diagnostics' codes and spans with it. */
async function compileProbe(source: string) {
  const result = await compile(source, { filename: "probe/useProbe.uf.ts", targets: ["qwik"] });
  const errors = result.diagnostics
    .filter(({ severity }) => severity === "error")
    .map(({ code, span }) => ({ code, text: source.slice(span.start, span.end), at: span.start }));
  return { errors, outputs: result.outputs.qwik ?? [], source };
}

/** The hook a case's composable compiles to. */
function hook(id: string): string {
  return cases
    .find((each) => each.id === id)!
    .sources.find(({ filename }) => filename.endsWith(".uf.ts"))!.outputs[0]!.contents;
}

describe("qwik composable hooks", () => {
  it("returns its signals as they are, and its functions as `$()` QRLs", () => {
    const output = hook("composables/use-toggle");
    expect(output).toContain("export function useToggle(initial: boolean) {");
    expect(output).toContain("const on = useSignal(initial);");
    expect(output).toContain("const toggle = $(() => {");
    expect(output).toContain("return { on, toggle, close };");
  });

  it("takes a getter argument as the signal its caller computes, read through `.value`", () => {
    const output = hook("composables/getter-argument");
    expect(output).toContain(
      "export function useTotal(price: ReadonlySignal<number>, quantity: ReadonlySignal<number>) {",
    );
    expect(output).toContain("const total = useComputed$(() => price.value * quantity.value);");
  });

  it("takes a callback argument as a QRL, which a call that returns nothing leaves to run", () => {
    const output = hook("composables/callback-argument");
    expect(output).toContain("onLimit: QRL<(count: number) => void>");
    expect(output).toContain("if (count.value === limit) void onLimit(count.value);");
  });

  it("keeps its type parameters, which its parameters' forms carry", () => {
    const output = hook("composables/use-controllable-state");
    expect(output).toContain("export function useControllableState<T>(");
    expect(output).toContain("value: ReadonlySignal<T | undefined>,");
    expect(output).toContain("onChange: QRL<(next: T) => void>,");
  });

  it("reads a getter argument as its signal in a derived value and in a hook", () => {
    const output = hook("semantics/composable-unmount-order");
    expect(output).toContain("const title = useComputed$(() => `Panel ${name.value}`);");
    expect(output).toMatch(/^\s*report\(`\$\{name\.value\} closed`\);$/m);
  });
});

describe("qwik composable forms", () => {
  it(
    "keeps a returned function that reads nothing of the hook a `$()` QRL",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe() {
  const count = ref(0);
  function format(value: number) {
    return \`#\${value}\`;
  }
  return { count, format };
}
`);
      expect(errors).toEqual([]);
      expect(outputs[0]!.contents).toContain("const format = $((value: number) => {");
      expect(outputs[0]!.contents).toContain("return { count, format };");
      await expectToolchainClean("returned-pure", outputs);
    },
  );

  it(
    "tracks a getter argument through a function in a watcher and an effect",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } =
        await compileProbe(`import { ref, watch, watchEffect } from "unframework";

export function useProbe(price: () => number, limit?: () => number) {
  const last = ref(0);
  const seen = ref(0);
  watch(
    () => price(),
    (value) => {
      seen.value = value;
    },
  );
  watchEffect(() => {
    last.value = price() + (limit?.() ?? 0);
  });
  return { last, seen };
}
`);
      expect(errors).toEqual([]);
      const output = outputs[0]!.contents;
      expect(output).toContain("const value = track(() => price.value);");
      expect(output).toContain(
        'const values: [typeof price.value, NonNullable<typeof limit>["value"] | undefined] = [',
      );
      expect(output).toContain("track(() => limit?.value)");
      expect(output).toContain("last.value = price.value + (limit?.value ?? 0);");
      await expectToolchainClean("tracked-getters", outputs);
    },
  );

  it(
    "floats a statement call of a callback that returns a promise, and awaits one whose value is used",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe(onSave: (count: number) => Promise<void>, accept: (count: number) => boolean) {
  const count = ref(0);
  function save() {
    onSave(count.value);
    if (accept(count.value)) count.value += 10;
  }
  return { count, save };
}
`);
      expect(errors).toEqual([]);
      const output = outputs[0]!.contents;
      expect(output).toContain("void onSave(count.value);");
      expect(output).toContain("if (await accept(count.value)) count.value += 10;");
      await expectToolchainClean("callback-calls", outputs);
    },
  );

  it("reports a getter passed on or kept other than by a call, and emits nothing", async () => {
    const { errors, outputs } = await compileProbe(`import { computed } from "unframework";

export function useProbe(price: () => number) {
  function apply(get: () => number) {
    return get() * 2;
  }
  const read = price;
  const double = computed(() => read() * 2);
  const applied = computed(() => apply(price));
  return { double, applied };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "price" },
      { code: "UF1002", text: "price" },
    ]);
    expect(outputs).toEqual([]);
  });

  it("reports a callback passed on or called in a function of the code's own", async () => {
    const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe(accept: (value: number) => boolean, compare: (a: number, b: number) => number) {
  const list = ref([3, 1, 2]);
  function keep() {
    list.value = list.value.filter((value) => accept(value));
  }
  function order() {
    list.value = [...list.value].sort(compare);
  }
  return { list, keep, order };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "accept" },
      { code: "UF1002", text: "compare" },
    ]);
    expect(outputs).toEqual([]);
  });

  it("reports a value whose type holds a function where a `$` scope captures it", async () => {
    const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

interface Formats {
  label: string;
  format(value: number): string;
}

export function useProbe(options: { format: (value: number) => string }, named: Formats, plain: { step: number }) {
  const label = ref("");
  const initial = ref(named.label);
  function show(value: number) {
    label.value = options.format(value) + named.format(value) + String(plain.step);
  }
  return { label, initial, show };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "options" },
      { code: "UF1002", text: "named" },
    ]);
    expect(outputs).toEqual([]);
  });

  it("reports a `const` that takes a function-holding value or a part of it, where a `$` scope captures it", async () => {
    const { errors, outputs } = await compileProbe(`import { computed, ref } from "unframework";

export function useProbe(options: { step: number; format: (value: number) => string }) {
  const count = ref(0);
  const label = ref("");
  const format = options.format;
  const settings = options;
  const first = options.format(1);
  const shown = computed(() => format(count.value));
  function show() {
    label.value = String(settings.step) + first;
  }
  return { count, label, shown, show };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "format" },
      { code: "UF1002", text: "settings" },
    ]);
    expect(outputs).toEqual([]);
  });

  it(
    "judges a `const` by the types its value reads: a member that holds no function is free",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

interface Base {
  format(value: number): string;
}

interface Options extends Base {
  step: number;
  labels: readonly string[];
}

export function useProbe(options: Options) {
  const count = ref(0);
  const step = options.step;
  const first = options.labels[0] ?? "";
  const size = options.labels.length;
  const shown = options.format(step);
  function bump() {
    count.value += step + size + first.length + shown.length;
  }
  return { count, bump };
}
`);
      expect(errors).toEqual([]);
      expect(outputs[0]!.contents).toContain("const step = options.step;");
      await expectToolchainClean("written-free", outputs);
    },
  );

  it("judges a `const` by a call's declared return type, a function's `bind` and an array's copies", async () => {
    const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe(options: {
  make: () => (value: number) => string;
  format: (value: number) => string;
  formats: ((value: number) => string)[];
}) {
  const label = ref("");
  const made = options.make();
  const bound = options.format.bind(null);
  const copied = options.formats.slice();
  const one = options.formats.at(0);
  function show(value: number) {
    label.value = made(value) + bound(value) + String(copied.length) + String(one);
  }
  return { label, show };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "made" },
      { code: "UF1002", text: "bound" },
      { code: "UF1002", text: "copied" },
      { code: "UF1002", text: "one" },
    ]);
    expect(outputs).toEqual([]);
  });

  it(
    "reads a primitive's methods and a function's `name` as free, and an array's callback by what it returns",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe(options: {
  name: string;
  count: number;
  tags: string[];
  format: (value: number) => string;
  formats: ((value: number) => string)[];
}) {
  const total = ref(0);
  const upper = options.name.toUpperCase();
  const fixed = options.count.toFixed(2);
  const words = options.name.split(" ");
  const trimmed = options.format(1).trim();
  const called = options.format.name;
  const joined = options.tags.join(",");
  const least = Math.min(options.count, 1);
  const shown = options.formats.map((format) => format(options.count));
  function sum() {
    total.value =
      upper.length + fixed.length + words.length + trimmed.length + called.length + joined.length + least + shown.length;
  }
  return { total, sum };
}
`);
      expect(errors).toEqual([]);
      await expectToolchainClean("written-methods", outputs);
    },
  );

  it("reads a value the written types give no type by what it reads", async () => {
    const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe(options: {
  format: (value: number) => string;
  items: number[];
  formats: Array<(value: number) => string>;
}) {
  const total = ref(0);
  const merged = Object.assign({}, options);
  const mapped = options.items.map(() => options.format);
  const copied = Array.from(options.formats);
  const values = Object.values(options);
  const spread = [...options.formats.values()];
  const kept = options.formats.map((format) => format);
  const cloned = structuredClone(options);
  function count() {
    total.value = String(merged).length + mapped.length + copied.length + values.length + spread.length + kept.length + String(cloned).length;
  }
  return { total, count };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "merged" },
      { code: "UF1002", text: "mapped" },
      { code: "UF1002", text: "copied" },
      { code: "UF1002", text: "values" },
      { code: "UF1002", text: "spread" },
      { code: "UF1002", text: "kept" },
      { code: "UF1002", text: "cloned" },
    ]);
    expect(outputs).toEqual([]);
  });

  it("reads a value the written types don't type exactly by what its code reads", async () => {
    const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

type Format = (value: number) => string;

interface Box<T> {
  value: T;
}

export function useProbe(options: {
  entries: Array<{ format: Format; id: number }>;
  formats: Format[];
  box: Box<Format>;
  identity: <T>(value: T) => T;
  make?: (() => Format) | undefined;
  format: Format;
}) {
  const total = ref(0);
  const pick = () => options.format;
  const destructured = options.entries.map(({ format }) => format);
  const picked = pick();
  const boxed = options.box.value;
  const local = options.formats.map((format) => {
    const kept = format;
    return kept;
  });
  const defaulted = options.formats.map((format = options.format) => format);
  const rested = options.formats.map((...all) => all[0]);
  const indexed = options.formats.map((_, index, all) => all[index]);
  const same = options.identity(options.format);
  const made = options.make?.();
  const gathered = options.formats.reduce<Format[]>((all, format) => {
    all.push(format);
    return all;
  }, []);
  function count() {
    total.value = [destructured, picked, boxed, local, defaulted, rested, indexed, same, made, gathered].length;
  }
  return { total, count };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual(
      [
        "destructured",
        "picked",
        "boxed",
        "local",
        "defaulted",
        "rested",
        "indexed",
        "same",
        "made",
        "gathered",
      ].map((text) => ({ code: "UF1002", text })),
    );
    expect(outputs).toEqual([]);
  });

  it(
    "reads through an optional array, the utility types and a substituted generic to a free member",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

type Format = (value: number) => string;

interface Box<T> {
  value: T;
}

export function useProbe(
  options: { formats?: Array<Format> | undefined; box: Box<number>; format: Format },
  named: Readonly<{ format: Format; name: string }>,
  partial: Partial<{ format: Format; step: number }>,
) {
  const total = ref(0);
  const size = options.formats?.length ?? 0;
  const boxed = options.box.value;
  const length = named.name.length;
  const step = partial.step ?? 1;
  function count() {
    total.value = size + boxed + length + step;
  }
  return { total, count };
}
`);
      expect(errors).toEqual([]);
      await expectToolchainClean("written-wrappers", outputs);
    },
  );

  it("reports a `let` whose initial value holds a function, since it is a signal", async () => {
    const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

export function useProbe(options: { format: (value: number) => string; step: number }) {
  const count = ref(0);
  const label = ref("");
  let format = options.format;
  let step = options.step;
  function show() {
    label.value = format(count.value) + String(step);
  }
  return { count, label, show };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "options.format" },
    ]);
    expect(outputs).toEqual([]);
  });

  it("reports a value whose type inherits a function from an interface the module extends", async () => {
    const { errors, outputs } = await compileProbe(`import { computed } from "unframework";

interface Base {
  format(value: number): string;
}

interface Options extends Base {
  label: string;
}

export function useProbe(options: Options) {
  const shown = computed(() => options.format(1) + options.label);
  return { shown };
}
`);
    expect(errors.map(({ code, text }) => ({ code, text }))).toEqual([
      { code: "UF1002", text: "options" },
      { code: "UF1002", text: "options" },
    ]);
    expect(outputs).toEqual([]);
  });

  it(
    "tests whether an optional getter or callback was passed, as the source does",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { computed, ref } from "unframework";

export function useProbe(
  price: () => number,
  limit?: () => number,
  onChange?: (next: number) => void,
  accept?: (next: number) => boolean,
) {
  const count = ref(0);
  const capped = computed(() => (limit ? Math.min(price(), limit()) : price()));
  const bounded = computed(() => (limit !== undefined && !!price ? limit!() : 0));
  function set(next: number) {
    count.value = next;
    if (onChange) onChange(next);
    if (accept && accept!(next)) count.value += 1;
  }
  return { count, capped, bounded, set };
}
`);
      expect(errors).toEqual([]);
      const output = outputs[0]!.contents;
      expect(output).toContain(
        "const capped = useComputed$(() => (limit ? Math.min(price.value, limit.value) : price.value));",
      );
      expect(output).toContain("limit !== undefined && !!price ? limit!.value : 0");
      expect(output).toContain("if (onChange) void onChange(next);");
      expect(output).toContain("if (accept && (await accept!(next))) count.value += 1;");
      await expectToolchainClean("guards", outputs);
    },
  );

  it(
    "declares a module's constant a composable reads beside the hook",
    { timeout: 60_000 },
    async () => {
      const { errors, outputs } = await compileProbe(`import { ref } from "unframework";

const STEP = 2;

export function useProbe() {
  const count = ref(0);
  function add() {
    count.value += STEP;
  }
  return { count, add };
}
`);
      expect(errors).toEqual([]);
      expect(outputs[0]!.contents).toMatch(/^const STEP = 2;\n\nexport function useProbe\(\) \{$/m);
      await expectToolchainClean("module-constant", outputs);
    },
  );
});

/** A composable's parameter of a kind, with its type as written. */
function parameter(
  name: string,
  kind: ComposableParameterKind,
  type: string,
  optional = false,
): ComposableParameter {
  const span = { start: 0, end: type.length };
  return createComposableParameter(
    name,
    kind,
    createTypeText(type, span),
    `${name}@0`,
    span,
    optional,
  );
}

describe("qwik composable parameters", () => {
  it("declares a value as written, a getter as a signal and a callback as a QRL", () => {
    const names = new OutputNames(new ImportSet(new Set()));
    expect(parameterCode(parameter("initial", "value", "boolean"), names)).toBe("initial: boolean");
    expect(parameterCode(parameter("price", "getter", "() => number | undefined"), names)).toBe(
      "price: ReadonlySignal<number | undefined>",
    );
    expect(parameterCode(parameter("pick", "getter", "<T>() => T", true), names)).toBe(
      "pick?: ReadonlySignal<ReturnType<<T>() => T>>",
    );
    expect(parameterCode(parameter("onLimit", "callback", "(count: number) => void"), names)).toBe(
      "onLimit: QRL<(count: number) => void>",
    );
  });

  it("floats the calls of a callback that returns nothing or a promise", () => {
    expect(callbackFloats(parameter("onSave", "callback", "(n: number) => void"))).toBe(true);
    expect(callbackFloats(parameter("onSave", "callback", "(n: number) => Promise<void>"))).toBe(
      true,
    );
    expect(
      callbackFloats(parameter("onSave", "callback", "(n: number) => void | PromiseLike<void>")),
    ).toBe(true);
    expect(callbackFloats(parameter("accept", "callback", "(n: number) => boolean"))).toBe(false);
  });

  it("reads a getter's signal where code calls it, an optional call included", () => {
    const getters = new Set(["price"]);
    expect(readGetters("price() * 2", "expression", getters)).toBe("price.value * 2");
    expect(readGetters("price?.() ?? 0", "expression", getters)).toBe("price?.value ?? 0");
    expect(
      readGetters("{ const total = price(); log(total, prices()); }", "statements", getters),
    ).toBe("{ const total = price.value; log(total, prices()); }");
  });
});

/**
 * The sources at `files` (paths under `/project`), each `.uf.tsx` and `.uf.ts` one compiled for
 * Qwik through a resolver and a type oracle over them: every output, and each `.ts` source as a
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
    const result = await compile(source, { filename, targets: ["qwik"], resolve, typeOracle });
    diagnostics.push(
      ...result.diagnostics.map(({ code, severity, span }) => ({
        code,
        severity,
        text: source.slice(span.start, span.end),
      })),
    );
    for (const file of result.outputs.qwik ?? []) outputs.set(file.path, file.contents);
  }
  return {
    diagnostics,
    outputs: [...outputs].map(([path, contents]) => ({ path, contents })),
    output: (path: string) => outputs.get(path)!,
  };
}

/** A composable that takes a callback, as the pending `callback-argument` case's does. */
const USE_COUNTER = `import { ref } from "unframework";

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const count = ref(0);
  function increment() {
    count.value += 1;
    if (count.value === limit) onLimit(count.value);
  }
  function reset() {
    count.value = 0;
  }
  return { count, increment, reset };
}
`;

/** A composable with state, a derived value, a constant, a function and an async function. */
const USE_BITS = `import { computed, ref } from "unframework";

export function useBits(start: number) {
  const count = ref(start);
  const double = computed(() => count.value * 2);
  const unit = "px";
  function label(value: number) {
    return \`\${value}\${unit}\`;
  }
  function add() {
    count.value++;
  }
  async function save() {
    await Promise.resolve();
    count.value = 0;
  }
  return { count, double, unit, label, add, save };
}
`;

describe("qwik composable calls", () => {
  it("destructures what the output reads, from the hook its output imports", () => {
    const disclosure = caseOutput("composables/use-toggle", "Disclosure.tsx");
    expect(disclosure).toContain('import { useToggle } from "./useToggle";');
    expect(disclosure).toContain("const { on, toggle, close } = useToggle(false);");
    expect(disclosure).toContain("aria-expanded={on.value} onClick$={() => toggle()}");
  });

  it("destructures a renamed member under its local, once per call", () => {
    const layout = caseOutput("composables/use-media-query", "Layout.tsx");
    expect(layout).toContain('const { matches: wide } = useMediaQuery("(min-width: 1px)");');
    expect(layout).toContain('const { matches: tiny } = useMediaQuery("(max-width: 1px)");');
  });

  it("passes a getter as the signal `useComputed$` makes, and a callback as a `$()` QRL", () => {
    const basket = caseOutput("composables/getter-argument", "Basket.tsx");
    expect(basket).toContain(
      "useTotal(\n      useComputed$(() => price),\n      useComputed$(() => quantity.value),\n    );",
    );
    const clicker = caseOutput("composables/callback-argument", "Clicker.tsx");
    expect(clicker).toContain("const { count, step, increment, reset } = useCounter(\n      3,");
    expect(clicker).toContain("$((reached) => {\n        message.value = `Reached ${reached}`;");
  });

  it("awaits a returned function's call in client code, so a read after it sees the write", () => {
    const cart = caseOutput("semantics/composable-read-after-write", "Cart.tsx");
    expect(cart).toContain(
      "const addTwiceAndReport = $(async () => {\n      await add(1);\n      await add(2);\n      onTotal$?.(items.value);",
    );
  });

  it("tracks a returned ref in a watcher as its own", () => {
    const timeline = caseOutput("semantics/composable-effect-order", "Timeline.tsx");
    expect(timeline).toContain(
      "const { count, increment } = useTracked($((entry) => record(entry)));",
    );
    expect(timeline).toContain("const value = track(count);");
  });

  it(
    "leaves out what nothing reads, and floats a statement call of an async function",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/useBits.uf.ts": USE_BITS,
        "/project/Probe.uf.tsx": `import { useBits } from "./useBits.uf.ts";

export default function Probe() {
  const { count, add, save, unit } = useBits(1);
  const { double } = useBits(2);
  function reset() {
    save();
    add();
  }
  return (
    <button type="button" onClick={reset}>
      {count.value}
    </button>
  );
}
`,
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const probe = project.output("Probe.tsx");
      expect(probe).toContain("const { count, add, save } = useBits(1);\n    useBits(2);");
      expect(probe).toContain("void save();\n      await add();");
      await expectToolchainClean("calls/unread", project.outputs);
    },
  );

  it("reports a returned function the template or a getter calls (UF1002), and emits nothing", async () => {
    const project = await compileProject({
      "/project/useBits.uf.ts": USE_BITS,
      "/project/Probe.uf.tsx": `import { computed } from "unframework";

import { useBits } from "./useBits.uf.ts";

export default function Probe() {
  const { count, label } = useBits(1);
  const text = computed(() => label(count.value));
  function shown() {
    return label(0);
  }
  return (
    <p>
      {text.value} {shown()}
    </p>
  );
}
`,
    });
    expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
      { code: "UF1002", severity: "error", text: "label" },
      { code: "UF1002", severity: "error", text: "label" },
    ]);
    expect(project.outputs.map(({ path }) => path)).not.toContain("Probe.tsx");
  });

  it("reports a returned function each other site of render code calls (UF1002)", async () => {
    const project = await compileProject({
      "/project/useBits.uf.ts": USE_BITS,
      "/project/Probe.uf.tsx": `import { provide, ref, watch } from "unframework";
import type { InjectionKey } from "unframework";

import { useBits } from "./useBits.uf.ts";

export const NameKey: InjectionKey<string> = Symbol("name");

export default function Probe() {
  const { count, label } = useBits(1);
  const shown = ref(label(1));
  const fixed = label(2);
  watch(
    () => label(count.value),
    () => console.log(shown.value),
  );
  const { unit } = useBits(label(3).length);
  provide(NameKey, label(4));
  return (
    <p>
      {fixed} {unit}
    </p>
  );
}
`,
      "/project/Reader.uf.tsx": `import { inject } from "unframework";

import { NameKey } from "./Probe.uf.tsx";
import { useBits } from "./useBits.uf.ts";

export default function Reader() {
  const { label } = useBits(1);
  const name = inject(NameKey, label(5));
  return <p>{name}</p>;
}
`,
    });
    expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual(
      Array.from({ length: 6 }, () => ({ code: "UF1002", severity: "error", text: "label" })),
    );
    expect(project.outputs.map(({ path }) => path)).not.toContain("Probe.tsx");
    expect(project.outputs.map(({ path }) => path)).not.toContain("Reader.tsx");
  });

  it("reports a returned function a named slot's fill calls, since the fill renders (UF1002)", async () => {
    const project = await compileProject({
      "/project/useName.uf.ts": `import { ref } from "unframework";

export function useName() {
  const n = ref("Ada");
  function label(): string {
    return "Hi " + n.value;
  }
  return { n, label };
}
`,
      "/project/Card.uf.tsx": `import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return (
    <div class="card">
      <h3>{slots.title?.() ?? "Untitled"}</h3>
    </div>
  );
}
`,
      "/project/Page.uf.tsx": `import Card from "./Card.uf.tsx";
import { useName } from "./useName.uf.ts";

export default function Page() {
  const { label } = useName();
  return <Card>{{ title: () => <span aria-label={label()}>{label()}</span> }}</Card>;
}
`,
    });
    expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
      { code: "UF1002", severity: "error", text: "label" },
      { code: "UF1002", severity: "error", text: "label" },
    ]);
    expect(project.outputs.map(({ path }) => path)).not.toContain("Page.tsx");
  });

  it("reports an argument that reads what its own call returns, itself or through a function (UF1002)", async () => {
    const direct = await compileProject({
      "/project/useCounter.uf.ts": USE_COUNTER,
      "/project/Probe.uf.tsx": `import { useCounter } from "./useCounter.uf.ts";

export default function Probe() {
  const { count, increment, reset } = useCounter(3, () => {
    reset();
  });
  return (
    <button type="button" onClick={() => increment()}>
      {count.value}
    </button>
  );
}
`,
    });
    expect(direct.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
      { code: "UF1002", severity: "error", text: "reset" },
    ]);
    expect(direct.outputs.map(({ path }) => path)).not.toContain("Probe.tsx");
    const through = await compileProject({
      "/project/useCounter.uf.ts": USE_COUNTER,
      "/project/Probe.uf.tsx": `import { useCounter } from "./useCounter.uf.ts";

export default function Probe() {
  const { count, increment, reset } = useCounter(3, (n) => {
    report(n);
  });
  function report(n: number) {
    console.log(n);
    reset();
  }
  return (
    <button type="button" onClick={() => increment()}>
      {count.value}
    </button>
  );
}
`,
    });
    expect(through.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
      { code: "UF1002", severity: "error", text: "report" },
    ]);
    expect(through.outputs.map(({ path }) => path)).not.toContain("Probe.tsx");
    // Two calls whose callbacks read each other's members: each argument is made before both
    // calls return.
    const crossed = await compileProject({
      "/project/useCounter.uf.ts": USE_COUNTER,
      "/project/Probe.uf.tsx": `import { useCounter } from "./useCounter.uf.ts";

export default function Probe() {
  const { count: a, reset: resetA } = useCounter(3, () => {
    resetB();
  });
  const { count: b, reset: resetB } = useCounter(4, () => {
    resetA();
  });
  return (
    <p>
      {a.value} {b.value}
    </p>
  );
}
`,
    });
    expect(crossed.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
      { code: "UF1002", severity: "error", text: "resetB" },
      { code: "UF1002", severity: "error", text: "resetA" },
    ]);
    expect(crossed.outputs.map(({ path }) => path)).not.toContain("Probe.tsx");
  });

  it(
    "declares a call before what reads its members, and after what its callback calls, a QRL it awaits",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/useCounter.uf.ts": USE_COUNTER,
        "/project/Probe.uf.tsx": `import { ref } from "unframework";

import { useCounter } from "./useCounter.uf.ts";

export default function Probe() {
  const message = ref("Counting");
  function bump() {
    increment();
  }
  const { count, increment } = useCounter(3, () => {
    announce();
  });
  function announce() {
    message.value = "Reached";
  }
  return (
    <button type="button" onClick={bump}>
      {count.value} {message.value}
    </button>
  );
}
`,
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const probe = project.output("Probe.tsx");
      const at = (text: string) => {
        expect(probe).toContain(text);
        return probe.indexOf(text);
      };
      const announce = at("const announce = $(() => {");
      const call = at("const { count, increment } = useCounter(");
      const bump = at("const bump = $(async () => {\n      await increment();");
      expect(at("$(async () => {\n        await announce();")).toBeGreaterThan(call);
      expect(announce).toBeLessThan(call);
      expect(call).toBeLessThan(bump);
      await expectToolchainClean("calls/order", project.outputs);
    },
  );

  it.each([
    { how: "itself", callback: "resetB();", relay: "", read: "resetB" },
    {
      how: "through a setup function",
      callback: "relay();",
      relay: "  function relay() {\n    resetB();\n  }\n",
      read: "relay",
    },
  ])(
    "names every call of a hook another call's argument reads $how, so the server builds it",
    { timeout: 60_000 },
    async ({ how, callback, relay, read }) => {
      const project = await compileProject({
        "/project/useCounter.uf.ts": USE_COUNTER,
        "/project/Probe.uf.tsx": `import { ref } from "unframework";

import { useCounter } from "./useCounter.uf.ts";

export default function Probe() {
  const message = ref("");
  const { count: a, increment } = useCounter(3, () => {
    ${callback}
  });
  const { count: b, reset: resetB } = useCounter(4, () => {
    message.value = "b";
  });
${relay}  return (
    <button type="button" onClick={() => increment()}>
      {a.value} {b.value} {message.value}
    </button>
  );
}
`,
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const probe = project.output("Probe.tsx");
      // The call another call's argument reads comes first, as an object of its own.
      expect(probe).toMatch(
        /const counter_1 = useCounter\(\s*4,[\s\S]*?\);\n\s*const \{ count: b, reset: resetB \} = counter_1;/,
      );
      expect(probe).toMatch(
        new RegExp(
          `const counter = useCounter\\(\\s*3,\\s*\\$\\(async \\(\\) => \\{\\s*await ${read}\\(\\);[\\s\\S]*?\\);\\n\\s*const \\{ count: a, increment \\} = counter;`,
        ),
      );
      expect(probe.indexOf("const counter_1 =")).toBeLessThan(probe.indexOf("const counter ="));
      await expectToolchainClean(`calls/same-hook-${how.replace(/\W+/g, "-")}`, project.outputs);
      // The server's build hoists every segment into the module (Qwik's Vite plugin runs the
      // optimizer with `hoist` for every server transform), where two calls the optimizer named
      // alike would be declared twice.
      const optimizer = await createOptimizer();
      const { modules } = await optimizer.transformModules({
        input: [{ path: "Probe.tsx", code: probe }],
        srcDir: scratch,
        entryStrategy: { type: "hoist" },
        minify: "simplify",
        transpileTs: true,
        transpileJsx: true,
        explicitExtensions: true,
        mode: "dev",
        isServer: true,
      });
      expect(modules.length).toBeGreaterThan(0);
      for (const { code } of modules)
        expect(() => parseCodeSource(code, "statements")).not.toThrow();
    },
  );
});

describe("qwik shared modules", () => {
  it("imports a shared module's values as the source does", () => {
    const picker = caseOutput("modules/shared-constants", "SizePicker.tsx");
    expect(picker).toContain(
      'import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";',
    );
    expect(picker).toContain("const size = useSignal<Size>(DEFAULT_SIZE);");
  });

  it("declares the module's constants at module scope, in source order", () => {
    const stepper = caseOutput("modules/module-constants", "Stepper.tsx");
    expect(stepper).toContain(
      [
        "const STEPS = [1, 5, 10] as const;",
        "const LIMITS = Object.freeze({ min: 0, max: 20 });",
        "const caption = (value: number): string => `${value} of ${LIMITS.max}`;",
        "const START = LIMITS.min + 2;",
        "",
        "export default component$",
      ].join("\n"),
    );
  });

  it(
    "declares a constant two components read in the main one's output, which the other imports",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/Pair.uf.tsx": `const STEP = 2;

function Half() {
  return <span>{STEP / 2}</span>;
}

export default function Pair() {
  return (
    <p>
      {STEP} <Half />
    </p>
  );
}
`,
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      expect(project.output("Pair.tsx")).toContain("const STEP = 2;\nexport { STEP };");
      expect(project.output("Half.tsx")).toContain('import { STEP } from "./Pair";');
      expect(project.output("Half.tsx")).not.toContain("const STEP");
      await expectToolchainClean("modules/pair", project.outputs);
    },
  );

  it(
    "moves what reads only module values to module scope, but in an owner that imports them",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/Pair.uf.tsx": `const STEP = 2;

function Half() {
  const LIMIT = STEP * 2;
  return <span>{LIMIT}</span>;
}

export default function Pair() {
  const DOUBLE = STEP * 2;
  function grow(value: number): number {
    return value + STEP;
  }
  return (
    <p>
      {DOUBLE} {grow(1)} <Half />
    </p>
  );
}
`,
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const pair = project.output("Pair.tsx");
      const component = pair.indexOf("export default component$");
      expect(pair.indexOf("const DOUBLE = STEP * 2;")).toBeLessThan(component);
      expect(pair.indexOf("function grow(value: number): number {")).toBeLessThan(component);
      const half = project.output("Half.tsx");
      expect(half.indexOf("const LIMIT = STEP * 2;")).toBeGreaterThan(
        half.indexOf("export const Half = component$"),
      );
      await expectToolchainClean("modules/hoisted", project.outputs);
    },
  );

  it(
    "declares the constants, types and type imports a reached constant names, and what a type queries",
    { timeout: 60_000 },
    async () => {
      const project = await compileProject({
        "/project/units.ts": 'export type Unit = "km" | "mi";\n',
        "/project/Gauge.uf.tsx": `import { ref } from "unframework";

import type { Unit } from "./units";

interface Limits {
  min: number;
  max: number;
}

const LIMITS: Limits = { min: 0, max: 9 };
const START = LIMITS.min + 1;
const UNIT: Unit = "km";
const SIZES = { sm: 1, md: 2 } as const;

export default function Gauge() {
  const size = ref<keyof typeof SIZES>("sm");
  return (
    <p>
      {START} {UNIT} {size.value}
    </p>
  );
}
`,
      });
      expect(project.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const gauge = project.output("Gauge.tsx");
      expect(gauge).toContain('import type { Unit } from "./units";');
      expect(gauge).toContain("interface Limits {");
      expect(gauge).toContain(
        [
          "const LIMITS: Limits = { min: 0, max: 9 };",
          "const START = LIMITS.min + 1;",
          'const UNIT: Unit = "km";',
          "const SIZES = { sm: 1, md: 2 } as const;",
        ].join("\n"),
      );
      await expectToolchainClean("modules/closure", project.outputs);
    },
  );
});
