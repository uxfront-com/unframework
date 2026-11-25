// The corpus's Qwik golden outputs that the toolchain tests check (L3, L4, L5). A case whose
// committed expected diagnostics hold an error for Qwik (a capability Qwik does not support, as
// UF4001) has no output: the harness skips its layers from L3 on (cases.ts `expectsErrors`), so
// these tests leave its golden out too.
import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../..", import.meta.url));

/** Whether the case that holds a golden expects an error on Qwik (or on every target). */
function expectsErrors(golden: string): boolean {
  const caseDir = golden.slice(0, golden.indexOf("/__output__/"));
  const path = join(caseDir, "__expected__", "diagnostics.json");
  if (!existsSync(path)) {
    return false;
  }
  const diagnostics = JSON.parse(readFileSync(path, "utf8")) as Array<{
    severity: string;
    target?: string;
  }>;
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      (diagnostic.target === undefined || diagnostic.target === "qwik"),
  );
}

/**
 * The absolute paths of the golden files matching `pattern` (from the repository's root), sorted,
 * but the scoped sheets (`<source>.css`), which the compile project parses instead (ADR-0063), and
 * the directories the pattern matches, such as a tree's `_unframework/` (ADR-0121).
 */
export function goldens(pattern: string): Array<string> {
  return globSync(pattern, { cwd: repo })
    .toSorted()
    .map((file) => join(repo, file))
    .filter((file) => !file.endsWith(".css") && statSync(file).isFile() && !expectsErrors(file));
}
