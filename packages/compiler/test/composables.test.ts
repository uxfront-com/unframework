// A composable's call and what a module or a composable gives are declared before the targets
// emit them (ADR-0069, ADR-0070): until each target's composables lane lands, the target reports
// a component that uses one, and emits nothing for it (P2).
import type { Diagnostic } from "@unframework/diagnostics";
import type { UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { modules } from "../../ir/test/modules-fixture.ts";
import { builtinTargets, TARGET_NAMES } from "../src/index.ts";
import type { TargetName } from "../src/index.ts";

function emit(name: TargetName, module: UfModule) {
  const reported: Omit<Diagnostic, "file" | "target">[] = [];
  const files = builtinTargets[name].emit(module.components[0]!, {
    module,
    options: undefined,
    report: (diagnostic) => reported.push(diagnostic),
  });
  return { files, reported };
}

describe("composables and shared modules before each target's lane", () => {
  it.each(TARGET_NAMES)(
    "%s reports UF1002 where a component first reads a module's value",
    (name) => {
      const module = modules();
      expect(emit(name, module)).toEqual({
        files: [],
        reported: [
          {
            code: "UF1002",
            severity: "error",
            message: `The ${name} target does not emit a value imported from a \`.ts\` module yet: it lands with this target's composables lane.`,
            span: module.components[0]!.bindings[0]!.span,
          },
        ],
      });
    },
  );

  it.each(TARGET_NAMES)("%s reports UF1002 at a composable's call", (name) => {
    const module = modules();
    const list = module.components[0]!;
    list.bindings = list.bindings.filter(({ kind }) => kind !== "import" && kind !== "moduleConst");
    expect(emit(name, module).reported).toEqual([
      expect.objectContaining({ code: "UF1002", span: list.setup[0]!.span }),
    ]);
  });
});
