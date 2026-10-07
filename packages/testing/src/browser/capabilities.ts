// The project's capability matrix in the browser (plan §5.7, ADR-0050): provided from Node as
// plain data (`ufCapabilities`), never imported from a target, whose compiler code does not run
// in a browser. A test that requires an unsupported capability is skipped, with the reason, on
// every layer it would have recorded, and so is a test of a case the target has no output for;
// an interaction where nothing runs is refused.
import type { CapabilityCell } from "@unframework/codegen";
import { inject } from "vitest";

import { noOutputSkip, requiresSkip } from "../layers.ts";
import { currentTarget } from "./target.ts";

/** The target's capability matrix, as the project provides it. */
export function capabilityCells(): Readonly<Record<string, CapabilityCell>> {
  const cells = inject("ufCapabilities") as Readonly<Record<string, CapabilityCell>> | undefined;
  if (!cells) {
    throw new Error(
      "No capabilities are provided: the browser project must set test.provide.ufCapabilities to its target's capability matrix.",
    );
  }
  return cells;
}

/** The capability's cell; throws for a name the matrix does not have. */
export function capabilityCell(
  name: string,
  cells: Readonly<Record<string, CapabilityCell>> = capabilityCells(),
): CapabilityCell {
  const cell = Object.hasOwn(cells, name) ? cells[name] : undefined;
  if (!cell) {
    throw new Error(
      `"${name}" is not a capability: the capabilities are ${Object.keys(cells).join(", ")}.`,
    );
  }
  return cell;
}

/**
 * Why a test that requires these capabilities cannot run on the project's target: the skip
 * reason of the first one whose cell is unsupported (`requires interactivity: …`), or nothing.
 */
export function requiredSkip(
  requires: readonly string[],
  cells: Readonly<Record<string, CapabilityCell>> = capabilityCells(),
): string | undefined {
  for (const name of requires) {
    const cell = capabilityCell(name, cells);
    if (cell.support === "unsupported") return requiresSkip(name, cell.reason);
  }
  return undefined;
}

/**
 * Why a test of a case its target has no output for is skipped there, or nothing: the case
 * expects an error for the target (the one it declares for a capability it lacks), so there is
 * no component to render, and the project gives its spec a stand-in that loads. Each test is
 * skipped with `no output: <the errors>`, a mechanical cause the summary excuses on that target
 * alone, whatever the test requires.
 */
export function noOutputReason(
  caseId: string,
  cases: Readonly<Record<string, string>> | undefined = inject("ufNoOutput"),
): string | undefined {
  const errors = cases && Object.hasOwn(cases, caseId) ? cases[caseId] : undefined;
  return errors === undefined ? undefined : noOutputSkip(errors);
}

/**
 * Refuses what only a target that runs client code can do: a user's action, or reading the
 * events a component emitted. A test that does either declares `requires: ["interactivity"]`,
 * and is skipped where it cannot run, rather than clicking inert HTML and failing later.
 */
export function assertInteractive(
  what: string,
  cells: Readonly<Record<string, CapabilityCell>> = capabilityCells(),
  target: string = currentTarget(),
): void {
  const cell = capabilityCell("interactivity", cells);
  if (cell.support !== "unsupported") return;
  throw new Error(
    `${what}: ${target} runs no client code (${cell.reason}). A test that interacts or reads emitted events declares it: it(name, { requires: ["interactivity"] }, fn).`,
  );
}
