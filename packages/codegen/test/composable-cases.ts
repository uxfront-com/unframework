// The composable and shared-module cases each target's `composable` test compiles (ADR-0069,
// ADR-0070). They wait in `tests/integration/pending/` until every target's composables lane has
// landed, and then move into `cases/` in one change: the list names them by id, and each is read
// from wherever it is, so the tests keep working across the move. A listed case found in neither
// fails, and `pending/` is never listed, so its absence after the move is no error.
//
// The compiler is above codegen (plan §5.2): this test-only helper reaches it from its source, as
// the targets' test helpers do.
import { existsSync, readdirSync } from "node:fs";
import { readFile as readText } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { Diagnostic } from "@unframework/diagnostics";

import { compile, createFileResolver, createSyntacticOracle } from "../../compiler/src/index.ts";
import type { TargetName } from "../../compiler/src/index.ts";
import type { OutputFile } from "../src/index.ts";

/** The integration corpus's package directory. */
export const INTEGRATION_DIR: string = fileURLToPath(
  new URL("../../../tests/integration", import.meta.url),
);

/** The rendering cases of composables and shared modules, by id, `<area>/<case>`. */
export const COMPOSABLE_CASES: readonly string[] = [
  "composables/use-toggle",
  "composables/use-controllable-state",
  "composables/use-media-query",
  "composables/getter-argument",
  "composables/callback-argument",
  "modules/shared-constants",
  "modules/shared-helpers",
  "modules/module-constants",
  "modules/nested-modules",
  "semantics/composable-read-after-write",
  "semantics/composable-effect-order",
  "semantics/composable-unmount-order",
];

/** Where a case is: the directory it sits under (`pending/` or `cases/`) and its own. */
export interface CaseLocation {
  id: string;
  /** `tests/integration/pending` or `tests/integration/cases`, absolute. */
  root: string;
  /** The case's directory, absolute. */
  dir: string;
}

/**
 * Finds a case by id under `pending/`, then under `cases/`, checking each path rather than
 * listing a directory. Throws when it is in neither.
 */
export function locateCase(id: string, integrationDir: string = INTEGRATION_DIR): CaseLocation {
  for (const directory of ["pending", "cases"]) {
    const root = join(integrationDir, directory);
    const dir = join(root, id);
    if (existsSync(dir)) return { id, root, dir };
  }
  throw new Error(
    `The case ${id} is in neither tests/integration/pending/ nor tests/integration/cases/.`,
  );
}

/** One source of a case, compiled for one target. */
export interface CompiledSource {
  /** The source's path under its root, `composables/use-toggle/useToggle.uf.ts`. */
  filename: string;
  diagnostics: Diagnostic[];
  /** What the target emitted, the copied `.ts` modules included, as `compile()` returns it. */
  outputs: OutputFile[];
}

/** A case, each of its sources compiled for one target. */
export interface CompiledCase extends CaseLocation {
  sources: CompiledSource[];
}

/**
 * Compiles every source of each case (its `.uf.tsx` and `.uf.ts` files) for one target through
 * `compile()`, with a resolver and a syntactic type oracle that read the case's own files, and
 * the packages its sources import. The harness's resolver reads the case's files alone and
 * passes it the oracle (`caseResolver`); the outputs are the same for these cases.
 */
export async function compileComposableCases(
  target: TargetName,
  {
    ids = COMPOSABLE_CASES,
    integrationDir = INTEGRATION_DIR,
  }: { ids?: readonly string[]; integrationDir?: string } = {},
): Promise<CompiledCase[]> {
  const compiled: CompiledCase[] = [];
  for (const id of ids) {
    const location = locateCase(id, integrationDir);
    const root = location.root.split(sep).join("/");
    const readFile = async (path: string): Promise<string | undefined> => {
      const file = join(path);
      const inCase = relative(location.dir, dirname(file)) === "";
      if (!inCase && !file.split(sep).includes("node_modules")) return undefined;
      return readText(file, "utf8").catch(() => undefined);
    };
    const names = readdirSync(location.dir)
      .filter((name) => name.endsWith(".uf.tsx") || name.endsWith(".uf.ts"))
      .toSorted();
    const sources: CompiledSource[] = [];
    for (const name of names) {
      const filename = `${id}/${name}`;
      const result = await compile(await readText(join(location.dir, name), "utf8"), {
        filename,
        targets: [target],
        resolve: createFileResolver({ root, readFile }),
        typeOracle: createSyntacticOracle({ root, readFile }),
      });
      sources.push({
        filename,
        diagnostics: result.diagnostics,
        outputs: result.outputs[target] ?? [],
      });
    }
    compiled.push({ ...location, sources });
  }
  return compiled;
}
