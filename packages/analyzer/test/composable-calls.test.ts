import { applyFixes } from "@unframework/diagnostics";
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

// A component's call of a composable (ADR-0069): `const { on, toggle } = useToggle(false)` at the
// top level of the setup lowers to a `Use` item, each argument as its parameter's kind reads it,
// each destructured member a `used*` binding of the member's kind, which the caller reads and
// never writes (UF2036).
import { componentImports } from "../src/index.ts";
import { problems, run } from "./helpers.ts";

const COMPOSABLE = [
  'import { onMounted, ref } from "unframework";',
  "export function useToggle(initial: boolean, label: () => string, onToggle?: (on: boolean) => void) {",
  "  const on = ref(initial);",
  "  function toggle() {",
  "    on.value = !on.value;",
  "    onToggle?.(on.value);",
  "  }",
  "  function isOn() {",
  "    return on.value;",
  "  }",
  "  onMounted(() => console.log(label()));",
  "  return { on, toggle, isOn };",
  "}",
].join("\n");

/** What the resolver gives for `./useToggle.uf.ts`: the module's API, read by its analysis. */
function toggleApi(): ModuleApi {
  const { api, diagnostics } = run(COMPOSABLE, "useToggle.uf.ts");
  expect(diagnostics).toEqual([]);
  return api!;
}

/** Analyses a component that imports `useToggle`, with `setup` before it returns `jsx`. */
function caller(setup: readonly string[], jsx = "<p>{on.value ? label : 'off'}</p>") {
  const source = [
    'import { ref } from "unframework";',
    'import { useToggle } from "./useToggle.uf.ts";',
    "export default function Toggle({ label }: { label: string }) {",
    ...setup.map((line) => `  ${line}`),
    `  return ${jsx};`,
    "}",
  ].join("\n");
  const result = run(source, "Toggle.uf.tsx", {
    imports: new Map([["./useToggle.uf.ts", toggleApi()]]),
  });
  return { source, ...result, reported: problems(source, result.diagnostics) };
}

describe("a composable's call", () => {
  it("is resolved like a child: the compiler asks for each `.uf.ts` a component imports", () => {
    const source = [
      'import type { Mode } from "./useMode.uf.ts";',
      'import { useToggle } from "./useToggle.uf.ts";',
      'import Field from "./Field.uf.tsx";',
    ].join("\n");
    expect(componentImports(parseModule("Form.uf.tsx", source))).toEqual([
      "./useToggle.uf.ts",
      "./Field.uf.tsx",
    ]);
    // A composable calls no other (UF2035), so a `.uf.ts` module resolves none.
    expect(componentImports(parseModule("useForm.uf.ts", source))).toEqual(["./Field.uf.tsx"]);
  });

  it("lowers to a Use item, its members to used bindings, and records the import", () => {
    const { source, module, reported } = caller([
      "const count = ref(0);",
      "const { on, toggle, isOn: shown } = useToggle(false, () => label, (value) => {",
      "  count.value += value ? 1 : 0;",
      "});",
      "function flip() {",
      "  toggle();",
      "}",
    ]);
    expect(reported).toEqual([]);
    const at = (text: string) => source.indexOf(text);
    const [component] = module!.components;
    const use = component!.setup[1]!;
    expect(use).toMatchObject({
      kind: "Use",
      composable: "useToggle",
      arguments: [
        { kind: "Value", value: { code: "false" } },
        { kind: "Getter", getter: { parameters: [], body: { code: "label" }, expression: true } },
        { kind: "Callback", callback: { parameters: [{ name: "value" }] } },
      ],
      members: [
        { member: "on", binding: `on@${at("on,")}` },
        { member: "toggle", binding: `toggle@${at("toggle,")}` },
        { member: "isOn", binding: `shown@${at("shown")}` },
      ],
      hasEffects: true,
      span: { start: at("const { on"), end: at("});") + 3 },
    });
    expect(component!.bindings.map(({ name, kind }) => [name, kind])).toEqual([
      ["label", "prop"],
      ["count", "state"],
      ["on", "usedState"],
      ["toggle", "usedFn"],
      ["shown", "usedFn"],
      ["flip", "localFn"],
    ]);
    expect(module!.imports).toEqual([
      expect.objectContaining({
        specifier: "./useToggle.uf.ts",
        file: "useToggle.uf.ts",
        names: [expect.objectContaining({ kind: "Composable", imported: "useToggle" })],
      }),
    ]);
  });

  it("leaves `hasEffects` out for a composable whose setup runs no code in the browser", () => {
    const api = toggleApi();
    delete api.composables![0]!.hasEffects;
    const source = [
      'import { useToggle } from "./useToggle.uf.ts";',
      "export default function Toggle({ label }: { label: string }) {",
      "  const { on } = useToggle(false, () => label);",
      "  return <p>{on.value ? label : 'off'}</p>;",
      "}",
    ].join("\n");
    const { module, diagnostics } = run(source, "Toggle.uf.tsx", {
      imports: new Map([["./useToggle.uf.ts", api]]),
    });
    expect(diagnostics).toEqual([]);
    expect(module!.components[0]!.setup[0]).not.toHaveProperty("hasEffects");
  });

  it("calls a pure returned function in a template, and only client code calls the others", () => {
    expect(
      caller(["const { isOn } = useToggle(false, () => label);"], "<p>{isOn() ? label : 'off'}</p>")
        .reported,
    ).toEqual([]);
    expect(
      caller(
        ["const { on, toggle } = useToggle(false, () => label);"],
        "<p>{on.value ? toggle() : label}</p>",
      ).reported,
    ).toEqual(["UF2014 toggle"]);
  });

  it("reports a call of a returned function that isn't pure through a local function (UF2014)", () => {
    const through = ["function shown() {", "  toggle();", "  return 1;", "}"];
    expect(
      caller(["const { toggle } = useToggle(false, () => label);", ...through], "<p>{shown()}</p>")
        .reported,
    ).toEqual(["UF2014 shown"]);
    expect(
      caller(
        ["const { toggle } = useToggle(false, () => label);", ...through, "const n = shown();"],
        "<p>{n}</p>",
      ).reported,
    ).toEqual(["UF2014 shown"]);
    // A value argument is an initial value, read as the setup runs.
    expect(
      caller([
        "const { toggle } = useToggle(false, () => label);",
        ...through,
        "const { on } = useToggle(shown() > 0, () => label);",
      ]).reported,
    ).toEqual(["UF2014 shown"]);
    const pure = ["function shown() {", "  return isOn() ? 1 : 0;", "}"];
    expect(
      caller(["const { isOn } = useToggle(false, () => label);", ...pure], "<p>{shown()}</p>")
        .reported,
    ).toEqual([]);
  });

  it("watches a returned ref through a getter of its value (UF2020, with a safe fix)", () => {
    const source = [
      'import { watch } from "unframework";',
      'import { useToggle } from "./useToggle.uf.ts";',
      "export default function Toggle({ label }: { label: string }) {",
      "  const { on } = useToggle(false, () => label);",
      "  watch(on, (value) => console.log(value));",
      "  watch(on.value, (value) => console.log(value));",
      "  return <p>{on.value ? label : 'off'}</p>;",
      "}",
    ].join("\n");
    const { diagnostics } = run(source, "Toggle.uf.tsx", {
      imports: new Map([["./useToggle.uf.ts", toggleApi()]]),
    });
    expect(problems(source, diagnostics)).toEqual(["UF2020 on", "UF2020 on.value"]);
    expect(diagnostics.map(({ message }) => message.split(":")[0])).toEqual([
      "`on` is a ref its composable returns, which a watcher reads through a getter",
      "`on.value` is the value of a ref its composable returns as the setup runs, which nothing can watch",
    ]);
    const fixed = applyFixes(
      source,
      diagnostics.flatMap(({ fixes }) => fixes ?? []),
    );
    expect(fixed).toContain("watch(() => on.value, (value) => console.log(value));");
    expect(
      run(fixed, "Toggle.uf.tsx", { imports: new Map([["./useToggle.uf.ts", toggleApi()]]) })
        .diagnostics,
    ).toEqual([]);
  });

  it("names a returned function used as a value as one (UF2022)", () => {
    const { diagnostics, reported } = caller(
      ["const { toggle } = useToggle(false, () => label);", "const t = toggle;"],
      "<p />",
    );
    expect(reported).toEqual(["UF2022 toggle"]);
    expect(diagnostics[0]!.message).toMatch(/^`toggle` is a function a composable returns used/);
  });

  it("reports a write of a returned ref (UF2036)", () => {
    const { reported } = caller([
      "const { on } = useToggle(false, () => label);",
      "function open() {",
      "  on.value = true;",
      "}",
      "function flip() {",
      "  on = undefined;",
      "}",
    ]);
    expect(reported).toEqual(["UF2036 on.value", "UF2036 on"]);
  });

  it("reports a reactive read passed to a value parameter (UF2007), and not one in a getter", () => {
    const { reported, diagnostics } = caller([
      "const start = ref(false);",
      "const { on } = useToggle(start.value, () => label);",
    ]);
    expect(reported).toEqual(["UF2007 start.value"]);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(caller(["const { on } = useToggle(label === 'on', () => label);"]).reported).toEqual([
      "UF2007 label === 'on'",
    ]);
    expect(caller(["const { on } = useToggle(true, () => label);"]).reported).toEqual([]);
  });

  it("reports what an argument reads that is declared after the call (UF2023)", () => {
    expect(
      caller(["const { on } = useToggle(true, () => later.value);", "const later = ref('a');"])
        .reported,
    ).toEqual(["UF2023 later.value"]);
  });

  it("reports a call that is not destructured by a top-level `const`", () => {
    expect(caller(["const toggle = useToggle(false, () => label);"], "<p />").reported).toEqual([
      "UF1002 toggle",
    ]);
    expect(caller(["useToggle(false, () => label);"], "<p />").reported).toEqual([
      "UF1002 useToggle(false, () => label)",
    ]);
    expect(caller(["let { on } = useToggle(false, () => label);"], "<p />").reported).toEqual([
      "UF1002 let { on } = useToggle(false, () => label);",
    ]);
    expect(
      caller(["function flip() {", "  useToggle(false, () => label);", "}"], "<p />").reported,
    ).toEqual(["UF1002 useToggle"]);
  });

  it("reports arguments and members the composable does not take or return", () => {
    expect(caller(["const { on } = useToggle(false);"]).reported).toEqual([
      "UF1002 useToggle(false)",
    ]);
    expect(caller(["const { on } = useToggle(false, label);"]).reported).toEqual(["UF1002 label"]);
    expect(caller(["const { on, off } = useToggle(false, () => label);"]).reported).toEqual([
      "UF1002 off",
    ]);
    expect(caller(["const { on, ...rest } = useToggle(false, () => label);"]).reported).toEqual([
      "UF1002 ...rest",
    ]);
    expect(caller(["const { on = 1 } = useToggle(false, () => label);"]).reported).toEqual([
      "UF1002 on = 1",
    ]);
  });

  it("reports an import that resolves to no composable (UF1202)", () => {
    const source = [
      'import { useToggle, useOther } from "./useToggle.uf.ts";',
      'import { useMissing } from "./missing.uf.ts";',
      "export default function Toggle() {",
      "  return <p />;",
      "}",
    ].join("\n");
    const { diagnostics } = run(source, "Toggle.uf.tsx", {
      imports: new Map([["./useToggle.uf.ts", toggleApi()]]),
    });
    expect(problems(source, diagnostics)).toEqual(["UF1202 useOther", 'UF1202 "./missing.uf.ts"']);
  });

  it("reports a composable read other than called and destructured", () => {
    expect(
      caller(["const { on } = useToggle(false, () => label);", "const use = useToggle;"]).reported,
    ).toEqual(["UF1002 useToggle"]);
  });
});
