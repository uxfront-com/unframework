// Composition's cells are declared before the targets emit it (ADR-0055): until M3's lanes land,
// every target reports a component that uses it, and emits nothing for it (P2).
import type { Diagnostic } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import { composition } from "../../ir/test/composition-fixture.ts";
import { builtinTargets, compile, TARGET_NAMES } from "../src/index.ts";

describe("composition before M3's lanes", () => {
  // Vue emits all of composition (M3's core lane); every other target reports it until its own
  // lane lands.
  it("vue emits it", () => {
    const module = composition();
    const reported: Omit<Diagnostic, "file" | "target">[] = [];
    const files = builtinTargets.vue.emit(module.components[0]!, {
      module,
      options: undefined,
      report: (diagnostic) => reported.push(diagnostic),
    });
    expect(reported).toEqual([]);
    expect(files.map((file) => file.path)).toEqual(["Form.vue"]);
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
