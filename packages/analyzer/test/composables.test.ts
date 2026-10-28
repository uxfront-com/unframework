import { describe, expect, it } from "vitest";

// Composables (ADR-0069): the named `use*` exports of a `.uf.ts` module, each a setup under a
// component's rules, with parameters in place of props and a returned shorthand object in place
// of JSX. Analysing one gives its IR, `UfComposable`, and what a caller reads of it,
// `ComposableApi`.
import { problems, run } from "./helpers.ts";

/** Analyses a module of composables. */
function composables(lines: readonly string[]) {
  const source = lines.join("\n");
  return { source, ...run(source, "useToggle.uf.ts") };
}

const TOGGLE = [
  'import { ref } from "unframework";',
  "export function useToggle(initial: boolean) {",
  "  const on = ref(initial);",
  "  function toggle() {",
  "    on.value = !on.value;",
  "  }",
  "  return { on, toggle };",
  "}",
];

describe("a composable", () => {
  it("lowers its parameters, its setup and its returned members", () => {
    const { source, module, diagnostics } = composables(TOGGLE);
    expect(diagnostics).toEqual([]);
    expect(module!.components).toEqual([]);
    expect(module!.exports).toEqual([]);
    const [composable] = module!.composables!;
    const at = (text: string, from = 0) => source.indexOf(text, from);
    expect(composable).toMatchObject({
      name: "useToggle",
      span: { start: at("export"), end: source.length },
      parameters: [
        {
          name: "initial",
          kind: "value",
          type: { code: "boolean" },
          binding: `initial@${at("initial")}`,
        },
      ],
      types: [],
      returns: [
        { name: "on", binding: `on@${at("on =")}` },
        { name: "toggle", binding: `toggle@${at("toggle()")}` },
      ],
    });
    expect(composable!.bindings.map(({ name, kind }) => [name, kind])).toEqual([
      ["initial", "argument"],
      ["on", "state"],
      ["toggle", "localFn"],
    ]);
    expect(composable!.setup.map((item) => item.kind)).toEqual(["State", "Function"]);
    // The state's initial value reads the argument through its binding.
    expect(JSON.stringify(composable!.setup[0])).toContain(`"binding":"initial@${at("initial")}"`);
  });

  it("gives its API: each parameter's kind, each member's kind and type, and the function flags", () => {
    const { api, diagnostics } = composables([
      'import { computed, ref } from "unframework";',
      "export function useCounter(start: number, step: () => number, onChange?: (count: number) => void) {",
      "  const count = ref<number>(start);",
      "  const double = computed<number>(() => count.value * 2);",
      "  const max: number = 10;",
      "  function increment() {",
      "    count.value += step();",
      "    onChange?.(count.value);",
      "  }",
      "  async function reset() {",
      "    count.value = start;",
      "  }",
      "  function isMax() {",
      "    return count.value >= max;",
      "  }",
      "  return { count, double, max, increment, reset, isMax };",
      "}",
    ]);
    expect(diagnostics).toEqual([]);
    expect(api!.composables).toEqual([
      {
        name: "useCounter",
        parameters: [
          { name: "start", kind: "value", type: "number" },
          { name: "step", kind: "getter", type: "() => number" },
          {
            name: "onChange",
            kind: "callback",
            optional: true,
            type: "(count: number) => void",
          },
        ],
        members: [
          { name: "count", kind: "state", type: "number" },
          { name: "double", kind: "derived", type: "number" },
          { name: "max", kind: "constant", type: "number" },
          { name: "increment", kind: "function", client: true },
          { name: "reset", kind: "function", async: true, client: true },
          { name: "isMax", kind: "function", pure: true },
        ],
      },
    ]);
  });

  it("sets `hasEffects` where its setup runs code in the browser", () => {
    const { api, diagnostics } = composables([
      'import { onMounted, onUnmounted, ref, watch } from "unframework";',
      "export function useMediaQuery(query: () => string) {",
      "  const matches = ref(false);",
      "  let list: MediaQueryList | undefined;",
      "  function update() {",
      "    matches.value = list?.matches ?? false;",
      "  }",
      "  watch(() => query(), () => update());",
      "  onMounted(() => {",
      "    list = window.matchMedia(query());",
      '    list.addEventListener("change", update);',
      "    update();",
      "  });",
      '  onUnmounted(() => list?.removeEventListener("change", update));',
      "  return { matches };",
      "}",
      "export function useFlag(initial: boolean) {",
      "  const flag = ref(initial);",
      "  return { flag };",
      "}",
    ]);
    expect(diagnostics).toEqual([]);
    expect(api!.composables!.map(({ name, hasEffects }) => [name, hasEffects])).toEqual([
      ["useMediaQuery", true],
      ["useFlag", undefined],
    ]);
  });

  it("keeps its type parameters, and the module's types and constants it reaches", () => {
    const { module, api, diagnostics } = composables([
      'import { ref } from "unframework";',
      "interface Item { id: string }",
      "const LIMIT = 3;",
      "export function useList<T extends Item>(items: T[]) {",
      "  const list = ref<T[]>(items.slice(0, LIMIT));",
      "  return { list };",
      "}",
    ]);
    expect(diagnostics).toEqual([]);
    expect(module!.types.map(({ name }) => name)).toEqual(["Item"]);
    expect(module!.constants!.map(({ name }) => name)).toEqual(["LIMIT"]);
    const [composable] = module!.composables!;
    expect(composable!.types).toEqual(["Item"]);
    expect(composable!.typeParameters).toMatchObject([{ name: "T", constraint: { code: "Item" } }]);
    expect(api!.composables![0]).toMatchObject({
      typeParameters: ["T"],
      members: [{ name: "list", kind: "state", type: "T[]" }],
    });
  });

  it("is exported by name in a declaration or a list", () => {
    const { api, diagnostics } = composables([
      "function useA() {",
      "  return {};",
      "}",
      "export function useB() {",
      "  return {};",
      "}",
      "export { useA };",
    ]);
    expect(diagnostics).toEqual([]);
    expect(api!.composables!.map(({ name }) => name)).toEqual(["useA", "useB"]);
  });

  it("reads a callback in client code, and a getter in a derived value", () => {
    const { diagnostics } = composables([
      'import { computed } from "unframework";',
      "export function useLabel(text: () => string, onPick: (value: string) => void) {",
      "  const label = computed(() => text().toUpperCase());",
      "  function pick() {",
      "    onPick(label.value);",
      "  }",
      "  return { label, pick };",
      "}",
    ]);
    expect(diagnostics).toEqual([]);
  });

  it("watches a getter argument through a call of it, with a safe fix", () => {
    const { source, diagnostics } = composables([
      'import { ref, watch } from "unframework";',
      "export function useSeen(value: () => number) {",
      "  const seen = ref(0);",
      "  watch(value, () => {",
      "    seen.value++;",
      "  });",
      "  return { seen };",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual(["UF2020 value"]);
    expect(diagnostics[0]!.fixes?.[0]?.edits).toEqual([
      { span: diagnostics[0]!.span, text: "() => value()" },
    ]);
  });

  it("leaves a `.uf.tsx` module's analysis as it was", () => {
    const { module, diagnostics } = run(
      [
        'import { ref } from "unframework";',
        "export function Toggle() {",
        "  const count = ref(0);",
        "  return <button>{count.value}</button>;",
        "}",
      ].join("\n"),
    );
    expect(diagnostics).toEqual([]);
    expect(module!.composables).toBeUndefined();
    expect(module!.components.map(({ name }) => name)).toEqual(["Toggle"]);
  });
});

/** A composable `useA` whose setup is `setup`, returning `returned`. */
function useA(setup: readonly string[], returned = "return { n };", imports = "ref") {
  return composables([
    `import { ${imports} } from "unframework";`,
    "export function useA() {",
    "  const n = ref(1);",
    ...setup.map((line) => `  ${line}`),
    `  ${returned}`,
    "}",
  ]);
}

// Each form ADR-0069 rejects is UF2035 (`invalid-composable`), at the exact span, once.
describe("UF2035", () => {
  it.each([
    ["useId", ["const id = useId();"], "return { n, id };"],
    ["useTemplateRef", ['const el = useTemplateRef<HTMLElement>("el");'], "return { n };"],
    ["defineEmits", ["const emit = defineEmits<{ change: [value: number] }>();"], "return { n };"],
    ["defineSlots", ["const slots = defineSlots<{ default(): unknown }>();"], "return { n };"],
    ["defineModel", ['const value = defineModel<string>("value");'], "return { n, value };"],
    ["defineExpose", ["defineExpose({});"], "return { n };"],
    ["defineOptions", ["defineOptions({ inheritAttrs: false });"], "return { n };"],
  ])("rejects `%s`, which needs a component", (api, setup, returned) => {
    const { source, module, diagnostics } = useA(setup, returned, `${api}, ref`);
    expect(problems(source, diagnostics)).toEqual([`UF2035 ${api}`]);
    expect(module).toBeUndefined();
  });

  it.each([
    ["provide", ["provide(ThemeKey, n);"], "return { n };"],
    ["inject", ["const theme = inject(ThemeKey);"], "return { n, theme };"],
  ])("rejects `%s`, which needs a place in the tree", (api, setup, returned) => {
    const { source, diagnostics } = composables([
      `import { ${api}, ref } from "unframework";`,
      'import { ThemeKey } from "./Theme.uf.tsx";',
      "export function useA() {",
      "  const n = ref(1);",
      ...setup.map((line) => `  ${line}`),
      `  ${returned}`,
      "}",
    ]);
    // The key's module is no resolver's here (UF1202): the call is still reported, once.
    expect(problems(source, diagnostics).filter((each) => each.startsWith("UF2035"))).toEqual([
      `UF2035 ${api}`,
    ]);
  });

  it("rejects a call of a composable another `.uf.ts` module exports", () => {
    const { source, module, diagnostics } = composables([
      'import { ref } from "unframework";',
      'import { useOther } from "./useOther.uf.ts";',
      "export function useA() {",
      "  const n = ref(1);",
      "  const { m } = useOther();",
      "  return { n };",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual(["UF2035 useOther"]);
    expect(module).toBeUndefined();
  });

  it("rejects a call of a composable the module declares, wherever the body makes it", () => {
    const { source, diagnostics } = composables([
      'import { ref } from "unframework";',
      "export function useB() {",
      "  const m = ref(1);",
      "  return { m };",
      "}",
      "export function useA() {",
      "  const n = ref(1);",
      "  function grow() {",
      "    n.value += useB().m.value;",
      "  }",
      "  return { n, grow };",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual(["UF2035 useB"]);
  });

  it("rejects a default export, declared or listed", () => {
    const declared = composables(["export default function useA() {", "  return {};", "}"]);
    expect(problems(declared.source, declared.diagnostics)).toEqual([`UF2035 ${declared.source}`]);
    const listed = composables([
      "function useA() {",
      "  return {};",
      "}",
      "export { useA as default };",
    ]);
    expect(problems(listed.source, listed.diagnostics)).toEqual(["UF2035 useA as default"]);
    expect(listed.module).toBeUndefined();
  });

  it.each([
    ["a ref", "return n;", "return n;"],
    ["an array", "return [n];", "return [n];"],
    ["nothing", "return;", "return;"],
  ])("rejects a return of %s", (_, returned, reported) => {
    const { source, diagnostics } = useA([], returned);
    expect(problems(source, diagnostics)).toEqual([`UF2035 ${reported}`]);
  });

  it("rejects a body that does not end with a return", () => {
    const { source, diagnostics } = useA([], "n.value++;");
    expect(problems(source, diagnostics)).toEqual(["UF2035 n.value++;"]);
  });

  it("rejects a member that is not a shorthand property", () => {
    const { source, diagnostics } = useA([], "return { count: n, ...{} };");
    expect(problems(source, diagnostics)).toEqual(["UF2035 count: n", "UF2035 ...{}"]);
  });

  it("rejects a returned name that is not the setup's own", () => {
    const { source, diagnostics } = composables([
      "export function useA(start: number) {",
      "  return { start };",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual(["UF2035 start"]);
  });

  it("rejects a parameter without a type, with a default value, or written as a pattern", () => {
    const { source, diagnostics } = composables([
      "export function useA(a, b: number = 1, { c }: { c: number }, ...d: number[]) {",
      "  return {};",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual([
      "UF2035 a",
      "UF2035 b: number = 1",
      "UF2035 { c }: { c: number }",
      "UF2035 ...d: number[]",
    ]);
  });

  it("rejects a callback read outside client code", () => {
    const { source, diagnostics } = composables([
      'import { computed } from "unframework";',
      "export function useA(onPick: (value: number) => void) {",
      "  const picked = computed(() => onPick);",
      "  return { picked };",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual(["UF2035 onPick"]);
  });

  it("rejects a composable the module keeps, one named otherwise, and one written as a value", () => {
    const local = composables(["function useA() {", "  return {};", "}"]);
    expect(problems(local.source, local.diagnostics)).toEqual(["UF2035 useA"]);
    const misnamed = composables(["export function toggle() {", "  return {};", "}"]);
    expect(problems(misnamed.source, misnamed.diagnostics)).toEqual(["UF2035 toggle"]);
    const value = composables(["export const useA = () => {", "  return {};", "};"]);
    expect(problems(value.source, value.diagnostics)).toEqual(["UF2035 useA"]);
  });

  it("rejects an asynchronous composable", () => {
    const { source, diagnostics } = composables([
      "export async function useA() {",
      "  return {};",
      "}",
    ]);
    expect(problems(source, diagnostics)).toEqual(["UF2035 useA"]);
  });

  it("rejects a module that exports no composable", () => {
    const { source, diagnostics } = composables(['import { ref } from "unframework";']);
    expect(problems(source, diagnostics)).toEqual(["UF2035 "]);
  });
});
