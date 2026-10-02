// Portability (P4): what a selected target cannot render exactly is declared in its capability
// matrix, and the compiler reports it as a diagnostic for that target, located where the source
// first uses it; the other targets compile the same source clean.
import { describe, expect, it } from "vitest";

import { compile, TARGET_NAMES } from "../src/index.ts";

describe("portability diagnostics", () => {
  it("reports Vue's single-selection list box at its `size`, on Vue alone", async () => {
    const source = [
      "export default function Choice() {",
      "  return (",
      '    <select name="choice" size="2">',
      '      <optgroup label="Letters">',
      '        <option value="a">A</option>',
      "      </optgroup>",
      "    </select>",
      "  );",
      "}",
      "",
    ].join("\n");
    const result = await compile(source, { filename: "Choice.uf.tsx", targets: TARGET_NAMES });
    expect(
      result.diagnostics.map(({ code, severity, target, span }) => [
        code,
        severity,
        target,
        source.slice(span.start, span.end),
      ]),
    ).toEqual([["UF4001", "error", "vue", 'size="2"']]);
    expect(result.diagnostics[0]!.message).toMatch(
      /^The vue target does not support listbox: runtime-dom's `nodeOps.createElement` /,
    );
    for (const target of TARGET_NAMES) expect(result.outputs[target], target).toHaveLength(1);
  });
});
