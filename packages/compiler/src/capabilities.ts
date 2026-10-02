import { requiredCapabilities } from "@unframework/codegen";
import type { Target } from "@unframework/codegen";
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { UfModule } from "@unframework/ir";

/**
 * Pass P4: checks the capabilities a module uses against a target's matrix and reports a
 * portability diagnostic for each one the target cannot support, where the module first uses
 * it. A capability the matrix does not declare (a third-party target written before the
 * capability existed) is unsupported: nothing says the target can lower it.
 */
export function checkCapabilities(module: UfModule, target: Target): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const [capability, span] of requiredCapabilities(module)) {
    const cell = (target.capabilities as Partial<Target["capabilities"]> | undefined)?.[capability];
    if (cell?.support === "native" || cell?.support === "emulated") continue;
    const at = { file: module.file, span, target: target.name };
    diagnostics.push(
      cell?.support === "unsupported"
        ? createDiagnostic(cell.code, {
            ...at,
            severity: cell.severity,
            message: `The ${target.name} target does not support ${capability}: ${cell.reason}`,
          })
        : createDiagnostic("UF4001", {
            ...at,
            severity: "error",
            message: `The ${target.name} target does not declare whether it supports ${capability}, so the compiler treats it as unsupported.`,
          }),
    );
  }
  return diagnostics;
}
