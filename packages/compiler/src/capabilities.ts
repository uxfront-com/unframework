import { CAPABILITY_PREREQUISITES, requiredCapabilities } from "@unframework/codegen";
import type { CapabilityName, Target } from "@unframework/codegen";
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { UfModule } from "@unframework/ir";

/**
 * Pass P4: checks the capabilities a module uses against a target's matrix and reports a
 * portability diagnostic for each one the target cannot support, where the module first uses
 * it. A capability the matrix does not declare (a third-party target written before the
 * capability existed) is unsupported: nothing says the target can lower it. A capability that
 * refines another the target cannot support either (a listener's options and semantics, and
 * `nextTick`, refine `interactivity`: `CAPABILITY_PREREQUISITES`) is not reported again: the
 * one report says the listener is inert, where three would say it at the same span.
 */
export function checkCapabilities(module: UfModule, target: Target): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const required = requiredCapabilities(module);
  const cellOf = (capability: CapabilityName) =>
    (target.capabilities as Partial<Target["capabilities"]> | undefined)?.[capability];
  const supports = (capability: CapabilityName) => {
    const support = cellOf(capability)?.support;
    return support === "native" || support === "emulated";
  };
  for (const [capability, span] of required) {
    if (supports(capability)) continue;
    const prerequisite = CAPABILITY_PREREQUISITES[capability];
    if (prerequisite && required.has(prerequisite) && !supports(prerequisite)) continue;
    const cell = cellOf(capability);
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
