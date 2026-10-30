// What a component reads of its module and of a composable on Svelte (ADR-0069, ADR-0070): a
// composable is its own `.svelte.ts` module returning an object of getters; a caller keeps that
// object and reads each destructured name through it; a value from a `.ts` module is imported as
// the source does, and a constant of the module is declared, with those it reads, at the top of
// the instance script, under a name of its own where the setup shadows it.
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { compileSources, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** svelte-check's messages on a tree of outputs, by file name, empty when it checks clean. */
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

/** svelte-check takes a few seconds; give it room on a loaded machine. */
const checker = { timeout: 60_000 };

const TOGGLE = [
  'import { ref } from "unframework";',
  "",
  'const LABEL = "Toggle";',
  "",
  "export function useToggle(initial: boolean) {",
  "  const on = ref(initial);",
  "  const label = LABEL;",
  "  function toggle() {",
  "    on.value = !on.value;",
  "  }",
  "  return { on, label, toggle };",
  "}",
  "",
].join("\n");

describe("svelte composables", () => {
  it("emits a composable as a `.svelte.ts` module returning getters, with its module's constants", async () => {
    const outputs = await compileSources({ "useToggle.uf.ts": TOGGLE });
    expect(outputs["useToggle.svelte.ts"]).toBe(
      [
        'const LABEL = "Toggle";',
        "",
        "export function useToggle(initial: boolean) {",
        "  let on = $state.raw(initial);",
        "  const label = LABEL;",
        "",
        "  function toggle() {",
        "    on = !on;",
        "  }",
        "",
        "  return {",
        "    get on() {",
        "      return on;",
        "    },",
        "    label,",
        "    toggle,",
        "  };",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("keeps the result whole and reads each name through it", checker, async () => {
    const outputs = await compileSources({
      "useToggle.uf.ts": TOGGLE,
      "Switch.uf.tsx": [
        'import { computed } from "unframework";',
        "",
        'import { useToggle } from "./useToggle.uf.ts";',
        "",
        "export default function Switch() {",
        "  const { on, label, toggle } = useToggle(false);",
        '  const text = computed(() => `${label}: ${on.value ? "on" : "off"}`);',
        "  return (",
        '    <button type="button" aria-pressed={on.value} onClick={() => toggle()}>',
        "      {text.value}",
        "    </button>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const script = outputs["Switch.svelte"]!;
    expect(script).toContain('import { useToggle } from "./useToggle.svelte";');
    expect(script).toContain("const toggle = useToggle(false);");
    expect(script).toContain(
      'const text = $derived(`${toggle.label}: ${toggle.on ? "on" : "off"}`);',
    );
    expect(script).toContain("aria-pressed={toggle.on}");
    expect(script).toContain("onclick={() => toggle.toggle()}");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it(
    "names the result by its one renamed member, or apart from a name the setup takes",
    checker,
    async () => {
      const outputs = await compileSources({
        "useToggle.uf.ts": TOGGLE,
        "Switch.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import { useToggle } from "./useToggle.uf.ts";',
          "",
          "export default function Switch() {",
          "  const toggle = ref(0);",
          "  const { on: open } = useToggle(true);",
          "  const { on, label } = useToggle(false);",
          "  return (",
          '    <button type="button" onClick={() => toggle.value++}>',
          "      {label} {open.value} {on.value} {toggle.value}",
          "    </button>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Switch.svelte"]!;
      expect(script).toContain("let toggle = $state(0);");
      expect(script).toContain("const open = useToggle(true);");
      expect(script).toContain("const toggle_1 = useToggle(false);");
      expect(script).toContain("{toggle_1.label} {open.on} {toggle_1.on} {toggle}");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );
});

describe("svelte shared modules", () => {
  it(
    "declares a constant the setup shadows under a name of its own, with what reads it",
    checker,
    async () => {
      const outputs = await compileSources({
        "tokens.ts": "export const BASE = 4;\n",
        "Meter.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import { BASE } from "./tokens";',
          "",
          "const LIMIT = 10;",
          "const BOUNDS = { LIMIT, BASE };",
          "",
          "export default function Meter() {",
          "  const LIMIT = ref(1);",
          "  const BASE = ref(2);",
          "  return (",
          "    <p>",
          "      {LIMIT.value + BASE.value} of {BOUNDS.LIMIT + BOUNDS.BASE}",
          "    </p>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Meter.svelte"]!;
      expect(script).toContain('import { BASE as BASE_1 } from "./tokens";');
      expect(script).toContain("const LIMIT_1 = 10;");
      expect(script).toContain("const BOUNDS = { LIMIT: LIMIT_1, BASE: BASE_1 };");
      expect(script).toContain("let LIMIT = $state(1);");
      expect(script).toContain("let BASE = $state(2);");
      expect(outputs["tokens.ts"]).toBe("export const BASE = 4;\n");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "imports a value a copied type queries with `typeof`, and the types a constant names",
    checker,
    async () => {
      const outputs = await compileSources({
        "limits.ts": "export const SIZES = { sm: 1, lg: 2 } as const;\n",
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
      });
      const script = outputs["Size.svelte"]!;
      expect(script).toContain('import { SIZES } from "./limits";');
      expect(script).toContain("type Size = keyof typeof SIZES;");
      expect(script).toContain('const DEFAULT: Size = "sm";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
      const paths = writeScratch(outputs);
      const linted = await toolchain.lint(Object.values(paths), {
        toolchainDir,
        root: toolchainDir,
      });
      expect([...linted.values()].flat()).toEqual([]);
    },
  );
});
