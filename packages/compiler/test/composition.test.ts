// Composition's cells are declared before the targets emit it (ADR-0055): until M3's lanes land,
// every target reports a component that uses it, and emits nothing for it (P2).
import type { Diagnostic } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import { composition, find } from "../../ir/test/composition-fixture.ts";
import { builtinTargets, TARGET_NAMES } from "../src/index.ts";

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
        message: `The ${name} target does not emit model yet: composition lands in M3.`,
        span: find('const open = defineModel<boolean>("open");'),
      },
    ]);
  });
});
