// What a component reads of its module and of a composable on Astro (ADR-0069, ADR-0070): a
// composable is a static `.ts` module that returns initial values and drops client code; a
// caller destructures what its server render reads and passes no callback; a value from a `.ts`
// module is imported as the source does, and a constant of the module is declared, with those
// it reads, in the frontmatter, under a name of its own where the setup shadows it.
import { describe, expect, it } from "vitest";

// The compiler is above the targets (plan §5.2): this test reaches it from its source, as the
// composable test does (the package's turbo.json hashes it into this package's tests).
import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";

/** Each output of each source, compiled for Astro over the files of `project`, by path. */
async function compileSources(project: Record<string, string>): Promise<Record<string, string>> {
  const readFile = async (path: string) => project[path.slice("/project/".length)];
  const outputs: Record<string, string> = {};
  for (const [filename, source] of Object.entries(project)) {
    if (!/\.uf\.tsx?$/.test(filename)) continue;
    const { diagnostics, outputs: emitted } = await compile(source, {
      filename,
      targets: ["astro"],
      resolve: createFileResolver({ root: "/project", readFile }),
      typeOracle: createSyntacticOracle({ root: "/project", readFile }),
    });
    const errors = diagnostics.filter(({ severity }) => severity !== "info");
    if (errors.length) throw new Error(`${filename}: ${JSON.stringify(errors)}`);
    for (const file of emitted.astro ?? []) outputs[file.path] = file.contents;
  }
  return outputs;
}

/** The frontmatter of an Astro output, between its fences. */
function frontmatter(output: string): string {
  return output.slice(4, output.indexOf("\n---\n") + 1);
}

const TOGGLE = [
  'import { onMounted, ref } from "unframework";',
  "",
  'const LABEL = "Toggle";',
  "",
  "export function useToggle(initial: boolean, delay: number, onChange: (on: boolean) => void) {",
  "  const on = ref(initial);",
  "  const label = LABEL;",
  "  function describe(prefix: string) {",
  "    return `${prefix}: ${on.value}`;",
  "  }",
  "  function toggle() {",
  "    on.value = !on.value;",
  "    onChange(on.value);",
  "  }",
  "  function later() {",
  "    setTimeout(toggle, delay);",
  "  }",
  "  onMounted(() => later());",
  "  return { on, label, describe, toggle, later };",
  "}",
  "",
].join("\n");

describe("astro composables", () => {
  it("emits a composable as a static module: initial values, render-safe functions, no callback", async () => {
    const outputs = await compileSources({ "useToggle.uf.ts": TOGGLE });
    expect(outputs["useToggle.ts"]).toBe(
      [
        'const LABEL = "Toggle";',
        "",
        "export function useToggle(initial: boolean, _delay: number) {",
        "  const on = initial;",
        "  const label = LABEL;",
        "",
        "  function describe(prefix: string) {",
        "    return `${prefix}: ${on}`;",
        "  }",
        "",
        "  return { on, label, describe };",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("destructures what the render reads, and passes no callback", async () => {
    const outputs = await compileSources({
      "useToggle.uf.ts": TOGGLE,
      "Switch.uf.tsx": [
        'import { defineEmits } from "unframework";',
        "",
        'import { useToggle } from "./useToggle.uf.ts";',
        "",
        "export default function Switch() {",
        "  const emit = defineEmits<{ change: [on: boolean] }>();",
        '  const { on: pressed, describe, toggle } = useToggle(true, 100, (on) => emit("change", on));',
        "  return (",
        '    <button type="button" aria-pressed={pressed.value} onClick={() => toggle()}>',
        '      {describe("Switch")}',
        "    </button>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const code = frontmatter(outputs["Switch.astro"]!);
    expect(code).toContain('import { useToggle } from "./useToggle";');
    expect(code).toContain("const { on: pressed, describe } = useToggle(true, 100);");
  });

  it("drops a call whose members only client code reads, and its import", async () => {
    const outputs = await compileSources({
      "useToggle.uf.ts": TOGGLE,
      "Switch.uf.tsx": [
        'import { useToggle } from "./useToggle.uf.ts";',
        "",
        "export default function Switch() {",
        "  const { toggle } = useToggle(false, 100, () => {});",
        "  return (",
        '    <button type="button" onClick={() => toggle()}>',
        "      Switch",
        "    </button>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    expect(outputs["Switch.astro"]).not.toContain("useToggle");
  });
});

describe("astro shared modules", () => {
  it("imports the values the render reads, and declares the constants it reaches, but no others", async () => {
    const outputs = await compileSources({
      "format.ts":
        "export function formatPrice(cents: number): string {\n  return `${cents}`;\n}\n",
      "Price.uf.tsx": [
        'import { ref } from "unframework";',
        "",
        'import { formatPrice } from "./format";',
        "",
        "const LIMITS = Object.freeze({ min: 0, max: 20 });",
        "const START = LIMITS.min + 2;",
        "const STEP = 5;",
        "",
        "export default function Price() {",
        "  const count = ref(START);",
        "  return (",
        '    <button type="button" onClick={() => (count.value += STEP)}>',
        "      {formatPrice(count.value)}",
        "    </button>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const code = frontmatter(outputs["Price.astro"]!);
    expect(code).toContain('import { formatPrice } from "./format";');
    expect(code).toContain(
      ["const LIMITS = Object.freeze({ min: 0, max: 20 });", "const START = LIMITS.min + 2;"].join(
        "\n",
      ),
    );
    expect(code).not.toContain("STEP");
    expect(code).toContain("const count = START;");
  });

  it("declares a constant a setup name shadows under a name of its own", async () => {
    const outputs = await compileSources({
      "Stepper.uf.tsx": [
        'import { ref } from "unframework";',
        "",
        "const STEP = 1;",
        "const NEXT = { STEP };",
        "",
        "export default function Stepper() {",
        "  const STEP = ref(5);",
        "  return (",
        "    <p>",
        "      {STEP.value} then {NEXT.STEP}",
        "    </p>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const code = frontmatter(outputs["Stepper.astro"]!);
    expect(code).toContain(["const STEP_1 = 1;", "const NEXT = { STEP: STEP_1 };"].join("\n"));
    expect(code).toContain("const STEP = 5 as number;");
  });
});
