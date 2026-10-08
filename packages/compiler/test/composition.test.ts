// Composition's cells are declared before the targets emit it (ADR-0055): until M3's lanes land,
// every target reports a component that uses it, and emits nothing for it (P2).
import type { Diagnostic } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import { composition } from "../../ir/test/composition-fixture.ts";
import { builtinTargets, compile, TARGET_NAMES } from "../src/index.ts";

describe("composition before M3's lanes", () => {
  it.each(TARGET_NAMES)("%s reports UF1002 where a component first uses it", (name) => {
    const module = composition();
    const reported: Omit<Diagnostic, "file" | "target">[] = [];
    const files = builtinTargets[name].emit(module.components[0]!, {
      module,
      options: undefined,
      report: (diagnostic) => reported.push(diagnostic),
    });
    expect(files).toEqual([]);
    expect(reported).toEqual([
      {
        code: "UF1002",
        severity: "error",
        message: `The ${name} target does not emit an injection key yet: composition lands in M3.`,
        span: module.keys![0]!.span,
      },
    ]);
  });
});

describe("a contextual root without composition", () => {
  // ADR-0054 accepts it, and ADR-0056 leaves it unsupported on Angular alone (`contextual-root`).
  it("emits on every target, and Angular reports UF4001 there", async () => {
    const result = await compile("export default function Item() { return <li>One</li>; }", {
      filename: "Item.uf.tsx",
      targets: TARGET_NAMES,
      format: false,
    });
    expect(result.diagnostics.map(({ code, target }) => [code, target])).toEqual([
      ["UF4001", "angular"],
    ]);
    for (const name of TARGET_NAMES) {
      expect(result.outputs[name], name).toHaveLength(1);
    }
  });
});
