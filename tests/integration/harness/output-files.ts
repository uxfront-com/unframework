// A case's output files for the tools that read them from the disk (L3, L4, L5 and L15): its
// committed `__output__/<target>/` tree, or, with a canary, a fresh compile of it.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { compile } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";
import { writeIfChanged } from "@unframework/testing/node";

import { canaryPlugins } from "./canaries.ts";
import { errorState } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
import { CANARY_DIR } from "./paths.ts";
import { caseOracle, caseResolver } from "./sources.ts";
import { toolchainFiles } from "./toolchain-results.ts";

/** A case's committed output files for a target, without its scoped sheets (`toolchainFiles`). */
export function committedOutputFiles(info: CaseInfo, target: string): string[] {
  const directory = join(info.dir, "__output__", target);
  return toolchainFiles(existsSync(directory) ? listFiles(directory) : []);
}

/**
 * Each case's output files: the committed `__output__/<target>/` tree, or, with a canary, a
 * fresh compile written to `.canary/<id>/<target>/cases/<case>/__output__/<target>/`. Scoped
 * sheets are left out (`toolchainFiles`), after a canary's are written: an output may read its
 * sheet from the disk (Angular's `styleUrl`).
 */
export async function outputFiles(
  cases: readonly CaseInfo[],
  target: string,
  casesDir: string,
  canary: string | null,
): Promise<Map<string, string[]>> {
  const files = new Map<string, string[]>();
  // A case whose expected diagnostics are missing fails its own test; check what it has.
  const checked = cases.filter((info) => errorState(info, target) !== true);
  if (!canary) {
    for (const info of checked) files.set(info.id, committedOutputFiles(info, target));
    return files;
  }
  // Each target's project writes its own tree: the projects run in parallel.
  const root = join(CANARY_DIR, canary, target);
  rmSync(root, { recursive: true, force: true });
  for (const info of checked) {
    // Every source of the case, as the compile project writes them into one tree (ADR-0057):
    // a parent's output imports its children's.
    const directory = join(root, "cases", info.id, "__output__", target);
    const paths: string[] = [];
    for (const source of info.sources) {
      const text = readFileSync(source.source, "utf8");
      const typeOracle = caseOracle(info, casesDir, { filename: source.filename, text });
      let result: Awaited<ReturnType<typeof compile>>;
      try {
        result = await compile(text, {
          filename: source.filename,
          targets: [target as TargetName],
          plugins: canaryPlugins(canary, target),
          resolve: caseResolver(info, casesDir, typeOracle),
          typeOracle,
        });
      } finally {
        await typeOracle.dispose();
      }
      for (const file of result.outputs[target] ?? []) {
        const path = join(directory, file.path);
        writeIfChanged(path, file.contents);
        paths.push(path);
      }
    }
    files.set(info.id, toolchainFiles(paths).sort());
  }
  return files;
}

function listFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true }) as string[])
    .map((entry) => join(directory, entry))
    .filter((path) => statSync(path).isFile())
    .sort();
}
