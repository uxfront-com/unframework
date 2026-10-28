// The corpus's Qwik golden outputs that the toolchain tests check (L3, L4, L5). A case whose
// committed expected diagnostics hold an error for Qwik (a capability Qwik does not support, as
// UF4001) has no output: the harness skips its layers from L3 on (cases.ts `expectsErrors`), so
// these tests leave its golden out too.
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../..", import.meta.url));

/** Whether the case that holds a golden expects an error on Qwik (or on every target). */
function expectsErrors(golden: string): boolean {
  const caseDir = golden.slice(0, golden.indexOf("/__output__/"));
  const path = join(caseDir, "__expected__", "diagnostics.json");
  if (!existsSync(path)) return false;
  const diagnostics = JSON.parse(readFileSync(path, "utf8")) as {
    severity: string;
    target?: string;
  }[];
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      (diagnostic.target === undefined || diagnostic.target === "qwik"),
  );
}

/**
 * M5's types and generics cases (ADR-0067, ADR-0068), which Qwik emits from its types lane, layer
 * 25 of M5 (UXF-466): until then `harness/quarantine/qwik.ts` lists their failing cells, and the lane
 * brings them back here.
 */
const TYPES_LANE = /(?:^|\/)(?:types|generics|diagnostics\/generic-slot-props)\//;

/**
 * The absolute paths of the goldens matching `pattern` (from the repository's root), sorted, but
 * the scoped sheets (`<source>.css`), which the compile project parses instead (ADR-0063), and
 * the cases of its types lane (`TYPES_LANE`).
 */
export function goldens(pattern: string): string[] {
  return globSync(pattern, { cwd: repo })
    .toSorted()
    .map((file) => join(repo, file))
    .filter((file) => !file.endsWith(".css") && !expectsErrors(file) && !TYPES_LANE.test(file));
}
