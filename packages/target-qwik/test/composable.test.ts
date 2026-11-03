// The composables of the composable and shared-module cases on Qwik (ADR-0069): each `.uf.ts`
// source compiles through `compile()` with no error, to one `use*` hook, which passes the real
// optimizer (L3), tsgo (L4) and the lint rules, eslint-plugin-qwik's type-aware ones among them
// (L5), as the corpus's toolchain project runs them. The components that call them wait for
// Qwik's call site (L27). The cases wait in `tests/integration/pending/` until every target's lane
// has landed (../../codegen/test/composable-cases.ts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ImportSet } from "@unframework/codegen";
import type { OutputFile } from "@unframework/codegen";
import { createComposableParameter, createTypeText } from "@unframework/ir";
import type { ComposableParameter, ComposableParameterKind } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { compile } from "../../compiler/src/index.ts";
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

const cases = (await compileComposableCases("qwik"))
  .map((each) => ({
    ...each,
    sources: each.sources.filter(({ filename }) => filename.endsWith(".uf.ts")),
  }))
  .filter(({ sources }) => sources.length > 0);

describe("qwik composable cases", () => {
  it("finds the cases that hold a composable", () => {
    expect(cases.map(({ id }) => id)).toEqual([
      "composables/use-toggle",
      "composables/use-controllable-state",
      "composables/use-media-query",
      "composables/getter-argument",
      "composables/callback-argument",
      "semantics/composable-read-after-write",
      "semantics/composable-effect-order",
      "semantics/composable-unmount-order",
    ]);
  });

  it.each(cases)(
    "compiles $id to hooks that pass L3 to L5",
    { timeout: 60_000 },
    async ({ id, sources }) => {
      const errors = sources.flatMap(({ diagnostics }) =>
        diagnostics.filter(({ severity }) => severity === "error"),
      );
      expect(errors).toEqual([]);
      const emitted = sources.flatMap(({ outputs }) => outputs);
      expect(emitted.map(({ path }) => path)).toEqual(
        sources.map(({ filename }) => `${filename.slice(filename.lastIndexOf("/") + 1, -6)}.ts`),
      );
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
  return cases.find((each) => each.id === id)!.sources[0]!.outputs[0]!.contents;
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

  it("reports a composable that reads a module's values, at the value, and emits nothing", async () => {
    const { errors, outputs, source } = await compileProbe(`import { ref } from "unframework";

const STEP = 2;

export function useProbe() {
  const count = ref(0);
  function add() {
    count.value += STEP;
  }
  return { count, add };
}
`);
    expect(errors).toEqual([{ code: "UF1002", text: "STEP", at: source.indexOf("STEP") }]);
    expect(outputs).toEqual([]);
  });
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
