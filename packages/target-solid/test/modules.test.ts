// A component's module bindings on Solid (src/composable.ts, ADR-0070): the module's constants it
// reaches are declared at module scope as written, before what the setup hoists, and a setup
// function that reads only them moves to module scope beside them.
import { describe, expect, it } from "vitest";

import { emitSource } from "./fixtures.ts";

describe("solid module bindings (src/composable.ts)", () => {
  it("declares the constants a component reaches, and hoists a function that reads only them", async () => {
    const output = await emitSource(
      [
        'import { ref } from "unframework";',
        "",
        "const BASE = 2;",
        "const STEP = BASE * 3;",
        "const UNUSED = 9;",
        "",
        "export default function Probe() {",
        "  const count = ref(0);",
        "  function next(value: number) {",
        "    return value + STEP;",
        "  }",
        "  return (",
        '    <button type="button" onClick={() => (count.value = next(count.value))}>',
        "      {count.value}",
        "    </button>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    const head = output.slice(0, output.indexOf("export default function Probe"));
    expect(head).toContain("const BASE = 2;\nconst STEP = BASE * 3;\n");
    expect(head).not.toContain("UNUSED");
    expect(head.indexOf("function next(")).toBeGreaterThan(head.indexOf("const STEP"));
  });

  it("keeps in the component a setup constant named like a module's constant", async () => {
    const output = await emitSource(
      [
        'import { ref } from "unframework";',
        "",
        "const LIMIT = 3;",
        "const caption = (n: number) => `${n} of ${LIMIT}`;",
        "",
        "export default function Probe() {",
        "  const count = ref(0);",
        "  const LIMIT = 5;",
        "  function bump() {",
        "    count.value = Math.min(LIMIT, count.value + 1);",
        "  }",
        '  return <button type="button" onClick={bump}>{caption(count.value)}</button>;',
        "}",
        "",
      ].join("\n"),
    );
    const start = output.indexOf("export default function Probe");
    // Hoisted, it would declare `LIMIT` twice at module scope.
    expect(output.slice(0, start).match(/const LIMIT/g)).toEqual(["const LIMIT"]);
    expect(output.slice(start)).toContain("const LIMIT = 5;");
  });
});
